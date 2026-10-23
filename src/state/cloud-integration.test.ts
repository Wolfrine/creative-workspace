import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { WritingEngine } from './engine';
import { DeviceDatabase } from '../storage/database';
import { textBody, type CloudAdapter, type Revision, type WorkspaceSnapshot } from '../domain/model';
import { stableStringify, toBase64 } from '../domain/codec';
import { encodeArchive, decodeArchive } from '../storage/archive';
// @ts-expect-error The backend is intentionally executable ESM shared with its Node tests.
import { commitOperation, putCatalog, putOriginal, registerDocuments, sha256 } from '../../functions/src/service.mjs';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
const engines: WritingEngine[] = [];
async function open(account: string, cloud: CloudAdapter | null) { const engine = new WritingEngine(account, cloud); engines.push(engine); await engine.initialize(); if (cloud) await engine.sync(); return engine; }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { engines.forEach(engine => engine.dispose()); engines.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function cloudService(uid = 'author'): CloudAdapter {
  const tables = new Map<string, any>(); const blobs = new Map<string, Uint8Array>(); let tail: Promise<unknown> = Promise.resolve();
  const deps = {
    ownerUid: uid, now: () => new Date().toISOString(),
    transaction: (callback: (transaction: any) => Promise<unknown>) => {
      const task = tail.then(() => callback({ get: async (table: string, id: string) => structuredClone(tables.get(`${table}/${id}`)), create: (table: string, id: string, data: unknown) => { if (tables.has(`${table}/${id}`)) throw new Error('Duplicate immutable ID'); tables.set(`${table}/${id}`, structuredClone(data)); }, set: (table: string, id: string, data: unknown) => tables.set(`${table}/${id}`, structuredClone(data)) }));
      tail = task.catch(() => {}); return task;
    },
    verifyBlob: async (_uid: string, descriptor: { sha256: string }, expected?: Uint8Array, expectedDigest?: string) => {
      const bytes = blobs.get(descriptor.sha256);
      if (!bytes || sha256(bytes) !== descriptor.sha256 || (expected && sha256(expected) !== descriptor.sha256) || (expectedDigest && expectedDigest !== descriptor.sha256)) throw new Error('Blob digest mismatch');
      return { path: `noveliaaWorkspaces/${uid}/blobs/${descriptor.sha256}`, generation: '1', sha256: descriptor.sha256, size: bytes.length };
    },
  };
  const stage = (bytes: Uint8Array) => { const digest = sha256(bytes); blobs.set(digest, bytes); return { sha256: digest }; };
  const rows = (name: string) => [...tables].filter(([key]) => key.startsWith(`${name}/`)).map(([, value]) => structuredClone(value));
  return {
    async load(): Promise<WorkspaceSnapshot> {
      const catalog = tables.get('meta/catalog') ?? { universes: [], collections: [] };
      const revisions: Revision[] = rows('revisions').map(row => JSON.parse(new TextDecoder().decode(blobs.get(row.blob.sha256))));
      const originals = rows('originals').map(({ blob, fingerprint: _fingerprint, ...original }) => ({ ...original, bytesBase64: toBase64(blobs.get(blob.sha256)!) }));
      return { schemaVersion: 1, accountId: uid, universes: structuredClone(catalog.universes), collections: structuredClone(catalog.collections), revisions, originals, documents: rows('documents').map(head => ({ ...revisions.find(revision => revision.id === head.headRevisionId)!.snapshot, headRevisionId: head.headRevisionId })), receipts: revisions.map(revision => ({ revisionId: revision.id, level: 'cloud', at: revision.createdAt })) };
    },
    commit: async operation => commitOperation(uid, { ...operation, blob: stage(new TextEncoder().encode(stableStringify(operation.revision))) }, deps),
    putCatalog: async (universes, collections) => { await putCatalog(uid, { universes, collections }, deps); },
    putOriginal: async original => { const { bytesBase64, ...metadata } = original; await putOriginal(uid, { original: metadata, blob: stage(Uint8Array.from(atob(bytesBase64), char => char.charCodeAt(0))) }, deps); },
    registerDocuments: async documents => { await registerDocuments(uid, { documents }, deps); },
  };
}

describe('Writing engine against actual trusted commit service', () => {
  for (const firstDevice of ['a', 'b'] as const) it(`retains both offline variants in independent persistent stores when ${firstDevice.toUpperCase()} reconnects first`, async () => {
    // Separate factories model distinct browser/device stores. A shared
    // BroadcastChannel would model tabs, so it is explicitly absent here.
    vi.stubGlobal('BroadcastChannel', undefined);
    const storeA = new IDBFactory(); const storeB = new IDBFactory();
    const cloud = cloudService();
    vi.stubGlobal('indexedDB', storeA);
    const a = await open('author', cloud);
    const id = await a.createDocument({ body: textBody('Shared immutable base — हिन्दी 🪶') }); await a.sync();
    const seeded = await cloud.load();
    const base = seeded.documents.find(document => document.id === id)!;
    const originalRevision = structuredClone(seeded.revisions.find(revision => revision.id === base.headRevisionId)!);
    vi.stubGlobal('indexedDB', storeB);
    const b = await open('author', cloud);
    expect(b.getSnapshot().documents.find(document => document.id === id)?.headRevisionId).toBe(base.headRevisionId);
    (a as unknown as { offline(): void }).offline(); (b as unknown as { offline(): void }).offline();
    const textA = 'Offline device A — exact स्वतंत्र words'; const textB = 'Offline device B — a different exact branch 🪶';
    a.updateDocument(id, { body: textBody(textA) }); b.updateDocument(id, { body: textBody(textB) });
    await a.flush(); await b.flush();
    const revisionA = a.getSnapshot().documents.find(document => document.id === id)!.headRevisionId!;
    const revisionB = b.getSnapshot().documents.find(document => document.id === id)!.headRevisionId!;
    expect(revisionA).not.toBe(revisionB);
    expect(a.getSnapshot().revisions.find(revision => revision.id === revisionA)?.parentIds).toEqual([base.headRevisionId]);
    expect(b.getSnapshot().revisions.find(revision => revision.id === revisionB)?.parentIds).toEqual([base.headRevisionId]);
    expect((await cloud.load()).revisions).toHaveLength(1);
    const outcomes: { expectedHeadId: string | null; status: string }[] = [];
    const commit = cloud.commit.bind(cloud);
    vi.spyOn(cloud, 'commit').mockImplementation(async operation => {
      const result = await commit(operation); outcomes.push({ expectedHeadId: operation.expectedHeadId, status: result.status }); return result;
    });
    const winner = firstDevice === 'a' ? a : b; const loser = firstDevice === 'a' ? b : a;
    (winner as unknown as { online(): void }).online(); await winner.sync(false);
    (loser as unknown as { online(): void }).online(); await loser.sync(false);
    const remote = await cloud.load();
    expect(outcomes).toEqual([{ expectedHeadId: base.headRevisionId, status: 'synced' }, { expectedHeadId: base.headRevisionId, status: 'conflict' }]);
    expect(remote.revisions).toHaveLength(3);
    expect(remote.revisions.find(revision => revision.id === base.headRevisionId)).toEqual(originalRevision);
    expect(remote.revisions.find(revision => revision.id === revisionA)?.snapshot.plainText).toBe(textA);
    expect(remote.revisions.find(revision => revision.id === revisionB)?.snapshot.plainText).toBe(textB);
    expect(remote.documents.find(document => document.id === id)?.headRevisionId).toBe(firstDevice === 'a' ? revisionA : revisionB);
    expect(winner.getSnapshot().saveState).toBe('synced'); expect(loser.getSnapshot().saveState).toBe('conflict');
    expect(a.getSnapshot().documents.find(document => document.id === id)?.plainText).toBe(textA);
    expect(b.getSnapshot().documents.find(document => document.id === id)?.plainText).toBe(textB);
    a.dispose(); b.dispose();
    // Reopening uses each original factory, rather than reconstructing memory.
    vi.stubGlobal('indexedDB', storeA); const reopenedA = await open('author', cloud);
    vi.stubGlobal('indexedDB', storeB); const reopenedB = await open('author', cloud);
    expect(reopenedA.getSnapshot().documents.find(document => document.id === id)?.plainText).toBe(textA);
    expect(reopenedB.getSnapshot().documents.find(document => document.id === id)?.plainText).toBe(textB);
    expect((firstDevice === 'a' ? reopenedB : reopenedA).getSnapshot().saveState).toBe('conflict');
    expect(outcomes).toHaveLength(2);
    expect((await cloud.load()).revisions).toHaveLength(3);
  });

  it('does not replace an acknowledged checkpoint made while a stale cloud merge is waiting', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    const id = await engine.createDocument({ body: textBody('Cloud base') }); await engine.sync();
    const entered = deferred(); const release = deferred(); const merge = DeviceDatabase.prototype.merge;
    vi.spyOn(DeviceDatabase.prototype, 'merge').mockImplementationOnce(async function (this: DeviceDatabase, snapshot, preserve) {
      entered.resolve(); await release.promise; await merge.call(this, snapshot, preserve);
    });
    const syncing = engine.sync(); await entered.promise;
    engine.updateDocument(id, { body: textBody('New acknowledged writing during pull') }); await engine.flush();
    const acknowledgedHead = engine.getSnapshot().documents.find(document => document.id === id)!.headRevisionId;
    release.resolve(); await syncing;
    const state = engine.getSnapshot();
    expect(state.documents.find(document => document.id === id)?.plainText).toBe('New acknowledged writing during pull');
    expect(state.documents.find(document => document.id === id)?.headRevisionId).toBe(acknowledgedHead);
    expect((await cloud.load()).documents.find(document => document.id === id)?.plainText).toBe('New acknowledged writing during pull');
  });

  it('keeps local-only concurrent-tab conflicts visible after restart', async () => {
    const a = await open('device', null); const id = await a.createDocument({ body: textBody('Base') });
    const b = await open('device', null);
    a.updateDocument(id, { body: textBody('First tab retained') }); b.updateDocument(id, { body: textBody('Second tab retained') });
    await a.flush(); await b.flush();
    expect(b.getSnapshot().saveState).toBe('conflict');
    a.dispose(); b.dispose();
    const reopened = await open('device', null);
    expect(reopened.getSnapshot().saveState).toBe('conflict');
  });

  it('preserves a newly imported original before committing its revision during an ongoing sync', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    await engine.importText(new File(['Earlier raw bytes'], 'earlier.txt')); await engine.sync();
    const entered = deferred(); const release = deferred(); const preserve = cloud.putOriginal.bind(cloud);
    vi.spyOn(cloud, 'putOriginal').mockImplementationOnce(async original => { entered.resolve(); await release.promise; await preserve(original); });
    const syncing = engine.sync(false); await entered.promise;
    const id = await engine.importText(new File(['Late exact original\r\nहिन्दी'], 'late.txt'));
    release.resolve(); await syncing;
    expect(engine.getSnapshot().error).toBeNull();
    expect((await cloud.load()).documents.some(document => document.id === id)).toBe(true);
  });

  it('restores archive link targets before source revisions when timestamps tie', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    const time = '2026-10-23T00:00:00.000Z';
    const makeRevision = (id: string, documentId: string, body = textBody('Target')): Revision => {
      const snapshot = { id: documentId, universeId: 'archive-world', title: '', body, plainText: body.content?.[0].content?.[0].text ?? '', collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: time, updatedAt: time };
      return { id, documentId, universeId: snapshot.universeId, parentIds: [], snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
    };
    const target = makeRevision('z-target-revision', 'target');
    const source = makeRevision('a-source-revision', 'source', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Source link', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/target' } }] }] }] });
    const snapshot: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'from-another-device', universes: [{ id: 'archive-world', name: 'Archive', createdAt: time }], collections: [], originals: [], receipts: [], revisions: [source, target], documents: [source, target].map(revision => ({ ...revision.snapshot, headRevisionId: revision.id })) };
    const archive = await encodeArchive(snapshot);
    await engine.importArchive(new File([archive], 'archive.json')); await engine.sync();
    expect(engine.getSnapshot().error).toBeNull();
    expect((await cloud.load()).documents).toHaveLength(2);
  });

  it('restores valid mutually linked first revisions without inventing empty writing', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    const time = '2026-10-23T00:00:00.000Z';
    const makeRevision = (id: string, target: string): Revision => {
      const snapshot = { id, universeId: 'archive-world', title: '', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: id, marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + target } }] }] }] }, plainText: id, collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: time, updatedAt: time };
      return { id: `${id}-revision`, documentId: id, universeId: snapshot.universeId, parentIds: [], snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
    };
    const revisions = [makeRevision('a', 'b'), makeRevision('b', 'a')];
    const snapshot: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'original-account', universes: [{ id: 'archive-world', name: 'Mutual links', createdAt: time }], collections: [], originals: [], receipts: [], revisions, documents: revisions.map(revision => ({ ...revision.snapshot, headRevisionId: revision.id })) };
    await engine.importArchive(new File([await encodeArchive(snapshot)], 'mutual-links.json')); await engine.sync();
    expect(engine.getSnapshot().error).toBeNull();
    const remote = await cloud.load();
    expect(remote.revisions.map(revision => revision.id).sort()).toEqual(revisions.map(revision => revision.id).sort());
    expect(remote.documents).toHaveLength(2);
  });

  it('preserves an archive-selected branch or exposes a conflict when another branch sorts first', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    const makeRevision = (id: string, parents: string[], text: string, time: string): Revision => {
      const snapshot = { id: 'branched', universeId: 'archive-world', title: '', body: textBody(text), plainText: text, collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: '2026-10-23T00:00:00.000Z', updatedAt: time };
      return { id, documentId: snapshot.id, universeId: snapshot.universeId, parentIds: parents, snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
    };
    const base = makeRevision('base', [], 'Original', '2026-10-23T00:00:00.000Z');
    const first = makeRevision('first-unselected', ['base'], 'Earlier unselected alternative', '2026-10-23T00:00:01.000Z');
    const selected = makeRevision('selected', ['base'], 'Author-selected branch', '2026-10-23T00:00:02.000Z');
    const last = makeRevision('later-unselected', ['base'], 'Later unselected alternative', '2026-10-23T00:00:03.000Z');
    const snapshot: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'original', universes: [{ id: 'archive-world', name: 'Branches', createdAt: base.createdAt }], collections: [], originals: [], receipts: [], revisions: [base, first, selected, last], documents: [{ ...selected.snapshot, headRevisionId: selected.id }] };
    await engine.importArchive(new File([await encodeArchive(snapshot)], 'branches.json')); await engine.sync();
    for (let attempt = 0; attempt < 10 && engine.getSnapshot().pendingCount; attempt++) await engine.sync(false);
    const state = engine.getSnapshot();
    const restoredHead = state.documents.find(document => document.id === 'branched')!;
    expect(restoredHead.plainText).toBe(selected.snapshot.plainText);
    expect(restoredHead.origin).toBe(selected.snapshot.origin);
    expect(state.revisions.some(revision => revision.id === selected.id)).toBe(true);
    if (restoredHead.headRevisionId !== selected.id) expect(state.revisions.find(revision => revision.id === restoredHead.headRevisionId)?.restoredFrom).toBe(selected.id);
    const remote = await cloud.load();
    expect(remote.revisions.length).toBeGreaterThanOrEqual(4);
    expect(remote.documents[0].plainText === selected.snapshot.plainText || state.saveState === 'conflict').toBe(true);
  });

  it('rechecks that a restore notebook is empty inside its write transaction', async () => {
    const source = await open('source', null); await source.createDocument({ body: textBody('Archived source') });
    const archive = await source.exportArchive();
    const restoring = await open('target', null); const otherTab = await open('target', null);
    const entered = deferred(); const release = deferred(); const snapshot = DeviceDatabase.prototype.snapshot;
    vi.spyOn(DeviceDatabase.prototype, 'snapshot').mockImplementationOnce(async function (this: DeviceDatabase) {
      const prior = await snapshot.call(this); entered.resolve(); await release.promise; return prior;
    });
    const restore = restoring.importArchive(new File([archive], 'archive.json')); await entered.promise;
    const id = await otherTab.createDocument({ body: textBody('Created in the other tab during restore') });
    release.resolve();
    await expect(restore).rejects.toThrow(/empty|changed|writing|restore/i);
    const recovered = await open('target', null);
    const document = recovered.getSnapshot().documents.find(document => document.id === id)!;
    expect(recovered.getSnapshot().universes.some(universe => universe.id === document.universeId)).toBe(true);
  });

  it('does not replace new author writing while an imported archive is synchronizing its selected branch', async () => {
    const cloud = cloudService(); const engine = await open('author', cloud);
    const makeRevision = (id: string, parents: string[], text: string, second: number): Revision => {
      const time = `2026-10-23T00:00:0${second}.000Z`;
      const snapshot = { id: 'branched', universeId: 'archive-world', title: '', body: textBody(text), plainText: text, collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: '2026-10-23T00:00:00.000Z', updatedAt: time };
      return { id, documentId: snapshot.id, universeId: snapshot.universeId, parentIds: parents, snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
    };
    const base = makeRevision('base', [], 'Original', 0);
    const first = makeRevision('first', ['base'], 'Earlier unselected branch', 1);
    const selected = makeRevision('selected', ['base'], 'Imported chosen branch', 2);
    const archive: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'original', universes: [{ id: 'archive-world', name: 'Archive', createdAt: base.createdAt }], collections: [], originals: [], receipts: [], revisions: [base, first, selected], documents: [{ ...selected.snapshot, headRevisionId: selected.id }] };
    const entered = deferred(); const release = deferred(); const commit = cloud.commit.bind(cloud);
    vi.spyOn(cloud, 'commit').mockImplementationOnce(async operation => { entered.resolve(); await release.promise; return commit(operation); });
    await engine.importArchive(new File([await encodeArchive(archive)], 'archive.json')); await entered.promise;
    engine.updateDocument('branched', { body: textBody('New author writing after the import') }); await engine.flush();
    release.resolve();
    for (let attempt = 0; attempt < 10 && engine.getSnapshot().pendingCount; attempt++) await engine.sync(false);
    expect(engine.getSnapshot().documents.find(document => document.id === 'branched')?.plainText).toBe('New author writing after the import');
    expect(engine.getSnapshot().revisions.some(revision => revision.id === selected.id)).toBe(true);
  });

  it('does not publish an older tab-refresh snapshot after a newer checkpoint is acknowledged', async () => {
    const engine = await open('device', null); const id = await engine.createDocument({ body: textBody('Before tab refresh') });
    const entered = deferred(); const release = deferred(); const all = DeviceDatabase.prototype.all;
    vi.spyOn(DeviceDatabase.prototype, 'all').mockImplementationOnce(async function <T>(this: DeviceDatabase, name: Parameters<DeviceDatabase['all']>[0]): Promise<T[]> {
      const rows = await all.call(this, name) as T[]; entered.resolve(); await release.promise; return rows;
    });
    const refreshing = (engine as unknown as { refreshDisk(): Promise<void> }).refreshDisk(); await entered.promise;
    engine.updateDocument(id, { body: textBody('Acknowledged while refresh was waiting') }); await engine.flush();
    const head = engine.getSnapshot().documents.find(document => document.id === id)!.headRevisionId;
    const importedId = await engine.importText(new File(['Exact original captured during refresh\r\n'], 'during-refresh.txt'), 'recovered_original');
    const originalId = engine.getSnapshot().documents.find(document => document.id === importedId)!.sourceOriginalIds[0];
    release.resolve(); await refreshing;
    expect(engine.getSnapshot().documents.find(document => document.id === id)?.plainText).toBe('Acknowledged while refresh was waiting');
    expect(engine.getSnapshot().revisions.some(revision => revision.id === head)).toBe(true);
    expect(engine.getSnapshot().originals.some(original => original.id === originalId)).toBe(true);
    await expect(engine.exportArchive()).resolves.toBeInstanceOf(Blob);
  });

  it('refuses unsupported rich-text attributes in an otherwise correctly hashed archive', async () => {
    const engine = await open('device', null); await engine.createDocument({ body: textBody('Source words') });
    const archive = JSON.parse(await (await engine.exportArchive()).text());
    for (const revision of archive.snapshot.revisions) {
      revision.snapshot.body.content[0].attrs = { unsupportedFutureFormatting: 'must not silently disappear' };
      revision.contentHash = sha256(stableStringify(revision.snapshot));
    }
    for (const document of archive.snapshot.documents) document.body.content[0].attrs = { unsupportedFutureFormatting: 'must not silently disappear' };
    const { sha256: _old, ...payload } = archive; archive.sha256 = sha256(stableStringify(payload));
    await expect(decodeArchive(JSON.stringify(archive))).rejects.toThrow(/unsupported|invalid/i);
    expect(engine.getSnapshot().documents[0].plainText).toBe('Source words');
  });

  it('does not accept a restored revision whose source-original provenance has been removed', async () => {
    const engine = await open('device', null);
    const id = await engine.importText(new File(['User:\nOriginal\nAssistant:\nUnverified suggestion'], 'chat.txt'), 'imported_chat');
    const first = engine.getSnapshot().documents.find(document => document.id === id)!.headRevisionId!;
    engine.updateDocument(id, { body: textBody('A later experiment') }); await engine.flush(); await engine.restoreRevision(first);
    const archive = JSON.parse(await (await engine.exportArchive()).text());
    const restored = archive.snapshot.revisions.find((revision: Revision) => revision.restoredFrom === first);
    restored.snapshot.sourceOriginalIds = []; restored.contentHash = sha256(stableStringify(restored.snapshot));
    archive.snapshot.documents.find((document: { id: string }) => document.id === id).sourceOriginalIds = [];
    const { sha256: _old, ...payload } = archive; archive.sha256 = sha256(stableStringify(payload));
    await expect(decodeArchive(JSON.stringify(archive))).rejects.toThrow(/source|provenance|restore/i);
  });
});
