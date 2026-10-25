import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { WritingEngine } from './engine';
import { DeviceDatabase } from '../storage/database';
import { stableStringify, validateSnapshot } from '../domain/codec';
import { decodeArchive, encodeArchive } from '../storage/archive';
import { textBody, type CloudAdapter, type WorkspaceSnapshot } from '../domain/model';

const engines: WritingEngine[] = [];
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { engines.forEach(engine => engine.dispose()); engines.length = 0; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function open(cloud: CloudAdapter | null = null, account = 'author') {
  const engine = new WritingEngine(account, cloud); engines.push(engine); await engine.initialize(); if (cloud) await engine.sync(); return engine;
}
// Synthetic protocol fixture. Actual Firebase transactions and Rules are tested
// separately in spark.emulator.test.ts; this exercises device/engine races.
function cloudFixture() {
  const state: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'author', universes: [], collections: [], documents: [], revisions: [], originals: [], receipts: [] };
  const listeners = new Set<() => void>();
  const cloud: CloudAdapter = {
    load: async () => structuredClone(state),
    watch: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    putCatalog: async (universes, collections) => { for (const item of universes) if (!state.universes.some(value => value.id === item.id)) state.universes.push(structuredClone(item)); for (const item of collections) if (!state.collections.some(value => value.id === item.id)) state.collections.push(structuredClone(item)); },
    renameCollection: async change => {
      const current = state.collections.find(item => item.id === change.collection.id)!;
      if (current.name === change.collection.name) return { status: 'synced', collection: structuredClone(current) };
      if (current.name !== change.expected.name || stableStringify(current.nameVersion) !== stableStringify(change.expected.nameVersion)) return { status: 'conflict', collection: structuredClone(current) };
      Object.assign(current, structuredClone(change.collection)); listeners.forEach(callback => callback());
      return { status: 'synced', collection: structuredClone(current) };
    },
    putOriginal: async original => { if (!state.originals.some(value => value.id === original.id)) state.originals.push(structuredClone(original)); },
    commit: async operation => {
      const prior = state.documents.find(item => item.id === operation.revision.documentId);
      const status = (prior?.headRevisionId ?? null) === operation.expectedHeadId ? 'synced' : 'conflict';
      state.revisions.push(structuredClone(operation.revision)); state.receipts.push({ revisionId: operation.revision.id, level: 'cloud', at: operation.revision.createdAt });
      if (status === 'synced') state.documents = [...state.documents.filter(item => item.id !== operation.revision.documentId), { ...structuredClone(operation.revision.snapshot), headRevisionId: operation.revision.id }];
      return { status, headRevisionId: status === 'synced' ? operation.revision.id : prior!.headRevisionId };
    },
  };
  return { cloud, state };
}

