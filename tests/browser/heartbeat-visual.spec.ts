import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { seedPopulatedWorkspace, fixtureIds } from '../helpers/populated-workspace';
import type { HeartbeatAnnotation } from '../../src/heartbeat/model';

// Existing AI-generated, unverified fiction, in isolated DEV-only notebooks.
// Only the Heartbeat endpoint is mocked; the editor, store and reader are real.
async function seed(page: Page, mode: 'mixed' | 'quiet' | 'error' | 'invalid' | 'long' = 'mixed') {
  const notebook = `heartbeat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/?local=1&notebook=' + notebook);
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  const snapshot = await seedPopulatedWorkspace(page, notebook);
  const document = snapshot.documents.find(item => item.id === fixtureIds.tide)!;
  const revision = snapshot.revisions.find(item => item.id === document.headRevisionId)!;
  const makeBeat = (quote: string, foreground: string, undertone: string, trajectory: 'build' | 'hold' | 'release', tone: 'tense' | 'tender' | 'cool', weight: number) => ({ start: document.plainText.indexOf(quote), end: document.plainText.indexOf(quote) + quote.length, quote, foreground, undertone, trajectory, tone, weight, reasoning: 'Synthetic evaluation interpretation: the ordinary harbour details hold a gentleness beneath Mira’s uncertainty. Another reading is possible.' });
  const annotation: HeartbeatAnnotation = {
    id: 'synthetic-heartbeat', schema: 'noveliaa-heartbeat-1',
    anchor: { documentId: document.id, revisionId: revision.id, contentHash: revision.contentHash, title: document.title },
    attribution: { provider: 'Synthetic provider', model: 'Fixture model' }, contextNote: 'Synthetic fixture only. No author intent, canon or reader response is asserted.',
    origin: 'ai', verification: 'unverified', createdAt: '2026-11-03T10:00:00Z',
    beats: mode === 'quiet' ? [] : [
      makeBeat('Mira reached the harbour before the baker unlocked his shutters.', mode === 'long' ? 'Unacknowledged private yearning' : 'Quiet hope', mode === 'long' ? 'Unresolved quiet apprehension' : 'Old grief', 'hold', 'tender', 2),
      makeBeat('Somewhere below the stonework, water knocked three times and then waited.', 'Unease', 'Curiosity', 'build', 'tense', 4),
      makeBeat('She wanted to go home, boil water, and let the day become ordinary.', 'Longing', 'Dread', 'hold', 'cool', 3),
      makeBeat('Mira laughed then, one startled breath.', 'Relief', 'Disbelief', 'release', 'tender', 4),
    ],
  };
  if (mode === 'invalid') annotation.anchor.contentHash = '0'.repeat(64);
  let requests = 0;
  await page.route('**/api/integrations/heartbeat?**', async route => {
    requests++;
    if (mode === 'error') await route.fulfill({ status: 503, json: { error: 'Synthetic unavailable service' } });
    else await route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } });
  });
  return { document, annotation, requests: () => requests };
}
const writingToggle = (page: Page) => page.locator('.format-toolbar').getByRole('button', { name: 'Emotional Heartbeat', exact: true });
const readingToggle = (page: Page) => page.locator('.reader-header').getByRole('button', { name: 'Emotional Heartbeat', exact: true });
async function sourceState(page: Page) { return page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals }); }); }
async function highlights(page: Page, scope: 'writer' | 'reader') { return page.evaluate(value => [...((CSS as any).highlights?.keys() || [])].filter((key: string) => key.startsWith('heartbeat-' + value)), scope); }

for (const width of [1440, 390]) test(`Heartbeat visual evidence ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await seed(page);
  const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat/after'; await mkdir(output, { recursive: true });
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('Mira reached the harbour');
  const baselineOnly = output.includes('baseline'); await page.screenshot({ path: `${output}/writer-off-${width}.png` });
  if (!baselineOnly) { await writingToggle(page).click(); await expect(page.locator('.heartbeat-beat').first()).toContainText('Quiet hope'); await expect.poll(() => highlights(page, 'writer')).not.toEqual([]); }
  await page.screenshot({ path: `${output}/writer-${width}.png` });
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0'); await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-pages'))).toBeGreaterThan(1);
  if (!baselineOnly) await expect(page.locator('.reader .heartbeat-beat').first()).toContainText('Quiet hope');
  await page.screenshot({ path: `${output}/reader-${width}.png` });
  if (!baselineOnly) { await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat')).toHaveCount(0); await page.screenshot({ path: `${output}/reader-off-${width}.png` }); }
});

