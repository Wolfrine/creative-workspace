import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { sha256, stableStringify } from '../src/service.mjs';

let app, db, bucket, authorToken, otherToken;
const uid = 'emulator-author';
const endpoint = 'http://127.0.0.1:15001/demo-noveliaa/asia-south1/';
const local = value => /^(127\.0\.0\.1|localhost):\d+$/.test(value || '');
async function token(userId) {
  const auth = getAuth(app);
  try { await auth.createUser({ uid: userId }); } catch (error) { if (error.code !== 'auth/uid-already-exists') throw error; }
  const customToken = await auth.createCustomToken(userId);
  const response = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-public-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const result = await response.json(); if (!result.idToken) throw new Error('Emulator sign-in failed.'); return result.idToken;
}
async function call(name, data, token) {
  const response = await fetch(endpoint + name, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data: data ?? {} }) });
  return { httpStatus: response.status, ...await response.json() };
}
const stage = async bytes => {
  const sha = sha256(bytes);
  await bucket.file(`noveliaaWorkspaces/${uid}/staging/${sha}`).save(bytes, { resumable: false }); return { sha256: sha };
};
const revision = (id, parents = [], text = 'Callable synthetic हिन्दी 🪶') => {
  const time = '2026-10-23T00:00:00.000Z';
  const snapshot = { id: 'callable-doc', universeId: 'callable-universe', title: '', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, plainText: text, collectionId: null, trashed: false, order: 0, origin: 'author', sourceOriginalIds: [], createdAt: time, updatedAt: time };
  return { id, documentId: snapshot.id, universeId: snapshot.universeId, parentIds: parents, snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
};
const operation = async (r, head = null, op = `op-${r.id}`) => ({ operationId: op, expectedHeadId: head, revision: r, blob: await stage(Buffer.from(stableStringify(r))) });
before(async () => {
  if (!local(process.env.FIRESTORE_EMULATOR_HOST) || !local(process.env.FIREBASE_AUTH_EMULATOR_HOST) || !local(process.env.FIREBASE_STORAGE_EMULATOR_HOST) || process.env.NOVELIAA_OWNER_UID !== uid) throw new Error('Callable tests require all local emulators and NOVELIAA_OWNER_UID=emulator-author.');
  app = initializeApp({ projectId: 'demo-noveliaa', storageBucket: 'demo-noveliaa.appspot.com' }, 'callable-test');
  db = getFirestore(app); bucket = getStorage(app).bucket();
  await db.doc('noveliaaConfig/access').set({ ownerUid: uid });
  authorToken = await token(uid); otherToken = await token('emulator-other');
});
after(async () => { if (db) await db.terminate(); if (app) await deleteApp(app); });
test('callables deny missing identity, other accounts and forged author fields', async () => {
  assert.equal((await call('loadWorkspace')).error.status, 'UNAUTHENTICATED');
  assert.equal((await call('loadWorkspace', { actorUid: uid }, otherToken)).error.status, 'PERMISSION_DENIED');
  assert.equal((await call('saveCatalog', { actorUid: uid, universes: [], collections: [] }, otherToken)).error.status, 'PERMISSION_DENIED');
  assert.equal((await call('registerDocumentIdentities', { documents: [{ id: 'forged', universeId: 'callable-universe' }] }, otherToken)).error.status, 'PERMISSION_DENIED');
  await db.doc('noveliaaConfig/access').delete();
  assert.equal((await call('loadWorkspace', {}, authorToken)).error.status, 'FAILED_PRECONDITION');
  await db.doc('noveliaaConfig/access').set({ ownerUid: uid });
  assert.equal((await call('loadWorkspace', {}, authorToken)).result.accountId, uid);
});
test('authenticated callable commit is idempotent and preserves a concurrent losing branch', async () => {
  const catalog = { universes: [{ id: 'callable-universe', name: 'Synthetic callable', createdAt: '2026-10-23T00:00:00.000Z' }], collections: [] };
  assert.equal((await call('saveCatalog', catalog, authorToken)).result.ok, true);
  assert.equal((await call('registerDocumentIdentities', { documents: [{ id: 'callable-doc', universeId: 'callable-universe' }] }, authorToken)).result.ok, true);
  const base = await operation(revision('base'));
  const first = await call('commitWriting', base, authorToken);
  assert.equal(first.result.status, 'synced');
  assert.deepEqual((await call('commitWriting', base, authorToken)).result, first.result);
  const left = await operation(revision('left', ['base'], 'left exact'), 'base');
  const right = await operation(revision('right', ['base'], 'right exact'), 'base');
  const results = await Promise.all([call('commitWriting', left, authorToken), call('commitWriting', right, authorToken)]);
  assert.deepEqual(results.map(result => result.result.status).sort(), ['conflict', 'synced']);
  assert.equal((await call('commitWriting', await operation(revision('changed'), null, base.operationId), authorToken)).error.status, 'ALREADY_EXISTS');
  const workspace = (await call('loadWorkspace', {}, authorToken)).result;
  assert.equal(workspace.revisions.length, 3); assert.equal(workspace.heads.length, 1);
});
test('callable rejects corrupt staged bytes and submitted actor fields without promotion', async () => {
  const bad = await operation(revision('corrupt', ['base']), 'base');
  await bucket.file(`noveliaaWorkspaces/${uid}/staging/${bad.blob.sha256}`).save(Buffer.from('corrupted'), { resumable: false });
  assert.equal((await call('commitWriting', bad, authorToken)).error.status, 'INVALID_ARGUMENT');
  const forged = { ...await operation(revision('forged', ['base']), 'base'), actorUid: uid };
  assert.equal((await call('commitWriting', forged, authorToken)).error.status, 'INVALID_ARGUMENT');
  assert.equal((await call('loadWorkspace', {}, authorToken)).result.revisions.length, 3);
});
