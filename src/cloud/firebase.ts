import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import type { CloudAdapter, CommitOperation, CommitResult, Original, Revision, Session, WorkspaceSnapshot } from '../domain/model';
import { stableStringify } from '../domain/codec';

interface FirebaseClient { auth: Auth; functions: Functions; storage: FirebaseStorage }
let pendingClient: Promise<FirebaseClient | null> | undefined;
let initialized: FirebaseClient | null = null;
let emulatorConnected = false;
export async function readFirebaseConfig(): Promise<FirebaseOptions | null> {
  const cacheKey = 'noveliaa-public-firebase-config-v1';
  const configured = import.meta.env.VITE_FIREBASE_CONFIG;
  let config: FirebaseOptions;
  if (configured) {
    try { config = JSON.parse(configured); } catch { throw new Error('Firebase configuration is invalid. The private workspace requires verified Firebase setup.'); }
  } else {
    try {
      const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error('Public Firebase configuration is unavailable.');
      config = await response.json();
    } catch {
      // Hosting discovery must not become an online prerequisite for reopening
      // acknowledged writing. Only public web configuration is cached here.
      try { const cached = localStorage.getItem(cacheKey); if (!cached) return null; config = JSON.parse(cached); }
      catch { return null; }
    }
  }
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.storageBucket || !config.appId) throw new Error('Firebase public configuration is incomplete. The private workspace requires verified Firebase setup.');
  try { localStorage.setItem(cacheKey, JSON.stringify(config)); } catch { /* Storage failure is surfaced by the writing checkpoint layer. */ }
  return config;
}
export async function initializeFirebaseSession(): Promise<FirebaseClient | null> {
  if (!pendingClient) pendingClient = (async () => {
    const config = await readFirebaseConfig();
    if (!config) return null;
    const app = getApps().length ? getApp() : initializeApp(config);
    const client = { auth: getAuth(app), functions: getFunctions(app, import.meta.env.VITE_FIREBASE_REGION || 'asia-south1'), storage: getStorage(app) };
    if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
      if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Firebase emulators are restricted to local development.');
      if (!emulatorConnected) {
        connectAuthEmulator(client.auth, 'http://127.0.0.1:19099', { disableWarnings: true });
        connectFunctionsEmulator(client.functions, '127.0.0.1', 15001);
        connectStorageEmulator(client.storage, '127.0.0.1', 19199);
        emulatorConnected = true;
      }
    }
    initialized = client;
    return client;
  })();
  return pendingClient;
}
export const firebaseAuth = (): Auth | null => initialized?.auth ?? null;
export async function signInWithGoogle(): Promise<Session> {
  const client = await initializeFirebaseSession();
  if (!client) throw new Error('Cloud sign-in is not configured. Complete the verified Firebase setup before opening the private workspace.');
  const { user } = await signInWithPopup(client.auth, new GoogleAuthProvider());
  return { uid: user.uid, displayName: user.displayName || user.email || 'Author', localOnly: false, signOut: signOutFirebase };
}
export async function signOutFirebase(): Promise<void> {
  const client = await initializeFirebaseSession();
  if (client) await signOut(client.auth);
}
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
interface BlobReference { path: string; sha256: string; generation: string; size: number }
interface StoredRevision { id: string; documentId: string; universeId: string; contentHash: string; blob: BlobReference }
interface StoredOriginal extends Omit<Original, 'bytesBase64'> { blob: BlobReference }
interface WorkspaceResponse {
  schemaVersion: number; accountId: string;
  catalog: { universes: WorkspaceSnapshot['universes']; collections: WorkspaceSnapshot['collections'] };
  heads: { id: string; universeId: string; headRevisionId: string }[];
  revisions: StoredRevision[]; originals: StoredOriginal[];
}
const toBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 32768) parts.push(String.fromCharCode(...bytes.subarray(start, start + 32768)));
  return btoa(parts.join(''));
};
export function createCloudAdapter(uid: string): CloudAdapter {
  const uploaded = new Set<string>();
  const preservedOriginals = new Map<string, string>();
  const revisionCache = new Map<string, { digest: string; revision: Revision }>();
  const originalCache = new Map<string, { digest: string; bytesBase64: string }>();
  let catalogFingerprint = '';
  const registeredDocuments = new Map<string, string>();
  const context = async () => {
    const client = await initializeFirebaseSession();
    if (!client || !uid || client.auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Writing remains in its original device workspace.');
    return client;
  };
  const call = async <T>(name: string, data?: unknown): Promise<T> => {
    const client = await context();
    return (await httpsCallable<unknown, T>(client.functions, name)(data)).data;
  };
  const stage = async (bytes: Uint8Array, expectedDigest?: string) => {
    const client = await context();
    const sha256 = await digest(bytes);
    if (expectedDigest && expectedDigest !== sha256) throw new Error('Original byte digest mismatch. Nothing was uploaded.');
    if (uploaded.has(sha256)) return { sha256 };
    const object = ref(client.storage, `noveliaaWorkspaces/${uid}/staging/${sha256}`);
    try { await uploadBytes(object, bytes, { contentType: 'application/octet-stream', customMetadata: { sha256 } }); }
    catch (error) {
      // Staging objects are create-only. A retry may encounter the already-uploaded
      // immutable object; verify its actual bytes rather than trusting metadata.
      let existing: ArrayBuffer;
      try { existing = await getBytes(object, 32 * 1024 * 1024); } catch { throw error; }
      if (await digest(new Uint8Array(existing)) !== sha256) throw error;
    }
    uploaded.add(sha256);
    return { sha256 };
  };
  const readBlob = async (reference: BlobReference) => {
    if (!reference.path.startsWith(`noveliaaWorkspaces/${uid}/blobs/`) || !reference.generation || !/^[a-f0-9]{64}$/.test(reference.sha256)) throw new Error('Unexpected cloud source reference.');
    const client = await context();
    const bytes = new Uint8Array(await getBytes(ref(client.storage, reference.path), 32 * 1024 * 1024));
    if (bytes.length !== reference.size || await digest(bytes) !== reference.sha256) throw new Error('Cloud source integrity failed. Local writing has not been replaced.');
    return bytes;
  };
  return {
    async load() {
      const result = await call<WorkspaceResponse>('loadWorkspace');
      if (result.schemaVersion !== 1 || result.accountId !== uid) throw new Error('Unsupported or mismatched cloud workspace.');
      // Bound concurrent downloads: large manuscripts must not start hundreds of requests.
      const revisions: Revision[] = [];
      for (const stored of result.revisions) {
        const cached = revisionCache.get(stored.id);
        if (cached) {
          if (cached.digest !== stored.blob.sha256) throw new Error('An immutable cloud revision was changed.');
          revisions.push(structuredClone(cached.revision)); continue;
        }
        const revision: Revision = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBlob(stored.blob)));
        if (revision.id !== stored.id || revision.documentId !== stored.documentId || revision.universeId !== stored.universeId || revision.contentHash !== stored.contentHash || await digest(new TextEncoder().encode(stableStringify(revision.snapshot))) !== revision.contentHash) throw new Error('Cloud revision identity or content digest mismatch.');
        revisions.push(revision);
        revisionCache.set(revision.id, { digest: stored.blob.sha256, revision: structuredClone(revision) });
      }
      const originals: Original[] = [];
      for (const stored of result.originals) {
        const { blob, ...original } = stored;
        const cached = originalCache.get(original.id);
        if (cached && cached.digest !== blob.sha256) throw new Error('Immutable original source bytes were changed.');
        const bytesBase64 = cached?.bytesBase64 ?? toBase64(await readBlob(blob));
        originalCache.set(original.id, { digest: blob.sha256, bytesBase64 });
        // Explicitly project known metadata; Firestore's internal fields never leak
        // into archives and cannot be resubmitted as source provenance.
        originals.push({ id: original.id, universeId: original.universeId, name: original.name, sha256: original.sha256, origin: original.origin, verification: original.verification, sourceReference: original.sourceReference, createdAt: original.createdAt, ...(original.speakerSegments ? { speakerSegments: original.speakerSegments } : {}), bytesBase64 });
      }
      const documents = result.heads.map(head => {
        const revision = revisions.find(item => item.id === head.headRevisionId && item.documentId === head.id && item.universeId === head.universeId);
        if (!revision) throw new Error('Cloud document points to missing writing.');
        return { ...revision.snapshot, headRevisionId: revision.id };
      });
      return { schemaVersion: 1, accountId: uid, universes: result.catalog.universes, collections: result.catalog.collections, documents, revisions, originals, receipts: revisions.map(revision => ({ revisionId: revision.id, level: 'cloud' as const, at: revision.createdAt })) };
    },
    async commit(operation: CommitOperation) {
      const blob = await stage(new TextEncoder().encode(stableStringify(operation.revision)));
      const result = await call<CommitResult>('commitWriting', { ...operation, blob });
      revisionCache.set(operation.revision.id, { digest: blob.sha256, revision: structuredClone(operation.revision) });
      return result;
    },
    async putOriginal(original) {
      await context();
      const { bytesBase64, ...metadata } = original;
      const fingerprint = stableStringify(original);
      if (preservedOriginals.get(original.id) === fingerprint) return;
      const bytes = Uint8Array.from(atob(bytesBase64), character => character.charCodeAt(0));
      const blob = await stage(bytes, original.sha256);
      await call('preserveOriginal', { original: metadata, blob });
      preservedOriginals.set(original.id, fingerprint);
    },
    async putCatalog(universes, collections) {
      await context();
      const fingerprint = stableStringify({ universes, collections });
      if (fingerprint === catalogFingerprint) return;
      await call('saveCatalog', { universes, collections });
      catalogFingerprint = fingerprint;
    },
    async registerDocuments(documents) {
      await context();
      const needed = documents.filter(document => registeredDocuments.get(document.id) !== document.universeId);
      if (!needed.length) return;
      // Firestore transaction and callable payload limits stay bounded on a large
      // restored library. Repeating a completed chunk is harmless.
      for (let start = 0; start < needed.length; start += 200) {
        const chunk = needed.slice(start, start + 200);
        await call('registerDocumentIdentities', { documents: chunk });
        chunk.forEach(document => registeredDocuments.set(document.id, document.universeId));
      }
    },
  };
}