test('Off by default; toggles, reasoning and source navigation never change writing', async ({ page }) => {
  const fixture = await seed(page); const before = await sourceState(page);
  await expect(writingToggle(page)).toHaveAttribute('aria-pressed', 'false'); await expect(page.locator('.heartbeat')).toHaveCount(0); expect(fixture.requests()).toBe(0);
  await writingToggle(page).focus(); await page.keyboard.press('Space'); await expect(page.locator('.heartbeat-beat')).toHaveCount(4); await expect(page.locator('.heartbeat')).toContainText('undertone: Old grief');
  await expect(page.getByRole('dialog', { name: 'A possible reading' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Relief.*undertone: Disbelief/ }).click(); await expect(page.getByRole('dialog', { name: 'A possible reading' })).toContainText('Unverified AI inference');
  await page.getByRole('button', { name: 'Find this passage' }).click(); await expect.poll(() => page.locator('.manuscript-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  await writingToggle(page).click(); await expect(page.locator('.heartbeat')).toHaveCount(0); expect(await highlights(page, 'writer')).toEqual([]); expect(await sourceState(page)).toBe(before);
});

test('A local draft edit immediately rejects annotations despite an unchanged source quote', async ({ page }) => {
  await seed(page); await writingToggle(page).click(); await expect(page.locator('.heartbeat-beat')).toHaveCount(4);
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await canvas.press('ControlOrMeta+End'); await page.keyboard.insertText(' A new author sentence.');
  await expect(page.locator('.heartbeat')).toContainText('Writing changed'); await expect(page.locator('.heartbeat-beat')).toHaveCount(0); expect(await highlights(page, 'writer')).toEqual([]);
  await expect(canvas).toContainText('Mira reached the harbour before the baker unlocked his shutters.'); await expect(canvas).toContainText('A new author sentence.');
});

for (const width of [1440, 390, 320]) test(`Read toggles retain pagination and exact text at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await seed(page); const before = await sourceState(page);
  await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-pages'))).toBeGreaterThan(1);
  const geometry = await page.locator('.reader-stage').evaluate(element => ({ pages: element.getAttribute('data-pages'), width: element.clientWidth, height: element.clientHeight, text: element.textContent }));
  await readingToggle(page).focus(); await page.keyboard.press('Space'); await expect(page.locator('.reader .heartbeat-beat').first()).toContainText('Quiet hope'); expect(await highlights(page, 'reader')).not.toEqual([]);
  expect(await page.locator('.reader-stage').evaluate(element => ({ pages: element.getAttribute('data-pages'), width: element.clientWidth, height: element.clientHeight, text: element.textContent }))).toEqual(geometry);
  await page.locator('.reader .heartbeat-beat').first().click(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'A possible reading' })).toHaveCount(0); await expect(page.locator('.reader')).toBeVisible();
  await readingToggle(page).click(); expect(await highlights(page, 'reader')).toEqual([]); expect(await sourceState(page)).toBe(before); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Changed live writing invalidates the frozen private reading snapshot immediately', async ({ page }) => {
  const fixture = await seed(page); await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat-beat').first()).toContainText('Quiet hope');
  await page.evaluate(id => { (window as any).__NOVELIAA_TEST__.updateDocument(id, { title: 'A deliberate new title' }); }, fixture.document.id);
  await expect(page.locator('.reader .heartbeat')).toContainText('Writing changed'); await expect(page.locator('.reader .heartbeat-beat')).toHaveCount(0); expect(await highlights(page, 'reader')).toEqual([]); await expect(page.locator('.reader-prose')).toContainText('When the steps returned');
});

for (const mode of ['quiet', 'error', 'invalid', 'long'] as const) test(`Heartbeat ${mode} state stays quiet and bounded`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page, mode); const before = await sourceState(page); await writingToggle(page).click();
  if (mode === 'quiet') await expect(page.locator('.heartbeat')).toContainText('A quiet passage');
  else if (mode === 'error') await expect(page.locator('.heartbeat')).toContainText('unavailable');
  else if (mode === 'invalid') { await expect(page.locator('.heartbeat')).toContainText('No Heartbeat for this revision'); expect(await highlights(page, 'writer')).toEqual([]); }
  else await expect(page.locator('.heartbeat-beat').first()).toContainText('Unacknowledged private yearning');
  await mkdir('.local/heartbeat/after', { recursive: true }); await page.screenshot({ path: `.local/heartbeat/after/state-${mode}-390.png` }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await sourceState(page)).toBe(before);
});

for (const width of [1440, 390]) test(`Long labels retain their leading words in the reader at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await seed(page, 'long');
  await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await readingToggle(page).click();
  const beat = page.locator('.reader .heartbeat-beat').first(); await expect(beat).toContainText('Unacknowledged private yearning');
  expect(await beat.locator('.heartbeat-emotions').evaluate(element => { const strip = element.closest('.heartbeat-strip')!.getBoundingClientRect(); const bounds = element.getBoundingClientRect(); return bounds.top >= strip.top - 1 && bounds.bottom <= strip.bottom + 1; })).toBe(true);
  await page.screenshot({ path: `.local/heartbeat/after/reader-long-${width}.png` });
  await beat.click(); await expect(page.getByRole('dialog', { name: 'A possible reading' })).toContainText('Unacknowledged private yearning');
  await page.screenshot({ path: `.local/heartbeat/after/reasoning-${width}.png` });
});

test('A metadata-only local change also invalidates a frozen reader anchor', async ({ page }) => {
  const fixture = await seed(page); await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat-beat').first()).toBeVisible();
  await page.evaluate(id => { (window as any).__NOVELIAA_TEST__.updateDocument(id, { collectionId: null }); }, fixture.document.id);
  await expect(page.locator('.reader .heartbeat')).toContainText('Writing changed'); expect(await highlights(page, 'reader')).toEqual([]);
});

test('Highlight API absence retains accessible labels and editable text', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Highlight', { value: undefined, configurable: true }); }); await seed(page); await writingToggle(page).click(); await expect(page.getByRole('button', { name: /^Quiet hope.*undertone: Old grief/ })).toBeVisible();
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await page.keyboard.insertText('An author’s addition. '); await expect(canvas).toContainText('An author’s addition.');
});

for (const width of [1440, 390]) test(`Heartbeat accessibility across writer, reasoning, paper and night at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await seed(page);
  const check = async (state: string) => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), state).toEqual([]);
    // Native top-layer dialogs can make axe leave contrast as "incomplete".
    // Check their observed ink against the actual opaque paper as well.
    const dialog = page.getByRole('dialog', { name: 'A possible reading' });
    if (await dialog.isVisible()) {
      const contrast = await dialog.evaluate(element => {
        const luminance = (color: string) => { const values = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => { const normalized = value / 255; return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4; }); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
        const paper = luminance(getComputedStyle(element).backgroundColor);
        return [...element.querySelectorAll<HTMLElement>('.heartbeat-detail,.heartbeat-detail *')].filter(node => node.getClientRects().length && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())).map(node => { const ink = luminance(getComputedStyle(node).color); return { text: node.textContent?.slice(0, 70), ratio: (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05) }; });
      });
      expect(contrast.filter(pair => pair.ratio < 4.5), state + ' measured dialog contrast').toEqual([]);
    }
  };
  await check('writer off');
  await writingToggle(page).click(); await expect(page.locator('.heartbeat-beat')).toHaveCount(4); await check('writer ready');
  await page.locator('.heartbeat-beat').first().click(); await expect(page.getByRole('dialog', { name: 'A possible reading' })).toBeVisible(); await check('writer reasoning');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect(page.locator('.reader .heartbeat-beat').first()).toBeVisible(); await check('paper reader ready');
  await page.locator('.reader .heartbeat-beat').first().click(); await check('paper reader reasoning'); await page.keyboard.press('Escape');
  await readingToggle(page).click(); await check('paper reader off');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByRole('button', { name: 'Night', exact: true }).click(); await page.getByRole('button', { name: 'Close reading settings' }).click();
  await expect(page.locator('.reader')).toHaveClass(/reader-night/); await check('night reader off');
  await readingToggle(page).hover(); await check('night reader off hover');
  await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat-beat').first()).toBeVisible(); await check('night reader ready');
  await page.screenshot({ path: `.local/heartbeat/after/reader-night-${width}.png` });
  await page.locator('.reader .heartbeat-beat').first().click(); await check('night reader reasoning');
});
