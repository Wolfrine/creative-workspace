import { test, expect, type Page, type Request } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Synthetic account and actual Auth/Firestore emulators only. These inventory
// oracles must never query a production manuscript or application project.
for (const variable of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[variable] ?? '')) throw new Error(variable + ' must use the isolated loopback emulator.');
}
const requireAdmin = createRequire(path.resolve('functions/package.json'));
const { initializeApp, deleteApp } = requireAdmin('firebase-admin/app');
const { getAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore } = requireAdmin('firebase-admin/firestore');
const admin = initializeApp({ projectId: 'demo-noveliaa' }, 'spark-collection-reader-browser');
const auth = getAuth(admin), db = getFirestore(admin);
const author = 'spark-collection-reader-author';
// Each CI/local run writes fresh reports outside the retained, hash-bound
// release evidence. Copy a reviewed run into docs/evidence deliberately.
const evidence = process.env.NOVELIAA_COLLECTION_READER_EVIDENCE_DIR || '.local/spark-browser-collection-reader';
const namespaces = ['universes', 'collections', 'documentIdentities', 'documents', 'revisions', 'originals', 'operations', 'blobs', 'chunks'] as const;
let token: string;
const canvas = (page: Page) => page.getByRole('textbox', { name: 'Writing canvas', exact: true });
const collectionName = 'Synthetic tide collection';
const renamed = 'Synthetic salt and memory';
const text = Array.from({ length: 60 }, (_, index) => `Passage ${index}. The tide rose through the reeds. हिंदी é 🙂 The window held the last of the light. This original line remains the author’s own.`).join('\r\n\r\n');

function canonical(value: any): any {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { bytesBase64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
async function inventory() {
  return Object.fromEntries(await Promise.all(namespaces.map(async kind => {
    const rows = await db.collection('noveliaaWorkspaces/' + author + '/' + kind).get();
    return [kind, rows.docs.map((row: any) => ({ id: row.id, data: canonical(row.data()) })).sort((a: any, b: any) => a.id.localeCompare(b.id))];
  }))) as Record<typeof namespaces[number], { id: string; data: any }[]>;
}
async function recordInventory(name: string, before: unknown, after: unknown, observations?: unknown) {
  const result = JSON.stringify({ source: 'actual loopback Auth and Firestore emulators', syntheticAccount: author, before, after, observations }, null, 2) + '\n';
  await writeFile(path.join(evidence, name + '.json'), result, 'utf8');
  await test.info().attach(name, { body: result, contentType: 'application/json' });
}
async function signIn(page: Page) {
  await page.goto('/');
  await page.evaluate(async value => {
    const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts');
    await helper.signIn(value);
  }, token);
}
async function synced(page: Page) {
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.getByRole('button', { name: 'Check cloud sync', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Cloud synchronization checked.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close your writing, in your hands', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synced', exact: true })).toBeVisible({ timeout: 30000 });
}
async function seed(page: Page) {
  await signIn(page);
  await page.getByRole('button', { name: 'Browse collections', exact: true }).click();
  await page.getByRole('button', { name: 'New collection', exact: true }).click();
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill(collectionName);
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'Synthetic tide chapter.txt', mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await expect(canvas(page)).toContainText('Passage 59.');
  await page.getByRole('combobox', { name: 'Move writing to collection', exact: true }).click();
  await page.getByRole('option', { name: collectionName, exact: true }).click();
  await synced(page);
}
async function rename(page: Page) {
  await page.getByRole('button', { name: 'Options for collection ' + collectionName, exact: true }).click();
  await page.getByRole('button', { name: 'Rename collection', exact: true }).click();
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill(renamed);
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await synced(page);
}

test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
  await auth.createUser({ uid: author, displayName: 'Synthetic collection reader author' }).catch((error: any) => { if (error.code !== 'auth/uid-already-exists') throw error; });
  token = await auth.createCustomToken(author);
});
test.beforeEach(async () => {
  await db.doc('noveliaaConfig/access').set({ ownerUid: author });
  await db.recursiveDelete(db.doc('noveliaaWorkspaces/' + author));
});
test.afterAll(async () => { await deleteApp(admin); });

