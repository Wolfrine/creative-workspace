import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const structuralEvidence = process.env.NOVELIAA_EVIDENCE_DIR ? process.env.NOVELIAA_EVIDENCE_DIR + '/structural' : '.local/browser/structural';
const refinementEvidence = process.env.NOVELIAA_EVIDENCE_DIR ?? '.local/refinement-browser';
const originText = 'User:\r\nThe river rose.\r\nAssistant:\r\nAn unapproved tower.\r\nहिंदी e\u0301 🙂';
test.beforeEach(async ({ page }, info) => {
  await page.goto('/?local=1&notebook=test-' + info.testId.replace(/[^a-z0-9]/gi, '') + '-' + Date.now());
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
});
const saved = async (page: any) => { await expect.poll(() => page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().saveState)).toBe('local'); };
const create = async (page: any) => { await page.getByRole('button', { name: 'New thought ↗', exact: true }).click(); await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).waitFor(); };

test('A01/A08 immediate capture, Unicode, caret and undo', async ({ page }) => {
  await create(page); const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await expect(canvas).toBeFocused();
  await canvas.fill('A beginning. हिंदी e\u0301 🙂'); await saved(page);
  await page.waitForTimeout(600); // A separate author pause creates a new native undo group.
  await canvas.press('Control+End'); await canvas.pressSequentially(' The second line.'); await saved(page);
  await expect(canvas).toHaveText('A beginning. हिंदी e\u0301 🙂 The second line.');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas).toHaveText('A beginning. हिंदी e\u0301 🙂');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(canvas).toContainText('The second line.');
  expect(await page.getByRole('textbox', { name: 'Writing title', exact: true }).inputValue()).toBe('');
});

test('A08 formatted archive restores into an isolated browser and HTML retains formatting', async ({ page, browser }) => {
  await create(page); const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await canvas.fill('A bold beginning. हिंदी 🙂'); await canvas.press('Control+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click(); await saved(page);
  const result = await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__, id = engine.getSnapshot().activeDocumentId;
    return { archive: await (await engine.exportArchive()).text(), html: await (await engine.exportDocument(id, 'html')).text(), markdown: await (await engine.exportDocument(id, 'md')).text(), body: engine.getSnapshot().documents[0].body };
  });
  expect(result.html).toContain('<strong>A bold beginning. हिंदी 🙂</strong>');
  expect(result.markdown).toContain('**A bold beginning. हिंदी 🙂**');
  const isolated = await browser.newContext(); const restored = await isolated.newPage();
  await restored.goto('/?local=1&notebook=isolated-' + Date.now());
  await restored.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  await restored.evaluate(async archive => { await (window as any).__NOVELIAA_TEST__.importArchive(new File([archive], 'complete.json')); }, result.archive);
  await expect(restored.locator('.manuscript strong')).toHaveText('A bold beginning. हिंदी 🙂');
  expect(await restored.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].body)).toEqual(result.body);
  await isolated.close();
});

