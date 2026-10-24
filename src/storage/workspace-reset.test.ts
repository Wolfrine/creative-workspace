import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { DeviceDatabase } from './database';
import { WritingEngine } from '../state/engine';
import { textBody, type CloudAdapter } from '../domain/model';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
it('opens a fresh store after reset, deletes prior stores, preserves another account and does not replay the old outbox', async () => {
  const old = new WritingEngine('author', null); await old.initialize();
  await old.createDocument({ body: textBody('Old authorized-for-deletion writing') }); old.dispose();
  const other = await DeviceDatabase.open('different-author'); await other.setPreference('canary', 'retain'); other.close();
  const fresh = await DeviceDatabase.open('author', 'reset_new');
  expect((await fresh.snapshot()).documents).toEqual([]); expect(await fresh.all('outbox')).toEqual([]);
  await vi.waitFor(async () => expect((await indexedDB.databases()).map(database => database.name)).not.toContain('noveliaa-writing-v1-author'));
  fresh.close();
  const retained = await DeviceDatabase.open('different-author'); expect(await retained.getPreference('canary')).toBe('retain'); retained.close();
});
it('keeps the new workspace across reopening with the same server key', async () => {
  const cloud: CloudAdapter = { workspaceId: 'reset_new', load: async cache => cache!, putCatalog: async () => {}, putOriginal: async () => {}, commit: async operation => ({ status: 'synced', headRevisionId: operation.revision.id }) };
  const first = new WritingEngine('author', cloud); await first.initialize();
  await first.createDocument({ body: textBody('Fresh writing after reset') }); first.dispose();
  const second = new WritingEngine('author', cloud); await second.initialize();
  expect(second.getSnapshot().documents[0].plainText).toBe('Fresh writing after reset'); second.dispose();
});
it('does not clear a concurrent tab warning while an unreviewed pending revision remains', async () => {
  const engine = new WritingEngine('author', null); await engine.initialize();
  const id = await engine.createDocument({ body: textBody('Base') });
  const base = engine.getSnapshot().documents[0].headRevisionId!;
  engine.updateDocument(id, { body: textBody('An unreviewed tab revision') }); await engine.checkpoint();
  engine.updateDocument(id, { body: textBody('Explicit selected revision') }); await engine.checkpoint();
  const selected = engine.getSnapshot().documents[0].headRevisionId!;
  const db = await DeviceDatabase.open('author'); await db.markConflict(id);
  expect(await db.finishResolution(id, selected, [base])).toBe(false);
  expect(await db.conflicts()).toEqual([id]);
  expect((await db.snapshot()).revisions).toHaveLength(3);
  db.close(); engine.dispose();
});
it('a stale named workspace selection cannot delete a newer named device store', async () => {
  const newer = await DeviceDatabase.open('author', 'reset_newer'); await newer.setPreference('new-writing-canary', 'retain'); newer.close();
  const stale = await DeviceDatabase.open('author', 'reset_older'); stale.close();
  const reopened = await DeviceDatabase.open('author', 'reset_newer');
  expect(await reopened.getPreference('new-writing-canary')).toBe('retain'); reopened.close();
});
