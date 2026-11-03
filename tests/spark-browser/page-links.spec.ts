import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pagePath } from '../../functions/src/page-url.mjs';

for (const variable of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[variable] ?? '')) throw new Error('Loopback emulators required.');
}
const adminRequire = createRequire(path.resolve('functions/package.json'));
const { initializeApp, deleteApp } = adminRequire('firebase-admin/app');
const { getAuth } = adminRequire('firebase-admin/auth');
const { getFirestore } = adminRequire('firebase-admin/firestore');
const app = initializeApp({ projectId: 'demo-noveliaa' }, 'page-links-browser');
const db = getFirestore(app), auth = getAuth(app), uid = 'synthetic-page-link-author';
const root = db.doc('noveliaaWorkspaces/' + uid);
const stable = (value: any): string => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const now = '2026-11-03T00:00:00.000Z';
const a = { id: 'exact-scene-a', universeId: 'world-a', collectionId: 'drafts-a', title: 'Same title' };
const b = { id: 'exact-scene-b', universeId: 'world-b', collectionId: null, title: 'Same title' };
let token: string;
test.beforeAll(async () => {
  await auth.createUser({ uid }).catch((error: any) => { if (error.code !== 'auth/uid-already-exists') throw error; });
  token = await auth.createCustomToken(uid);
  await db.doc('noveliaaConfig/access').set({ ownerUid: uid });
  for (const universeId of ['world-a', 'world-b']) await root.collection('universes').doc(universeId).set({ id: universeId, name: universeId, createdAt: now });
  await root.collection('collections').doc('drafts-a').set({ id: 'drafts-a', universeId: 'world-a', name: 'Draft chapters', order: 0 });
  for (const page of [a, b]) {
    const text = 'Exact synthetic text for ' + page.id;
    const snapshot = { ...page, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, plainText: text, trashed: false, order: 0, origin: 'author', sourceOriginalIds: [], createdAt: now, updatedAt: now };
    const revision = { id: 'revision-' + page.id, documentId: page.id, universeId: page.universeId, snapshot, contentHash: digest(stable(snapshot)), parentIds: [], createdAt: now };
    const bytes = Buffer.from(stable(revision)), zipped = gzipSync(bytes), hash = digest(bytes), chunk = digest(zipped);
    await root.collection('chunks').doc(chunk).set({ sha256: chunk, bytes: zipped });
    await root.collection('blobs').doc(hash).set({ sha256: hash, size: bytes.length, encodedSize: zipped.length, encoding: 'gzip', chunks: [chunk] });
    await root.collection('revisions').doc(revision.id).set({ id: revision.id, documentId: page.id, universeId: page.universeId, blobHash: hash, contentHash: revision.contentHash });
    await root.collection('documents').doc(page.id).set({ id: page.id, universeId: page.universeId, headRevisionId: revision.id });
  }
});
test.afterAll(async () => { await deleteApp(app); });
test('signed-out URL survives normal author authentication, fresh cloud hydration, refresh and universe changes without writes', async ({ page, browser }) => {
  const before = await root.collection('revisions').get();
  await page.goto(pagePath(b));
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveCount(0);
  await page.evaluate(async value => { const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts'); await helper.signIn(value); }, token);
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('Exact synthetic text for ' + b.id);
  await expect(page.getByRole('combobox', { name: 'Story universe' })).toHaveValue(b.universeId);
  await page.goto(pagePath(a, 'Old collection name'));
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('Exact synthetic text for ' + a.id);
  await expect(page).toHaveURL(new RegExp('/draft-chapters/'));
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('Exact synthetic text for ' + a.id);
  const fresh = await browser.newContext(); const tab = await fresh.newPage();
  await tab.goto('http://127.0.0.1:5820' + pagePath(b));
  await tab.evaluate(async value => { const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts'); await helper.signIn(value); }, token);
  await expect(tab.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('Exact synthetic text for ' + b.id);
  await fresh.close();
  expect((await root.collection('revisions').get()).docs.map((d: any) => d.id)).toEqual(before.docs.map((d: any) => d.id));
  expect((await root.collection('operations').get()).size).toBe(0);
});