test('confirmed collection rename streams to a clean independent device without changing manuscript evidence', async ({ page, browser }) => {
  await seed(page); const before = await inventory();
  const other = await browser.newContext();
  try {
    const clean = await other.newPage(); await signIn(clean); await expect(canvas(clean)).toContainText('Passage 59.');
    await clean.getByRole('button', { name: 'Library', exact: true }).first().click();
    await clean.getByRole('button', { name: 'Collections 1', exact: true }).click();
    await expect(clean.getByRole('heading', { name: collectionName, exact: true })).toBeVisible();
    await rename(page);
    await expect(clean.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await expect(clean.locator('.collection-conflict-notice')).toHaveCount(0);
    await expect(clean.getByRole('button', { name: 'Review this page', exact: true })).toHaveCount(0);
    const after = await inventory();
    for (const kind of namespaces.filter(value => value !== 'collections')) expect(after[kind], kind + ' must remain byte-for-byte equivalent').toEqual(before[kind]);
    expect(after.collections.map(value => value.id)).toEqual(before.collections.map(value => value.id));
    expect(after.collections[0].data).toEqual({ ...before.collections[0].data, name: renamed, nameVersion: { id: expect.any(String), generation: 1 } });
    await recordInventory('emulator-rename-server-inventory', before, after);
  } finally { await other.close(); }
});

test('an offline stale device can add unrelated writing and a collection without undoing the confirmed name', async ({ page, browser }) => {
  await seed(page); const staleContext = await browser.newContext();
  try {
    const stale = await staleContext.newPage(); await signIn(stale); await expect(canvas(stale)).toContainText('Passage 59.');
    await staleContext.setOffline(true);
    await stale.getByRole('button', { name: 'Browse collections', exact: true }).click();
    await stale.getByRole('button', { name: 'New collection', exact: true }).click();
    await stale.getByRole('textbox', { name: 'Collection name', exact: true }).fill('Unrelated offline collection');
    await stale.getByRole('button', { name: 'Create collection', exact: true }).click();
    await stale.getByRole('button', { name: 'New thought ↗', exact: true }).click();
    await stale.getByRole('textbox', { name: 'Writing title', exact: true }).fill('Unrelated offline page');
    await canvas(stale).fill('Exact unrelated words written while this device knew the old collection name.');
    await rename(page); const before = await inventory(); const protectedCollection = before.collections.find(value => value.data.name === renamed)!;
    await staleContext.setOffline(false); await synced(stale);
    const after = await inventory();
    expect(after.collections.find(value => value.id === protectedCollection.id)).toEqual(protectedCollection);
    expect(after.collections.map(value => value.data.name)).toEqual(expect.arrayContaining([renamed, 'Unrelated offline collection']));
    expect(after.documents).toHaveLength(before.documents.length + 1);
    expect(after.originals).toEqual(before.originals);
    await expect(page.getByRole('button', { name: /Unrelated offline page/ }).first()).toBeVisible();
    await expect(stale.locator('.collection-conflict-notice')).toHaveCount(0);
    await recordInventory('emulator-stale-catalog-server-inventory', before, after);
  } finally { await staleContext.close(); }
});

test('reader entry, page turns, appearance changes and exit leave the complete server inventory unchanged', async ({ page }) => {
  const writeRequests: { method: string; url: string }[] = [];
  const observeWrite = (request: Request) => {
    const url = request.url();
    if (request.method() === 'POST' && /(?:\/documents:(?:commit|batchWrite)|\/Firestore\/(?:Write|Commit)\/)/u.test(url)) writeRequests.push({ method: request.method(), url });
  };
  page.on('request', observeWrite);
  await seed(page); const before = await inventory();
  // Positive control: the oracle must detect the real seed's cloud writes.
  expect(writeRequests.length).toBeGreaterThan(0); const seedWriteRequests = writeRequests.length;
  expect(before.originals).toHaveLength(1); expect(before.revisions.length).toBeGreaterThan(0);
  await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('.library-tabs').getByRole('button', { name: /^Pages/ }).click();
  for (const layout of ['Tile', 'List', 'Detailed']) await page.getByRole('button', { name: layout + ' view', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('Passage 59');
  await page.locator('.main-nav').getByRole('button', { name: 'Continue writing', exact: true }).click();
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-pages'))).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-page'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await page.getByRole('combobox', { name: 'Reading typeface', exact: true }).selectOption('sans');
  await page.getByRole('combobox', { name: 'Reading margins', exact: true }).selectOption('wide');
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Page-turn animation', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
  await expect(page.locator('.reader')).toHaveClass(/reader-night/);
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(canvas(page)).toContainText('Passage 59.');
  await expect(page.getByRole('button', { name: 'Synced', exact: true })).toBeVisible();
  const after = await inventory(); expect(after).toEqual(before);
  const duringReading = writeRequests.slice(seedWriteRequests); expect(duringReading).toEqual([]);
  page.off('request', observeWrite);
  await recordInventory('emulator-reader-zero-writes-server-inventory', before, after, { seedFirestoreWriteRequests: seedWriteRequests, readingFirestoreWriteRequests: duringReading });
});