test('A03 failed storage leaves open text exportable and never says saved', async ({ page }) => {
  await create(page);
  await page.evaluate(() => { const engine = (window as any).__NOVELIAA_TEST__; engine.db.checkpoint = async () => { throw new DOMException('Injected disk full', 'QuotaExceededError'); }; });
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill('UNSAVED-RECOVERY-ORACLE हिंदी');
  await expect(page.getByText('Save needs attention', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export open text', exact: true }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toBe('UNSAVED-RECOVERY-ORACLE हिंदी');
});

test('A22/A23 short mobile writing, keyboard navigation and 200 percent text remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.getByRole('button', { name: 'New thought', exact: true }).click();
  const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await canvas.fill('A line to keep.\n'.repeat(30)); await saved(page);
  await canvas.press('Control+End'); await page.keyboard.type('CARET-VISIBLE');
  await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas).not.toContainText('CARET-VISIBLE');
  await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(canvas).toContainText('CARET-VISIBLE');
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leave focus mode', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('aside[aria-label="Writing navigation"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  await page.addStyleTag({ content: '.manuscript { font-size: 200% !important; line-height: 1.5 !important; letter-spacing: .12em; word-spacing: .16em }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
test('A02 offline editing survives a new tab and preserves acknowledged revisions', async ({ page, context }) => {
  await create(page); await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill('OFFLINE-ACKNOWLEDGED — हिंदी 🙂'); await saved(page);
  const url = page.url(); await page.close(); await context.setOffline(false);
  const reopened = await context.newPage(); await reopened.goto(url);
  await expect(reopened.getByRole('textbox', { name: 'Writing canvas', exact: true })).toHaveText('OFFLINE-ACKNOWLEDGED — हिंदी 🙂');
  await expect(reopened.getByText('Saved on this device', { exact: true }).first()).toBeVisible();
});
test('A06 revision restoration retains the intervening version', async ({ page }) => {
  await create(page); const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await canvas.fill('The original paragraph.'); await saved(page);
  await canvas.fill('An experiment worth keeping.'); await saved(page);
  await page.getByRole('button', { name: 'Revision history', exact: true }).click();
  const versions = page.getByRole('navigation', { name: 'Saved revisions', exact: true }).getByRole('button');
  await versions.nth(1).click();
  await page.getByRole('button', { name: 'Restore this version', exact: true }).click();
  await expect(canvas).toHaveText('The original paragraph.');
  const texts = await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().revisions.map((r: any) => r.snapshot.plainText));
  expect(texts).toContain('An experiment worth keeping.');
});
test('A07/A09 archive from browser preserves sources and independent saved-text oracle', async ({ page }) => {
  await mkdir(structuralEvidence, { recursive: true });
  // Independent source bytes exist in Node before they cross the app boundary.
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  await page.getByRole('combobox', { name: /^Origin of this file/ }).selectOption('imported_chat');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'mixed-source.txt', mimeType: 'text/plain', buffer: Buffer.from(originText) });
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).waitFor();
  const before = await page.evaluate(async () => await (await (window as any).__NOVELIAA_TEST__.exportArchive()).text());
  const beforeState = JSON.parse(before).snapshot;
  const original = beforeState.originals[0];
  expect(original.sha256).toBe(hash(originText));
  expect(beforeState.revisions.every((r: any) => r.snapshot.origin === 'imported_chat')).toBe(true);
  await page.getByRole('button', { name: 'Imported conversation', exact: true }).click();
  await page.getByText('Imported speaker attribution', { exact: true }).click();
  await expect(page.getByText('Assistant · unverified', { exact: true })).toBeVisible();
  const originalDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download exact original', exact: true }).click();
  expect(await readFile((await (await originalDownload).path())!)).toEqual(Buffer.from(originText));
  await page.getByRole('button', { name: 'Close where this writing began', exact: true }).click();
  const oracle = { schema_version: 1, originals: { [original.id]: hash(originText) }, saved_revisions: {} as Record<string, string> };
  for (const revision of beforeState.revisions) oracle.saved_revisions[revision.id] = hash(originText.replace(/\r\n/g, '\n'));
  const expected = 'A revised thought. हिंदी e\u0301 🙂';
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill(expected); await saved(page);
  const after = await page.evaluate(async () => await (await (window as any).__NOVELIAA_TEST__.exportArchive()).text());
  const afterState = JSON.parse(after).snapshot;
  for (const revision of afterState.revisions) if (!oracle.saved_revisions[revision.id]) oracle.saved_revisions[revision.id] = hash(expected);
  await writeFile(structuralEvidence + '/before-archive.json', before);
  await writeFile(structuralEvidence + '/after-archive.json', after);
  await writeFile(structuralEvidence + '/oracle.json', JSON.stringify(oracle, null, 2));
  // Verify a normal user download as well as the engine adapter output.
  await page.getByRole('button', { name: 'Import & export', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workspace archive', exact: true }).click();
  const file = await (await download).path(); expect(file).not.toBeNull();
  expect(JSON.parse(await readFile(file!, 'utf8')).snapshot.originals[0].sha256).toBe(hash(originText));
});
test('A11 search stays in the selected universe', async ({ page }) => {
  await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__;
    await engine.createDocument({ title: 'River note', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'हिंदी GOLDEN-PHRASE' }] }] } });
    const firstWorld = engine.getSnapshot().activeUniverseId;
    await engine.createUniverse('Other world');
    await engine.createDocument({ title: 'River note', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PRIVATE-CANARY-OTHER-WORLD' }] }] } });
    await engine.selectUniverse(firstWorld);
  });
  await page.getByRole('button', { name: /Search/ }).first().click();
  await page.getByRole('textbox', { name: 'Search writing', exact: true }).fill('GOLDEN-PHRASE');
  await expect(page.getByRole('button', { name: /River note/ }).first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE-CANARY-OTHER-WORLD');
});

