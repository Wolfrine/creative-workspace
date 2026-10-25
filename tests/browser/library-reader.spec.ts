import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic author fixture. No production account or manuscript is read by these tests.
test.beforeEach(async ({ page }, info) => {
  await page.goto('/?local=1&notebook=reader-controls-' + info.testId.replace(/[^a-z0-9]/gi, '') + '-' + Date.now());
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
});
async function seed(page: any, length = 100) {
  return page.evaluate(async (count: number) => { const engine = (window as any).__NOVELIAA_TEST__; await engine.createCollection('The tide notebooks'); const snapshot = engine.getSnapshot(); const collection = snapshot.collections[0]; const id = await engine.createDocument({ title: 'The room above the sea', collectionId: collection.id }); engine.updateDocument(id, { body: { type: 'doc', content: Array.from({ length: count }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Passage ${index}. The tide rose through the reeds. हिंदी é 🙂 The window held the last of the light.` }] })) } }); return { id, collectionId: collection.id }; }, length);
}
test('Library has searchable pages, same-ID rename and collection reading', async ({ page }) => {
  const seeded = await seed(page, 3);
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Your library.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search library' }).fill('last of the light');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Collections 1', exact: true }).click();
  await page.getByRole('button', { name: 'Options for collection The tide notebooks', exact: true }).last().click();
  await page.getByRole('button', { name: 'Rename collection', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill('Salt and memory');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salt and memory', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().collections[0].id)).toBe(seeded.collectionId);
  await page.locator('.collection-card-open').click(); await page.getByRole('button', { name: 'Read collection', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Private reading mode' })).toBeVisible();
  await expect(page.locator('.reader-prose')).toContainText('Passage 2.');
});
test('Reader turns, appearance and resume remain local and preserve source/revisions', async ({ page }) => {
  await seed(page, 100); await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-pages'))).toBeGreaterThan(2);
  const before = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals, pending: state.pendingCount }); });
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '2');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await page.getByRole('combobox', { name: 'Reading typeface' }).selectOption('sans');
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Page-turn animation', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
  await expect(page.locator('.reader')).toHaveClass(/reader-night/);
  expect(await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals, pending: state.pendingCount }); })).toBe(before);
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toContainText('Passage 99.');
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-page'))).toBeGreaterThan(0);
});
test('Mobile Read replaces Export, reduced motion and reader accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, 30);
  await page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-columns', '1');
  await page.getByRole('button', { name: 'Next reader page' }).click();
  await expect(page.locator('.reader-turn')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Read resumes the last collection by identity, with contents context and a true editing return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await seed(page, 35);
  await page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click(); await page.locator('.collection-card-open').click();
  await page.getByRole('button', { name: 'Read collection', exact: true }).click(); await page.getByRole('button', { name: 'Next reader page' }).click();
  const before = Number(await page.locator('.reader-stage').getAttribute('data-page'));
  await page.getByRole('button', { name: 'Reading contents' }).click();
  await expect(page.locator('.reader-panel [aria-current="location"]')).toContainText('The room above the sea');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Reading contents panel' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit current page', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toBeVisible();
  await page.evaluate(async collectionId => { const engine = (window as any).__NOVELIAA_TEST__; await engine.createDocument({ title: 'A newly added ending', collectionId }); }, fixture.collectionId);
  await page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.locator('.reader-book-title')).toContainText('The tide notebooks');
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-page'))).toBe(before);
  await page.getByRole('button', { name: 'Reading contents' }).click(); await expect(page.getByRole('dialog', { name: 'Reading contents panel' })).toContainText('A newly added ending');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('noveliaa.reader.scope.')).map(([, value]) => JSON.parse(value)));
  expect(stored).toEqual([{ type: 'collection', id: fixture.collectionId }]);
});

test('Changed source restarts deliberately and appearance panel traps keyboard focus', async ({ page }) => {
  const fixture = await seed(page, 50); await page.getByRole('button', { name: 'Read this page' }).click();
  await page.getByRole('button', { name: 'Next reader page' }).click(); await page.getByRole('button', { name: 'Back to writing' }).click();
  // Use and verify the author's actual keyboard selection before replacing a
  // multi-paragraph ProseMirror document. Native contenteditable fill inserted
  // before the old body in one runner; it did not establish this precondition.
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' });
  await canvas.click(); await canvas.press('ControlOrMeta+A');
  await expect.poll(() => canvas.evaluate(element => {
    const selection = window.getSelection();
    return Boolean(selection?.anchorNode && selection.focusNode && element.contains(selection.anchorNode) && element.contains(selection.focusNode) && selection.toString().includes('Passage 49.'));
  })).toBe(true);
  await page.keyboard.insertText('A new opening, deliberately different.');
  await expect(canvas).toHaveText('A new opening, deliberately different.');
  await page.getByRole('button', { name: 'Read this page' }).click();
  await expect(page.getByRole('status')).toContainText('This writing changed since your last reading');
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0');
  await page.getByRole('button', { name: 'Reading appearance' }).click();
  const panel = page.getByRole('dialog', { name: 'Reading appearance panel' });
  await expect(panel.getByRole('button', { name: 'Close reading settings' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(panel.getByRole('checkbox', { name: 'Page-turn animation' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(panel.getByRole('button', { name: 'Close reading settings' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
  expect(await page.evaluate(id => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === id).plainText, fixture.id)).toBe('A new opening, deliberately different.');
});

test('Library navigation makes a local recovery copy without a writing revision', async ({ page }) => {
  const fixture = await seed(page, 2);
  const before = await page.evaluate(() => { const engine = (window as any).__NOVELIAA_TEST__; const saved = engine.db.saveDraft.bind(engine.db); (window as any).__readerDraftWrites = 0; engine.db.saveDraft = (...args: any[]) => { (window as any).__readerDraftWrites++; return saved(...args); }; return engine.getSnapshot().revisions.length; });
  await page.getByRole('textbox', { name: 'Writing canvas' }).fill('Recovered when I leave the editor, before the idle timer.');
  await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__readerDraftWrites)).toBe(1);
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().revisions.length)).toBe(before);
  await page.reload();
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  expect(await page.evaluate(id => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === id).plainText, fixture.id)).toBe('Recovered when I leave the editor, before the idle timer.');
});

test('New thought follows collection detail; all Library and Inbox create uncollected writing', async ({ page }) => {
  const fixture = await seed(page, 1);
  await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click(); await page.locator('.collection-card-open').click();
  await page.locator('.new-thought').click();
  await expect.poll(() => page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return state.documents.find((item: any) => item.id === state.activeDocumentId).collectionId; })).toBe(fixture.collectionId);
  await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click(); await page.locator('.new-thought').click();
  await expect.poll(() => page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return state.documents.find((item: any) => item.id === state.activeDocumentId).collectionId; })).toBeNull();
  await page.locator('.main-nav').getByRole('button', { name: /^Inbox/ }).click(); await page.locator('.new-thought').click();
  await expect.poll(() => page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return state.documents.find((item: any) => item.id === state.activeDocumentId).collectionId; })).toBeNull();
});

test('Keyboard follows offscreen links and opens available linked writing; unavailable links explain', async ({ page }) => {
  const fixture = await page.evaluate(async () => { const engine = (window as any).__NOVELIAA_TEST__; const linkedId = await engine.createDocument({ title: 'The separate notebook' }); const trashedId = await engine.createDocument({ title: 'A page set aside' }); engine.updateDocument(trashedId, { trashed: true }); const content = Array.from({ length: 50 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Passage ${index}. The tide rose through the reeds. हिंदी é 🙂 The window held the last of the light.` }] })); const id = await engine.createDocument({ title: 'Reading linked passages', body: { type: 'doc', content: [...content, { type: 'paragraph', content: [{ type: 'text', text: 'Open the separate notebook', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + linkedId } }] }] }, { type: 'paragraph', content: [{ type: 'text', text: 'A missing connection', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + trashedId } }] }] }] } }); return { id, linkedId }; });
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.press('Control+Home'); await canvas.pressSequentially('A fresh author addition. ');
  await expect.poll(() => page.evaluate(id => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === id).body.content.length, fixture.id)).toBe(52);
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('Open the separate notebook');
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().error)).toBeNull();
  await page.getByRole('button', { name: 'Read this page' }).click();
  await expect(page.locator('.reader-prose')).toContainText('A fresh author addition.');
  const link = page.getByRole('link', { name: 'Open the separate notebook', exact: true }); await link.focus();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-page'))).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.reader-stage').evaluate(element => element.scrollLeft)).toBe(0);
  await page.getByRole('link', { name: 'A missing connection', exact: true }).click(); await expect(page.getByRole('status')).toContainText('unavailable in this universe');
  await link.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('The separate notebook');
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().activeDocumentId)).toBe(fixture.linkedId);
});
