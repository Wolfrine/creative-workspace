import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { WritingEngine, LOCAL_SAVE_DELAY, CLOUD_SYNC_DELAY } from './engine';
import { DeviceDatabase } from '../storage/database';
import { textBody, type CloudAdapter, type Revision, type WorkspaceSnapshot } from '../domain/model';
import { decodeArchive } from '../storage/archive';

const engines: WritingEngine[] = [];
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { engines.forEach(engine => engine.dispose()); engines.length = 0; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const tick = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); for (let i = 0; i < 12; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
function cloudFixture(): CloudAdapter {
  let catalog: Pick<WorkspaceSnapshot, 'universes' | 'collections'> = { universes: [], collections: [] };
  const revisions = new Map<string, Revision>(), heads = new Map<string, string>();
  return {
    load: vi.fn(async () => ({ schemaVersion: 1 as const, accountId: 'author', ...structuredClone(catalog), revisions: structuredClone([...revisions.values()]), originals: [], documents: [...heads.values()].map(key => ({ ...structuredClone(revisions.get(key)!.snapshot), headRevisionId: key })), receipts: [] })),
    putCatalog: vi.fn(async (universes, collections) => { catalog = structuredClone({ universes, collections }); }), putOriginal: vi.fn(async () => {}),
    commit: vi.fn(async operation => { const old = heads.get(operation.revision.documentId) ?? null; revisions.set(operation.revision.id, structuredClone(operation.revision)); if (old === operation.expectedHeadId) heads.set(operation.revision.documentId, operation.revision.id); return { status: old === operation.expectedHeadId ? 'synced' as const : 'conflict' as const, headRevisionId: heads.get(operation.revision.documentId) ?? null }; }),
  };
}
async function open(cloud: CloudAdapter | null = null) { const engine = new WritingEngine('author', cloud); engines.push(engine); await engine.initialize(); return engine; }
async function setup() {
  const cloud = cloudFixture(), engine = await open(cloud), id = await engine.createDocument({ body: textBody('Base') }); await engine.sync();
  vi.mocked(cloud.commit).mockClear(); vi.mocked(cloud.putCatalog).mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  return { cloud, engine, id };
}

it('saves the device draft only after ten seconds of silence, then one latest revision at sixty seconds', async () => {
  const { engine, cloud, id } = await setup(), save = vi.spyOn(DeviceDatabase.prototype, 'saveDraft');
  const count = engine.getSnapshot().revisions.length;
  engine.updateDocument(id, { body: textBody('First pause') });
  await tick(LOCAL_SAVE_DELAY - 1); expect(save).not.toHaveBeenCalled();
  await tick(1); expect(save).toHaveBeenCalledTimes(1); expect(engine.getSnapshot().saveState).toBe('local');
  expect(engine.getSnapshot().revisions).toHaveLength(count); expect(cloud.commit).not.toHaveBeenCalled();
  await tick(20_000); engine.updateDocument(id, { body: textBody('Latest pause') });
  await tick(LOCAL_SAVE_DELAY); expect(save).toHaveBeenCalledTimes(2); expect(engine.getSnapshot().revisions).toHaveLength(count);
  await tick(CLOUD_SYNC_DELAY - LOCAL_SAVE_DELAY - 1); expect(cloud.commit).not.toHaveBeenCalled();
  await tick(1); await vi.waitFor(() => expect(cloud.commit).toHaveBeenCalledTimes(1));
  expect((await cloud.load()).documents[0].plainText).toBe('Latest pause');
  expect(engine.getSnapshot().revisions).toHaveLength(count + 1);
});

it('does not start local or cloud saving during continuous typing, including slow pauses below ten seconds', async () => {
  const { engine, cloud, id } = await setup(), save = vi.spyOn(DeviceDatabase.prototype, 'saveDraft');
  for (let n = 0; n < 12; n++) { engine.updateDocument(id, { body: textBody('Typing ' + n) }); await tick(9_000); }
  expect(save).not.toHaveBeenCalled(); expect(cloud.commit).not.toHaveBeenCalled();
  expect(engine.getSnapshot().saveState).toBe('waiting');
});

it('backgrounding makes a local-only recovery copy and reconnecting cannot bypass the cloud idle deadline', async () => {
  const { engine, cloud, id } = await setup();
  vi.stubGlobal('document', { visibilityState: 'hidden' });
  engine.updateDocument(id, { body: textBody('Background recovery') });
  (engine as unknown as { visibility(): void }).visibility(); await engine.flush();
  (engine as unknown as { offline(): void }).offline(); await tick(5_000);
  (engine as unknown as { online(): void }).online(); await tick(1_000);
  expect(cloud.commit).not.toHaveBeenCalled();
  const db = await DeviceDatabase.open('author'); expect((await db.all('drafts'))).toHaveLength(1); db.close();
  expect(engine.getSnapshot().revisions).toHaveLength(1);
});

it('recovers the latest draft after restart while keeping both simultaneous tab drafts', async () => {
  const a = await open(), id = await a.createDocument({ body: textBody('Base') }), b = await open();
  a.updateDocument(id, { body: textBody('First tab exact words') }); await a.flush();
  b.updateDocument(id, { body: textBody('Second tab exact words') }); await b.flush();
  expect(a.getSnapshot().revisions).toHaveLength(1); expect(b.getSnapshot().revisions).toHaveLength(1);
  a.dispose(); b.dispose(); const recovered = await open();
  expect(recovered.getSnapshot().revisions.map(revision => revision.snapshot.plainText)).toEqual(expect.arrayContaining(['Base', 'First tab exact words', 'Second tab exact words']));
  expect(recovered.getSnapshot().saveState).toBe('conflict');
});

it('does not acknowledge newer typing when an older device draft finishes saving', async () => {
  const { engine, id } = await setup();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const actual = DeviceDatabase.prototype.saveDraft;
  vi.spyOn(DeviceDatabase.prototype, 'saveDraft').mockImplementationOnce(async function(this: DeviceDatabase, draft) { await gate; return actual.call(this, draft); });
  engine.updateDocument(id, { body: textBody('Older draft') }); const saving = engine.flush();
  await tick(0); engine.updateDocument(id, { body: textBody('Newer words while saving') }); release(); await saving;
  expect(engine.getSnapshot().saveState).toBe('waiting'); expect(engine.getSnapshot().documents[0].plainText).toBe('Newer words while saving');
  await tick(LOCAL_SAVE_DELAY); expect(engine.getSnapshot().saveState).toBe('local');
});

it('protects a device-saved draft against a cloud refresh even after memory dirty flags clear', async () => {
  const { engine, cloud, id } = await setup();
  engine.updateDocument(id, { body: textBody('Device-only exact words') }); await tick(LOCAL_SAVE_DELAY);
  await (engine as unknown as { pullCloud(): Promise<void> }).pullCloud();
  expect(engine.getSnapshot().documents[0].plainText).toBe('Device-only exact words'); expect(cloud.commit).not.toHaveBeenCalled();
});

it('unchanged content and clean manual checks create no new local draft, revision or cloud write', async () => {
  const { engine, cloud, id } = await setup(), save = vi.spyOn(DeviceDatabase.prototype, 'saveDraft');
  engine.updateDocument(id, { body: textBody('Base') }); await tick(CLOUD_SYNC_DELAY + 1); await engine.sync();
  expect(save).not.toHaveBeenCalled(); expect(cloud.commit).not.toHaveBeenCalled(); expect(cloud.putCatalog).not.toHaveBeenCalled();
  expect(engine.getSnapshot().revisions).toHaveLength(1);
});

it('undoing back to the checkpoint removes only this writer draft and creates no cloud revision', async () => {
  const { engine, cloud, id } = await setup();
  engine.updateDocument(id, { body: textBody('Temporary experiment') }); await tick(LOCAL_SAVE_DELAY);
  engine.updateDocument(id, { body: textBody('Base') }); await tick(CLOUD_SYNC_DELAY);
  expect(cloud.commit).not.toHaveBeenCalled(); expect(engine.getSnapshot().revisions).toHaveLength(1);
  const db = await DeviceDatabase.open('author'); expect(await db.all('drafts')).toHaveLength(0); db.close();
});

it('failed device draft writes keep the current words exportable and never earn a saved acknowledgement', async () => {
  const { engine, id } = await setup();
  vi.spyOn(DeviceDatabase.prototype, 'saveDraft').mockRejectedValueOnce(new DOMException('Device storage is full', 'QuotaExceededError'));
  engine.updateDocument(id, { body: textBody('Exact unsaved words हिंदी 🙂') });
  await expect(engine.flush()).rejects.toThrow('Device storage is full');
  expect(engine.getSnapshot().saveState).toBe('error');
  expect(await (await engine.exportDocument(id, 'txt')).text()).toBe('Exact unsaved words हिंदी 🙂');
});

it('cloud history failure does not block a valid archive of all locally available writing', async () => {
  const { engine, cloud, id } = await setup();
  engine.updateDocument(id, { body: textBody('Device writing remains exportable') });
  vi.mocked(cloud.load).mockRejectedValueOnce(new Error('Cloud history unavailable'));
  const archive = await decodeArchive(await (await engine.exportArchive()).text());
  expect(archive.documents[0].plainText).toBe('Device writing remains exportable');
});

it('typing during a cloud history read is checkpointed before the archive snapshot is encoded', async () => {
  const { engine, cloud, id } = await setup();
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; }), load = vi.mocked(cloud.load).getMockImplementation()!;
  vi.mocked(cloud.load).mockImplementationOnce(async () => { enter(); await gate; return load(); });
  const exporting = engine.exportArchive(); await entered;
  engine.updateDocument(id, { body: textBody('New words while history was loading') }); release();
  const archive = await decodeArchive(await (await exporting).text());
  expect(archive.documents[0].plainText).toBe('New words while history was loading');
});
