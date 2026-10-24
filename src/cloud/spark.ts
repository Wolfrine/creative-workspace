import { Bytes, collection, doc, getDocFromCache, getDocFromServer, getDocsFromServer, onSnapshot, runTransaction, type Firestore, type DocumentData } from 'firebase/firestore';
import type { CloudAdapter, CommitOperation, CommitResult, Original, Revision, WorkspaceSnapshot } from '../domain/model';
import { assertBody, fromBase64, sha256, stableStringify, toBase64 } from '../domain/codec';
import { linkIds, plainText } from '../domain/model';

const CHUNK = 192 * 1024;
const MAX_BLOB = 32 * 1024 * 1024;
const id = (value: string) => { if (!/^[A-Za-z0-9_-]{1,150}$/.test(value)) throw new Error('Invalid cloud record identity.'); return value; };
interface BlobRecord { sha256: string; size: number; encodedSize: number; encoding: 'raw' | 'gzip'; chunks: string[] }
interface CloudRevision { id: string; documentId: string; universeId: string; blobHash: string; contentHash: string; operationId: string; expectedHeadId: string | null; won: boolean }
interface CloudOriginal extends Omit<Original, 'bytesBase64'> { blobHash: string }
export class CloudDependencyPending extends Error {
  readonly code = 'cloud-dependency-pending';
  constructor() { super('A related cloud page is still being uploaded. Your device copy is retained.'); }
}

async function transform(bytes: Uint8Array, compress: boolean, limit = MAX_BLOB + 65536): Promise<Uint8Array> {
  const stream = compress ? new CompressionStream('gzip') : new DecompressionStream('gzip');
  const output = new Blob([bytes.slice().buffer]).stream().pipeThrough(stream);
  const reader = output.getReader(), parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    length += next.value.length;
    if (length > limit) { await reader.cancel(); throw new Error('Cloud source expands beyond its verified size limit.'); }
    parts.push(next.value);
  }
  const result = new Uint8Array(length); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

