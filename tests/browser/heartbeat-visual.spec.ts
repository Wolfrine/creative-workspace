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
async function rails(page: Page, scope: string) { return page.locator(`.heartbeat-rail[data-heartbeat-scope="${scope}"] path[data-coverage="continuous"]`).evaluateAll(paths => paths.map(path => path.getAttribute('data-feeling-key'))); }
async function openReader(page: Page) {
  // These established cases exercise paginated reading. Auto/Scroll defaults
  // have their own native-scroll and complete-reachability coverage.
  await page.evaluate(() => localStorage.setItem('noveliaa.reader.preferences', JSON.stringify({ layout: 'pages' })));
  await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0');
}
const bookmark = (page: Page) => page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('noveliaa.reader.position.'))?.[1]);

for (const [width, height] of [[1366, 768], [390, 844], [320, 568]]) test(`Heartbeat visual evidence ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(page);
  const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-rework/browser'; await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/writer-off-${width}.png` });
  await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Eager calm');
  await page.screenshot({ path: `${output}/writer-${width}.png` });
  await openReader(page); await expect(page.locator('.reader .heartbeat-legend-item').first()).toContainText('Eager calm');
  await expect.poll(() => rails(page, 'reader')).not.toEqual([]);
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
  await writingToggle(page).click(); await expect(page.locator('.heartbeat')).toHaveCount(0); expect(await rails(page, 'writer')).toEqual([]); expect(await sourceState(page)).toBe(before);
});

test('A local draft edit immediately rejects annotations despite an unchanged source quote', async ({ page }) => {
  await seed(page); await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toBeVisible();
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await canvas.press('ControlOrMeta+End'); await page.keyboard.insertText(' A new author sentence.');
  await expect(page.locator('.heartbeat')).toContainText('Writing changed'); await expect(page.locator('.heartbeat-legend-item')).toHaveCount(0); expect(await rails(page, 'writer')).toEqual([]);
  await expect(page.locator('.heartbeat-rail-segment:not([data-token="unanalysed"])')).toHaveCount(0); await expect(page.locator('.heartbeat-rail[data-projection="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => { const text = (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].plainText; return [...document.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].every(path => path.dataset.sourceStart === '0' && Number(path.dataset.sourceEnd) === text.length && path.dataset.feelingKey === 'unanalysed'); })).toBe(true);
  await expect(canvas).toContainText('Late afternoon light'); await expect(canvas).toContainText('A new author sentence.');
});

for (const [width, height] of [[1366, 768], [390, 844], [320, 568]]) test(`Read toggles retain exact text and passage anchor at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(page); const before = await sourceState(page);
  await openReader(page);
  const exactText = await page.locator('.reader-prose').textContent();
  const next = page.getByRole('button', { name: 'Next reader page', exact: true });
  if (await next.isEnabled()) await next.click();
  const position = await bookmark(page);
  await readingToggle(page).click(); await expect.poll(() => rails(page, 'reader')).not.toEqual([]);
  // Compact footer may repaginate; the exact stored passage must stay put.
  await expect.poll(() => bookmark(page)).toBe(position);
  expect(await page.locator('.reader-prose').textContent()).toBe(exactText);
  await readingToggle(page).click(); await expect.poll(() => rails(page, 'reader')).toEqual([]);
  await expect.poll(() => bookmark(page)).toBe(position); expect(await sourceState(page)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const change of ['title', 'order'] as const) test(`A ${change} change invalidates the frozen reader source`, async ({ page }) => {
  const fixture = await seed(page); await openReader(page); await readingToggle(page).click(); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await page.evaluate(({ id, field }) => { (window as any).__NOVELIAA_TEST__.updateDocument(id, field === 'title' ? { title: 'A deliberate new title' } : { order: 1 }); }, { id: fixture.document.id, field: change });
  await expect(page.locator('.reader .heartbeat')).toContainText('Writing changed'); expect(await rails(page, 'reader')).toEqual([]); await expect(page.locator('.heartbeat-rail-segment:not([data-token="unanalysed"])')).toHaveCount(0); await expect(page.locator('.heartbeat-rail[data-projection="true"]')).toHaveCount(0); await expect(page.locator('.reader-prose')).toContainText('Late afternoon light');
});

for (const mode of ['rest', 'sparse', 'error', 'invalid', 'long'] as const) test(`Heartbeat ${mode} stays honest and bounded`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await seed(page, mode); const before = await sourceState(page); await writingToggle(page).click();
  if (mode === 'rest') { await expect(page.locator('.heartbeat-legend-item')).toContainText('Rest'); await expect.poll(() => rails(page, 'writer')).not.toEqual([]); expect(new Set(await rails(page, 'writer'))).toEqual(new Set(['rest'])); }
  else if (mode === 'sparse') {
    await expect(page.getByRole('button', { name: 'Unanalysed writing. About this interpretation.', exact: true })).toBeVisible();
    expect(await rails(page, 'writer')).toEqual([]); await expect(page.locator('.heartbeat-legend-item:not([data-token="unanalysed"])')).toHaveCount(0);
    await expect.poll(() => page.locator('.heartbeat-rail[data-coverage="unanalysed"] path').count()).toBeGreaterThan(0);
    expect(await page.locator('.heartbeat-rail path').evaluateAll(paths => paths.every(path => path.getAttribute('data-token') === 'unanalysed' && getComputedStyle(path).strokeDasharray !== 'none'))).toBe(true);
  }
  else if (mode === 'error') await expect(page.locator('.heartbeat')).toContainText('unavailable');
  else if (mode === 'invalid') { await expect(page.locator('.heartbeat')).toContainText('No AI interpretation for this revision'); expect(await rails(page, 'writer')).toEqual([]); }
  else {
    const key = page.locator('.heartbeat-legend-item').first();
    await expect(key).toContainText('Unacknowledged private yearning'); await key.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await expect(key).toBeFocused();
    const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-current/qa/browser'; await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/long-feeling-focused-320.png` });
    await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toContainText('Unacknowledged private yearning');
    await page.screenshot({ path: `${output}/long-feeling-details-320.png` });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await sourceState(page)).toBe(before);
});

