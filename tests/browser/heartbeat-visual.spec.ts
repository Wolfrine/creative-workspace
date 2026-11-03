import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { continuityAnnotation, seedContinuityWorkspace } from '../helpers/heartbeat-continuity-fixture';

type Mode = 'mixed' | 'rest' | 'sparse' | 'error' | 'invalid' | 'long';
async function seed(page: Page, mode: Mode = 'mixed') {
  const notebook = `heartbeat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/?local=1&notebook=' + notebook);
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  const workspace = await seedContinuityWorkspace(page, notebook);
  const document = workspace.documents[0], annotation = continuityAnnotation(workspace);
  if (mode === 'sparse') annotation.beats = [annotation.beats[0], annotation.beats.at(-1)!];
  if (mode === 'rest') annotation.beats = [{ ...annotation.beats[0], start: 0, end: document.plainText.length, quote: document.plainText, foreground: 'Rest', undertone: undefined, tone: 'neutral', trajectory: 'quiet', weight: 1, reasoning: 'Explicit synthetic analysed rest across the complete source.' }];
  if (mode === 'long') annotation.beats[0] = { ...annotation.beats[0], foreground: 'Unacknowledged private yearning', undertone: 'Unresolved quiet apprehension' };
  if (mode === 'invalid') annotation.anchor.contentHash = '0'.repeat(64);
  let requests = 0;
  await page.route('**/api/integrations/heartbeat?**', async route => {
    requests++;
    if (mode === 'error') await route.fulfill({ status: 503, json: { error: 'Synthetic unavailable service' } });
    else await route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } });
  });
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('Late afternoon light');
  return { document, annotation, requests: () => requests };
}
const writingToggle = (page: Page) => page.locator('.format-toolbar').getByRole('button', { name: 'Emotional Heartbeat', exact: true });
const readingToggle = (page: Page) => page.locator('.reader-header').getByRole('button', { name: 'Emotional Heartbeat', exact: true });
async function sourceState(page: Page) { return page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals }); }); }
async function highlights(page: Page, scope: string) { return page.evaluate(value => [...((CSS as any).highlights?.keys() || [])].filter((key: string) => key.startsWith('heartbeat-' + value)), scope); }
async function openReader(page: Page) { await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0'); }
const bookmark = (page: Page) => page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('noveliaa.reader.position.'))?.[1]);

for (const [width, height] of [[1366, 768], [390, 844], [320, 568]]) test(`Heartbeat visual evidence ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(page);
  const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-rework/browser'; await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/writer-off-${width}.png` });
  await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Eager calm');
  await page.screenshot({ path: `${output}/writer-${width}.png` });
  await openReader(page); await expect(page.locator('.reader .heartbeat-legend-item').first()).toContainText('Eager calm');
  await expect.poll(() => highlights(page, 'reader')).not.toEqual([]);
  await page.screenshot({ path: `${output}/reader-${width}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Off by default; explicit reasoning and source navigation never change writing', async ({ page }) => {
  const fixture = await seed(page); const before = await sourceState(page);
  await expect(writingToggle(page)).toHaveAttribute('aria-pressed', 'false'); await expect(page.locator('.heartbeat')).toHaveCount(0); expect(fixture.requests()).toBe(0);
  await writingToggle(page).focus(); await page.keyboard.press('Space'); await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Eager calm');
  await expect(page.locator('.heartbeat')).not.toContainText('Undertone:'); await expect(page.locator('.heartbeat')).not.toContainText('weight 3');
  await expect(page.getByRole('dialog', { name: 'A possible reading' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Eager calm. Show interpretation.', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A possible reading' })).toContainText('Unverified AI inference');
  await expect(page.getByRole('dialog')).toContainText('Undertone: Anticipation');
  await page.getByRole('button', { name: 'Find this passage' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await writingToggle(page).click(); await expect(page.locator('.heartbeat')).toHaveCount(0); expect(await highlights(page, 'writer')).toEqual([]); expect(await sourceState(page)).toBe(before);
});

test('A local draft edit immediately rejects annotations despite an unchanged source quote', async ({ page }) => {
  await seed(page); await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toBeVisible();
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await canvas.press('ControlOrMeta+End'); await page.keyboard.insertText(' A new author sentence.');
  await expect(page.locator('.heartbeat')).toContainText('Writing changed'); await expect(page.locator('.heartbeat-legend-item')).toHaveCount(0); expect(await highlights(page, 'writer')).toEqual([]);
  await expect(canvas).toContainText('Late afternoon light'); await expect(canvas).toContainText('A new author sentence.');
});

for (const [width, height] of [[1366, 768], [390, 844], [320, 568]]) test(`Read toggles retain exact text and passage anchor at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(page); const before = await sourceState(page);
  await openReader(page);
  const exactText = await page.locator('.reader-prose').textContent();
  const next = page.getByRole('button', { name: 'Next reader page', exact: true });
  if (await next.isEnabled()) await next.click();
  const position = await bookmark(page);
  await readingToggle(page).click(); await expect.poll(() => highlights(page, 'reader')).not.toEqual([]);
  // Compact footer may repaginate; the exact stored passage must stay put.
  await expect.poll(() => bookmark(page)).toBe(position);
  expect(await page.locator('.reader-prose').textContent()).toBe(exactText);
  await readingToggle(page).click(); await expect.poll(() => highlights(page, 'reader')).toEqual([]);
  await expect.poll(() => bookmark(page)).toBe(position); expect(await sourceState(page)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const change of ['title', 'order'] as const) test(`A ${change} change invalidates the frozen reader source`, async ({ page }) => {
  const fixture = await seed(page); await openReader(page); await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await page.evaluate(({ id, field }) => { (window as any).__NOVELIAA_TEST__.updateDocument(id, field === 'title' ? { title: 'A deliberate new title' } : { order: 1 }); }, { id: fixture.document.id, field: change });
  await expect(page.locator('.reader .heartbeat')).toContainText('Writing changed'); expect(await highlights(page, 'reader')).toEqual([]); await expect(page.locator('.reader-prose')).toContainText('Late afternoon light');
});

for (const mode of ['rest', 'sparse', 'error', 'invalid', 'long'] as const) test(`Heartbeat ${mode} stays honest and bounded`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await seed(page, mode); const before = await sourceState(page); await writingToggle(page).click();
  if (mode === 'rest') { await expect(page.locator('.heartbeat-legend-item')).toContainText('Rest'); await expect.poll(() => highlights(page, 'writer')).toEqual(['heartbeat-writer-neutral']); }
  else if (mode === 'sparse') { await expect(page.locator('.heartbeat')).toContainText('Incomplete reading'); expect(await highlights(page, 'writer')).toEqual([]); await expect(page.locator('.heartbeat-legend-item')).toHaveCount(0); }
  else if (mode === 'error') await expect(page.locator('.heartbeat')).toContainText('unavailable');
  else if (mode === 'invalid') { await expect(page.locator('.heartbeat')).toContainText('No Heartbeat for this revision'); expect(await highlights(page, 'writer')).toEqual([]); }
  else { await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Unacknowledged private yearning'); await page.locator('.heartbeat-legend-item').first().click(); await expect(page.getByRole('dialog')).toContainText('Unacknowledged private yearning'); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await sourceState(page)).toBe(before);
});

test('Highlight API absence retains exact accessible labels and editable text', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Highlight', { value: undefined, configurable: true }); }); await seed(page); await writingToggle(page).click();
  await expect(page.getByRole('button', { name: 'Eager calm. Show interpretation.', exact: true })).toBeVisible();
  await expect(page.locator('.heartbeat-caption')).toContainText('Colors unavailable'); expect(await highlights(page, 'writer')).toEqual([]);
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await page.keyboard.insertText('An author’s addition. '); await expect(canvas).toContainText('An author’s addition.');
});

test('Writer scrolling updates its visible legend without another annotation request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const fixture = await seed(page); await writingToggle(page).click();
  await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Eager calm'); const count = fixture.requests();
  await page.locator('.manuscript-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.heartbeat-legend')).toContainText('Tempered eagerness'); await expect(page.locator('.heartbeat-legend')).not.toContainText('Eager calm');
  await page.getByRole('button', { name: '+1 feeling', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Color to feeling' })).toContainText('Quiet reward'); expect(fixture.requests()).toBe(count);
});

for (const width of [1366, 390, 320]) test(`Heartbeat accessibility across writing, details, paper and night at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1366 ? 768 : width === 390 ? 844 : 568 }); await seed(page);
  const check = async (state: string) => {
    const result = await new AxeBuilder({ page }).analyze(); expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), state).toEqual([]);
    const dialog = page.getByRole('dialog', { name: 'A possible reading' });
    if (await dialog.isVisible()) {
      const contrast = await dialog.evaluate(element => {
        const luminance = (color: string) => { const values = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
        const paper = luminance(getComputedStyle(element).backgroundColor);
        return [...element.querySelectorAll<HTMLElement>('.heartbeat-detail,.heartbeat-detail *')].filter(node => node.getClientRects().length && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())).map(node => { const ink = luminance(getComputedStyle(node).color); return { text: node.textContent?.slice(0, 50), ratio: (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05) }; });
      });
      expect(contrast.filter(pair => pair.ratio < 4.5), state + ' measured dialog contrast').toEqual([]);
    }
  };
  await check('writer off'); await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toBeVisible(); await check('writer ready');
  await page.locator('.heartbeat-legend-item').first().click(); await check('writer reasoning'); await page.keyboard.press('Escape');
  await openReader(page); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible(); await check('paper reader');
  await page.locator('.reader .heartbeat-legend-item').first().click(); await check('paper reasoning'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByRole('button', { name: 'Night', exact: true }).click(); await page.getByRole('button', { name: 'Close reading settings' }).click();
  await check('night reader'); await page.locator('.reader .heartbeat-legend-item').first().click(); await check('night reasoning');
});