test('A06 stable links, backlinks and non-drag organization survive title changes', async ({ page }) => {
  await page.evaluate(async () => { const engine = (window as any).__NOVELIAA_TEST__; await engine.createDocument({ title: 'Ferry house' }); await engine.createDocument({ title: 'A source fragment' }); });
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill('Return to the house.');
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).press('Control+a');
  await page.getByRole('button', { name: 'Link to writing', exact: true }).click();
  await page.getByRole('button', { name: /Ferry house/ }).last().click(); await saved(page);
  const link = page.locator('.manuscript a'); const href = await link.getAttribute('href');
  expect(href).toMatch(/^noveliaa:\/\/document\//);
  await link.click(); await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('The renamed ferry house'); await saved(page);
  await page.getByRole('button', { name: 'Move earlier', exact: true }).click(); await saved(page);
  await page.getByRole('complementary', { name: 'Writing context', exact: true }).getByRole('button', { name: 'A source fragment', exact: true }).click();
  expect(await page.locator('.manuscript a').getAttribute('href')).toBe(href);
  await page.getByRole('button', { name: 'Living Atlas', exact: true }).click();
  await page.locator('.atlas-index').getByRole('button', { name: /The renamed ferry house/ }).click();
  await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('The renamed ferry house');
});

for (const width of [1440, 390, 320]) test(`paragraph indentation and themed collection movement at ${width}px`, async ({ page }) => {
  await mkdir(refinementEvidence, { recursive: true });
  await page.setViewportSize({ width, height: width > 650 ? 1000 : 844 });
  await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__;
    await engine.createCollection('River chapters'); await engine.createCollection('Loose fragments');
    await engine.createDocument({ title: 'Where the river turns', body: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'At dawn the river carried the colour of old paper. Meera stayed a little longer, listening for the ferryman.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '“Some stories begin here,” she said. हिंदी é 🙂' }] },
    ] } });
  });
  const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  const collection = page.getByRole('combobox', { name: 'Move writing to collection', exact: true });
  await page.evaluate(() => document.fonts.ready);
  if (width > 650) {
    await collection.click();
    await expect(page.getByRole('listbox', { name: 'Collections', exact: true })).toBeVisible();
    await page.screenshot({ path: refinementEvidence + '/desktop-collection-open.png', fullPage: true });
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
    expect(violations).toEqual([]);
    await collection.press('End'); await collection.press('Enter');
    await expect(collection).toContainText('Loose fragments');
    await collection.click(); await collection.press('Home'); await collection.press('Enter');
    await expect(collection).toContainText('Inbox');
  } else {
    await collection.selectOption({ label: 'River chapters' });
    await expect(collection.locator('option:checked')).toHaveText('River chapters');
    await collection.selectOption({ label: 'Inbox · unsorted' });
  }
  await canvas.press('Control+Home');
  const indent = page.getByRole('button', { name: 'First-line indent', exact: true });
  if (width <= 650) await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  await indent.click(); await saved(page);
  await expect(canvas.locator('p').first()).toHaveAttribute('data-first-line-indent', 'true');
  await expect(canvas.locator('p').nth(1)).not.toHaveAttribute('data-first-line-indent');
  await canvas.press('Control+End');
  if (width <= 650) await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  await indent.click(); await saved(page);
  await expect(canvas.locator('p').nth(1)).toHaveAttribute('data-first-line-indent', 'true');
  if (width <= 650) await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  await indent.click(); await saved(page);
  await expect(canvas.locator('p').nth(1)).not.toHaveAttribute('data-first-line-indent');
  if (width <= 650) await page.getByRole('button', { name: 'More formatting', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: refinementEvidence + `/indentation-${width}.png`, fullPage: true });
  const exported = await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__, id = engine.getSnapshot().activeDocumentId;
    return { html: await (await engine.exportDocument(id, 'html')).text(), text: await (await engine.exportDocument(id, 'txt')).text() };
  });
  expect(exported.html.match(/text-indent:\s*2em/g)).toHaveLength(1);
  expect(exported.text).toBe('At dawn the river carried the colour of old paper. Meera stayed a little longer, listening for the ferryman.\n“Some stories begin here,” she said. हिंदी é 🙂');
});
for (const width of [320, 390, 768, 1440]) test(`A22/A23 writing layout and accessibility at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  if (width <= 650) await page.getByRole('button', { name: 'New thought', exact: true }).click(); else await create(page);
  const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await canvas.fill('A long paragraph with natural words. '.repeat(50)); await saved(page);
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }));
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Leave focus mode', exact: true }).click();
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['critical', 'serious'].includes(v.impact || ''));
  expect(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});