test('Native Highlight API absence retains the actual rail, accessible labels and editable text', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Highlight', { value: undefined, configurable: true }); Object.defineProperty(CSS, 'highlights', { value: undefined, configurable: true }); }); await seed(page); await writingToggle(page).click();
  await expect(page.getByRole('button', { name: 'Eager calm. Show interpretation.', exact: true })).toBeVisible();
  await expect.poll(() => rails(page, 'writer')).not.toEqual([]);
  await expect(page.locator('.heartbeat-caption')).not.toContainText('Colors unavailable');
  expect(await page.evaluate(() => [...((CSS as any).highlights?.keys() || [])].filter((key: string) => key.startsWith('heartbeat-')))).toEqual([]);
  const canvas = page.getByRole('textbox', { name: 'Writing canvas' }); await canvas.click(); await page.keyboard.insertText('An author’s addition. '); await expect(canvas).toContainText('An author’s addition.');
});

test('Writer scrolling updates its visible legend without another annotation request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const fixture = await seed(page); await writingToggle(page).click();
  await expect(page.locator('.heartbeat-legend-item').first()).toContainText('Eager calm'); const count = fixture.requests();
  await page.locator('.manuscript-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.heartbeat-legend')).toContainText('Tempered eagerness'); await expect(page.locator('.heartbeat-legend')).not.toContainText('Eager calm');
  await page.getByRole('button', { name: 'Show 1 more feelings on this page', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Color to feeling' })).toContainText('Quiet reward'); expect(fixture.requests()).toBe(count);
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
        const measured = (ink: string, required: number, text: string) => {
          const value = luminance(ink); const channels = ink.match(/[\d.]+/g) || [];
          return { text, required, ratio: Number.isFinite(value) && (channels.length < 4 || Number(channels[3]) === 1) ? (Math.max(value, paper) + .05) / (Math.min(value, paper) + .05) : 0 };
        };
        const semantic = [...element.querySelectorAll<HTMLElement>('.heartbeat-detail,.heartbeat-detail *')].filter(node => node.getClientRects().length && !node.closest('[aria-hidden="true"]') && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())).map(node => {
          const ink = luminance(getComputedStyle(node).color);
          return { text: node.textContent?.slice(0, 50), required: 4.5, ratio: (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05) };
        });
        // A real sample remains a graphic after Unicode marks become SVG. Read
        // its actual paint, so a markup change cannot evade this contrast gate.
        const graphics = [...element.querySelectorAll<HTMLElement>('.heartbeat-detail .heartbeat-swatch')].filter(node => node.getClientRects().length).map(node => {
          const path = node.querySelector('svg path,svg line,svg polyline');
          return measured(path ? getComputedStyle(path).stroke : getComputedStyle(node).color, 3, 'Feeling sample graphic');
        });
        type Rgba = [number, number, number, number];
        const rgba = (value: string): Rgba | null => {
          if (!/^rgba?\(/.test(value)) return null;
          const values = (value.match(/[\d.]+/g) || []).map(Number);
          return values.length >= 3 ? [values[0], values[1], values[2], values[3] ?? 1] : null;
        };
        const composite = (front: Rgba, back: Rgba): Rgba => [front[0] * front[3] + back[0] * (1 - front[3]), front[1] * front[3] + back[1] * (1 - front[3]), front[2] * front[3] + back[2] * (1 - front[3]), 1];
        const colorString = (value: Rgba) => `rgb(${value[0]}, ${value[1]}, ${value[2]})`;
        const opaqueBackdrop = (node: Element) => {
          const translucent: Rgba[] = [];
          for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const background = rgba(getComputedStyle(ancestor).backgroundColor);
            if (!background || background[3] === 0) continue;
            if (background[3] === 1) return { ancestor, color: translucent.reduceRight((back, front) => composite(front, back), background) };
            translucent.push(background);
          }
          return null;
        };
        const controlPaint = (node: Element, raw: string, paintOpacity: number, text: string) => {
          const background = opaqueBackdrop(node), color = rgba(raw);
          let opacity = paintOpacity;
          for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
            opacity *= Number(getComputedStyle(ancestor).opacity);
            if (ancestor === background?.ancestor) break;
          }
          const effective = color && background ? composite([color[0], color[1], color[2], color[3] * opacity], background.color) : null;
          const ink = effective ? luminance(colorString(effective)) : NaN;
          const paper = background ? luminance(colorString(background.color)) : NaN;
          return { text, required: 3, paint: raw, opacity: color ? color[3] * opacity : 0, background: background ? colorString(background.color) : 'No opaque ancestor', ratio: Number.isFinite(ink) && Number.isFinite(paper) ? (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05) : 0 };
        };
        const controls = [...element.querySelectorAll<HTMLElement>('button,[role="button"],a[href]')].filter(control => control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden');
        // aria-hidden SVGs still supply the sole visible close-X affordance.
        // Measure their actual painted primitives against their real surface.
        const interactiveGraphics = controls.flatMap(control => {
          const label = control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName;
          const visible = [...control.querySelectorAll<SVGElement>('svg path,svg line,svg polyline,svg polygon,svg rect,svg circle,svg ellipse')].filter(node => {
            const rect = node.getBoundingClientRect(); return node.getClientRects().length && (rect.width > 0 || rect.height > 0) && getComputedStyle(node).visibility !== 'hidden';
          });
          // Hiding the close glyph cannot turn a failed control into a pass.
          if (control.querySelector('svg') && !visible.length) return [controlPaint(control, 'none', 0, `Interactive SVG without visible paint: ${label}`)];
          return visible.map(node => {
            const paint = getComputedStyle(node);
            const stroke = paint.stroke !== 'none' && Number(paint.strokeOpacity) > 0 && parseFloat(paint.strokeWidth) > 0;
            return controlPaint(node, stroke ? paint.stroke : paint.fill, Number(stroke ? paint.strokeOpacity : paint.fillOpacity), `Interactive SVG: ${label}`);
          });
        });
        const focusOutlines = controls.filter(control => {
          const paint = getComputedStyle(control); return control.matches(':focus-visible') && paint.outlineStyle !== 'none' && parseFloat(paint.outlineWidth) > 0;
        }).map(control => controlPaint(control, getComputedStyle(control).outlineColor, 1, `Visible focus outline: ${control.getAttribute('aria-label') || control.textContent?.trim()}`));
        const night = !!document.querySelector('.reader.reader-night');
        const readerPaper = document.querySelector('.reader-book');
        return { pairs: [...semantic, ...graphics, ...interactiveGraphics, ...focusOutlines], interactiveGraphics, focusOutlines, background: getComputedStyle(element).backgroundColor, backgroundLuminance: paper, night, readerPaperLuminance: readerPaper ? luminance(getComputedStyle(readerPaper).backgroundColor) : null };
      });
      await test.info().attach(`dialog-contrast-${state.replace(/\s+/g, '-')}`, { contentType: 'application/json', body: JSON.stringify({ width, state, ...contrast }) });
      expect(contrast.pairs.filter(pair => pair.ratio < pair.required), state + ' measured semantic-text and decorative-graphic dialog contrast').toEqual([]);
      if (contrast.night) {
        expect(contrast.backgroundLuminance, 'Night details retain a dark surface').toBeLessThan(.15);
        expect(contrast.backgroundLuminance).toBeLessThanOrEqual((contrast.readerPaperLuminance || 0) + .08);
      }
    }
  };
  await check('writer off'); await writingToggle(page).click(); await expect(page.locator('.heartbeat-legend-item').first()).toBeVisible(); await check('writer ready');
  await page.locator('.heartbeat-legend-item').first().click(); await check('writer reasoning'); await page.keyboard.press('Escape');
  await openReader(page); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible(); await check('paper reader');
  await page.locator('.reader .heartbeat-legend-item').first().click(); await check('paper reasoning'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByRole('button', { name: 'Night', exact: true }).click(); await page.getByRole('button', { name: 'Close reading settings' }).click();
  await check('night reader'); await page.locator('.reader .heartbeat-legend-item').first().click(); await check('night reasoning');
  const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-current/qa/browser'; await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/night-details-${width}.png` });
});
