import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { createFirestoreAdapter } from './spark';
import { sha256, stableStringify, toBase64, validateSnapshot } from '../domain/codec';
import { textBody, plainText, type CommitOperation, type Original, type Revision } from '../domain/model';

const enabled = /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '');
describe.skipIf(!enabled)('Spark adapter through actual Firestore emulator and owner Rules', () => {
  let environment: RulesTestEnvironment;
  let db: Firestore;
  const time = '2026-10-23T00:00:00.000Z';
  const universe = { id: 'world', name: 'Synthetic world', createdAt: time };
  beforeAll(async () => {
    environment = await initializeTestEnvironment({ projectId: 'demo-noveliaa', firestore: { host: '127.0.0.1', port: 18080, rules: await readFile('firestore.rules', 'utf8') } });
  }, 30000);
  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'noveliaaConfig/access'), { ownerUid: 'author' }); });
    db = environment.authenticatedContext('author').firestore() as unknown as Firestore;
  });
  afterAll(async () => { await environment?.cleanup(); });
  const path = (kind: string, key: string) => 'noveliaaWorkspaces/author/' + kind + '/' + key;
  async function operation(key: string, text: string, parent: string | null = null, documentId = 'scene'): Promise<CommitOperation> {
    const body = textBody(text);
    const snapshot = { id: documentId, universeId: 'world', title: 'Synthetic scene', body, plainText: plainText(body), collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [] as string[], createdAt: time, updatedAt: time };
    const revision: Revision = { id: key, documentId, universeId: 'world', parentIds: parent ? [parent] : [], snapshot, contentHash: await sha256(stableStringify(snapshot)), createdAt: time };
    return { operationId: key, expectedHeadId: parent, revision };
  }
  async function ready(database = db) {
    const adapter = createFirestoreAdapter(database, 'author');
    await adapter.putCatalog([universe], []);
    await adapter.registerDocuments!([{ id: 'scene', universeId: 'world' }]);
    return adapter;
  }
  it('commits exact text, retries idempotently, and reconstructs a valid portable snapshot', async () => {
    const adapter = await ready(), op = await operation('r1', 'Synthetic original\r\nनमस्ते 🪶');
    expect(await adapter.commit(op)).toEqual({ status: 'synced', headRevisionId: 'r1' });
    expect(await adapter.commit(op)).toEqual({ status: 'synced', headRevisionId: 'r1' });
    const remote = await createFirestoreAdapter(db, 'author').load();
    await validateSnapshot(remote);
    expect(remote.documents[0].plainText).toBe('Synthetic original\nनमस्ते 🪶');
    expect(remote.revisions).toHaveLength(1);
  });
  it('retains both racing roots and never lets the losing revision replace the head', async () => {
    const first = await ready(), second = await ready(environment.authenticatedContext('author').firestore() as unknown as Firestore);
    const results = await Promise.all([first.commit(await operation('a', 'First synthetic branch')), second.commit(await operation('b', 'Second synthetic branch'))]);
    expect(results.map(value => value.status).sort()).toEqual(['conflict', 'synced']);
    const remote = await first.load(); await validateSnapshot(remote);
    expect(remote.revisions).toHaveLength(2);
    expect(remote.documents[0].headRevisionId).toBe(results.find(value => value.status === 'synced')!.headRevisionId);
  });
  it('rejects changed operation replay and immutable revision-ID reuse', async () => {
    const adapter = await ready(), first = await operation('r1', 'One');
    await adapter.commit(first);
    await expect(adapter.commit({ ...first, expectedHeadId: 'r1' })).rejects.toThrow('cannot be changed');
    await expect(adapter.commit({ ...first, operationId: 'different' })).rejects.toThrow('already exists');
    await adapter.commit(await operation('r2', 'Two', 'r1'));
    expect(await adapter.commit(first)).toEqual({ status: 'synced', headRevisionId: 'r1' });
    expect((await adapter.load()).documents[0].headRevisionId).toBe('r2');
  });
  it('preserves exact original bytes and denies overwrites/deletion of every evidence layer', async () => {
    const adapter = await ready(), bytes = new TextEncoder().encode('Exact imported bytes\r\nनमस्ते 🪶');
    const original: Original = { id: 'original', universeId: 'world', name: 'source.txt', bytesBase64: toBase64(bytes), sha256: await sha256(bytes), origin: 'imported_chat', verification: 'unverified', sourceReference: 'Explicit synthetic import', createdAt: time };
    await adapter.putOriginal(original); await adapter.putOriginal(original);
    const op = await operation('r1', 'A derivative');
    op.revision.snapshot.sourceOriginalIds = ['original']; op.revision.snapshot.origin = 'imported_chat';
    op.revision.contentHash = await sha256(stableStringify(op.revision.snapshot));
    await adapter.commit(op);
    const remote = await createFirestoreAdapter(db, 'author').load(); await validateSnapshot(remote);
    expect(remote.originals[0]).toEqual(original);
    await expect(adapter.putOriginal({ ...original, verification: 'verified' })).rejects.toThrow('Immutable');
    for (const kind of ['revisions', 'operations', 'originals', 'blobs', 'chunks']) {
      const rows = await getDocs(collection(db, 'noveliaaWorkspaces/author/' + kind));
      for (const row of rows.docs) {
        await assertFails(setDoc(row.ref, row.data()));
        await assertFails(deleteDoc(row.ref));
      }
    }
  });
  it('enforces chunk SHA-256 in Rules and blocks malformed manifests', async () => {
    const bytes = new TextEncoder().encode('Synthetic chunk'), hash = await sha256(bytes);
    await assertFails(setDoc(doc(db, path('chunks', 'a'.repeat(64))), { sha256: 'a'.repeat(64), bytes: Bytes.fromUint8Array(bytes) }));
    await setDoc(doc(db, path('chunks', hash)), { sha256: hash, bytes: Bytes.fromUint8Array(bytes) });
    await assertFails(setDoc(doc(db, path('blobs', hash)), { sha256: hash, size: 5, encodedSize: 5, encoding: 'raw', chunks: [] }));
  });
  it('is private to the configured owner and rejects config, later-phase and recursive writes', async () => {
    await ready();
    for (const context of [environment.authenticatedContext('other'), environment.unauthenticatedContext()]) {
      await assertFails(getDocs(collection(context.firestore(), 'noveliaaWorkspaces/author/universes')));
      await assertFails(setDoc(doc(context.firestore(), 'noveliaaWorkspaces/author/universes/forged'), universe));
      await assertFails(getDoc(doc(context.firestore(), 'noveliaaConfig/access')));
    }
    await assertFails(setDoc(doc(db, 'noveliaaConfig/access'), { ownerUid: 'other' }));
    for (const kind of ['editions', 'feedback', 'grants']) await assertFails(setDoc(doc(db, path(kind, 'forged')), { invented: true }));
    await assertFails(setDoc(doc(db, path('revisions', 'r1') + '/nested/leak'), { invented: true }));
    await environment.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'noveliaaConfig/access')));
    await assertFails(getDocs(collection(db, 'noveliaaWorkspaces/author/universes')));
  });
  it('revokes every retired workspace path after rotation while preserving owner identity and new-root access', async () => {
    const retired = await ready(); await retired.commit(await operation('r1', 'Retired synthetic writing'));
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'noveliaaConfig/access'), { ownerUid: 'author', workspaceId: 'reset_synthetic' }));
    expect((await getDoc(doc(db, 'noveliaaConfig/access'))).data()).toEqual({ ownerUid: 'author', workspaceId: 'reset_synthetic' });
    for (const kind of ['universes', 'collections', 'documentIdentities', 'documents', 'revisions', 'originals', 'operations', 'chunks', 'blobs']) {
      await assertFails(getDocs(collection(db, 'noveliaaWorkspaces/author/' + kind)));
      await assertFails(setDoc(doc(db, 'noveliaaWorkspaces/author/' + kind + '/old_device'), { id: 'old_device' }));
    }
    await expect(retired.commit(await operation('old_replay', 'Queued before reset', 'r1'))).rejects.toThrow();
    const current = createFirestoreAdapter(db, 'author', undefined, 'reset_synthetic');
    expect(current.workspaceId).toBe('reset_synthetic');
    expect((await current.load()).accountId).toBe('author');
    expect((await current.load()).documents).toEqual([]);
    await current.putCatalog([universe], []); await current.registerDocuments!([{ id: 'scene', universeId: 'world' }]);
    expect(await current.commit(await operation('new_first', 'Clean start'))).toEqual({ status: 'synced', headRevisionId: 'new_first' });
    expect((await current.load()).documents[0].plainText).toBe('Clean start');
    for (const context of [environment.authenticatedContext('other'), environment.unauthenticatedContext()]) await assertFails(getDocs(collection(context.firestore(), 'noveliaaWorkspaces/reset_synthetic/universes')));
    await assertFails(getDoc(doc(db, 'noveliaaOperations/workspaceReset-reset_synthetic')));
    await assertFails(setDoc(doc(db, 'noveliaaOperations/workspaceReset-reset_synthetic'), { status: 'complete' }));
  });
  it('denies direct head rollback, missing revision/receipt and unattached revision creation', async () => {
    const adapter = await ready(); await adapter.commit(await operation('r1', 'One')); await adapter.commit(await operation('r2', 'Two', 'r1'));
    await assertFails(setDoc(doc(db, path('documents', 'scene')), { id: 'scene', universeId: 'world', headRevisionId: 'r1', operationId: 'r1' }));
    await assertFails(setDoc(doc(db, path('documents', 'scene')), { id: 'scene', universeId: 'world', headRevisionId: 'absent', operationId: 'absent' }));
    const old = (await getDoc(doc(db, path('revisions', 'r1')))).data()!;
    await assertFails(setDoc(doc(db, path('revisions', 'standalone')), { ...old, id: 'standalone', operationId: 'absent' }));
    expect((await adapter.load()).documents[0].headRevisionId).toBe('r2');
  });
  it('cannot move identities or delete catalog entries, and concurrent additions survive', async () => {
    const adapter = await ready();
    await adapter.putCatalog([universe, { ...universe, id: 'second' }], [{ id: 'group', universeId: 'world', name: 'Group', order: 0 }]);
    await assertFails(setDoc(doc(db, path('documentIdentities', 'scene')), { id: 'scene', universeId: 'second' }));
    await assertFails(setDoc(doc(db, path('collections', 'group')), { id: 'group', universeId: 'second', name: 'Group', order: 0 }));
    await assertFails(deleteDoc(doc(db, path('universes', 'world'))));
    const other = createFirestoreAdapter(db, 'author');
    await other.putCatalog([universe, { ...universe, id: 'third' }], []);
    expect((await other.load()).universes.map(value => value.id).sort()).toEqual(['second', 'third', 'world']);
  });
  it('renames legacy collections once and blocks stale legacy/token rollback without manuscript writes', async () => {
    const first = await ready(), original = { id: 'group', universeId: 'world', name: 'Original', order: 0 };
    await first.putCatalog([universe], [original]);
    const changed = { ...original, name: 'Renamed हिंदी', nameVersion: { id: 'rename-one', generation: 1 } };
    expect(await first.renameCollection!({ expected: original, collection: changed })).toEqual({ status: 'synced', collection: changed });
    expect(await first.renameCollection!({ expected: original, collection: changed })).toEqual({ status: 'synced', collection: changed });
    const stale = createFirestoreAdapter(environment.authenticatedContext('author').firestore() as unknown as Firestore, 'author');
    await stale.putCatalog([universe], [original]);
    expect((await stale.load()).collections).toEqual([changed]);
    await assertFails(setDoc(doc(db, path('collections', 'group')), original));
    await assertFails(setDoc(doc(db, path('collections', 'group')), { ...changed, name: 'Stale name', nameVersion: { id: 'different-token', generation: 1 } }));
    await assertFails(setDoc(doc(db, path('collections', 'group')), { ...changed, name: 'Skipped generation', nameVersion: { id: 'different-token', generation: 3 } }));
    const withoutVersion = { ...original, name: changed.name }; await assertFails(setDoc(doc(db, path('collections', 'group')), withoutVersion));
    for (const kind of ['revisions', 'operations', 'blobs', 'chunks']) expect((await getDocs(collection(db, 'noveliaaWorkspaces/author/' + kind))).size).toBe(0);
    await validateSnapshot(await stale.load());
  });
  it('detects actual racing metadata transactions and accepts only an explicit rebase of the losing name', async () => {
    const first = await ready(), original = { id: 'group', universeId: 'world', name: 'Original', order: 0 };
    await first.putCatalog([universe], [original]);
    const second = createFirestoreAdapter(environment.authenticatedContext('author').firestore() as unknown as Firestore, 'author');
    const names = ['Phone', 'Laptop'].map((name, index) => ({ ...original, name, nameVersion: { id: 'rename-' + index, generation: 1 } }));
    const results = await Promise.all([first.renameCollection!({ expected: original, collection: names[0] }), second.renameCollection!({ expected: original, collection: names[1] })]);
    expect(results.map(result => result.status).sort()).toEqual(['conflict', 'synced']);
    const loser = results.findIndex(result => result.status === 'conflict'), winner = results[loser].collection;
    const chosen = { ...winner, name: names[loser].name, nameVersion: { id: 'explicit-author-choice', generation: 2 } };
    expect(await first.renameCollection!({ expected: winner, collection: chosen })).toEqual({ status: 'synced', collection: chosen });
    expect((await second.load()).collections).toEqual([chosen]);
    expect((await getDocs(collection(db, 'noveliaaWorkspaces/author/revisions'))).size).toBe(0);
  });
  it('rejects malformed remote collection metadata before attempting any rename', async () => {
    const adapter = await ready(), original = { id: 'group', universeId: 'world', name: 'Original', order: 0 };
    await adapter.putCatalog([universe], [original]);
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), path('collections', 'group')), { ...original, nameVersion: { id: 'broken', generation: -1 } }));
    await expect(adapter.renameCollection!({ expected: original, collection: { ...original, name: 'New', nameVersion: { id: 'valid', generation: 1 } } })).rejects.toThrow('Invalid collection name version');
    expect((await getDoc(doc(db, path('collections', 'group')))).data()?.name).toBe('Original');
  });
  it('reconstructs a multi-chunk original without Firestore document truncation', async () => {
    const adapter = await ready(), bytes = new Uint8Array(720000);
    for (let start = 0; start < bytes.length; start += 60000) crypto.getRandomValues(bytes.subarray(start, Math.min(start + 60000, bytes.length)));
    const original: Original = { id: 'large', universeId: 'world', name: 'synthetic.bin', bytesBase64: toBase64(bytes), sha256: await sha256(bytes), origin: 'unknown', verification: 'unverified', sourceReference: 'Synthetic chunk stress fixture', createdAt: time };
    await adapter.putOriginal(original);
    const remote = await createFirestoreAdapter(db, 'author').load(); await validateSnapshot(remote);
    expect(remote.originals[0].bytesBase64).toBe(original.bytesBase64);
    expect((await getDocs(collection(db, 'noveliaaWorkspaces/author/chunks'))).size).toBeGreaterThan(1);
  }, 30000);
  it('refuses source corruption and changed account before acknowledging cloud save', async () => {
    const adapter = await ready(); await adapter.commit(await operation('r1', 'Original'));
    const chunks = await getDocs(collection(db, 'noveliaaWorkspaces/author/chunks'));
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), chunks.docs[0].ref.path), { sha256: chunks.docs[0].id, bytes: Bytes.fromUint8Array(new TextEncoder().encode('corrupt')) });
    });
    // Admin corruption deliberately bypasses immutable Rules. A fresh device
    // must reject it; an existing verified immutable-byte cache is not an audit
    // of subsequent administrator changes to otherwise immutable server data.
    const freshDevice = environment.authenticatedContext('author').firestore() as unknown as Firestore;
    await expect(createFirestoreAdapter(freshDevice, 'author').load()).rejects.toThrow('digest');
    await expect(createFirestoreAdapter(db, 'author', async () => { throw new Error('account changed'); }).commit(await operation('r2', 'Two', 'r1'))).rejects.toThrow('account changed');
  });
  it('validates parent identities and the selected restoration text', async () => {
    const adapter = await ready(); await adapter.commit(await operation('r1', 'Original'));
    const broken = await operation('r2', 'Other', 'missing');
    await expect(adapter.commit(broken)).rejects.toThrow('ancestry');
    const edited = await operation('r3', 'Edit', 'r1'); await adapter.commit(edited);
    const restore = await operation('r4', 'Original', 'r3'); restore.revision.restoredFrom = 'r1';
    await adapter.commit(restore);
    const wrong = await operation('r5', 'Invented replacement', 'r4'); wrong.revision.restoredFrom = 'r1';
    await expect(adapter.commit(wrong)).rejects.toThrow('preserve');
    const remote = await adapter.load(); await validateSnapshot(remote);
    expect(remote.documents[0].plainText).toBe('Original');
    expect(remote.revisions.map(value => value.id).sort()).toEqual(['r1', 'r3', 'r4']);
  });
});
