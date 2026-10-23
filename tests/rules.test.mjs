import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getMetadata, deleteObject } from 'firebase/storage';
import { runTrustedEmulatorScenario } from '../functions/test/firebase-emulator.mjs';

const projectId = 'demo-noveliaa';
let environment;
const bytes = new TextEncoder().encode('Synthetic original\r\nनमस्ते 🪶');
const digest = createHash('sha256').update(bytes).digest('hex');
const options = { contentType: 'application/octet-stream', customMetadata: { sha256: digest } };
before(async () => {
  environment = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 18080, rules: await readFile('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 19199, rules: await readFile('storage.rules', 'utf8') },
  });
});
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'noveliaaConfig/access'), { ownerUid: 'author' });
    await setDoc(doc(context.firestore(), 'noveliaaWorkspaces/author/revisions/r1'), { id: 'r1', canary: 'PRIVATE_AUTHOR' });
    await setDoc(doc(context.firestore(), 'noveliaaWorkspaces/other/revisions/r1'), { id: 'r1', canary: 'PRIVATE_OTHER' });
  });
});
after(async () => { await environment?.cleanup(); });
test('configured owner can read own writing, history, originals and save receipts', async () => {
  const db = environment.authenticatedContext('author').firestore();
  await assertSucceeds(getDoc(doc(db, 'noveliaaWorkspaces/author/revisions/r1')));
  await assertSucceeds(getDocs(collection(db, 'noveliaaWorkspaces/author/revisions')));
  for (const name of ['meta', 'documents', 'originals', 'operations']) await assertSucceeds(getDoc(doc(db, `noveliaaWorkspaces/author/${name}/synthetic`)));
});
test('other and unauthenticated identities cannot read owner workspace', async () => {
  for (const context of [environment.authenticatedContext('other'), environment.unauthenticatedContext()]) {
    await assertFails(getDoc(doc(context.firestore(), 'noveliaaWorkspaces/author/revisions/r1')));
    await assertFails(getDocs(collection(context.firestore(), 'noveliaaWorkspaces/author/revisions')));
  }
  await assertFails(getDoc(doc(environment.authenticatedContext('author').firestore(), 'noveliaaWorkspaces/other/revisions/r1')));
  await assertFails(getDoc(doc(environment.authenticatedContext('other').firestore(), 'noveliaaWorkspaces/other/revisions/r1')));
});
test('direct writes, deletes, original edits, config edits and later-phase paths denied to owner too', async () => {
  const db = environment.authenticatedContext('author').firestore();
  for (const name of ['meta', 'documentIdentities', 'documents', 'revisions', 'originals', 'operations', 'editions', 'feedback', 'grants']) {
    await assertFails(setDoc(doc(db, `noveliaaWorkspaces/author/${name}/forged`), { actorUid: 'author', canon: true }));
    await assertFails(deleteDoc(doc(db, `noveliaaWorkspaces/author/${name}/r1`)));
  }
  await assertFails(setDoc(doc(db, 'noveliaaConfig/access'), { ownerUid: 'other' }));
  await assertFails(getDoc(doc(db, 'noveliaaConfig/access')));
  await assertFails(setDoc(doc(db, 'users/author/arbitrary/document'), { forged: true }));
});
test('missing allowlist denies signed-in owner', async () => {
  await environment.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'noveliaaConfig/access')));
  const context = environment.authenticatedContext('author');
  await assertFails(getDoc(doc(context.firestore(), 'noveliaaWorkspaces/author/revisions/r1')));
  await assertFails(uploadBytes(ref(context.storage(), `noveliaaWorkspaces/author/staging/${digest}`), bytes, options));
});
test('owner can stage bytes once; overwrites and deletes remain denied', async () => {
  const object = ref(environment.authenticatedContext('author').storage(), `noveliaaWorkspaces/author/staging/${digest}`);
  await assertSucceeds(uploadBytes(object, bytes, options));
  await assertSucceeds(getMetadata(object));
  await assertFails(uploadBytes(object, new TextEncoder().encode('overwritten'), options));
  await assertFails(deleteObject(object));
});
test('Storage denies other account, unauthenticated access, invalid path and forged metadata', async () => {
  for (const context of [environment.authenticatedContext('other'), environment.unauthenticatedContext()]) {
    const object = ref(context.storage(), `noveliaaWorkspaces/author/staging/${digest}`);
    await assertFails(getMetadata(object)); await assertFails(uploadBytes(object, bytes, options));
  }
  const storage = environment.authenticatedContext('author').storage();
  await assertFails(uploadBytes(ref(storage, 'noveliaaWorkspaces/author/staging/not-a-digest'), bytes, options));
  const otherDigest = 'a'.repeat(64);
  await assertFails(uploadBytes(ref(storage, `noveliaaWorkspaces/author/staging/${otherDigest}`), bytes, options));
  await assertFails(uploadBytes(ref(storage, `noveliaaWorkspaces/other/staging/${digest}`), bytes, options));
  await assertFails(uploadBytes(ref(storage, `users/author/${digest}`), bytes, options));
});
test('final blobs are readable by owner, immutable and private', async () => {
  const path = `noveliaaWorkspaces/author/blobs/${digest}`;
  await environment.withSecurityRulesDisabled(context => uploadBytes(ref(context.storage(), path), bytes, options));
  const storage = environment.authenticatedContext('author').storage();
  const object = ref(storage, path);
  await assertSucceeds(getMetadata(object));
  await assertFails(uploadBytes(object, bytes, options)); await assertFails(deleteObject(object));
  await assertFails(getMetadata(ref(environment.authenticatedContext('other').storage(), path)));
  await assertFails(getMetadata(ref(environment.unauthenticatedContext().storage(), path)));
  assert.equal((await getMetadata(object)).size, bytes.length);
});
test('backups and arbitrary recursive paths are never client readable/writable', async () => {
  const context = environment.authenticatedContext('author');
  for (const path of ['backups/author/archive.json', `noveliaaWorkspaces/author/backups/${digest}`, `noveliaaWorkspaces/author/blobs/${digest}/nested`]) {
    await assertFails(getMetadata(ref(context.storage(), path)));
    await assertFails(uploadBytes(ref(context.storage(), path), bytes, options));
  }
  await assertFails(getDoc(doc(context.firestore(), 'noveliaaWorkspaces/author/revisions/r1/nested/leak')));
});
test('trusted Admin path preserves concurrent branches, retries, byte digests and isolated backup recovery', async context => {
  const result = await runTrustedEmulatorScenario();
  context.diagnostic(JSON.stringify({ dataset: 'synthetic', ...result }));
});
