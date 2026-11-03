import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedContinuityWorkspace, continuityAnnotation } from '../helpers/heartbeat-continuity-fixture';

async function reader(page: Page, width = 1366, height = 768, motion = false) {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: motion ? 'no-preference' : 'reduce' });
  const notebook = `heartbeat-layout-${width}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/?local=1&notebook=' + notebook); await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  // This established suite tests Pages, including complete character coverage
  // and real curl clones. Auto Scroll defaults have their own current suite.
  await page.evaluate(() => localStorage.setItem('noveliaa.reader.preferences', JSON.stringify({ layout: 'pages' })));
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
  if (width === 1366) await expect(page.locator('.reader .heartbeat-more')).toHaveCount(0);
});

test('The actual rail covers exactly the explicit full source; no prose fills, wrapper marks or source edits', async ({ page }) => {
  const fixture = await reader(page);
  const field = await page.evaluate(() => ({
    ranges: [...new Map([...document.querySelectorAll<SVGPathElement>('.reader-prose .heartbeat-rail-segment')].map(path => [path.dataset.sourceStart + ':' + path.dataset.sourceEnd, { start: Number(path.dataset.sourceStart), end: Number(path.dataset.sourceEnd), indexes: path.dataset.beatIndexes }])).values()],
    marks: document.querySelectorAll('.reader-prose mark').length,
    railText: [...document.querySelectorAll('.heartbeat-rail')].map(rail => rail.textContent).join(''),
    fills: [...document.querySelectorAll('.reader-prose [data-passage],.reader-prose [data-passage] *')].map(node => getComputedStyle(node).backgroundColor).filter(color => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent'),
    native: [...((CSS as any).highlights?.keys() || [])].filter((name: string) => name.startsWith('heartbeat-')),
    original: (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].plainText,
  }));
  expect(field.marks).toBe(0); expect(field.original).toBe(fixture.workspace.documents[0].plainText);
  expect(field.railText).toBe(''); expect(field.fills).toEqual([]); expect(field.native).toEqual([]);
  expect(field.ranges.map(range => ({ start: range.start, end: range.end, text: field.original.slice(range.start, range.end) }))).toEqual(fixture.annotation.beats.map(beat => ({ start: beat.start, end: beat.end, text: beat.quote })));
});

test('Actual rail accents and unchanged prose retain contrast on paper and night', async ({ page }) => {
  await reader(page);
  for (const theme of ['paper', 'night']) {
    if (theme === 'night') { await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByRole('button', { name: 'Night', exact: true }).click(); await page.getByRole('button', { name: 'Close reading settings', exact: true }).click(); }
    const pairs = await page.locator('.reader-prose').evaluate(element => {
      const light = (color: string) => { const c = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(n => { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
      const background = getComputedStyle(document.querySelector('.reader-book')!).backgroundColor;
      const b = light(background);
      const measure = (ink: string) => { const a = light(ink); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
      return { prose: measure(getComputedStyle(element).color), background, accents: [...new Map([...element.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].map(path => { const paint = getComputedStyle(path); return [path.dataset.feelingKey, { key: path.dataset.feelingKey, color: paint.stroke, contrast: measure(paint.stroke), opacity: Number(paint.opacity) * Number(paint.strokeOpacity) }] as const; })).values()] };
    });
    expect(pairs.prose, theme + ' unchanged prose contrast').toBeGreaterThanOrEqual(4.5);
    expect(pairs.accents.every(pair => pair.contrast >= 3 && pair.opacity === 1), theme + JSON.stringify(pairs)).toBe(true);
    expect(new Set(pairs.accents.map(pair => pair.color)).size).toBe(7);
  }
});

test('Rail follows the measured source columns continuously and stays outside the prose', async ({ page }) => {
  const fixture = await reader(page);
  const geometry = await page.evaluate(async ({ body, annotation }) => {
    await document.fonts.ready;
    const { heartbeatRanges } = await import('/src/heartbeat/decorations.ts');
    const article = document.querySelector<HTMLElement>('.reader-prose')!;
    const source = article.querySelector<HTMLElement>('.reader-source')!;
    const articleBounds = article.getBoundingClientRect();
    const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    const stride = stage.clientWidth / Number(stage.dataset.columns);
    const ranges = heartbeatRanges(source, body, annotation).map(({ beat, range }: any) => ({ start: beat.start, end: beat.end, rects: [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => ({ column: Math.floor((rect.left - articleBounds.left + 2) / stride), left: rect.left - articleBounds.left, top: rect.top - articleBounds.top, bottom: rect.bottom - articleBounds.top })) }));
    const paths = [...article.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].map(path => {
      const box = path.getBBox(); const column = Number(path.dataset.column);
      const point = path.getPointAtLength(0); const matrix = path.getScreenCTM();
      const paintedX = matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix).x - articleBounds.left : NaN;
      const sourceRange = ranges.find(range => range.start === Number(path.dataset.sourceStart) && range.end === Number(path.dataset.sourceEnd));
      const rects = sourceRange?.rects.filter(rect => rect.column === column) || [];
      return { column, start: Number(path.dataset.sourceStart), end: Number(path.dataset.sourceEnd), top: box.y, bottom: box.y + box.height, metadataTop: Number(path.dataset.top), metadataBottom: Number(path.dataset.bottom), x: paintedX, width: parseFloat(getComputedStyle(path).strokeWidth), exactSource: !!sourceRange, rects };
    });
    return { stageHeight: stage.clientHeight, paths };
  }, { body: fixture.workspace.documents[0].body, annotation: fixture.annotation });
  expect(geometry.paths.length).toBeGreaterThanOrEqual(fixture.annotation.beats.length);
  for (const path of geometry.paths) {
    expect(path.exactSource).toBe(true); expect(path.rects.length).toBeGreaterThan(0);
    expect(path.top).toBeCloseTo(path.metadataTop, 1); expect(path.bottom).toBeCloseTo(path.metadataBottom, 1);
    expect(path.bottom).toBeGreaterThan(path.top); expect(path.width).toBeLessThanOrEqual(8);
    expect(path.x + path.width / 2).toBeLessThan(Math.min(...path.rects.map(rect => rect.left)));
    // A feeling change on a shared text line uses a midpoint partition. The
    // path must still intersect that exact source range's measured line band.
    expect(path.top).toBeLessThan(Math.max(...path.rects.map(rect => rect.bottom)));
    expect(path.bottom).toBeGreaterThan(Math.min(...path.rects.map(rect => rect.top)));
  }
  const columns = [...new Set(geometry.paths.map(path => path.column))];
  for (const column of columns) {
    const paths = geometry.paths.filter(path => path.column === column).sort((a, b) => a.top - b.top);
    for (let index = 1; index < paths.length; index++) expect(paths[index].top).toBeCloseTo(paths[index - 1].bottom, 1);
    if (column === columns[0]) expect(paths[0].top).toBeCloseTo(Math.min(...paths[0].rects.map(rect => rect.top)), 0);
    if (column === columns.at(-1)) expect(paths.at(-1)!.bottom).toBeCloseTo(Math.max(...paths.at(-1)!.rects.map(rect => rect.bottom)), 0);
  }
  await test.info().attach('measured-source-rail-geometry', { contentType: 'application/json', body: JSON.stringify(geometry) });
});

test('The page key includes only feelings with actual visible glyphs at paragraph boundaries', async ({ page }) => {
  const fixture = await reader(page, 320, 568);
  for (let turn = 0; turn < 30; turn++) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const visible = await page.evaluate(beats => {
      const bounds = document.querySelector('.reader-stage')!.getBoundingClientRect();
      const indexes = new Set<number>(); let offset = 0;
      for (const passage of document.querySelectorAll('.reader-prose [data-passage]')) {
        const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) for (let index = 0; index < node.textContent!.length; index++, offset++) {
          if (/\s/u.test(node.textContent![index])) continue;
          const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width > .5 && rect.right > bounds.left && rect.left < bounds.right && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1) {
            const beat = beats.findIndex(beat => offset >= beat.start && offset < beat.end);
            if (beat >= 0) indexes.add(beat);
          }
        }
        offset++; // Exact source paragraph separator, absent from DOM text.
      }
      return [...indexes].sort((a, b) => a - b).map(index => beats[index].foreground);
    }, fixture.annotation.beats);
    const actual = await page.locator('.reader .heartbeat-legend-item').allTextContents();
    // Scarce preview space may prioritize the largest visible source spans;
    // every shown feeling still needs real glyphs, without duplicate labels.
    const shown = actual.map(text => visible.find(label => text?.includes(label)));
    expect(shown.every(Boolean)).toBe(true); expect(new Set(shown).size).toBe(actual.length);
    const more = page.locator('.reader .heartbeat-more');
    if (visible.length > actual.length) { await expect(more).toHaveAttribute('aria-label', `All feelings. Show ${visible.length - actual.length} more feelings on this page`); await expect(more).toHaveText('All feelings'); }
    else await expect(more).toHaveCount(0);
    expect(actual.length).toBeGreaterThan(0);
    const next = page.getByRole('button', { name: 'Next reader page', exact: true });
    if (await next.isDisabled()) break;
    await next.click();
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

for (const width of [1366, 390, 320]) test(`Bounded page-turn projections preserve real rail geometry and clean off, resize and exit at ${width}px`, async ({ page }) => {
  const fixture = await reader(page, width, width === 1366 ? 768 : width === 390 ? 844 : 568, true); const source = fixture.workspace.documents[0].plainText;
  const start = (turnOff = false, waitForRotation = false) => page.evaluate(async ({ turnOff, waitForRotation }) => {
    await document.fonts.ready;
    const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    const article = document.querySelector<HTMLElement>('.reader-prose')!;
    // Use observable font-ready geometry and renderer frames, as the CI probe
    // does. A key alone can precede ResizeObserver pagination and cancel motion.
    let previousGeometry = ''; let stableFrames = 0;
    while (stableFrames < 2) {
      await new Promise(requestAnimationFrame);
      const geometry = JSON.stringify([stage.clientWidth, stage.clientHeight, stage.dataset.page, stage.dataset.pages, stage.dataset.columns, article.style.width, article.style.height, article.style.opacity]);
      stableFrames = geometry === previousGeometry && article.style.opacity === '1' ? stableFrames + 1 : 0;
      previousGeometry = geometry;
    }
    const signature = (path: SVGPathElement) => JSON.stringify(['d', 'data-document-id', 'data-coverage', 'data-source-start', 'data-source-end', 'data-beat-indexes', 'data-feeling-key', 'data-token', 'data-column', 'data-top', 'data-bottom', 'data-width', 'data-trajectory'].map(name => path.getAttribute(name)).concat(getComputedStyle(path).stroke));
    const canonical = [...article.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].map(signature);
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Next reader page"]')!;
    const previous = document.querySelector<HTMLButtonElement>('[aria-label="Previous reader page"]')!;
    (next.disabled ? previous : next).click();
    const snapshot = () => {
      const projections = [...document.querySelectorAll<HTMLElement>('.reader-page-content')];
      const projected = projections.flatMap(projection => [...projection.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].map(path => {
        const rect = path.getBoundingClientRect();
        const matrix = path.getScreenCTM();
        const first = path.getPointAtLength(0), last = path.getPointAtLength(path.getTotalLength());
        const a = matrix ? new DOMPoint(first.x, first.y).matrixTransform(matrix) : null;
        const b = matrix ? new DOMPoint(last.x, last.y).matrixTransform(matrix) : null;
        // getBBox() is zero before PageFlip displays a leaf. Interpreted path
        // endpoints/length remain meaningful for those inert hidden copies;
        // positive rendered screen geometry is checked separately below.
        return { signature: signature(path), inert: !!projection.closest('[inert]'), projection: path.closest('.heartbeat-rail')?.getAttribute('data-projection'), column: path.dataset.column, sourceColumn: projection.closest<HTMLElement>('.reader-motion-leaf')?.dataset.sourceColumn, finite: [rect.x, rect.y, rect.width, rect.height, a?.x, a?.y, b?.x, b?.y].every(value => typeof value === 'number' && Number.isFinite(value)), localGeometry: Math.abs(first.y - Number(path.dataset.top)) < .1 && Math.abs(last.y - Number(path.dataset.bottom)) < .1 && Math.abs(first.x - last.x) < .1 && Math.abs(path.getTotalLength() - (last.y - first.y)) < .1, screenGeometry: rect.height === 0 || !!a && !!b && Math.abs(Math.min(a.x, b.x) - rect.left) < .5 && Math.abs(Math.max(a.x, b.x) - rect.right) < .5 && Math.abs(Math.min(a.y, b.y) - rect.top) < .5 && Math.abs(Math.max(a.y, b.y) - rect.bottom) < .5, actualLength: path.getTotalLength() };
      }));
      return { active: stage.dataset.motionActive === 'true' && stage.dataset.motion === 'curl', rotated: [...document.querySelectorAll<HTMLElement>('.reader-motion-leaf')].some(leaf => { const angle = leaf.style.transform.match(/rotate\(([-\d.e]+)rad\)/); return leaf.style.clipPath.startsWith('polygon') && !!angle && Math.abs(Number(angle[1])) > .001; }), count: projections.length, displayed: projections.filter(projection => projection.getBoundingClientRect().height > 0 && getComputedStyle(projection).visibility !== 'hidden').length, decorated: projections.filter(projection => {
        const column = projection.closest<HTMLElement>('.reader-motion-leaf')?.dataset.sourceColumn;
        return [...projection.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].some(path => path.dataset.column === column && path.getTotalLength() > 0);
      }).length, painted: projections.filter(projection => {
        if (getComputedStyle(projection).visibility === 'hidden') return false;
        const column = projection.closest<HTMLElement>('.reader-motion-leaf')?.dataset.sourceColumn;
        return [...projection.querySelectorAll<SVGPathElement>('.heartbeat-rail-segment')].some(path => path.dataset.column === column && path.getTotalLength() > 0 && path.getBoundingClientRect().height > 0);
      }).length, projected };
    };
    const initial = snapshot();
    if (!turnOff && !waitForRotation) return { canonical, initial, moving: null, activeCurlSamples: 0, offWhileActive: false };
    // Arm inside the renderer before yielding to another protocol call. Portrait
    // clones appear in the first complete frame of the real PageFlip turn.
    let moving = initial; let activeCurlSamples = 0;
    do {
      await new Promise(requestAnimationFrame);
      moving = snapshot();
      if (moving.active) activeCurlSamples++;
    } while (moving.active && (moving.count === 0 || (stage.dataset.columns === '1' && moving.count <= initial.count) || waitForRotation && !moving.rotated));
    const offWhileActive = turnOff && moving.active && moving.count > 0;
    if (offWhileActive) document.querySelector<HTMLButtonElement>('.reader-header [aria-label="Emotional Heartbeat"]')!.click();
    return { canonical, initial, moving, activeCurlSamples, offWhileActive };
  }, { turnOff, waitForRotation });
  const projection = await start(true);
  const invalid = (paths: typeof projection.initial.projected) => paths.filter(path => !path.inert || path.projection !== 'true' || !path.finite || !path.localGeometry || !path.screenGeometry || path.actualLength <= 0 || !projection.canonical.includes(path.signature));
  const moving = projection.moving!;
  await test.info().attach('active-curl-probe', { contentType: 'application/json', body: JSON.stringify({ width, initialCount: projection.initial.count, activeCurlSamples: projection.activeCurlSamples, active: moving.active, count: moving.count, displayed: moving.displayed, decorated: moving.decorated, painted: moving.painted, projectedPaths: moving.projected.length, invalidInitialPaths: invalid(projection.initial.projected), invalidMovingPaths: invalid(moving.projected), exactInertGeometry: invalid(moving.projected).length === 0, offWhileActive: projection.offWhileActive }) });
  expect(projection.initial.count).toBeLessThanOrEqual(4); expect(projection.initial.projected.length).toBeGreaterThan(0); expect(invalid(projection.initial.projected)).toEqual([]);
  expect(projection.activeCurlSamples).toBeGreaterThan(0); expect(moving.active).toBe(true); expect(moving.count).toBeGreaterThan(0); expect(moving.count).toBeLessThanOrEqual(4); expect(moving.decorated).toBe(moving.count); expect(moving.displayed).toBeGreaterThan(0); expect(moving.painted).toBe(moving.displayed);
  expect(invalid(moving.projected)).toEqual([]);
  if (width < 1366) expect(moving.count).toBeGreaterThan(projection.initial.count);
  expect(projection.offWhileActive).toBe(true);
  await expect(page.getByRole('button', { name: 'Emotional Heartbeat', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.heartbeat-rail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect.poll(() => page.locator('.heartbeat-rail-segment').count()).toBeGreaterThan(0);
  const capture = await start(false, true); expect(capture.moving?.active).toBe(true); expect(capture.moving?.rotated).toBe(true);
  const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-current/qa/browser'; await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/motion-active-${width}.png`, animations: 'allow' });
  await test.info().attach('motion-png-state', { contentType: 'application/json', body: JSON.stringify({ width, activeBefore: capture.moving?.active, rotatedBefore: capture.moving?.rotated, activeAfter: await page.locator('.reader-stage').getAttribute('data-motion-active') }) });
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-motion-active', 'false');
  await start(); await page.setViewportSize({ width: 1200, height: 768 }); await expect(page.locator('.reader-page-content')).toHaveCount(0);
  await start(); await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.locator('.reader-motion-host')).toHaveCount(0); await expect(page.locator('.heartbeat-rail[data-projection="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().documents[0].plainText)).toBe(source); expect(fixture.requests()).toBeLessThanOrEqual(4);
});
