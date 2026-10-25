import type { Collection, CollectionRename, CollectionRenameResult, CommitOperation, Original, Revision, SaveReceipt, WorkspaceSnapshot, WritingDocument } from '../domain/model';
import { assertCollectionMetadata, stableStringify } from '../domain/codec';

export interface PendingOperation extends CommitOperation { status: 'pending' | 'conflict'; resolves?: string[] }
export interface RecoveryDraft { id: string; generation: number; editedAt: number; document: WritingDocument }
export interface PendingCollectionRename extends CollectionRename { id: string; editedAt: number; conflict?: Collection }
const renameKey = (id: string) => 'collectionRename:' + id;
const sameName = (a: Collection, b: Collection) => a.id === b.id && a.universeId === b.universeId && a.name === b.name && stableStringify(a.nameVersion) === stableStringify(b.nameVersion);
const stores = ['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts', 'outbox', 'preferences', 'drafts'] as const;
export type StoreName = typeof stores[number];
export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('Device storage failed.')); });
}
export function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error ?? new Error('Device save interrupted.')); transaction.onerror = () => reject(transaction.error ?? new Error('Device storage failed.')); });
}
export class DeviceDatabase {
  private constructor(readonly db: IDBDatabase, readonly accountId: string) {}
  static async open(accountId: string, workspaceId = accountId): Promise<DeviceDatabase> {
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(accountId) || !/^[A-Za-z0-9_-]{1,150}$/.test(workspaceId)) throw new Error('Invalid device workspace identity.');
    const name = 'noveliaa-writing-v1-' + accountId + (workspaceId === accountId ? '' : ':' + workspaceId);
    // This authorized first reset retires the legacy UID store. Never enumerate
    // and delete other named scopes: delayed access checks or stale offline
    // access evidence must not erase newer writing in a different scope.
    if (workspaceId !== accountId && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      const deletion = indexedDB.deleteDatabase('noveliaa-writing-v1-' + accountId);
      // Other open tabs close through onversionchange. A blocked obsolete tab
      // cannot block opening the new store, and Rules reject its cloud writes.
      void request(deletion).catch(() => {});
    }
    const req = indexedDB.open(name, 2);
    req.onupgradeneeded = () => { for (const name of stores) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: name === 'receipts' ? 'key' : 'id' }); };
    const db = await request(req);
    db.onversionchange = () => db.close();
    return new DeviceDatabase(db, accountId);
  }
  transaction(names: StoreName[]): IDBTransaction {
    try { return this.db.transaction(names, 'readwrite', { durability: 'strict' }); }
    catch { return this.db.transaction(names, 'readwrite'); }
  }
  async all<T>(name: StoreName): Promise<T[]> { return request(this.db.transaction(name).objectStore(name).getAll()); }
  async snapshot(): Promise<WorkspaceSnapshot> {
    const tx = this.db.transaction(['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts']);
    const rows = await Promise.all(['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts'].map(name => request(tx.objectStore(name).getAll())));
    return { schemaVersion: 1, accountId: this.accountId, documents: rows[0], revisions: rows[1], originals: rows[2], universes: rows[3], collections: rows[4], receipts: rows[5].map(({ key: _, ...value }) => value) };
  }
  async getPreference<T>(id: string): Promise<T | undefined> { return (await request(this.db.transaction('preferences').objectStore('preferences').get(id)))?.value; }
  async setPreference(id: string, value: unknown): Promise<void> { const tx = this.transaction(['preferences']); const done = completed(tx); tx.objectStore('preferences').put({ id, value }); await done; }
  async saveDraft(draft: RecoveryDraft): Promise<void> {
    const tx = this.transaction(['drafts']); const done = completed(tx);
    // Each engine owns a separate draft key. A simultaneous tab can never
    // overwrite another tab's uncheckpointed words.
    tx.objectStore('drafts').put(draft); await done;
  }
  async discardDraft(id: string, generation: number): Promise<void> {
    const tx = this.transaction(['drafts']); const done = completed(tx);
    const prior = await request<RecoveryDraft | undefined>(tx.objectStore('drafts').get(id));
    if (prior && prior.generation <= generation) tx.objectStore('drafts').delete(id);
    await done;
  }
  async checkpoint(doc: WritingDocument, revision: Revision, operation: PendingOperation, expectedLocalHead: string | null, draft?: Pick<RecoveryDraft, 'id' | 'generation'>): Promise<boolean> {
    const tx = this.transaction(['documents', 'revisions', 'receipts', 'outbox', 'preferences', 'universes', 'drafts']); const done = completed(tx);
    const prior = await request<WritingDocument | undefined>(tx.objectStore('documents').get(doc.id));
    const universe = await request(tx.objectStore('universes').get(doc.universeId));
    if (!universe) { tx.abort(); await done.catch(() => {}); throw new Error('The workspace changed in another tab. This text has not been acknowledged. Export the open text, then reopen the workspace.'); }
    const conflict = !!prior && prior.headRevisionId !== expectedLocalHead;
    if (conflict) tx.objectStore('preferences').put({ id: 'conflict:' + doc.id, value: true });
    tx.objectStore('revisions').add(revision);
    tx.objectStore('documents').put(doc);
    tx.objectStore('receipts').put({ key: revision.id + ':local', revisionId: revision.id, level: 'local', at: new Date().toISOString() });
    tx.objectStore('outbox').add({ ...operation, id: operation.operationId });
    if (draft) {
      const saved = await request<RecoveryDraft | undefined>(tx.objectStore('drafts').get(draft.id));
      if (saved && saved.generation <= draft.generation) tx.objectStore('drafts').delete(draft.id);
    }
    await done; return conflict;
  }
  async putOriginal(original: Original): Promise<void> { const tx = this.transaction(['originals']); const done = completed(tx); tx.objectStore('originals').add(original); await done; }
  async catalog(data: Pick<WorkspaceSnapshot, 'universes' | 'collections'>): Promise<void> {
    const tx = this.transaction(['universes', 'collections']); const done = completed(tx);
    // Creation must not rewrite names held by a newer tab. Renames use their
    // own guarded transaction below, never a whole-catalog replacement.
    for (const name of ['universes', 'collections'] as const) for (const item of data[name]) if (!await request(tx.objectStore(name).get(item.id))) tx.objectStore(name).add(item);
    await done;
  }
  async collectionRenames(): Promise<PendingCollectionRename[]> { return (await this.all<{ id: string; value: PendingCollectionRename }>('preferences')).filter(row => row.id.startsWith('collectionRename:')).map(row => row.value); }
  async queueCollectionRename(expectedLocal: Collection, name: string, token: string): Promise<void> {
    const tx = this.transaction(['collections', 'preferences']); const done = completed(tx);
    const current = await request<Collection | undefined>(tx.objectStore('collections').get(expectedLocal.id));
    const prior = (await request(tx.objectStore('preferences').get(renameKey(expectedLocal.id))))?.value as PendingCollectionRename | undefined;
    if (!current || !sameName(current, expectedLocal) || prior?.conflict) { tx.abort(); await done.catch(() => {}); throw new Error(prior?.conflict ? 'Resolve the collection name choice before renaming again.' : 'This collection changed in another tab. Review its current name and try again.'); }
    const expected = prior?.expected ?? current;
    // Even returning to the original name remains a queued intent: an earlier
    // name may already be in flight. The adapter avoids a write if still equal.
    const collection: Collection = { ...current, name, nameVersion: { id: token, generation: (expected.nameVersion?.generation ?? 0) + 1 } };
    assertCollectionMetadata(collection);
    tx.objectStore('collections').put(collection);
    if (sameName(collection, expected)) tx.objectStore('preferences').delete(renameKey(current.id));
    else tx.objectStore('preferences').put({ id: renameKey(current.id), value: { id: current.id, expected, collection, editedAt: Date.now() } satisfies PendingCollectionRename });
    tx.objectStore('preferences').put({ id: 'catalogPending', value: true });
    tx.objectStore('preferences').put({ id: 'catalogChangedAt', value: Date.now() });
    await done;
  }
  async resolveCollectionRename(id: string, choice: 'local' | 'remote'): Promise<void> {
    const tx = this.transaction(['collections', 'preferences']); const done = completed(tx);
    const change = (await request(tx.objectStore('preferences').get(renameKey(id))))?.value as PendingCollectionRename | undefined;
    if (!change?.conflict) { await done; return; }
    if (choice === 'remote' || change.collection.name === change.conflict.name) {
      tx.objectStore('collections').put(change.conflict); tx.objectStore('preferences').delete(renameKey(id));
    } else {
      const collection = { ...change.collection, nameVersion: { id: crypto.randomUUID(), generation: (change.conflict.nameVersion?.generation ?? 0) + 1 } };
      assertCollectionMetadata(collection);
      tx.objectStore('collections').put(collection);
      tx.objectStore('preferences').put({ id: renameKey(id), value: { id, expected: change.conflict, collection, editedAt: Date.now() } satisfies PendingCollectionRename });
    }
    tx.objectStore('preferences').put({ id: 'catalogPending', value: true });
    tx.objectStore('preferences').put({ id: 'catalogChangedAt', value: Date.now() });
    await done;
  }
  async finishCollectionRename(sent: PendingCollectionRename, result: CollectionRenameResult): Promise<void> {
    const tx = this.transaction(['collections', 'preferences']); const done = completed(tx);
    const current = (await request(tx.objectStore('preferences').get(renameKey(sent.id))))?.value as PendingCollectionRename | undefined;
    if (!current) { await done; return; }
    if (result.status === 'synced' && (sameName(current.collection, sent.collection) || current.collection.name === result.collection.name)) {
      tx.objectStore('collections').put(result.collection); tx.objectStore('preferences').delete(renameKey(sent.id));
    } else if (result.status === 'synced' && sameName(current.expected, sent.expected)) {
      // A second confirmed rename arrived while the first upload was in flight.
      // Rebase that still-local name; the older acknowledgement cannot erase it.
      const collection = { ...current.collection, nameVersion: { id: crypto.randomUUID(), generation: (result.collection.nameVersion?.generation ?? 0) + 1 } };
      assertCollectionMetadata(collection);
      tx.objectStore('collections').put(collection);
      tx.objectStore('preferences').put({ id: renameKey(sent.id), value: { id: sent.id, expected: result.collection, collection, editedAt: current.editedAt } satisfies PendingCollectionRename });
    } else {
      tx.objectStore('preferences').put({ id: renameKey(sent.id), value: { ...current, conflict: result.collection } });
    }
    await done;
  }
  async acknowledge(revisionId: string, conflict: boolean): Promise<void> {
    const tx = this.transaction(['outbox', 'receipts']); const done = completed(tx);
    if (conflict) {
      const op = await request(tx.objectStore('outbox').get(revisionId));
      if (op) tx.objectStore('outbox').put({ ...op, status: 'conflict' });
    } else {
      tx.objectStore('outbox').delete(revisionId);
      tx.objectStore('receipts').put({ key: revisionId + ':cloud', revisionId, level: 'cloud', at: new Date().toISOString() });
    }
    await done;
  }
  async clearConflicts(documentId: string): Promise<void> {
    const ops = await this.all<PendingOperation>('outbox');
    const tx = this.transaction(['outbox', 'preferences']); const done = completed(tx);
    tx.objectStore('preferences').delete('conflict:' + documentId);
    ops.filter(x => x.revision.documentId === documentId && x.status === 'conflict').forEach(x => tx.objectStore('outbox').delete(x.operationId)); await done;
  }
  async finishResolution(documentId: string, resolutionId: string, approvedIds: string[]): Promise<boolean> {
    const tx = this.transaction(['documents', 'outbox', 'preferences']); const done = completed(tx);
    const [head, operations] = await Promise.all([request<WritingDocument | undefined>(tx.objectStore('documents').get(documentId)), request<PendingOperation[]>(tx.objectStore('outbox').getAll())]);
    const approved = new Set(approvedIds);
    const retired = operations.filter(operation => operation.revision.documentId === documentId && operation.status === 'conflict' && approved.has(operation.operationId));
    retired.forEach(operation => tx.objectStore('outbox').delete(operation.operationId));
    const unresolved = operations.some(operation => operation.revision.documentId === documentId && operation.operationId !== resolutionId && !approved.has(operation.operationId));
    const cleared = head?.headRevisionId === resolutionId && !unresolved;
    if (cleared) tx.objectStore('preferences').delete('conflict:' + documentId);
    await done; return cleared;
  }
  async markConflict(documentId: string): Promise<void> { await this.setPreference('conflict:' + documentId, true); }
  async conflicts(): Promise<string[]> { return (await this.all<{ id: string; value: unknown }>('preferences')).filter(x => x.id.startsWith('conflict:') && x.value === true).map(x => x.id.slice(9)); }
  async merge(snapshot: WorkspaceSnapshot, preserveDocumentIds: Set<string>): Promise<void> {
    // Guard against checkpoints made while the network request or merge was waiting.
    // Read guards and write heads inside ONE transaction, across tabs as well as engines.
    const tx = this.transaction(['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts', 'outbox', 'preferences', 'drafts']); const done = completed(tx);
    const [localRevisions, localOriginals, localDocuments, pending, drafts, localCollections, preferences] = await Promise.all([
      request<Revision[]>(tx.objectStore('revisions').getAll()), request<Original[]>(tx.objectStore('originals').getAll()),
      request<WritingDocument[]>(tx.objectStore('documents').getAll()), request<PendingOperation[]>(tx.objectStore('outbox').getAll()),
      request<RecoveryDraft[]>(tx.objectStore('drafts').getAll()),
      request<Collection[]>(tx.objectStore('collections').getAll()), request<{ id: string; value: unknown }[]>(tx.objectStore('preferences').getAll()),
    ]);
    for (const name of ['revisions', 'originals'] as const) {
      const existing = new Map((name === 'revisions' ? localRevisions : localOriginals).map(x => [x.id, stableStringify(x)]));
      for (const item of snapshot[name]) if (existing.has(item.id) && existing.get(item.id) !== stableStringify(item)) {
        tx.abort(); await done.catch(() => {}); throw new Error('Immutable history differs for ' + item.id + '. Import stopped.');
      }
    }
    const preserve = new Set([...preserveDocumentIds, ...pending.map(x => x.revision.documentId), ...drafts.map(x => x.document.id)]);
    const remoteRevisions = new Map(snapshot.revisions.map(x => [x.id, x]));
    for (const local of localDocuments) {
      const remote = snapshot.documents.find(x => x.id === local.id);
      if (!remote || !local.headRevisionId) continue;
      const ancestors = new Set<string>(); const queue = [remote.headRevisionId!];
      while (queue.length) { const id = queue.pop()!; if (ancestors.has(id)) continue; ancestors.add(id); queue.push(...(remoteRevisions.get(id)?.parentIds ?? [])); }
      if (!ancestors.has(local.headRevisionId)) preserve.add(local.id);
      // Automatic stale-flag repair never deletes an outbox entry. This guard
      // and the head adoption share the transaction with cross-tab checkpoints.
      if (!preserve.has(local.id)) tx.objectStore('preferences').delete('conflict:' + local.id);
    }
    for (const name of ['revisions', 'originals', 'universes'] as const) snapshot[name].forEach(x => tx.objectStore(name).put(x));
    const renames = new Map(preferences.filter(row => row.id.startsWith('collectionRename:')).map(row => { const change = row.value as PendingCollectionRename; return [change.id, change]; }));
    for (const collection of snapshot.collections) {
      const change = renames.get(collection.id), local = localCollections.find(item => item.id === collection.id);
      if (local && local.universeId !== collection.universeId) { tx.abort(); await done.catch(() => {}); throw new Error('A collection cannot move between writing worlds.'); }
      if (change) {
        if (sameName(collection, change.collection) || collection.name === change.collection.name && (collection.nameVersion?.generation ?? 0) > (change.expected.nameVersion?.generation ?? 0)) {
          tx.objectStore('collections').put(collection); tx.objectStore('preferences').delete(renameKey(collection.id));
        } else if (!sameName(collection, change.expected) && (collection.nameVersion?.generation ?? 0) >= (change.expected.nameVersion?.generation ?? 0)) {
          tx.objectStore('preferences').put({ id: renameKey(collection.id), value: { ...change, conflict: collection } });
        }
      } else if (!local || (collection.nameVersion?.generation ?? 0) >= (local.nameVersion?.generation ?? 0)) {
        tx.objectStore('collections').put(collection);
      }
    }
    snapshot.documents.filter(x => !preserve.has(x.id)).forEach(x => tx.objectStore('documents').put(x));
    snapshot.receipts.forEach(x => tx.objectStore('receipts').put({ ...x, key: x.revisionId + ':' + x.level }));
    await done;
  }
  async enqueueArchive(snapshot: WorkspaceSnapshot): Promise<void> {
    const existing = await this.snapshot();
    if (existing.documents.length || existing.revisions.length || existing.originals.length) throw new Error('Full archive restore requires an empty notebook, to protect existing writing. Use revision history to recover a passage.');
    const tx = this.transaction(['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts', 'outbox', 'preferences']); const done = completed(tx);
    const counts = await Promise.all(['documents', 'revisions', 'originals'].map(name => request(tx.objectStore(name).count())));
    if (counts.some(Boolean)) { tx.abort(); await done.catch(() => {}); throw new Error('Full archive restore requires an empty notebook. Another tab saved writing before the restore began. Nothing was replaced.'); }
    // Empty default universe is replaced only in this atomic, validated restoration.
    const preferences = await request<{ id: string }[]>(tx.objectStore('preferences').getAll());
    preferences.filter(row => row.id.startsWith('collectionRename:')).forEach(row => tx.objectStore('preferences').delete(row.id));
    tx.objectStore('universes').clear(); tx.objectStore('collections').clear();
    for (const name of ['documents', 'revisions', 'originals', 'universes', 'collections'] as const) snapshot[name].forEach(x => tx.objectStore(name).add(x));
    for (const revision of snapshot.revisions) {
      tx.objectStore('receipts').put({ key: revision.id + ':local', revisionId: revision.id, level: 'local', at: new Date().toISOString() });
      tx.objectStore('outbox').add({ id: revision.id, operationId: revision.id, expectedHeadId: revision.parentIds[0] ?? null, revision, status: 'pending' });
    }
    tx.objectStore('preferences').put({ id: 'archiveHeads', value: snapshot.documents.map(doc => ({ documentId: doc.id, revisionId: doc.headRevisionId })) });
    tx.objectStore('preferences').put({ id: 'catalogPending', value: true });
    tx.objectStore('preferences').put({ id: 'catalogChangedAt', value: Date.now() });
    await done;
  }
  close(): void { this.db.close(); }
}