// Phase 1 has one trusted human writer. Firestore Rules enforce owner isolation,
// immutable evidence and atomic head transitions. The client verifies full content
// and provenance before merging it into the durable device workspace.
export function createFirestoreAdapter(db: Firestore, uid: string, checkSession: () => Promise<void> = async () => {}): CloudAdapter {
  id(uid);
  const root = 'noveliaaWorkspaces/' + uid + '/';
  const record = (kind: string, key: string) => doc(db, root + kind + '/' + id(key));
  const blobCache = new Map<string, Uint8Array>();
  const metadataCache = new Map<string, string>();
  const namespaces = ['documents', 'universes', 'collections', 'revisions', 'originals'] as const;
  let snapshots: Map<string, Map<string, DocumentData>> | undefined;
  let liveReady: Promise<void> | undefined;
  const immutableRead = async (kind: string, key: string) => {
    await checkSession();
    try { const cached = await getDocFromCache(record(kind, key)); if (cached.exists()) return cached; } catch { /* Absent/unavailable cache falls through to an authenticated server read. */ }
    return getDocFromServer(record(kind, key));
  };
  const read = async (kind: string, key: string) => { await checkSession(); return getDocFromServer(record(kind, key)); };
  const immutable = async (kind: string, key: string, value: DocumentData) => {
    await checkSession();
    await runTransaction(db, async transaction => {
      const reference = record(kind, key), previous = await transaction.get(reference);
      if (previous.exists()) {
        if (stableStringify(previous.data()) !== stableStringify(value)) throw new Error('Immutable cloud evidence differs. Your device copy is retained.');
      } else transaction.set(reference, value);
    });
  };
  const stage = async (bytes: Uint8Array): Promise<string> => {
    if (bytes.byteLength > MAX_BLOB) throw new Error('This revision exceeds the 32 MiB cloud limit. Its complete device copy and export remain available.');
    const hash = await sha256(bytes);
    if (blobCache.has(hash)) return hash;
    if ((await read('blobs', hash)).exists()) { await readBlob(hash); return hash; }
    const compressed = typeof CompressionStream !== 'undefined' ? await transform(bytes, true) : bytes;
    const encoded = compressed.length < bytes.length ? compressed : bytes;
    const encoding = encoded === compressed && compressed !== bytes ? 'gzip' : 'raw';
    const chunks: string[] = [];
    for (let offset = 0; offset < encoded.length; offset += CHUNK) {
      const part = encoded.slice(offset, offset + CHUNK), chunkHash = await sha256(part);
      await checkSession();
      await runTransaction(db, async transaction => {
        const reference = record('chunks', chunkHash), previous = await transaction.get(reference);
        if (previous.exists()) {
          const actual = previous.data().bytes?.toUint8Array();
          if (!(actual instanceof Uint8Array) || actual.length !== part.length || await sha256(actual) !== chunkHash) throw new Error('Cloud source chunk failed verification.');
        } else transaction.set(reference, { sha256: chunkHash, bytes: Bytes.fromUint8Array(part) });
      });
      chunks.push(chunkHash);
    }
    await immutable('blobs', hash, { sha256: hash, size: bytes.length, encodedSize: encoded.length, encoding, chunks });
    // A server readback, rather than a queued SDK write, earns an upload cache entry.
    const verified = await readBlob(hash, true);
    if (await sha256(verified) !== hash) throw new Error('Cloud byte readback failed.');
    return hash;
  };
  const readBlob = async (hash: string, forceServer = false): Promise<Uint8Array> => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid cloud source digest.');
    const cached = blobCache.get(hash); if (cached && !forceServer) return cached.slice();
    try {
    const fetch = forceServer ? read : immutableRead;
    const source = await fetch('blobs', hash);
    if (!source.exists()) throw new Error('Cloud source is incomplete. Local writing was not replaced.');
    const manifest = source.data() as BlobRecord;
    if (manifest.sha256 !== hash || !Number.isInteger(manifest.size) || manifest.size < 0 || manifest.size > MAX_BLOB || !Number.isInteger(manifest.encodedSize) || manifest.encodedSize < 0 || manifest.encodedSize > MAX_BLOB || !['raw', 'gzip'].includes(manifest.encoding) || !Array.isArray(manifest.chunks) || manifest.chunks.length !== Math.ceil(manifest.encodedSize / CHUNK)) throw new Error('Invalid cloud source manifest.');
    const encoded = new Uint8Array(manifest.encodedSize);
    let offset = 0;
    for (const chunkHash of manifest.chunks) {
      const chunk = await fetch('chunks', chunkHash), part = chunk.data()?.bytes?.toUint8Array();
      if (!(part instanceof Uint8Array) || part.length !== Math.min(CHUNK, encoded.length - offset) || await sha256(part) !== chunkHash) throw new Error('Immutable cloud source failed its byte digest.');
      encoded.set(part, offset); offset += part.length;
    }
    const bytes = manifest.encoding === 'gzip' ? await transform(encoded, false, manifest.size) : encoded;
    if (bytes.length !== manifest.size || await sha256(bytes) !== hash) throw new Error('Cloud source integrity failed. Local writing has not been replaced.');
    blobCache.set(hash, bytes); return bytes.slice();
    } catch (error) { if (!forceServer) return readBlob(hash, true); throw error; }
  };
  const mutableCatalogEntry = async (kind: 'universes' | 'collections', value: DocumentData & { id: string }) => {
    const fingerprint = stableStringify(value), key = kind + '/' + value.id;
    if (metadataCache.get(key) === fingerprint) return;
    await checkSession();
    await runTransaction(db, async transaction => {
      const reference = record(kind, value.id), previous = await transaction.get(reference);
      if (previous.exists() && (kind === 'universes' ? previous.data().createdAt !== value.createdAt : previous.data().universeId !== value.universeId)) throw new Error('An existing organization identity cannot be replaced or moved.');
      if (!previous.exists() || stableStringify(previous.data()) !== fingerprint) transaction.set(reference, value);
    });
    metadataCache.set(key, fingerprint);
  };
  return {
    watch(onChange, onError) {
      if (snapshots) throw new Error('The writing listener is already attached.');
      const current = new Map<string, Map<string, DocumentData>>(); snapshots = current;
      let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
      liveReady = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      void liveReady.catch(() => {});
      let stopped = false, notifyTimer: ReturnType<typeof setTimeout> | undefined;
      const stops = namespaces.map(kind => onSnapshot(collection(db, root + kind), { includeMetadataChanges: true }, snapshot => {
        // The SDK emits cached/optimistic snapshots too. Only server-confirmed
        // metadata can advance cloud heads or create a cloud receipt.
        if (stopped || snapshot.metadata.fromCache) return;
        const previous = current.get(kind), confirmed = new Map<string, DocumentData>();
        for (const item of snapshot.docs) {
          if (!item.metadata.hasPendingWrites) confirmed.set(item.id, item.data());
          else if (previous?.has(item.id)) confirmed.set(item.id, previous.get(item.id)!);
        }
        current.set(kind, confirmed);
        if (current.size === namespaces.length) {
          resolveReady(); clearTimeout(notifyTimer);
          notifyTimer = setTimeout(() => { if (!stopped) onChange(); }, 120);
        }
      }, error => { if (!stopped) { rejectReady(error); onError(error); } }));
      return () => { stopped = true; clearTimeout(notifyTimer); stops.forEach(stop => stop()); if (snapshots === current) { snapshots = undefined; liveReady = undefined; } rejectReady(new Error('Writing listener closed.')); };
    },
    async load(known) {
      await checkSession();
      // Read heads first. Their immutable revisions and originals already exist
      // atomically; later unrelated writes cannot create dangling loaded heads.
      let heads: Map<string, DocumentData>, worlds: Map<string, DocumentData>, groups: Map<string, DocumentData>, storedRevisions: Map<string, DocumentData>, storedOriginals: Map<string, DocumentData>;
      if (snapshots && liveReady) {
        const current = snapshots; await liveReady; await checkSession();
        [heads, worlds, groups, storedRevisions, storedOriginals] = namespaces.map(kind => new Map(current.get(kind)!));
      } else {
        const rows = async (kind: string) => new Map((await getDocsFromServer(collection(db, root + kind))).docs.map(item => [item.id, item.data()]));
        heads = await rows('documents');
        [worlds, groups, storedRevisions, storedOriginals] = await Promise.all(['universes', 'collections', 'revisions', 'originals'].map(rows));
      }
      const knownRevisions = new Map((known?.revisions ?? []).map(revision => [revision.id, revision]));
      const knownOriginals = new Map((known?.originals ?? []).map(original => [original.id, original]));
      const ensure = async (kind: string, key: string, rows: Map<string, DocumentData>) => {
        if (!rows.has(key)) { const missing = await read(kind, key); if (!missing.exists()) { if (snapshots && kind === 'documents') throw new CloudDependencyPending(); throw new Error('Cloud writing dependency is unavailable. Your device copy is retained.'); } rows.set(key, missing.data()); }
        return rows.get(key)!;
      };
      // Collection listeners are independent. A head can arrive before its
      // revision/source/catalog event; fetch only those missing dependencies.
      const revisionIndex = new Map<string, Revision>();
      const revisionQueue = [...storedRevisions].filter(([, value]) => heads.has(value.documentId)).map(([key]) => key);
      revisionQueue.push(...[...heads.values()].map(head => head.headRevisionId));
      for (let offset = 0; offset < revisionQueue.length; offset++) {
        const key = revisionQueue[offset]; if (revisionIndex.has(key)) continue;
        const metadata = await ensure('revisions', key, storedRevisions) as CloudRevision;
        const existing = knownRevisions.get(key);
        const revision: Revision = existing && await sha256(stableStringify(existing)) === metadata.blobHash
          ? existing : JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBlob(metadata.blobHash)));
        if (revision.id !== key || revision.documentId !== metadata.documentId || revision.universeId !== metadata.universeId || revision.contentHash !== metadata.contentHash || await sha256(stableStringify(revision.snapshot)) !== revision.contentHash) throw new Error('Cloud revision identity or digest mismatch.');
        revisionIndex.set(key, revision); revisionQueue.push(...revision.parentIds, ...(revision.restoredFrom ? [revision.restoredFrom] : []));
        for (const target of linkIds(revision.snapshot.body)) {
          const discovered = !heads.has(target), head = await ensure('documents', target, heads); revisionQueue.push(head.headRevisionId);
          if (discovered) revisionQueue.push(...[...storedRevisions].filter(([, value]) => value.documentId === target).map(([key]) => key));
        }
        for (const source of revision.snapshot.sourceOriginalIds) await ensure('originals', source, storedOriginals);
      }
      const revisions = [...revisionIndex.values()];
      const originals: Original[] = [];
      for (const [key, item] of storedOriginals) {
        const { blobHash, ...original } = item as CloudOriginal;
        if (original.id !== key || original.sha256 !== blobHash) throw new Error('Cloud original metadata differs from its source.');
        const existing = knownOriginals.get(key);
        const { bytesBase64: _, ...existingMetadata } = existing ?? {};
        originals.push(existing && stableStringify(existingMetadata) === stableStringify(original)
          ? existing : { ...original, bytesBase64: toBase64(await readBlob(blobHash)) });
      }
      const documents = [...heads].map(([key, head]) => {
        const revision = revisionIndex.get(head.headRevisionId);
        if (revision && (revision.documentId !== key || revision.universeId !== head.universeId)) throw new Error('Cloud writing identity differs from its revision.');
        if (!revision) throw new Error('Cloud writing points to a missing revision.');
        return { ...revision.snapshot, headRevisionId: revision.id };
      });
      for (const document of documents) if (document.collectionId) await ensure('collections', document.collectionId, groups);
      for (const value of [...documents, ...originals, ...groups.values()]) await ensure('universes', value.universeId, worlds);
      for (const [key, value] of [...worlds].map(([key, value]) => ['universes/' + key, value] as const).concat([...groups].map(([key, value]) => ['collections/' + key, value] as const))) metadataCache.set(key, stableStringify(value));
      return { schemaVersion: 1, accountId: uid, universes: [...worlds.values()] as WorkspaceSnapshot['universes'], collections: [...groups.values()] as WorkspaceSnapshot['collections'], documents, revisions, originals, receipts: revisions.map(revision => ({ revisionId: revision.id, level: 'cloud' as const, at: revision.createdAt })) };
    },
    async putCatalog(universes, collections) {
      for (const universe of universes) await mutableCatalogEntry('universes', universe);
      for (const group of collections) await mutableCatalogEntry('collections', group);
    },
    async registerDocuments(documents) {
      for (const identity of documents) {
        const key = 'documentIdentities/' + identity.id, fingerprint = stableStringify(identity);
        if (metadataCache.get(key) === fingerprint) continue;
        await immutable('documentIdentities', identity.id, identity);
        metadataCache.set(key, fingerprint);
      }
    },
    async putOriginal(original) {
      const key = 'originals/' + original.id, fingerprint = stableStringify(original);
      if (metadataCache.get(key) === fingerprint) return;
      const bytes = fromBase64(original.bytesBase64);
      if (await sha256(bytes) !== original.sha256) throw new Error('Original byte digest mismatch. Nothing was uploaded.');
      const blobHash = await stage(bytes), { bytesBase64: _, ...metadata } = original;
      await immutable('originals', original.id, { ...metadata, blobHash });
      metadataCache.set(key, fingerprint);
    },
    async commit(operation: CommitOperation): Promise<CommitResult> {
      const revision = operation.revision; id(operation.operationId); id(revision.id); id(revision.documentId); id(revision.universeId);
      assertBody(revision.snapshot.body);
      if (revision.snapshot.id !== revision.documentId || revision.snapshot.universeId !== revision.universeId || plainText(revision.snapshot.body) !== revision.snapshot.plainText || await sha256(stableStringify(revision.snapshot)) !== revision.contentHash || revision.parentIds.length > 10 || new Set(revision.parentIds).size !== revision.parentIds.length || revision.parentIds.includes(revision.id)) throw new Error('Invalid writing revision. The device copy is retained.');
      const fingerprint = await sha256(stableStringify(operation));
      const prior = await read('operations', operation.operationId);
      if (prior.exists()) { if (prior.data().fingerprint !== fingerprint) throw new Error('A committed operation cannot be changed.'); return prior.data().result as CommitResult; }
      const blobHash = await stage(new TextEncoder().encode(stableStringify(revision)));
      await checkSession();
      let observedHead: string | null | undefined;
      const attemptCommit = () => runTransaction(db, async transaction => {
        const opRef = record('operations', operation.operationId), headRef = record('documents', revision.documentId), revRef = record('revisions', revision.id);
        const [priorOp, head, priorRevision, identity] = await Promise.all([opRef, headRef, revRef, record('documentIdentities', revision.documentId)].map(reference => transaction.get(reference)));
        if (priorOp.exists()) { if (priorOp.data().fingerprint !== fingerprint) throw new Error('A committed operation cannot be changed.'); return priorOp.data().result as CommitResult; }
        if (priorRevision.exists()) throw new Error('An immutable revision ID already exists.');
        if (!identity.exists() || identity.data().universeId !== revision.universeId || head.exists() && head.data().universeId !== revision.universeId) throw new Error('Writing identity belongs to a different universe.');
        const parents = await Promise.all(revision.parentIds.map(parent => transaction.get(record('revisions', parent))));
        if (parents.some(parent => !parent.exists() || parent.data().documentId !== revision.documentId || parent.data().universeId !== revision.universeId)) throw new Error('Broken revision ancestry.');
        for (const sourceId of revision.snapshot.sourceOriginalIds) {
          const source = await transaction.get(record('originals', sourceId));
          if (!source.exists() || source.data().universeId !== revision.universeId) throw new Error('Original source is absent or belongs to another universe.');
        }
        for (const targetId of linkIds(revision.snapshot.body)) {
          const target = await transaction.get(record('documentIdentities', targetId));
          if (!target.exists() || target.data().universeId !== revision.universeId) throw new Error('Link belongs to missing writing or another universe.');
        }
        if (revision.restoredFrom) {
          const source = await transaction.get(record('revisions', revision.restoredFrom));
          if (!source.exists() || source.data().documentId !== revision.documentId) throw new Error('Restoration source is unavailable.');
          const restored: Revision = JSON.parse(new TextDecoder().decode(await readBlob(source.data().blobHash)));
          if (stableStringify(restored.snapshot.body) !== stableStringify(revision.snapshot.body) || restored.snapshot.origin !== revision.snapshot.origin || stableStringify(restored.snapshot.sourceOriginalIds) !== stableStringify(revision.snapshot.sourceOriginalIds)) throw new Error('Restoration must preserve the source text and provenance.');
        }
        const currentHead = head.exists() ? head.data().headRevisionId as string : null;
        observedHead = currentHead;
        const won = currentHead === operation.expectedHeadId;
        const result: CommitResult = { status: won ? 'synced' : 'conflict', headRevisionId: won ? revision.id : currentHead };
        transaction.set(revRef, { id: revision.id, documentId: revision.documentId, universeId: revision.universeId, contentHash: revision.contentHash, blobHash, operationId: operation.operationId, expectedHeadId: operation.expectedHeadId, won });
        transaction.set(opRef, { id: operation.operationId, revisionId: revision.id, documentId: revision.documentId, fingerprint, expectedHeadId: operation.expectedHeadId, result });
        if (won) transaction.set(headRef, { id: revision.documentId, universeId: revision.universeId, headRevisionId: revision.id, operationId: operation.operationId });
        return result;
      });
      // Security Rules can reject an optimistic stale-head commit before the
      // SDK reports its version precondition. Retry only a proven head race;
      // authorisation/schema failures remain failures and never earn a receipt.
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await attemptCommit(); }
        catch (error) {
          if (attempt === 2 || observedHead === undefined || (error as { code?: string }).code !== 'permission-denied') throw error;
          const fresh = await read('documents', revision.documentId);
          if ((fresh.exists() ? fresh.data().headRevisionId : null) === observedHead) throw error;
        }
      }
      throw new Error('Concurrent writing is still changing. The complete local revision is retained; retry sync.');
    },
  };
}
