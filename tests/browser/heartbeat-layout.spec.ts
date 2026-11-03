import { test, expect, type Page } from '@playwright/test';
import { seedContinuityWorkspace, continuityAnnotation } from '../helpers/heartbeat-continuity-fixture';

async function reader(page: Page, width = 1366, height = 768, motion = false) {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: motion ? 'no-preference' : 'reduce' });
  const notebook = `heartbeat-layout-${width}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/?local=1&notebook=' + notebook); await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  const workspace = await seedContinuityWorkspace(page, notebook), annotation = continuityAnnotation(workspace);
  let requests = 0;
  await page.route('**/api/integrations/heartbeat?**', route => { requests++; return route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } }); });
  await page.getByRole('button', { name: 'Read this page', exact: true }).click(); await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0');
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { workspace, annotation, requests: () => requests };
}

for (const [width, height, lines, area, book] of [[1366, 768, 27, 36, 600], [390, 844, 15, 38, 690], [320, 568, 8, 29, 420]]) test(`Compact prose and complete readable page key at ${width}×${height}`, async ({ page }) => {
  await reader(page, width, height);
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('.reader-stage')!.getBoundingClientRect(), rects: DOMRect[] = [];
    for (const element of document.querySelectorAll('[data-passage]')) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) { const range = document.createRange(); range.selectNodeContents(node); for (const rect of range.getClientRects()) if (rect.right > stage.left && rect.left < stage.right && rect.top >= stage.top - 1 && rect.bottom <= stage.bottom + 1) rects.push(rect); }
    }
    const key = document.querySelector('.heartbeat-legend')!.getBoundingClientRect();
    return { book: document.querySelector('.reader-book')!.getBoundingClientRect().height, heading: document.querySelector('.reader-source-heading')!.getBoundingClientRect().height, lines: new Set(rects.map(rect => `${Math.round(rect.x / (stage.width / 2))}:${Math.round(rect.y)}`)).size, area: rects.reduce((sum, rect) => sum + rect.width * rect.height, 0) / (innerWidth * innerHeight) * 100, overflow: document.documentElement.scrollWidth - innerWidth, keys: [...document.querySelectorAll<HTMLElement>('.heartbeat-legend-item,.heartbeat-more')].map(node => { const rect = node.getBoundingClientRect(); return { label: node.textContent, font: parseFloat(getComputedStyle(node).fontSize), visible: rect.left >= key.left - 1 && rect.right <= key.right + 1 && rect.bottom <= innerHeight && rect.top >= key.top - 1, clipped: node.scrollWidth > node.clientWidth + 1 }; }) };
  });
  expect(geometry.book).toBeGreaterThanOrEqual(book); expect(geometry.heading).toBeLessThan(90); expect(geometry.lines).toBeGreaterThanOrEqual(lines); expect(geometry.area).toBeGreaterThanOrEqual(area); expect(geometry.overflow).toBe(0);
  expect(geometry.keys.length).toBeGreaterThan(0); expect(geometry.keys.every(key => key.font >= 11 && key.visible && !key.clipped)).toBe(true);
  await expect(page.locator('.heartbeat')).not.toContainText('Undertone:'); await expect(page.locator('.heartbeat')).not.toContainText('weight ');
  if (width === 1366) expect(geometry.keys.some(key => key.label?.startsWith('+'))).toBe(false);
});

test('Native field covers exactly the explicit full source; no wrapper marks or source edits', async ({ page }) => {
  const fixture = await reader(page);
  const field = await page.evaluate(() => ({ ranges: [...((CSS as any).highlights as Map<string, Set<Range>>)].filter(([name]) => name.startsWith('heartbeat-reader-')).flatMap(([name, ranges]) => [...ranges].map(range => ({ name, text: range.toString(), inside: !!range.startContainer.parentElement?.closest('.reader-source') && !!range.endContainer.parentElement?.closest('.reader-source') }))), marks: document.querySelectorAll('.reader-prose mark').length, original: (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].plainText }));
  const compact = (text: string) => text.replace(/\s/gu, '');
  expect(field.marks).toBe(0); expect(field.original).toBe(fixture.workspace.documents[0].plainText);
  expect(field.ranges.every(range => range.inside)).toBe(true);
  expect(field.ranges.map(range => compact(range.text)).sort()).toEqual(fixture.annotation.beats.map(beat => compact(beat.quote)).sort());
});

test('Native field ink retains readable contrast in every paper and night color family', async ({ page }) => {
  await reader(page);
  for (const theme of ['paper', 'night']) {
    if (theme === 'night') { await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByRole('button', { name: 'Night', exact: true }).click(); await page.getByRole('button', { name: 'Close reading settings', exact: true }).click(); }
    const pairs = await page.locator('.reader-prose').evaluate(element => {
      const light = (color: string) => { const c = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(n => { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
      return ['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral'].map(tone => { const style = getComputedStyle(element, `::highlight(heartbeat-reader-${tone})`); const a = light(style.color), b = light(style.backgroundColor); return { tone, background: style.backgroundColor, ink: style.color, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }; });
    });
    expect(pairs.every(pair => pair.contrast >= 4.5), theme + JSON.stringify(pairs)).toBe(true);
    expect(new Set(pairs.map(pair => pair.background)).size).toBe(7);
  }
});

for (const width of [1366, 320]) test(`Every source character appears once across reader turns at ${width}px`, async ({ page }) => {
  const fixture = await reader(page, width, width === 1366 ? 768 : 568);
  const seen: Record<string, number> = {};
  const trace: unknown[] = [];
  for (let turn = 0; turn < 30; turn++) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    trace.push(await page.locator('.reader-stage').evaluate(element => ({ page: element.getAttribute('data-page'), pages: element.getAttribute('data-pages'), height: element.clientHeight, legend: document.querySelector('.heartbeat-legend')?.textContent })));
    const offsets = await page.evaluate(() => {
      const bounds = document.querySelector('.reader-stage')!.getBoundingClientRect(); const out: number[] = []; let offset = 0;
      for (const passage of document.querySelectorAll('[data-passage]')) {
        const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) for (let index = 0; index < node.textContent!.length; index++) { const char = node.textContent![index]; if (!/\s/u.test(char)) { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1); const rect = range.getBoundingClientRect(); if (rect.width && rect.right > bounds.left && rect.left < bounds.right && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1) out.push(offset); } offset++; }
      }
      return out;
    });
    for (const offset of offsets) seen[offset] = (seen[offset] || 0) + 1;
    const next = page.getByRole('button', { name: 'Next reader page', exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  // DOM text nodes omit only source paragraph separators.
  const text = fixture.workspace.documents[0].plainText.replaceAll('\n', '');
  const missing = [...text].flatMap((char, index) => /\s/u.test(char) || seen[index] === 1 ? [] : [{ index, char, seen: seen[index] || 0 }]);
  if (missing.length) console.log(JSON.stringify({ width, trace }));
  expect(missing).toEqual([]);
});

for (const width of [1366, 390, 320]) test(`Bounded page-turn projections preserve native range text and clean off, resize and exit at ${width}px`, async ({ page }) => {
  const fixture = await reader(page, width, width === 1366 ? 768 : width === 390 ? 844 : 568, true); const source = fixture.workspace.documents[0].plainText;
  const start = (turnOff = false) => page.evaluate(async turnOff => {
    await document.fonts.ready;
    const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    const article = document.querySelector<HTMLElement>('.reader-prose')!;
    // A ready key can precede the font-ready/ResizeObserver pagination frame.
    // Wait for observable geometry to settle before exercising optional motion.
    let previousGeometry = ''; let stableFrames = 0;
    while (stableFrames < 2) {
      await new Promise(requestAnimationFrame);
      const geometry = JSON.stringify([stage.clientWidth, stage.clientHeight, stage.dataset.page, stage.dataset.pages, stage.dataset.columns, article.style.width, article.style.height, article.style.opacity]);
      stableFrames = geometry === previousGeometry && article.style.opacity === '1' ? stableFrames + 1 : 0;
      previousGeometry = geometry;
    }
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Next reader page"]')!;
    const previous = document.querySelector<HTMLButtonElement>('[aria-label="Previous reader page"]')!;
    (next.disabled ? previous : next).click();
    const registry = (CSS as any).highlights as Map<string, Set<Range>>;
    const canonical = [...registry].filter(([name]) => name.startsWith('heartbeat-reader-')).flatMap(([, ranges]) => [...ranges].map(range => range.toString()));
    const snapshot = () => {
      const ranges = [...registry].filter(([name]) => name.startsWith('heartbeat-motion-')).flatMap(([, value]) => [...value]);
      const projections = [...document.querySelectorAll('.reader-page-content')];
      return { active: stage.dataset.motionActive === 'true' && stage.dataset.motion === 'curl', count: projections.length, painted: projections.filter(element => ranges.some(range => element.contains(range.startContainer) && element.contains(range.endContainer) && range.toString().length > 0)).length, projected: ranges.map(range => ({ text: range.toString(), inert: !!range.startContainer.parentElement?.closest('[inert]') })) };
    };
    const initial = snapshot();
    if (!turnOff) return { canonical, initial, moving: null, activeCurlSamples: 0, offWhileActive: false };
    // Arm the frame probe in the browser before yielding to another protocol call.
    // The first complete portrait frame also contains PageFlip's temporary clone.
    let moving = initial; let activeCurlSamples = 0;
    do {
      await new Promise(requestAnimationFrame);
      moving = snapshot();
      if (moving.active) activeCurlSamples++;
    } while (moving.active && (moving.count === 0 || (stage.dataset.columns === '1' && moving.count <= initial.count)));
    const offWhileActive = moving.active && moving.count > 0;
    if (offWhileActive) document.querySelector<HTMLButtonElement>('.reader-header [aria-label="Emotional Heartbeat"]')!.click();
    return { canonical, initial, moving, activeCurlSamples, offWhileActive };
  }, turnOff);
  const projection = await start(true);
  expect(projection.initial.count).toBeLessThanOrEqual(4); expect(projection.initial.projected.length).toBeGreaterThan(0); expect(projection.initial.projected.filter(range => !range.inert || !projection.canonical.includes(range.text))).toEqual([]);
  const moving = projection.moving!;
  await test.info().attach('active-curl-probe', { contentType: 'application/json', body: JSON.stringify({ width, initialCount: projection.initial.count, activeCurlSamples: projection.activeCurlSamples, active: moving.active, count: moving.count, painted: moving.painted, projectedRanges: moving.projected.length, exactInertRanges: moving.projected.every(range => range.inert && projection.canonical.includes(range.text)), offWhileActive: projection.offWhileActive }) });
  expect(projection.activeCurlSamples).toBeGreaterThan(0); expect(moving.active).toBe(true); expect(moving.count).toBeGreaterThan(0); expect(moving.count).toBeLessThanOrEqual(4); expect(moving.painted).toBe(moving.count);
  expect(moving.projected.filter(range => !range.inert || !projection.canonical.includes(range.text))).toEqual([]);
  if (width < 1366) expect(moving.count).toBeGreaterThan(projection.initial.count);
  expect(projection.offWhileActive).toBe(true);
  await expect(page.getByRole('button', { name: 'Emotional Heartbeat', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => [...((CSS as any).highlights?.keys() || [])].filter((name: string) => name.startsWith('heartbeat-reader-') || name.startsWith('heartbeat-motion-')))).toEqual([]);
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect.poll(() => page.locator('.heartbeat-legend-item').count()).toBeGreaterThan(0);
  await start(); await page.setViewportSize({ width: 1200, height: 768 }); await expect.poll(() => page.evaluate(() => [...((CSS as any).highlights?.keys() || [])].filter((name: string) => name.startsWith('heartbeat-motion-')))).toEqual([]);
  await start(); await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.locator('.reader-motion-host')).toHaveCount(0); await expect.poll(() => page.evaluate(() => [...((CSS as any).highlights?.keys() || [])].filter((name: string) => name.startsWith('heartbeat-motion-')))).toEqual([]);
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].plainText)).toBe(source); expect(fixture.requests()).toBeLessThanOrEqual(4);
});