describe('Collection rename durability and guarded metadata protocol', () => {
  it('renames a stable collection without touching writing, revisions or exact originals', async () => {
    const engine = await open(); await engine.createCollection('First collection'); const collection = engine.getSnapshot().collections[0];
    const page = await engine.importText(new File(['Exact original\r\nहिंदी 🪶'], 'source.txt'), 'recovered_original');
    engine.updateDocument(page, { collectionId: collection.id }); await engine.checkpoint();
    const before = engine.getSnapshot(), writing = stableStringify({ documents: before.documents, revisions: before.revisions, originals: before.originals });
    await engine.renameCollection(collection.id, '  My renamed collection  ');
    const after = engine.getSnapshot();
    expect(after.collections[0]).toMatchObject({ id: collection.id, universeId: collection.universeId, name: 'My renamed collection', nameVersion: { generation: 1 } });
    expect(stableStringify({ documents: after.documents, revisions: after.revisions, originals: after.originals })).toBe(writing);
    const db = await DeviceDatabase.open('author'); expect(await db.collectionRenames()).toHaveLength(1); db.close();
  });
  it('coalesces offline confirmations, survives reopen and roundtrips old and new archives', async () => {
    let engine = await open(); await engine.createCollection('Original'); const collection = engine.getSnapshot().collections[0];
    await engine.createDocument({ body: textBody('Words preserved'), collectionId: collection.id });
    await engine.renameCollection(collection.id, 'Intermediate'); await engine.renameCollection(collection.id, 'Final'); engine.dispose();
    engine = await open(); expect(engine.getSnapshot().collections[0].name).toBe('Final');
    const db = await DeviceDatabase.open('author'), changes = await db.collectionRenames(); db.close();
    expect(changes).toHaveLength(1); expect(changes[0].expected.name).toBe('Original'); expect(changes[0].collection.name).toBe('Final');
    const snapshot = await decodeArchive(await (await engine.exportArchive()).text()); expect(snapshot.collections[0].nameVersion?.generation).toBe(1);
    const restored = await open(null, 'restored'); await restored.createCollection('Empty old catalog'); await restored.renameCollection(restored.getSnapshot().collections[0].id, 'Old pending metadata');
    await restored.importArchive(new File([await encodeArchive(snapshot)], 'new.json'));
    expect(restored.getSnapshot().collections).toEqual(snapshot.collections);
    const restoredDb = await DeviceDatabase.open('restored'); expect(await restoredDb.collectionRenames()).toEqual([]); restoredDb.close();
    const legacy = structuredClone(snapshot); delete legacy.collections[0].nameVersion; await validateSnapshot(legacy);
    expect((await decodeArchive(await (await encodeArchive(legacy)).text())).collections[0]).not.toHaveProperty('nameVersion');
  });
  it('rejects invalid and unknown collection names and leaves a no-op unchanged', async () => {
    const engine = await open(); await engine.createCollection('Original'); const collection = engine.getSnapshot().collections[0], before = stableStringify(engine.getSnapshot().collections);
    for (const name of ['', '  ', 'bad\nname', 'a'.repeat(10001)]) await expect(engine.renameCollection(collection.id, name)).rejects.toThrow('collection name');
    await expect(engine.renameCollection('inbox', 'No')).rejects.toThrow('Inbox');
    await engine.renameCollection(collection.id, ' Original '); expect(stableStringify(engine.getSnapshot().collections)).toBe(before);
    const db = await DeviceDatabase.open('author'); expect(await db.collectionRenames()).toHaveLength(0); db.close();
  });
  it('adopts a clean remote rename through its existing watch without text revisions', async () => {
    const { cloud, state } = cloudFixture(), phone = await open(cloud); await phone.createCollection('Original'); await phone.sync();
    vi.stubGlobal('indexedDB', new IDBFactory()); const laptop = await open(cloud); const id = state.collections[0].id;
    await phone.renameCollection(id, 'From phone'); await phone.sync();
    await vi.waitFor(() => expect(laptop.getSnapshot().collections[0].name).toBe('From phone'));
    expect(state.revisions).toHaveLength(0); expect(laptop.getSnapshot().collectionConflicts).toEqual([]);
  });
  it('does not revert a renamed collection when a deliberately stale device uploads unrelated writing', async () => {
    const { cloud, state } = cloudFixture(), phone = await open(cloud); await phone.createCollection('Original'); await phone.sync();
    const stale = await cloud.load(); vi.stubGlobal('indexedDB', new IDBFactory());
    const laptop = await open({ ...cloud, watch: undefined, load: async () => structuredClone(stale) });
    await phone.renameCollection(state.collections[0].id, 'New cloud name'); await phone.sync();
    await laptop.createDocument({ body: textBody('Unrelated exact writing') }); await laptop.sync();
    expect(state.collections[0].name).toBe('New cloud name'); expect(state.documents[0].plainText).toBe('Unrelated exact writing');
  });
  it('preserves competing offline names after restart until the author explicitly chooses a local name', async () => {
    const { cloud, state } = cloudFixture(), phone = await open(cloud); await phone.createCollection('Original'); await phone.sync();
    const laptopStore = new IDBFactory(); vi.stubGlobal('indexedDB', laptopStore); let laptop = await open({ ...cloud, watch: undefined }); const id = state.collections[0].id;
    await laptop.renameCollection(id, 'Laptop name'); await phone.renameCollection(id, 'Phone name'); await phone.sync(); await laptop.sync();
    expect(laptop.getSnapshot().collections[0].name).toBe('Laptop name');
    expect(laptop.getSnapshot().collectionConflicts).toEqual([{ collectionId: id, localName: 'Laptop name', remoteName: 'Phone name' }]);
    expect(state.collections[0].name).toBe('Phone name'); laptop.dispose(); vi.stubGlobal('indexedDB', laptopStore); laptop = await open({ ...cloud, watch: undefined });
    expect(laptop.getSnapshot().collectionConflicts).toHaveLength(1);
    await laptop.resolveCollectionRename(id, 'local'); await laptop.sync(); expect(state.collections[0].name).toBe('Laptop name'); expect(state.collections[0].nameVersion?.generation).toBe(2);
    expect(laptop.getSnapshot().collectionConflicts).toEqual([]);
  });
  it('allows choosing the remote name without a new write and protects an uncheckpointed writing draft', async () => {
    const { cloud, state } = cloudFixture(), phone = await open(cloud); await phone.createCollection('Original'); const page = await phone.createDocument({ body: textBody('Base') }); await phone.sync();
    vi.stubGlobal('indexedDB', new IDBFactory()); const laptop = await open(cloud); const id = state.collections[0].id;
    await laptop.renameCollection(id, 'Laptop name'); laptop.updateDocument(page, { body: textBody('Uncheckpointed हिंदी draft') }); const revisionsBefore = laptop.getSnapshot().revisions.length;
    await phone.renameCollection(id, 'Phone name'); await phone.sync();
    await vi.waitFor(() => expect(laptop.getSnapshot().collectionConflicts).toHaveLength(1));
    expect(laptop.getSnapshot().documents[0].plainText).toBe('Uncheckpointed हिंदी draft');
    const rename = vi.spyOn(cloud, 'renameCollection'); await laptop.resolveCollectionRename(id, 'remote');
    expect(laptop.getSnapshot().collections[0].name).toBe('Phone name'); expect(laptop.getSnapshot().documents[0].plainText).toBe('Uncheckpointed हिंदी draft'); expect(laptop.getSnapshot().revisions).toHaveLength(revisionsBefore); expect(rename).not.toHaveBeenCalled();
  });
  it('preserves a newer confirmed rename when an earlier upload finishes late', async () => {
    const { cloud, state } = cloudFixture(), engine = await open(cloud); await engine.createCollection('Original'); await engine.sync(); const id = state.collections[0].id;
    let release!: () => void, entered!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const rename = cloud.renameCollection!.bind(cloud); vi.spyOn(cloud, 'renameCollection').mockImplementationOnce(async change => { entered(); await blocked; return rename(change); });
    await engine.renameCollection(id, 'First'); const syncing = engine.sync(); await reached; await engine.renameCollection(id, 'Final'); release(); await syncing;
    expect(engine.getSnapshot().collections[0].name).toBe('Final'); await engine.sync(); expect(state.collections[0].name).toBe('Final'); expect(state.collections[0].nameVersion?.generation).toBe(2);
  });
  it('defers automatic metadata upload for the full 60-second idle deadline', async () => {
    const { cloud, state } = cloudFixture(), engine = await open(cloud); await engine.createCollection('Original'); await engine.sync(); const id = state.collections[0].id;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); const renamed = vi.spyOn(cloud, 'renameCollection');
    await engine.renameCollection(id, 'First confirmation'); await vi.advanceTimersByTimeAsync(30000); await engine.renameCollection(id, 'Final confirmation');
    await vi.advanceTimersByTimeAsync(59999); expect(renamed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await engine.sync(); expect(renamed).toHaveBeenCalledTimes(1); expect(state.collections[0].name).toBe('Final confirmation');
  });
  it('retains an explicit return to the original name while an earlier rename is in flight', async () => {
    const { cloud, state } = cloudFixture(), engine = await open(cloud); await engine.createCollection('Original'); await engine.sync(); const id = state.collections[0].id;
    let release!: () => void, entered!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const rename = cloud.renameCollection!.bind(cloud); vi.spyOn(cloud, 'renameCollection').mockImplementationOnce(async change => { entered(); await blocked; return rename(change); });
    await engine.renameCollection(id, 'In flight'); const syncing = engine.sync(); await reached; await engine.renameCollection(id, 'Original'); release(); await syncing; await engine.sync();
    expect(state.collections[0].name).toBe('Original'); expect(engine.getSnapshot().collections[0].name).toBe('Original'); expect(engine.getSnapshot().collectionConflicts).toEqual([]);
  });
  it('rejects a stale same-device tab confirmation and retains the already durable name', async () => {
    const first = await open(); await first.createCollection('Original'); const second = await open(), id = first.getSnapshot().collections[0].id;
    await first.renameCollection(id, 'Already saved');
    await expect(second.renameCollection(id, 'Stale proposal')).rejects.toThrow('another tab');
    expect(second.getSnapshot().collections[0].name).toBe('Already saved');
    const db = await DeviceDatabase.open('author'); expect((await db.collectionRenames())[0].collection.name).toBe('Already saved'); db.close();
  });
  it('keeps a confirmed name when a late stale cloud snapshot arrives', async () => {
    const { cloud, state } = cloudFixture(), engine = await open(cloud); await engine.createCollection('Original'); await engine.sync(); const stale = await cloud.load();
    await engine.renameCollection(state.collections[0].id, 'Acknowledged'); await engine.sync();
    vi.spyOn(cloud, 'load').mockResolvedValue(stale); await engine.loadHistory();
    expect(engine.getSnapshot().collections[0].name).toBe('Acknowledged'); expect(engine.getSnapshot().collections[0].nameVersion?.generation).toBe(1);
  });
});
