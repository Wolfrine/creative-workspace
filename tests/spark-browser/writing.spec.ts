import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

const requireAdmin = createRequire(path.resolve('functions/package.json'));
const { initializeApp } = requireAdmin('firebase-admin/app');
const { getAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore } = requireAdmin('firebase-admin/firestore');
for (const variable of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[variable] ?? '')) throw new Error(variable + ' must use an isolated loopback emulator.');
}
const admin = initializeApp({ projectId: 'demo-noveliaa' }, 'spark-browser');
const auth = getAuth(admin), db = getFirestore(admin);
const author = 'spark-browser-author';
let token: string;
const evidence = '.local/spark-browser';
const canvas = (page: Page) => page.getByRole('textbox', { name: 'Writing canvas', exact: true });
const synced = async (page: Page) => {
  // Most flows test integrity, not the minute-long scheduler. Use the actual
  // author's manual sync action; the automatic deadline has a separate test.
  // Focused mobile writing intentionally hides bottom navigation. The header
  // menu remains available with the keyboard open as well as after a restore.
  if ((page.viewportSize()?.width ?? 1440) <= 650) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.getByRole('button', { name: 'Check cloud sync', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Cloud synchronization checked.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close your writing, in your hands', exact: true }).click();
  await expect(page.getByText('Synced', { exact: true }).first()).toBeVisible({ timeout: 30000 });
};
async function signIn(page: Page, customToken = token) {
  await page.goto('/');
  await page.evaluate(async value => {
    const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts');
    await helper.signIn(value);
  }, customToken);
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
}
test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
  await auth.createUser({ uid: author, displayName: 'Synthetic author' }).catch((error: any) => { if (error.code !== 'auth/uid-already-exists') throw error; });
  token = await auth.createCustomToken(author);
  await db.doc('noveliaaConfig/access').set({ ownerUid: author });
});
test.beforeEach(async () => { await db.recursiveDelete(db.doc('noveliaaWorkspaces/' + author)); });

