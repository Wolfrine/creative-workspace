import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { resetWorkspace } from '../../functions/scripts/reset-workspace.mjs';

const requireAdmin = createRequire(path.resolve('functions/package.json'));
const { initializeApp } = requireAdmin('firebase-admin/app');
const { getAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore } = requireAdmin('firebase-admin/firestore');
for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[name] ?? '')) throw new Error(name + ' must use the isolated loopback emulator.');
}
const admin = initializeApp({ projectId: 'demo-noveliaa' }, 'spark-reset-browser');
const auth = getAuth(admin), db = getFirestore(admin);
const author = 'spark-reset-author', email = 'synthetic-reset-author@example.test';
let token: string;
const canvas = (page: Page) => page.getByRole('textbox', { name: 'Writing canvas', exact: true });
async function signIn(page: Page) {
  await page.goto('/');
  await page.evaluate(async value => {
    const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts');
    await helper.signIn(value);
  }, token);
}
async function synced(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 650) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.getByRole('button', { name: 'Check cloud sync', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Cloud synchronization checked.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close your writing, in your hands', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synced', exact: true })).toBeVisible();
}
const resetOptions = (requestId: string) => ({ db, auth, binding: { projectId: 'demo-noveliaa', authorEmail: email }, request: { requestId, action: 'reset-entire-workspace', ownerEmail: email, approved: true, commitMarker: '[workspace-reset:' + requestId + ']' }, verifiedProject: 'demo-noveliaa', expectedRequestId: requestId });
async function expectCurrentWorkspace(page: Page, workspaceId: string) {
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).map(item => item.name))).toContain('noveliaa-writing-v1-' + author + ':' + workspaceId);
  await expect(page.getByRole('button', { name: 'Begin writing', exact: true })).toBeVisible();
  await expect(canvas(page)).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const firebase = await import(/* @vite-ignore */ '/src/cloud/firebase.ts');
    return firebase.firebaseAuth()?.currentUser?.uid;
  })).toBe(author);
}
test.beforeAll(async () => {
  await mkdir('.local/spark-browser', { recursive: true });
  await auth.createUser({ uid: author, email, displayName: 'Synthetic reset author' }).catch((error: any) => { if (error.code !== 'auth/uid-already-exists') throw error; });
  token = await auth.createCustomToken(author);
});
test.beforeEach(async () => {
  await db.doc('noveliaaConfig/access').set({ ownerUid: author });
  for (const key of [author, 'previous_browser_workspace', 'reset_browser_live', 'reset_browser_offline']) await db.recursiveDelete(db.doc('noveliaaWorkspaces/' + key));
  for (const key of ['reset_browser_live', 'reset_browser_offline']) await db.doc('noveliaaOperations/workspaceReset-' + key).delete();
});

