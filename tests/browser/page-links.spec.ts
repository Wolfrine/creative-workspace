import { test, expect } from '@playwright/test';
import { pagePath, pageUrl } from '../../functions/src/page-url.mjs';

test.beforeEach(async ({ page }, info) => {
  await page.goto('/?local=1&notebook=page-links-' + info.testId.replace(/[^a-z0-9]/gi, '') + '-' + Date.now());
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
});
async function seed(page: any) {
  return page.evaluate(async () => {
    const e = (window as any).__NOVELIAA_TEST__;
    await e.createCollection('Draft chapters');
    const c = e.getSnapshot().collections[0];
    const a = await e.createDocument({ title: 'Same title', collectionId: c.id });
    e.updateDocument(a, { body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First exact private scene.' }] }] } });
    await e.createUniverse('Other world');
    const b = await e.createDocument({ title: 'Same title' });
    e.updateDocument(b, { body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second exact private scene.' }] }] } });
    await e.flush();
    return { a: e.getSnapshot().documents.find((d: any) => d.id === a), b: e.getSnapshot().documents.find((d: any) => d.id === b), c };
  });
}
test('canonical click, refresh and back/forward resolve across universes and preserve an unsaved draft', async ({ page }) => {
  const { a, b } = await seed(page);
  await expect(page).toHaveURL(new RegExp(b.id));
  const query = new URL(page.url()).search;
  await page.goto(pagePath(a, 'Draft chapters') + query);
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('First exact private scene.');
  await expect(page.getByRole('combobox', { name: 'Story universe' })).toHaveValue(a.universeId);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('First exact private scene.');
  await page.getByRole('textbox', { name: 'Writing canvas' }).fill('An unsaved exact draft.');
  await page.getByRole('combobox', { name: 'Story universe' }).selectOption(b.universeId);
  await expect(page).toHaveURL(new RegExp(b.id));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(a.id));
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('An unsaved exact draft.');
  await page.goForward();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText('Second exact private scene.');
});
test('renaming and moving canonicalize old links; legacy queries remain usable', async ({ page }) => {
  const { a } = await seed(page), query = new URL(page.url()).search;
  await page.goto(pagePath(a, 'Draft chapters') + query);
  await page.getByRole('textbox', { name: 'Writing title' }).fill('हिन्दी Café 🙂');
  await page.evaluate(async (id) => { const e = (window as any).__NOVELIAA_TEST__; e.updateDocument(id, { collectionId: null }); await e.flush(); }, a.id);
  await expect(page).toHaveURL(new RegExp('/inbox/'));
  await page.goto(pagePath(a, 'Draft chapters') + query);
  await expect(page.getByRole('textbox', { name: 'Writing title' })).toHaveValue('हिन्दी Café 🙂');
  await expect(page).toHaveURL(new RegExp('/inbox/'));
  await page.goto('/' + query + '&page=' + a.id);
  await expect(page).toHaveURL(new RegExp('/u/' + a.universeId + '/inbox/'));
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
});
test('missing, trashed, malformed and mismatched paths never display a different scene', async ({ page }) => {
  const { a, b } = await seed(page), query = new URL(page.url()).search;
  await page.evaluate(async (id) => { const e = (window as any).__NOVELIAA_TEST__; e.updateDocument(id, { trashed: true }); await e.flush(); }, a.id);
  for (const path of [pagePath(a, 'Draft chapters'), pagePath({ ...b, id: 'missing-page' }), pagePath({ ...b, universeId: a.universeId }), '/u/bad/%2F/title/missing']) {
    await page.goto(path + query);
    await expect(page.getByText('This page link is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveCount(0);
    await expect(page.locator('.reader')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Open Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your library.' })).toBeVisible();
});
for (const width of [1440, 390, 320]) test(`copy in writing and Reader at ${width}px; private URL, accessible feedback, clipboard fallback`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { b } = await seed(page);
  await page.getByRole('button', { name: 'Copy page link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(pageUrl(b));
  await expect(page.getByRole('status').filter({ hasText: 'Page link copied.' })).toBeVisible();
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await page.getByRole('region', { name: 'Private reading mode' }).getByRole('button', { name: 'Copy page link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(pageUrl(b));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('denied'); } }); });
  await page.getByRole('region', { name: 'Private reading mode' }).getByRole('button', { name: 'Copy page link', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page URL' })).toHaveValue(pageUrl(b));
  await expect(page.getByRole('textbox', { name: 'Page URL' })).toBeFocused();
});
test('production deep links keep the normal signed-out gate and do not expose prose', async ({ page }) => {
  await page.goto('http://127.0.0.1:5818/u/private-world/inbox/secret-title/secret-page?local=1');
  await expect(page.locator('.connection-gate')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('First exact private scene.');
  expect(new URL(page.url()).pathname).toBe('/u/private-world/inbox/secret-title/secret-page');
});
test('collection Reader copies the current page and back resolves writing; collection rename refreshes canonical slugs', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const fixture = await page.evaluate(async () => {
    const e = (window as any).__NOVELIAA_TEST__;
    await e.createCollection('Old collection'); const collection = e.getSnapshot().collections[0];
    const first = await e.createDocument({ title: 'Repeated title', collectionId: collection.id });
    const second = await e.createDocument({ title: 'Repeated title', collectionId: collection.id });
    await e.renameCollection(collection.id, 'Renamed collection');
    await e.flush();
    return { first, second, page: e.getSnapshot().documents.find((d: any) => d.id === second) };
  });
  await expect(page).toHaveURL(new RegExp('/renamed-collection/'));
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
  await page.locator('.collection-card-open').click();
  await page.getByRole('button', { name: 'Read collection', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(fixture.first));
  await page.getByRole('button', { name: 'Reading contents', exact: true }).click();
  await page.locator('.reader-panel nav button').nth(1).click();
  await expect(page).toHaveURL(new RegExp(fixture.second));
  await page.getByRole('button', { name: 'Copy page link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(pageUrl(fixture.page, 'Renamed collection'));
  await page.goBack();
  await expect(page.locator('.reader')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().activeDocumentId)).toBe(fixture.first);
});
