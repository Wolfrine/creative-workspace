import { test, expect, type Page } from '@playwright/test';

// Browser-only instrumentation. Production code never replaces browser methods.
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const frames = new Set<number>(); const timers = new Set<number>(); const resize = new Set<unknown>();
    let started = 0; let cancelled = 0;
    const own = () => new Error().stack?.includes('/src/vendor/pageflip/page-flip.js');
    const request = window.requestAnimationFrame.bind(window); const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { if (!own()) return request(callback); started++; const id = request(time => { frames.delete(id); callback(time); }); frames.add(id); return id; };
    window.cancelAnimationFrame = id => { if (frames.delete(id)) cancelled++; cancel(id); };
    const delay = window.setTimeout.bind(window); const clear = window.clearTimeout.bind(window);
    window.setTimeout = ((callback: TimerHandler, milliseconds?: number, ...args: unknown[]) => { if (!own() || typeof callback !== 'function') return delay(callback, milliseconds, ...args); const id = delay(() => { timers.delete(id); callback(...args); }, milliseconds); timers.add(id); return id; }) as typeof setTimeout;
    window.clearTimeout = id => { timers.delete(id); clear(id); };
    const add = window.addEventListener.bind(window); const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, listener: unknown, options: unknown) => { if (type === 'resize' && own()) resize.add(listener); add(type, listener as EventListener, options as AddEventListenerOptions); }) as typeof add;
    window.removeEventListener = ((type: string, listener: unknown, options: unknown) => { if (type === 'resize') resize.delete(listener); remove(type, listener as EventListener, options as EventListenerOptions); }) as typeof remove;
    (window as any).__pageFlipResources = () => ({ frames: frames.size, timers: timers.size, resize: resize.size, started, cancelled });
  });
}
async function open(page: Page, suffix: string, paragraphs = 70, compact = false) {
  await instrument(page);
  await page.goto('/?local=1&notebook=motion-lifecycle-' + suffix + '-' + Date.now());
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  await page.evaluate(async ({ count, compact }) => { const engine = (window as any).__NOVELIAA_TEST__; await engine.createDocument({ title: 'An actual source, across many leaves', origin: 'ai', body: { type: 'doc', content: Array.from({ length: count }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: compact ? `Note ${index}.` : `Passage ${index}. Mira reached the harbour before the baker unlocked his shutters. A white dog slept beside the rope locker, one eye open to the sound of her steps. हिंदी é 🙂` }] })) } }); }, { count: paragraphs, compact });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect.poll(() => page.locator('.reader-stage').getAttribute('data-pages').then(Number)).toBeGreaterThan(4);
}
async function clean(page: Page) {
  await expect(page.locator('.reader-turn')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__pageFlipResources())).toMatchObject({ frames: 0, timers: 0, resize: 0 });
}
for (const width of [1440, 390]) test(`Actual content curl is bounded and releases resources after 20 turns at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, String(width));
  const before = await page.evaluate(() => { const s = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: s.documents, revisions: s.revisions, originals: s.originals, receipts: s.receipts, pending: s.pendingCount }); });
  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: index % 2 ? 'Previous reader page' : 'Next reader page', exact: true }).click();
    await expect(page.locator('.reader-turn')).toHaveCount(1);
    expect(await page.locator('.reader-motion-leaf').count()).toBeLessThanOrEqual(4);
    await expect(page.locator('.reader-page-content').first()).toContainText('Mira reached the harbour');
    await expect(page.locator('.reader-prose')).toHaveCount(1);
    // Overlay presence alone passed a rejected, stationary portrait back turn.
    await expect.poll(() => page.locator('.reader-motion-leaf').evaluateAll(leaves => leaves.some(leaf => {
      const style = (leaf as HTMLElement).style;
      const angle = style.transform.match(/rotate\(([-\d.e]+)rad\)/);
      return style.clipPath.startsWith('polygon') && Boolean(angle && Math.abs(Number(angle[1])) > .001);
    }))).toBe(true);
    await clean(page);
    if (index % 2) await expect(page.locator('.reader-prose .reader-source-heading')).toBeInViewport();
  }
  const counters = await page.evaluate(() => (window as any).__pageFlipResources());
  // A settled flip stops inside its final frame, before another frame is queued.
  expect(counters.started).toBeGreaterThan(20);
  expect(await page.evaluate(() => { const s = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: s.documents, revisions: s.revisions, originals: s.originals, receipts: s.receipts, pending: s.pendingCount }); })).toBe(before);
});

test('Rapid replacement, 20 reader exits, resize and reduced motion cancel all leaf work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open(page, 'cancel');
  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
    await page.getByRole('button', { name: 'Previous reader page', exact: true }).click();
    await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
    await clean(page);
    await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await clean(page);
  await page.getByRole('button', { name: 'Previous reader page', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await clean(page);
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click(); await clean(page);
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await page.waitForTimeout(150);
  await clean(page);
  const counters = await page.evaluate(() => (window as any).__pageFlipResources());
  expect(counters.started).toBeGreaterThan(40);
  expect(counters.cancelled).toBeGreaterThanOrEqual(20);
});

test('Large books animate only the canonical track and cancel slide work on every exit path', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open(page, 'large-slide', 500);
  const stage = page.locator('.reader-stage'); const prose = page.locator('.reader-prose');
  const cleanSlide = async () => {
    await expect(stage).toHaveAttribute('data-motion-active', 'false');
    await expect.poll(() => prose.evaluate(element => element.getAnimations().length)).toBe(0);
    await expect(page.locator('.reader-turn,.reader-page-content')).toHaveCount(0);
    await clean(page);
  };
  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: index % 2 ? 'Previous reader page' : 'Next reader page', exact: true }).click();
    await expect(stage).toHaveAttribute('data-motion', 'slide');
    await expect(stage).toHaveAttribute('data-motion-active', 'true');
    expect(await prose.evaluate(element => element.getAnimations().length)).toBe(1);
    await cleanSlide();
  }
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await cleanSlide();
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Page-turn animation', exact: true }).uncheck(); await cleanSlide();
  await page.getByRole('checkbox', { name: 'Page-turn animation', exact: true }).check();
  await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await cleanSlide();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.locator('.reader')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => { const motion = await import('/src/reader/page-turn.ts'); return motion.pageTurnDiagnostics(); })).toEqual({ activeTurns: 0, activeSlides: 0 });
  expect(await page.evaluate(() => (window as any).__pageFlipResources())).toMatchObject({ frames: 0, timers: 0, resize: 0, started: 0 });
});

test('DOM-rich small writing uses the node budget independently of character count', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open(page, 'node-budget', 320, true);
  const complexity = await page.locator('.reader-prose').evaluate(element => ({ characters: element.textContent?.length || 0, elements: element.querySelectorAll('*').length }));
  expect(complexity.characters).toBeLessThan(20_000); expect(complexity.elements).toBeGreaterThan(600);
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-motion', 'slide');
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-motion-active', 'true');
  await expect(page.locator('.reader-turn,.reader-page-content')).toHaveCount(0);
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-motion-active', 'false');
  expect(await page.evaluate(() => (window as any).__pageFlipResources())).toMatchObject({ frames: 0, timers: 0, resize: 0, started: 0 });
});
