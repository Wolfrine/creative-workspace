import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, commitOperation, putCatalog, putOriginal, registerDocuments, sha256, stableStringify, ServiceError } from '../src/service.mjs';
import { createBackup, verifyBackup } from '../src/backup.mjs';

const time = '2026-10-23T00:00:00.000Z';
function revision(id = 'r1', { documentId = 'd1', universeId = 'u1', parents = [], text = 'नमस्ते — original 🪶', origin = 'author', sourceOriginalIds = [], body } = {}) {
  const snapshot = { id: documentId, universeId, title: '', body: body ?? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, plainText: text, collectionId: null, trashed: false, order: 0, origin, sourceOriginalIds, createdAt: time, updatedAt: time };
  return { id, documentId, universeId, parentIds: parents, snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
}
function environment() {
  const tables = new Map(); const blobs = new Map(); let queue = Promise.resolve();
  const key = (table, id) => `${table}/${id}`;
  const deps = {
    ownerUid: 'author', now: () => time,
    transaction: callback => {
      const task = queue.then(async () => {
        const current = new Map(structuredClone([...tables]));
        const result = await callback({
          get: async (table, id) => structuredClone(current.get(key(table, id))),
          set: (table, id, data) => current.set(key(table, id), structuredClone(data)),
          create: (table, id, data) => { assert.equal(current.has(key(table, id)), false); current.set(key(table, id), structuredClone(data)); },
        });
        tables.clear(); for (const [k, value] of current) tables.set(k, value);
        return result;
      });
      queue = task.catch(() => {}); return task;
    },
    verifyBlob: async (_uid, descriptor, expected, expectedDigest) => {
      const bytes = blobs.get(descriptor?.sha256);
      if (!bytes || sha256(bytes) !== descriptor.sha256 || (expected && !bytes.equals(expected)) || (expectedDigest && expectedDigest !== descriptor.sha256)) throw new ServiceError('invalid-argument', 'Bad blob');
      return { path: `noveliaaWorkspaces/author/blobs/${descriptor.sha256}`, generation: '1', sha256: descriptor.sha256, size: bytes.length };
    },
  };
  const stage = bytes => { const buffer = Buffer.from(bytes); const digest = sha256(buffer); blobs.set(digest, buffer); return { sha256: digest }; };
  const input = (r, expectedHeadId = null, operationId = `op-${r.id}`) => ({ operationId, expectedHeadId, revision: r, blob: stage(stableStringify(r)) });
  const setup = () => putCatalog('author', { universes: [{ id: 'u1', name: 'Writing', createdAt: time }, { id: 'u2', name: 'Separate', createdAt: time }], collections: [] }, deps);
  const rows = table => [...tables.entries()].filter(([k]) => k.startsWith(`${table}/`)).map(([k, v]) => ({ ...v, _id: k.slice(table.length + 1) }));
  return { deps, tables, blobs, stage, input, setup, rows };
}
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('authorization fails closed for unauthenticated, other account and unset owner', () => {
  for (const [uid, owner] of [[undefined, 'author'], ['other', 'author'], ['author', '']]) assert.throws(() => authorize(uid, owner));
  assert.doesNotThrow(() => authorize('author', 'author'));
});
test('every callable service derives actor from verified uid', async () => {
  const e = environment(); await e.setup();
  for (const uid of [undefined, 'other']) {
    await rejects(commitOperation(uid, e.input(revision()), e.deps), uid ? 'permission-denied' : 'unauthenticated');
    await rejects(putCatalog(uid, { universes: [], collections: [] }, e.deps), uid ? 'permission-denied' : 'unauthenticated');
    await rejects(putOriginal(uid, {}, e.deps), uid ? 'permission-denied' : 'unauthenticated');
  }
  const forged = { ...e.input(revision()), actorUid: 'author' };
  await rejects(commitOperation('author', forged, e.deps), 'invalid-argument');
  assert.equal(e.rows('revisions').length, 0);
});
test('response-loss retry is exactly idempotent; changed payload with same ID conflicts', async () => {
  const e = environment(); await e.setup(); const input = e.input(revision());
  const first = await commitOperation('author', input, e.deps);
  assert.deepEqual(await commitOperation('author', input, e.deps), first);
  await rejects(commitOperation('author', e.input(revision('different'), null, input.operationId), e.deps), 'already-exists');
  assert.equal(e.rows('revisions').length, 1); assert.equal(e.rows('operations').length, 1);
  assert.equal(e.rows('operations')[0].actorUid, 'author');
});
test('two concurrent devices retain both branches and promote only one from the same base', async () => {
  const e = environment(); await e.setup(); await commitOperation('author', e.input(revision()), e.deps);
  const left = e.input(revision('left', { parents: ['r1'], text: 'left exact' }), 'r1');
  const right = e.input(revision('right', { parents: ['r1'], text: 'right exact' }), 'r1');
  const outcomes = await Promise.all([commitOperation('author', left, e.deps), commitOperation('author', right, e.deps)]);
  assert.deepEqual(outcomes.map(item => item.status), ['synced', 'conflict']);
  assert.equal(e.rows('revisions').length, 3); assert.equal(e.rows('documents')[0].headRevisionId, 'left');
  const follow = e.input(revision('right-child', { parents: ['right'], text: 'still retained' }), 'right');
  assert.equal((await commitOperation('author', follow, e.deps)).status, 'conflict');
  assert.equal(e.rows('revisions').length, 4);
});
test('new document race and reverse reconnect preserve both variants', async () => {
  const e = environment(); await e.setup();
  const outcomes = await Promise.all(['right', 'left'].map(id => commitOperation('author', e.input(revision(id)), e.deps)));
  assert.deepEqual(outcomes.map(item => item.status), ['synced', 'conflict']);
  assert.equal(e.rows('documents')[0].headRevisionId, 'right'); assert.equal(e.rows('revisions').length, 2);
});
test('missing, mismatched and changed blobs never finalize a revision', async () => {
  const e = environment(); await e.setup(); const input = e.input(revision());
  e.blobs.clear(); await rejects(commitOperation('author', input, e.deps), 'invalid-argument');
  const good = e.input(revision()); e.blobs.set(good.blob.sha256, Buffer.from('replaced'));
  await rejects(commitOperation('author', good, e.deps), 'invalid-argument');
  assert.equal(e.rows('documents').length, 0); assert.equal(e.rows('revisions').length, 0);
});
test('original source bytes and metadata are immutable and retryable', async () => {
  const e = environment(); await e.setup(); const bytes = Buffer.from('USER: original\r\nASSISTANT: unverified\r\n');
  const original = { id: 'original', universeId: 'u1', name: 'raw.txt', sha256: sha256(bytes), origin: 'imported_chat', verification: 'unverified', sourceReference: 'explicit upload', createdAt: time, speakerSegments: [{ role: 'user', start: 0, end: 14 }, { role: 'unknown', start: 14, end: 39 }] };
  const input = { original, blob: e.stage(bytes) };
  await putOriginal('author', input, e.deps); await putOriginal('author', input, e.deps);
  await rejects(putOriginal('author', { ...input, original: { ...original, origin: 'author' } }, e.deps), 'already-exists');
  await commitOperation('author', e.input(revision('r1', { origin: 'imported_chat', sourceOriginalIds: ['original'] })), e.deps);
  assert.equal(e.rows('originals').length, 1); assert.deepEqual(e.blobs.get(original.sha256), bytes);
});
test('cross-universe source, collection, parent and link references are refused', async () => {
  const e = environment(); await e.setup();
  await commitOperation('author', e.input(revision('other-r', { documentId: 'other', universeId: 'u2' })), e.deps);
  await rejects(commitOperation('author', e.input(revision('bad-parent', { parents: ['other-r'] }), 'other-r'), e.deps), 'invalid-argument');
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/other' } }] }] }] };
  await rejects(commitOperation('author', e.input(revision('bad-link', { text: 'Link', body })), e.deps), 'invalid-argument');
  await rejects(commitOperation('author', e.input(revision('bad-source', { sourceOriginalIds: ['absent'] })), e.deps), 'invalid-argument');
  const r = revision('bad-collection'); r.snapshot.collectionId = 'absent'; r.contentHash = sha256(stableStringify(r.snapshot));
  await rejects(commitOperation('author', e.input(r), e.deps), 'invalid-argument');
  assert.equal(e.rows('revisions').length, 1);
});
test('identity registration supports mutually linked first revisions without creating a head or writing text', async () => {
  const e = environment(); await e.setup();
  const docs = [{ id: 'a', universeId: 'u1' }, { id: 'b', universeId: 'u1' }];
  await registerDocuments('author', { documents: docs }, e.deps);
  await registerDocuments('author', { documents: docs }, e.deps);
  assert.equal(e.rows('documents').length, 0); assert.equal(e.rows('revisions').length, 0);
  assert.equal(e.rows('documentIdentities').length, 2);
  for (const [documentId, target] of [['a', 'b'], ['b', 'a']]) {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: documentId, marks: [{ type: 'link', attrs: { href: `noveliaa://document/${target}` } }] }] }] };
    await commitOperation('author', e.input(revision(`r-${documentId}`, { documentId, text: documentId, body })), e.deps);
  }
  assert.equal(e.rows('documents').length, 2); assert.equal(e.rows('revisions').length, 2);
});
test('writing identities cannot be forged, cross universes, carry placeholder text or bypass authorization', async () => {
  const e = environment(); await e.setup();
  await registerDocuments('author', { documents: [{ id: 'a', universeId: 'u1' }] }, e.deps);
  await rejects(registerDocuments('other', { documents: [{ id: 'b', universeId: 'u1' }] }, e.deps), 'permission-denied');
  await rejects(registerDocuments('author', { documents: [{ id: 'a', universeId: 'u2' }] }, e.deps), 'already-exists');
  await rejects(registerDocuments('author', { documents: [{ id: 'a', universeId: 'u1', title: 'placeholder' }] }, e.deps), 'invalid-argument');
  await rejects(registerDocuments('author', { documents: [{ id: 'b', universeId: 'missing' }] }, e.deps), 'invalid-argument');
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Crossed', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/a' } }] }] }] };
  await rejects(commitOperation('author', e.input(revision('cross', { universeId: 'u2', text: 'Crossed', body })), e.deps), 'invalid-argument');
});
test('accepts Tiptap 3.32 link attributes including nullable title without stripping any field', async () => {
  const e = environment(); await e.setup();
  await registerDocuments('author', { documents: [{ id: 'target', universeId: 'u1' }] }, e.deps);
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A doorway', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/target', target: null, rel: 'noopener noreferrer', class: null, title: null } }] }] }] };
  const r = revision('tiptap-link', { text: 'A doorway', body }); const input = e.input(r);
  assert.equal((await commitOperation('author', input, e.deps)).status, 'synced');
  assert.deepEqual(JSON.parse(e.blobs.get(input.blob.sha256).toString()).snapshot.body, body);
  const invalidBody = structuredClone(body); invalidBody.content[0].content[0].marks[0].attrs.title = { unsafe: 'object' };
  await rejects(commitOperation('author', e.input(revision('bad-title', { text: 'A doorway', body: invalidBody })), e.deps), 'invalid-argument');
});
test('unknown editor nodes, unknown fields, unsafe links and invalid text projections fail without stripping', async () => {
  const e = environment(); await e.setup();
  for (const alter of [r => { r.snapshot.body.content[0].type = 'unsupported'; }, r => { r.snapshot.plainText = 'different'; }, r => { r.snapshot.canon = true; }, r => { r.snapshot.body.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]; }]) {
    const r = revision(); alter(r); r.contentHash = sha256(stableStringify(r.snapshot));
    await rejects(commitOperation('author', e.input(r), e.deps), 'invalid-argument');
  }
  assert.equal(e.rows('revisions').length, 0);
});
test('restoration retains all history and cannot relabel source provenance', async () => {
  const e = environment(); await e.setup(); await commitOperation('author', e.input(revision('r1', { origin: 'ai' })), e.deps);
  await commitOperation('author', e.input(revision('r2', { parents: ['r1'], origin: 'mixed' }), 'r1'), e.deps);
  const invalid = { ...revision('restore-bad', { parents: ['r2'], origin: 'author' }), restoredFrom: 'r1' };
  await rejects(commitOperation('author', e.input(invalid, 'r2'), e.deps), 'invalid-argument');
  const restored = { ...revision('restore', { parents: ['r2'], origin: 'ai' }), restoredFrom: 'r1' };
  await commitOperation('author', e.input(restored, 'r2'), e.deps);
  assert.equal(e.rows('revisions').length, 3); assert.equal(e.rows('documents')[0].headRevisionId, 'restore');
});
test('catalog cannot remove or move existing collections/universes', async () => {
  const e = environment(); await e.setup();
  await rejects(putCatalog('author', { universes: [], collections: [] }, e.deps), 'invalid-argument');
  const catalog = e.rows('meta')[0];
  await putCatalog('author', { universes: catalog.universes, collections: [{ id: 'c1', universeId: 'u1', name: 'Scenes', order: 0 }] }, e.deps);
  await rejects(putCatalog('author', { universes: catalog.universes, collections: [{ id: 'c1', universeId: 'u2', name: 'Scenes', order: 0 }] }, e.deps), 'invalid-argument');
});
test('backup verifies blobs, revision graph and head inventory; interrupted/corrupt backup fails', async () => {
  const e = environment(); await e.setup(); await commitOperation('author', e.input(revision()), e.deps);
  const workspace = Object.fromEntries(['meta', 'documents', 'revisions', 'originals', 'operations'].map(name => [name, e.rows(name)]));
  const options = { accountId: 'author', workspace, readBlob: async reference => e.blobs.get(reference.sha256), createdAt: time };
  const bytes = await createBackup(options); const archive = verifyBackup(bytes);
  assert.equal(archive.workspace.revisions.length, 1);
  const corrupt = JSON.parse(bytes); corrupt.workspace.documents[0].headRevisionId = 'missing';
  assert.throws(() => verifyBackup(Buffer.from(JSON.stringify(corrupt))), /digest/);
  await assert.rejects(createBackup({ ...options, readBlob: async () => Buffer.from('interrupted') }), /digest/);
  workspace.documents[0].headRevisionId = 'absent';
  await assert.rejects(createBackup(options), /head/);
});