test('real author sign-in, cloud receipt, isolated-device restore, offline checkpoint and reconnect', async ({ page, context, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await signIn(page);
  await page.getByRole('button', { name: 'New thought ↗', exact: true }).click();
  await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('Where the river turns');
  const first = 'A quiet line beside the river. हिंदी e\u0301 🙂';
  await canvas(page).fill(first); await synced(page);
  await capture(page, 'desktop-writing');
  const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const restored = await isolated.newPage(); await signIn(restored);
  await expect(canvas(restored)).toHaveText(first); await synced(restored);
  await capture(restored, 'mobile-writing');
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  const mobileA11y = await new AxeBuilder({ page: restored }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(mobileA11y.violations).toEqual([]);
  await isolated.close();
  await context.setOffline(true);
  const offline = first + '\nThis paragraph was written offline.';
  await canvas(page).fill(offline);
  await expect(page.getByText('Saved here · cloud pending', { exact: true }).first()).toBeVisible();
  // Closing the tab proves this is a durable checkpoint, rather than React state.
  await page.close(); await context.setOffline(false);
  const reopened = await context.newPage(); await reopened.goto('/');
  await expect(canvas(reopened)).toContainText('This paragraph was written offline.'); await synced(reopened);
  const second = await browser.newContext(); const remote = await second.newPage(); await signIn(remote);
  await expect(canvas(remote)).toContainText('This paragraph was written offline.'); await synced(remote);
  await remote.getByRole('button', { name: 'Import & export', exact: true }).click();
  const exported = remote.waitForEvent('download'); await remote.getByRole('button', { name: 'Plain text', exact: true }).click();
  expect(await readFile((await (await exported).path())!, 'utf8')).toBe(offline);
  expect(errors).toEqual([]); await second.close();
});

test('imported conversation retains exact original and unverified provenance across devices; revision recovery and archive export', async ({ page, browser }) => {
  const bytes = Buffer.from('User:\r\nThe river rose.\r\nAssistant:\r\nAn unapproved tower.\r\nहिंदी e\u0301 🙂');
  await signIn(page);
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.getByRole('combobox', { name: /^Origin of this file/ }).selectOption('imported_chat');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic-conversation.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(canvas(page)).toContainText('An unapproved tower.'); await synced(page);
  const isolated = await browser.newContext(); const remote = await isolated.newPage(); await signIn(remote);
  await expect(canvas(remote)).toContainText('An unapproved tower.');
  await remote.getByRole('button', { name: 'Imported conversation', exact: true }).click();
  await remote.getByText('Imported speaker attribution', { exact: true }).click();
  await expect(remote.getByText('Assistant · unverified', { exact: true })).toBeVisible();
  const original = remote.waitForEvent('download'); await remote.getByRole('button', { name: 'Download exact original', exact: true }).click();
  expect(await readFile((await (await original).path())!)).toEqual(bytes);
  await remote.getByRole('button', { name: 'Close where this writing began', exact: true }).click();
  await canvas(remote).fill('An experiment worth keeping.'); await synced(remote);
  await remote.getByRole('button', { name: 'Revision history', exact: true }).click();
  await remote.getByRole('navigation', { name: 'Saved revisions', exact: true }).getByRole('button').nth(1).click();
  await remote.getByRole('button', { name: 'Restore this version', exact: true }).click();
  await expect(canvas(remote)).toContainText('An unapproved tower.'); await synced(remote);
  await remote.getByRole('button', { name: 'Import & export', exact: true }).click();
  const archive = remote.waitForEvent('download'); await remote.getByRole('button', { name: 'Download workspace archive', exact: true }).click();
  const snapshot = JSON.parse(await readFile((await (await archive).path())!, 'utf8')).snapshot;
  expect(snapshot.originals[0].verification).toBe('unverified');
  expect(snapshot.revisions.some((r: any) => r.snapshot.plainText === 'An experiment worth keeping.')).toBe(true);
  expect(snapshot.revisions.some((r: any) => r.restoredFrom)).toBe(true);
  await isolated.close();
});

test('unapproved real Auth account is denied before opening the workspace', async ({ page }) => {
  const uid = 'spark-browser-outsider';
  await auth.createUser({ uid }).catch((error: any) => { if (error.code !== 'auth/uid-already-exists') throw error; });
  await signIn(page, await auth.createCustomToken(uid));
  await expect(page.getByRole('alert')).toContainText(/permission|author access/i);
  await expect(canvas(page)).toHaveCount(0);
  await capture(page, 'desktop-denied');
  await page.setViewportSize({ width: 320, height: 640 }); await capture(page, 'mobile-denied');
});

test('a used laptop silently refreshes phone edits, then receives live pages and edits with persistent SDK cache', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await signIn(page); await page.getByRole('button', { name: 'New thought ↗', exact: true }).click();
  await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('Across the river');
  await canvas(page).fill('Earlier shared words.'); await synced(page);
  const laptopContext = await browser.newContext(); let laptop = await laptopContext.newPage(); await signIn(laptop);
  await expect(canvas(laptop)).toHaveText('Earlier shared words.'); await laptop.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await canvas(page).fill('Phone words written while the laptop was closed.'); await synced(page);
  laptop = await laptopContext.newPage(); await laptop.goto('/');
  await expect(canvas(laptop)).toHaveText('Phone words written while the laptop was closed.');
  await expect(laptop.getByText('Synced', { exact: true }).first()).toBeVisible();
  await expect(laptop.getByText('Versions need review', { exact: true })).toHaveCount(0);
  await canvas(page).fill('An incoming line while both devices are open.'); await synced(page);
  await expect(canvas(laptop)).toHaveText('An incoming line while both devices are open.');
  await page.getByRole('button', { name: 'New thought', exact: true }).click();
  await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('A fresh page from the phone');
  await canvas(page).fill('New pages arrive through metadata listeners.'); await synced(page);
  await expect(laptop.getByRole('button', { name: /A fresh page from the phone/ }).first()).toBeVisible();
  const databases = await laptop.evaluate(async () => (await indexedDB.databases()).map(db => db.name));
  expect(databases.some(name => name?.startsWith('firestore/'))).toBe(true);
  await capture(laptop, 'desktop-live-refresh');
  expect(errors).toEqual([]); await laptopContext.close();
});

test('real Firebase retains both genuinely concurrent device edits', async ({ page, browser }) => {
  await signIn(page); await page.getByRole('button', { name: 'New thought ↗', exact: true }).click();
  await canvas(page).fill('A common beginning.'); await synced(page);
  const other = await browser.newContext(); const parallel = await other.newPage(); await signIn(parallel);
  await expect(canvas(parallel)).toHaveText('A common beginning.');
  await canvas(page).fill('First device keeps this version.');
  await canvas(parallel).fill('Second device keeps another version.');
  await expect(parallel.getByText('Saved here · cloud pending', { exact: true }).first()).toBeVisible();
  await synced(page);
  await parallel.getByRole('button', { name: 'Import & export', exact: true }).click();
  await parallel.getByRole('button', { name: 'Check cloud sync', exact: true }).click();
  await expect(parallel.getByRole('dialog').getByText('Cloud synchronization checked.', { exact: true })).toBeVisible();
  await parallel.getByRole('button', { name: 'Close your writing, in your hands', exact: true }).click();
  await expect(canvas(parallel)).toHaveText('Second device keeps another version.');
  await expect(parallel.locator('.save-status').first()).toContainText(/review|version|conflict/i);
  const revisions = await db.collection('noveliaaWorkspaces/' + author + '/revisions').get();
  expect(revisions.size).toBeGreaterThanOrEqual(3);
  await capture(parallel, 'desktop-genuine-conflict'); await other.close();
});
