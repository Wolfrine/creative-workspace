import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { createFirestoreAdapter } from './spark';
import type { CloudAdapter, Session } from '../domain/model';


interface FirebaseClient { auth: Auth; db: Firestore }
let pendingClient: Promise<FirebaseClient | null> | undefined;
let initialized: FirebaseClient | null = null;
let emulatorConnected = false;
const activeWorkspaces = new Map<string, string>();
const workspaceKey = (value: unknown, uid: string): string => {
  const key = value === undefined ? uid : value;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(key)) throw new Error('The private workspace configuration is invalid.');
  return key;
};
const accessCacheKey = (client: FirebaseClient, uid: string) => 'noveliaa-author-access:' + client.auth.app.options.projectId + ':' + uid;
function rememberAccess(client: FirebaseClient, uid: string, workspaceId: string) {
  activeWorkspaces.set(uid, workspaceId);
  try { localStorage.setItem(accessCacheKey(client, uid), JSON.stringify({ workspaceId })); } catch { /* Device checkpoint errors have their own visible path. */ }
}
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
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error('Firebase public configuration is incomplete. The private workspace requires verified Firebase setup.');
  try { localStorage.setItem(cacheKey, JSON.stringify(config)); } catch { /* Storage failure is surfaced by the writing checkpoint layer. */ }
  return config;
}
export async function initializeFirebaseSession(): Promise<FirebaseClient | null> {
  if (!pendingClient) pendingClient = (async () => {
    const config = await readFirebaseConfig();
    if (!config) return null;
    const app = getApps().length ? getApp() : initializeApp(config);
    // The SDK cache shares query targets across tabs. DeviceDatabase still owns
    // acknowledged writing and its outbox; cached snapshots are not cloud receipts.
    const client = { auth: getAuth(app), db: initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) };
    if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
      if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Firebase emulators are restricted to local development.');
      if (!emulatorConnected) {
        connectAuthEmulator(client.auth, 'http://127.0.0.1:19099', { disableWarnings: true });
        connectFirestoreEmulator(client.db, '127.0.0.1', 18080);
        emulatorConnected = true;
      }
    }
    initialized = client;
    return client;
  })();
  return pendingClient;
}
export const firebaseAuth = (): Auth | null => initialized?.auth ?? null;
export async function verifyAuthorAccess(uid: string): Promise<string> {
  const client = await initializeFirebaseSession();
  if (!client || client.auth.currentUser?.uid !== uid) throw new Error('Your signed-in account changed.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      const cached = localStorage.getItem(accessCacheKey(client, uid));
      if (cached) {
        const key = cached === 'verified' ? uid : workspaceKey(JSON.parse(cached).workspaceId, uid);
        activeWorkspaces.set(uid, key); return key;
      }
    } catch { /* Unreadable access evidence requires online verification. */ }
    throw new Error('Sign in online once to verify this device for your private writing.');
  }
  const access = await getDocFromServer(doc(client.db, 'noveliaaConfig/access')).catch(error => {
    if (error.code === 'permission-denied') throw new Error('This Google account does not have author access to this workspace. Choose your authorized author account.');
    throw error;
  });
  if (!access.exists() || access.data().ownerUid !== uid) throw new Error('This Google account does not have author access to this workspace.');
  const key = workspaceKey(access.data().workspaceId, uid);
  rememberAccess(client, uid, key);
  return key;
}
// Cached access opens acknowledged writing offline. Only a server-confirmed
// config event can switch the live workspace, isolating retired device outboxes.
export function watchAuthorAccess(uid: string, onWorkspaceId: (workspaceId: string) => void, onError: (error: Error) => void): () => void {
  const client = initialized;
  if (!client) throw new Error('Firebase session has not been initialized.');
  return onSnapshot(doc(client.db, 'noveliaaConfig/access'), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites || client.auth.currentUser?.uid !== uid) return;
    try {
      if (!snapshot.exists() || snapshot.data().ownerUid !== uid) throw new Error('This Google account no longer has author access to this workspace.');
      const key = workspaceKey(snapshot.data().workspaceId, uid);
      rememberAccess(client, uid, key); onWorkspaceId(key);
    } catch (error) { activeWorkspaces.delete(uid); onError(error instanceof Error ? error : new Error(String(error))); }
  }, error => { activeWorkspaces.delete(uid); onError(error); });
}
export async function signInWithGoogle(): Promise<Session> {
  const client = await initializeFirebaseSession();
  if (!client) throw new Error('Cloud sign-in is not configured. Complete the verified Firebase setup before opening the private workspace.');
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(client.auth, provider);
  const workspaceId = await verifyAuthorAccess(user.uid);
  return { uid: user.uid, workspaceId, displayName: user.displayName || user.email || 'Author', localOnly: false, signOut: signOutFirebase };
}
export async function signOutFirebase(): Promise<void> {
  const client = await initializeFirebaseSession();
  if (client) await signOut(client.auth);
}
export function createCloudAdapter(uid: string, workspaceId = uid): CloudAdapter {
  if (!initialized) throw new Error('Firebase session has not been initialized.');
  return createFirestoreAdapter(initialized.db, uid, async () => {
    if (!initialized || initialized.auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Writing remains in its original device workspace.');
    if (activeWorkspaces.get(uid) !== workspaceId) throw new Error('This workspace was reset. Reopen the current workspace before syncing.');
  }, workspaceId);
}