test('authorized reset deletes exact originals/history, remounts a clean desktop workspace, preserves Auth and is idempotent', async ({ page }) => {
  await db.doc('noveliaaConfig/access').set({ ownerUid: author, workspaceId: 'previous_browser_workspace' });
  await db.doc('noveliaaWorkspaces/' + author + '/universes/legacy').set({ id: 'legacy', name: 'Synthetic legacy residue', createdAt: '2026-10-24T00:00:00.000Z' });
  await signIn(page);
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic-retired.txt', mimeType: 'text/plain', buffer: Buffer.from('Retired exact source\r\nहिंदी 🙂') });
  await expect(canvas(page)).toContainText('Retired exact source'); await synced(page);
  await canvas(page).fill('Retired author revision.'); await synced(page);
  expect((await db.collection('noveliaaWorkspaces/previous_browser_workspace/originals').get()).size).toBe(1);
  await expect(resetWorkspace({ ...resetOptions('reset_browser_live'), verifiedProject: 'wrong-project' })).rejects.toThrow('binding');
  await expect(resetWorkspace({ ...resetOptions('reset_browser_live'), expectedRequestId: 'different_request' })).rejects.toThrow('request binding');
  await expect(resetWorkspace({ ...resetOptions('reset_browser_live'), request: { ...resetOptions('reset_browser_live').request, approved: false } })).rejects.toThrow('request binding');
  await expect(resetWorkspace({ ...resetOptions('reset_browser_live'), request: { ...resetOptions('reset_browser_live').request, ownerEmail: 'somebody-else@example.test' } })).rejects.toThrow('owner email');
  expect((await db.doc('noveliaaConfig/access').get()).data().workspaceId).toBe('previous_browser_workspace');
  const interruptedDb = { projectId: db.projectId, doc: db.doc.bind(db), runTransaction: db.runTransaction.bind(db), recursiveDelete: async () => { throw new Error('Synthetic interrupted deletion'); } };
  await expect(resetWorkspace({ ...resetOptions('reset_browser_live'), db: interruptedDb })).rejects.toThrow('Synthetic interrupted deletion');
  expect((await db.doc('noveliaaConfig/access').get()).data().workspaceId).toBe('reset_browser_live');
  expect((await db.doc('noveliaaOperations/workspaceReset-reset_browser_live').get()).data().status).toBe('rotated');
  const result = await resetWorkspace(resetOptions('reset_browser_live'));
  expect(result.status).toBe('complete'); expect(result.authenticationPreserved).toBe(true);
  expect(result.results.map((value: any) => value.workspaceId).sort()).toEqual([author, 'previous_browser_workspace'].sort());
  expect(result.results.every((value: any) => value.verifiedEmpty)).toBe(true);
  await expectCurrentWorkspace(page, 'reset_browser_live');
  expect((await auth.getUser(author)).email).toBe(email);
  expect((await db.doc('noveliaaConfig/access').get()).data()).toEqual({ ownerUid: author, workspaceId: 'reset_browser_live' });
  await page.getByRole('button', { name: 'Begin writing', exact: true }).click();
  await canvas(page).fill('Only this clean-start page remains.'); await synced(page);
  await resetWorkspace(resetOptions('reset_browser_live'));
  expect((await db.collection('noveliaaWorkspaces/reset_browser_live/documents').get()).size).toBe(1);
  expect((await db.collection('noveliaaWorkspaces/' + author + '/revisions').get()).empty).toBe(true);
  expect((await db.collection('noveliaaWorkspaces/' + author + '/universes').get()).empty).toBe(true);
  expect((await db.collection('noveliaaWorkspaces/previous_browser_workspace/originals').get()).empty).toBe(true);
  await page.screenshot({ path: '.local/spark-browser/desktop-reset-clean-start.png', fullPage: true });
});

test('offline old-device drafts cannot repopulate a reset on reconnect and the mobile session opens its new store', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page); await page.getByRole('button', { name: 'Begin writing', exact: true }).click();
  await canvas(page).fill('Shared before reset.'); await synced(page);
  await page.evaluate(async () => {
    const firebase = await import(/* @vite-ignore */ '/src/cloud/firebase.ts');
    (window as any).__retiredAdapter = firebase.createCloudAdapter('spark-reset-author');
  });
  await context.setOffline(true); await canvas(page).fill('Offline old device must never resurrect this.');
  await expect(page.getByRole('button', { name: 'Saved on this device; cloud save pending', exact: true })).toBeVisible({ timeout: 15000 });
  await resetWorkspace(resetOptions('reset_browser_offline'));
  await context.setOffline(false);
  await expectCurrentWorkspace(page, 'reset_browser_offline');
  const oldError = await page.evaluate(async () => {
    try { await (window as any).__retiredAdapter.load(); return ''; } catch (error) { return String(error); }
  });
  expect(oldError).toContain('reset');
  expect((await db.collection('noveliaaWorkspaces/' + author + '/documents').get()).empty).toBe(true);
  expect((await db.collection('noveliaaWorkspaces/reset_browser_offline/documents').get()).empty).toBe(true);
  await page.getByRole('button', { name: 'Begin writing', exact: true }).click();
  await canvas(page).fill('Fresh mobile writing.'); await synced(page);
  expect((await db.collection('noveliaaWorkspaces/reset_browser_offline/revisions').get()).size).toBeGreaterThan(0);
  expect((await db.collection('noveliaaWorkspaces/' + author + '/revisions').get()).empty).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.local/spark-browser/mobile-reset-clean-start.png', fullPage: true });
  await page.reload(); await expect(canvas(page)).toHaveText('Fresh mobile writing.');
});
