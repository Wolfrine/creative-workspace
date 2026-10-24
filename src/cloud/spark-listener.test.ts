import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { createFirestoreAdapter } from './spark';
import { sha256, stableStringify, validateSnapshot } from '../domain/codec';
import { textBody, type Revision, type WorkspaceSnapshot } from '../domain/model';

const harness = vi.hoisted(() => ({ listeners: new Map<string, (value: unknown) => void>(), records: new Map<string, unknown>(), read: vi.fn(), query: vi.fn() }));
vi.mock('firebase/firestore', async original => ({
  ...await original<typeof import('firebase/firestore')>(),
  onSnapshot: (reference: { path: string }, _options: unknown, next: (value: unknown) => void) => { const key = reference.path.split('/').at(-1)!; harness.listeners.set(key, next); return () => harness.listeners.delete(key); },
  getDocFromServer: async (reference: { path: string }) => { harness.read(reference.path); const value = harness.records.get(reference.path); return { exists: () => value !== undefined, data: () => value }; },
  getDocsFromServer: () => { harness.query(); throw new Error('Live hydration must not repeat full-library GETs.'); },
}));
const time = '2026-10-24T00:00:00.000Z', root = 'noveliaaWorkspaces/author/';
let app: ReturnType<typeof initializeApp>;
let stop: (() => void) | undefined;
beforeEach(() => { harness.listeners.clear(); harness.records.clear(); harness.read.mockClear(); harness.query.mockClear(); app = initializeApp({ projectId: 'demo-noveliaa' }, 'listener-' + crypto.randomUUID()); });
afterEach(async () => { stop?.(); stop = undefined; await deleteApp(app); });
const emit = (kind: string, rows: Record<string, unknown>, fromCache = false, pending = new Set<string>()) => harness.listeners.get(kind)!({ metadata: { fromCache, hasPendingWrites: pending.size > 0 }, docs: Object.entries(rows).map(([id, data]) => ({ id, data: () => data, metadata: { hasPendingWrites: pending.has(id) } })) });
async function fixture() {
  const revision = async (id: string, documentId: string, parents: string[], linked = false): Promise<Revision> => {
    const snapshot = { id: documentId, universeId: 'world', title: id, body: linked ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/b' } }] }] }] } : textBody(id), plainText: linked ? 'Link' : id, collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: time, updatedAt: time };
    return { id, documentId, universeId: 'world', parentIds: parents, snapshot, contentHash: await sha256(stableStringify(snapshot)), createdAt: time };
  };
  const revisions = [await revision('a-main', 'a', [], true), await revision('b-base', 'b', []), await revision('b-main', 'b', ['b-base']), await revision('b-losing', 'b', ['b-base'])];
  const metadata = Object.fromEntries(await Promise.all(revisions.map(async value => [value.id, { id: value.id, documentId: value.documentId, universeId: 'world', contentHash: value.contentHash, blobHash: await sha256(stableStringify(value)) }])));
  const heads = { a: { headRevisionId: 'a-main', universeId: 'world' }, b: { headRevisionId: 'b-main', universeId: 'world' } };
  const known: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'author', universes: [{ id: 'world', name: 'World', createdAt: time }], collections: [], originals: [], receipts: [], revisions, documents: [revisions[0], revisions[2]].map(value => ({ ...value.snapshot, headRevisionId: value.id })) };
  const adapter = createFirestoreAdapter(getFirestore(app), 'author'); stop = adapter.watch!(() => {}, error => { throw error; });
  emit('universes', { world: known.universes[0] }); emit('collections', {}); emit('originals', {});
  return { adapter, known, metadata, heads };
}

it('hydrates a head ahead of its revision event, preserves all linked losing branches, and reuses verified local bytes', async () => {
  const { adapter, known, metadata, heads } = await fixture();
  emit('documents', { a: heads.a }); emit('revisions', { ...metadata, 'a-main': undefined });
  // Model independently ordered server streams: the two missing records exist
  // on the server but their respective collection event has not arrived yet.
  emit('revisions', Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== 'a-main')));
  harness.records.set(root + 'revisions/a-main', metadata['a-main']); harness.records.set(root + 'documents/b', heads.b);
  const loaded = await adapter.load(known); await validateSnapshot(loaded);
  expect(loaded.revisions.map(value => value.id).sort()).toEqual(known.revisions.map(value => value.id).sort());
  expect(harness.read.mock.calls.map(([value]) => value).sort()).toEqual([root + 'documents/b', root + 'revisions/a-main']);
  expect(harness.query).not.toHaveBeenCalled();
});

it('retains confirmed rows during optimistic events and never adopts cached or pending heads', async () => {
  const { adapter, known, metadata, heads } = await fixture();
  emit('documents', heads); emit('revisions', metadata);
  expect((await adapter.load(known)).documents.find(value => value.id === 'b')?.headRevisionId).toBe('b-main');
  emit('documents', { ...heads, b: { ...heads.b, headRevisionId: 'optimistic-unacknowledged' } }, false, new Set(['b']));
  emit('documents', {}, true);
  const loaded = await adapter.load(known); await validateSnapshot(loaded);
  expect(loaded.documents).toHaveLength(2); expect(loaded.documents.find(value => value.id === 'b')?.headRevisionId).toBe('b-main');
  expect(harness.read).not.toHaveBeenCalled(); expect(harness.query).not.toHaveBeenCalled();
});
