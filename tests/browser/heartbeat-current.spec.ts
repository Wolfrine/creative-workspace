import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { RichNode } from '../../src/domain/model';
import type { HeartbeatAnnotation } from '../../src/heartbeat/model';
import { continuityAnnotation, seedContinuityWorkspace } from '../helpers/heartbeat-continuity-fixture';

// Every fixture here is synthetic, isolated and loopback-only. No author data,
// signed-in account or production integration is used to establish these gates.
const output = process.env.HEARTBEAT_CAPTURE_DIR || '.local/heartbeat-current/qa/browser';
const viewports = [
  { width: 1366, height: 590, lines: 18, layout: 'pages' },
  { width: 1366, height: 768, lines: 28, layout: 'pages' },
  { width: 390, height: 700, lines: 11, layout: 'scroll' },
  { width: 390, height: 844, lines: 15, layout: 'pages' },
  { width: 320, height: 568, lines: 8, layout: 'scroll' },
] as const;

async function isolated(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const notebook = `heartbeat-current-${width}-${height}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/?local=1&notebook=' + notebook);
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  return notebook;
}
async function continuity(page: Page, width: number, height: number, sameTone = false) {
  const notebook = await isolated(page, width, height);
  const workspace = await seedContinuityWorkspace(page, notebook);
  const annotation = continuityAnnotation(workspace);
  if (sameTone) annotation.beats = annotation.beats.map(beat => ({ ...beat, tone: 'warm' }));
  let requests = 0;
  await page.route('**/api/integrations/heartbeat?**', route => {
    requests++;
    return route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } });
  });
  return { workspace, annotation, requests: () => requests };
}
async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    const article = document.querySelector<HTMLElement>('.reader-prose')!;
    let previous = ''; let stable = 0;
    while (stable < 2) {
      await new Promise(requestAnimationFrame);
      const geometry = JSON.stringify([stage.clientWidth, stage.clientHeight, stage.dataset.layout, stage.dataset.page, stage.dataset.pages, article.style.width, article.style.height, article.style.opacity]);
      stable = geometry === previous && article.style.opacity === '1' ? stable + 1 : 0;
      previous = geometry;
    }
  });
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect(page.locator('.reader-stage')).toBeVisible();
  await settled(page);
}
async function layout(page: Page, value: 'pages' | 'scroll' | 'auto') {
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await page.getByRole('combobox', { name: 'Reading layout', exact: true }).selectOption(value);
  await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
  await settled(page);
}
async function sourceState(page: Page) {
  return page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals }); });
}
async function bookmark(page: Page) {
  return page.evaluate(() => {
    const entry = Object.entries(localStorage).find(([key]) => key.startsWith('noveliaa.reader.position.'));
    return entry ? JSON.parse(entry[1]).anchor as { documentId: string; passage: number; offset: number } : null;
  });
}
async function bookmarkedCharacterVisible(page: Page, anchor: { documentId: string; passage: number; offset: number } | null) {
  return page.evaluate(point => {
    if (!point) return false;
    const stage = document.querySelector('.reader-stage')!.getBoundingClientRect();
    const passage = document.querySelector(`.reader-prose [data-document="${point.documentId}"][data-passage="${point.passage}"]`);
    if (!passage) return false;
    const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node; let remaining = point.offset;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length || 0;
      if (remaining >= length) { remaining -= length; continue; }
      const range = document.createRange(); range.setStart(node, remaining); range.setEnd(node, Math.min(length, remaining + 1));
      const rect = range.getBoundingClientRect();
      return rect.left >= stage.left - 1 && rect.right <= stage.right + 1 && rect.top >= stage.top - 1 && rect.bottom <= stage.bottom + 1;
    }
    return false;
  }, anchor);
}
async function visibleOffsets(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.reader-stage')!;
    const bounds = stage.getBoundingClientRect();
    // Count source glyphs in the opaque reading area, not just beneath the
    // native-scroll continuation fade. At the true end the mask is removed.
    const fade = getComputedStyle(stage).maskImage.match(/calc\(100%\s*-\s*([\d.]+)px\)/);
    const visibleBottom = bounds.bottom - Number(fade?.[1] || 0);
    const offsets: number[] = []; let offset = 0;
    for (const passage of document.querySelectorAll('.reader-prose [data-passage]')) {
      const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) {
        for (let index = 0; index < node.textContent!.length; index++, offset++) {
          if (/\s/u.test(node.textContent![index])) continue;
          const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= visibleBottom + 1) offsets.push(offset);
        }
      }
    }
    return offsets;
  });
}
// These independent source-offset probes use the continuity fixture's flat
// paragraphs. They do not infer visible feelings from the rail or legend.
async function positionContinuityOffset(page: Page, sourceOffset: number, targetTop?: number) {
  await page.evaluate(({ offset, targetTop }) => {
    const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    for (const passage of document.querySelectorAll('.reader-prose [data-passage]')) {
      const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length || 0;
        if (offset < length) {
          const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1);
          const rect = range.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
          stage.scrollTop += rect.top - bounds.top - (targetTop ?? stage.clientHeight / 2); return;
        }
        offset -= length;
      }
      offset--; // Exact paragraph separator, absent from the rendered nodes.
    }
    throw new Error('Synthetic source offset was not present in the actual reader.');
  }, { offset: sourceOffset, targetTop });
  await settled(page);
}
async function visibleContinuityFeelings(page: Page, beats: HeartbeatAnnotation['beats']) {
  return page.evaluate(beats => {
    const stage = document.querySelector('.reader-stage')!, bounds = stage.getBoundingClientRect();
    const fade = getComputedStyle(stage).maskImage.match(/calc\(100%\s*-\s*([\d.]+)px\)/);
    const bottom = bounds.bottom - Number(fade?.[1] || 0);
    const visible = new Set<number>(); let offset = 0;
    for (const passage of document.querySelectorAll('.reader-prose [data-passage]')) {
      const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) for (let index = 0; index < node.textContent!.length; index++, offset++) {
        if (/\s/u.test(node.textContent![index])) continue;
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width > .5 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bottom + 1) {
          const beat = beats.findIndex(beat => offset >= beat.start && offset < beat.end);
          if (beat >= 0) visible.add(beat);
        }
      }
      offset++;
    }
    return [...visible].sort((a, b) => a - b).map(index => beats[index].foreground);
  }, beats);
}
async function measuredFeelingKeys(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(buttons => buttons.map(button => {
    const label = button.querySelector<HTMLElement>('span:last-child')!;
    const rect = label.getBoundingClientRect(), control = button.getBoundingClientRect();
    const sample = button.querySelector('svg path')!;
    const key = button.getAttribute('data-feeling-key');
    const rail = [...document.querySelectorAll<SVGPathElement>('.reader-prose .heartbeat-rail-segment')].find(path => path.getAttribute('data-feeling-key') === key);
    return { key, label: label.textContent, accessible: button.getAttribute('aria-label'), font: parseFloat(getComputedStyle(label).fontSize), sample: getComputedStyle(sample).stroke, rail: rail ? getComputedStyle(rail).stroke : null, token: button.getAttribute('data-token'), railToken: rail?.getAttribute('data-token'), clipped: label.scrollWidth > label.clientWidth + 1, inside: rect.width > 0 && rect.height > 0 && control.left >= 0 && control.right <= innerWidth && control.top >= 0 && control.bottom <= innerHeight && rect.left >= control.left - 1 && rect.right <= control.right + 1 && rect.top >= control.top - 1 && rect.bottom <= control.bottom + 1 };
  }));
}

for (const viewport of viewports) test(`Auto layout keeps prose capacity and a compact rail key at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await continuity(page, viewport.width, viewport.height);
  const before = await sourceState(page);
  await open(page);
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', viewport.layout);
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await settled(page);
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('.reader-stage')!.getBoundingClientRect();
    const prose = document.querySelector('.reader-prose')!;
    const rects: DOMRect[] = [];
    for (const element of prose.querySelectorAll('[data-passage]')) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) {
        const range = document.createRange(); range.selectNodeContents(node);
        rects.push(...[...range.getClientRects()].filter(rect => rect.right > stage.left && rect.left < stage.right && rect.top >= stage.top - 1 && rect.bottom <= stage.bottom + 1));
      }
    }
    const computed = getComputedStyle(prose);
    return {
      lines: new Set(rects.map(rect => `${Math.round(rect.x / (stage.width / 2))}:${Math.round(rect.y)}`)).size,
      footer: document.querySelector('.reader-footer')!.getBoundingClientRect().height,
      font: parseFloat(computed.fontSize), leading: parseFloat(computed.lineHeight) / parseFloat(computed.fontSize),
      overflow: document.documentElement.scrollWidth - innerWidth,
      controls: [...document.querySelectorAll<HTMLElement>('.reader-footer button')].map(node => {
        const rect = node.getBoundingClientRect();
        return { label: node.getAttribute('aria-label') || node.textContent, visible: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight };
      }),
      keys: [...document.querySelectorAll<HTMLElement>('.reader .heartbeat-legend-item,.reader .heartbeat-more')].map(node => {
        const rect = node.getBoundingClientRect();
        return { label: node.textContent, font: parseFloat(getComputedStyle(node).fontSize), visible: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, clipped: node.scrollWidth > node.clientWidth + 1 };
      }),
    };
  });
  await test.info().attach('prose-capacity', { contentType: 'application/json', body: JSON.stringify({ viewport, geometry }) });
  expect(geometry.font).toBe(20); expect(geometry.leading).toBeCloseTo(1.85, 2);
  expect(geometry.lines).toBeGreaterThanOrEqual(viewport.lines); expect(geometry.footer).toBeLessThanOrEqual(70);
  expect(geometry.overflow).toBe(0); expect(geometry.keys.length).toBeGreaterThan(0);
  expect(geometry.controls.filter(control => !control.visible), 'every actual footer control stays inside the viewport').toEqual([]);
  expect(geometry.keys.every(key => key.font >= 11 && key.visible && !key.clipped)).toBe(true);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/auto-rail-${viewport.width}x${viewport.height}.png` });
  expect(await sourceState(page)).toBe(before);
});

const richBody: RichNode = {
  type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The room above the water' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'A bold beginning. ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'An italic continuation. ', marks: [{ type: 'italic' }] }, { type: 'hardBreak' }, { type: 'text', text: 'हिंदी é 🙂 remain exact through a native scroll.' }] },
    { type: 'bulletList', content: [0, 1, 2].map(index => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `List item ${index}: the river held a little more light.` }] }] })) },
    { type: 'orderedList', attrs: { start: 3 }, content: [0, 1].map(index => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Numbered item ${index}: a promise kept in sequence.` }] }] })) },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A remembered voice belongs to its exact source.' }] }] },
    { type: 'horizontalRule' },
    { type: 'codeBlock', content: [{ type: 'text', text: 'A code passage stays readable.\nThe next line remains reachable.' }] },
    ...Array.from({ length: 15 }, (_, index): RichNode => ({ type: 'paragraph', content: [{ type: 'text', text: `Passage ${index}. The last boat crossed the harbour while the lights came on one by one. ` }, { type: 'text', text: 'A safe source link.', marks: [{ type: 'link', attrs: { href: 'https://example.com/source' } }] }, { type: 'text', text: ' Every exact character remains part of this private reading.' }] })),
    { type: 'paragraph', content: [{ type: 'text', text: 'THE FINAL SOURCE CHARACTER: Ω' }] },
  ],
};

for (const viewport of viewports) test(`Auto layout exposes every rich-text character at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await isolated(page, viewport.width, viewport.height);
  await page.evaluate(async body => {
    const engine = (window as any).__NOVELIAA_TEST__;
    await engine.createDocument({ title: 'Synthetic rich-text reachability', origin: 'ai', body });
  }, richBody);
  await open(page);
  const before = await sourceState(page);
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', viewport.layout);
  const exact = await page.locator('.reader-prose [data-passage]').allTextContents();
  const sourceText = (node: RichNode): string => node.type === 'text' ? node.text || '' : (node.content || []).map(sourceText).join('');
  expect(exact.join('')).toBe(sourceText(richBody));
  expect(exact.join('')).toContain('हिंदी é 🙂');
  await expect(page.locator('.reader-prose strong')).toContainText('A bold beginning.');
  await expect(page.locator('.reader-prose em')).toContainText('An italic continuation.');
  await expect(page.locator('.reader-prose a').first()).toHaveAttribute('href', 'https://example.com/source');
  await expect(page.locator('.reader-prose ol')).toHaveAttribute('start', '3');
  const stage = page.locator('.reader-stage');
  if (viewport.layout === 'scroll') {
    await stage.hover(); await page.mouse.wheel(0, viewport.height);
    await expect.poll(() => stage.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await stage.focus(); await page.keyboard.press('Home');
    await stage.evaluate(element => { element.scrollTop = 0; });
  }
  const seen = new Set<number>(); const trace: unknown[] = [];
  for (let turn = 0; turn < 100; turn++) {
    await settled(page);
    for (const offset of await visibleOffsets(page)) seen.add(offset);
    const position = await stage.evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, total: element.scrollHeight, page: element.getAttribute('data-page') }));
    trace.push(position);
    if (viewport.layout === 'scroll') {
      if (position.top + position.height >= position.total - 1) break;
      await stage.evaluate(element => { element.scrollTop = Math.min(element.scrollHeight - element.clientHeight, element.scrollTop + element.clientHeight - 80); });
    } else {
      const next = page.getByRole('button', { name: 'Next reader page', exact: true });
      if (await next.isDisabled()) break;
      await next.click();
    }
  }
  const text = exact.join('');
  const missing = Array.from({ length: text.length }, (_, index) => index).filter(index => !/\s/u.test(text[index]) && !seen.has(index));
  await test.info().attach('native-scroll-reachability', { contentType: 'application/json', body: JSON.stringify({ viewport, sourceCharacters: text.length, reachedMeaningfulCharacters: seen.size, trace, missing: missing.map(index => ({ index, char: text[index] })) }) });
  expect(missing).toEqual([]); await expect(page.locator('.reader-prose').getByText('THE FINAL SOURCE CHARACTER: Ω', { exact: true })).toBeInViewport();
  expect(await page.locator('.reader-prose [data-passage]').allTextContents()).toEqual(exact);
  expect(await sourceState(page)).toBe(before);
});

for (const mode of ['legacy-rest', 'malformed', 'empty'] as const) test(`Rail keeps ${mode} honest without changing the synthetic source`, async ({ page }) => {
  const notebook = await isolated(page, 320, 568);
  const workspace = await seedContinuityWorkspace(page, notebook, mode === 'empty' ? '' : undefined);
  const annotation = continuityAnnotation(workspace);
  if (mode === 'legacy-rest') annotation.beats = annotation.beats.map(beat => ({ ...beat, tone: 'neutral', trajectory: 'quiet' }));
  if (mode === 'malformed') annotation.beats[0] = { ...annotation.beats[0], end: annotation.beats[0].start };
  if (mode === 'empty') annotation.beats = [];
  await page.route('**/api/integrations/heartbeat?**', route => route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } }));
  const before = await sourceState(page);
  await page.locator('.format-toolbar').getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  if (mode === 'legacy-rest') {
    await expect(page.getByRole('button', { name: 'Rest. Show interpretation.', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('.heartbeat-rail[data-coverage="continuous"] path').count()).toBeGreaterThan(0);
    expect(await page.locator('.heartbeat-rail-segment').evaluateAll(paths => paths.every(path => path.getAttribute('data-token') === 'rest' && getComputedStyle(path).strokeDasharray !== 'none'))).toBe(true);
    await page.getByRole('button', { name: 'Rest. Show interpretation.', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'A possible reading' })).toContainText('Eager calm');
    await page.keyboard.press('Escape');
  } else if (mode === 'malformed') {
    await expect(page.locator('.heartbeat')).toContainText('No AI interpretation for this revision');
    await expect(page.locator('.heartbeat-rail[data-coverage="continuous"]')).toHaveCount(0);
    await expect(page.locator('.heartbeat-legend-item')).toHaveCount(0);
    await expect.poll(() => page.locator('.heartbeat-rail[data-coverage="unanalysed"] path').count()).toBeGreaterThan(0);
    expect(await page.locator('.heartbeat-rail path').evaluateAll(paths => paths.every(path => path.getAttribute('data-token') === 'unanalysed' && getComputedStyle(path).strokeDasharray !== 'none'))).toBe(true);
  } else {
    await expect(page.locator('.heartbeat')).toContainText('No text to analyse.');
    await expect(page.locator('.heartbeat-rail')).toHaveCount(0);
  }
  await page.locator('.format-toolbar').getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  await expect(page.locator('.heartbeat-rail')).toHaveCount(0); expect(await sourceState(page)).toBe(before);
});

for (const width of [390, 320]) test(`Native scroll bookmark survives back, reentry and layout switches at ${width}px`, async ({ page }) => {
  const viewport = viewports.find(item => item.width === width && item.layout === 'scroll')!;
  await continuity(page, width, viewport.height); await open(page);
  const before = await sourceState(page);
  await page.locator('.reader-stage').hover(); await page.mouse.wheel(0, viewport.height);
  await expect.poll(() => page.locator('.reader-stage').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => bookmark(page)).not.toEqual({ documentId: 'continuity-synthetic-scene', passage: 0, offset: 0 });
  const position = await bookmark(page); expect(position).not.toBeNull();
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await expect.poll(() => bookmark(page)).toEqual(position);
  for (const mode of ['pages', 'scroll', 'auto'] as const) {
    await layout(page, mode); await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', mode === 'pages' ? 'pages' : 'scroll');
    await expect.poll(() => bookmark(page)).toEqual(position);
    expect(await bookmarkedCharacterVisible(page, position), `exact source anchor in ${mode}`).toBe(true);
  }
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toBeVisible();
  await open(page); await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', 'scroll');
  await expect.poll(() => bookmark(page)).toEqual(position);
  expect(await page.locator('.reader-stage').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await bookmarkedCharacterVisible(page, position)).toBe(true);
  expect(await sourceState(page)).toBe(before);
});

test('Seven different same-tone foregrounds keep distinct document colors across turns and resize', async ({ page }) => {
  const fixture = await continuity(page, 1366, 768, true); const before = await sourceState(page);
  await open(page); await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible(); await settled(page);
  const palette = () => page.locator('.reader-prose .heartbeat-rail path').evaluateAll(paths => [...new Map(paths.map(path => [path.getAttribute('data-feeling-key'), { key: path.getAttribute('data-feeling-key'), color: getComputedStyle(path).stroke }])).values()]);
  const keyMatchesRail = () => page.locator('.reader .heartbeat-legend-item').evaluateAll(buttons => buttons.every(button => {
    const key = button.getAttribute('data-feeling-key');
    const path = [...document.querySelectorAll<SVGPathElement>('.reader-prose .heartbeat-rail-segment')].find(path => path.getAttribute('data-feeling-key') === key);
    const swatch = button.querySelector('.heartbeat-swatch');
    const sample = swatch?.querySelector('svg path,svg line,svg polyline');
    const color = sample ? getComputedStyle(sample).stroke : swatch ? getComputedStyle(swatch).color : '';
    return !!path && !!swatch && color === getComputedStyle(path).stroke && button.getAttribute('data-token') === path.getAttribute('data-token');
  }));
  const initial = await palette();
  expect(initial).toHaveLength(7); expect(new Set(initial.map(item => item.color)).size).toBe(7);
  expect(new Set(initial.map(item => item.key))).toEqual(new Set(fixture.annotation.beats.map(beat => 'feeling:' + beat.foreground.toLowerCase())));
  expect(await keyMatchesRail()).toBe(true);
  expect(initial.find(item => item.key === 'feeling:eager calm')?.color).not.toBe(initial.find(item => item.key === 'feeling:quiet reward')?.color);
  const next = page.getByRole('button', { name: 'Next reader page', exact: true });
  while (await next.isEnabled()) { await next.click(); await settled(page); expect(await palette()).toEqual(initial); expect(await keyMatchesRail()).toBe(true); }
  await page.setViewportSize({ width: 390, height: 700 }); await settled(page);
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', 'scroll'); expect(await palette()).toEqual(initial); expect(await keyMatchesRail()).toBe(true);
  await page.locator('.reader-stage').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.reader .heartbeat-more')).toBeVisible(); expect(await palette()).toEqual(initial); expect(await keyMatchesRail()).toBe(true);
  await page.locator('.reader .heartbeat-more').click();
  await expect(page.getByRole('dialog', { name: 'Color to feeling' })).toContainText('Quiet reward');
  const fullKey = await page.locator('.heartbeat-full-key .heartbeat-legend-item').evaluateAll(buttons => buttons.map(button => {
    const swatch = button.querySelector('.heartbeat-swatch')!; const sample = swatch.querySelector('svg path,svg line,svg polyline');
    return { key: button.getAttribute('data-feeling-key'), color: sample ? getComputedStyle(sample).stroke : getComputedStyle(swatch).color };
  }));
  expect(fullKey).toEqual(initial);
  await test.info().attach('same-tone-document-palette', { contentType: 'application/json', body: JSON.stringify({ supplied: fixture.annotation.beats.map(beat => ({ foreground: beat.foreground, tone: beat.tone })), rail: initial, fullKey }) });
  await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/same-tone-full-key-390.png` });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1366, height: 768 }); await settled(page); expect(await palette()).toEqual(initial);
  expect(await sourceState(page)).toBe(before); expect(fixture.requests()).toBeLessThanOrEqual(2);
});

test('A 320px mixed reading shows both exact current feelings at 14px without hiding either behind overflow', async ({ page }) => {
  const fixture = await continuity(page, 320, 568), before = await sourceState(page);
  await open(page); await expect(page.locator('.reader-stage')).toHaveAttribute('data-layout', 'scroll');
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await positionContinuityOffset(page, fixture.annotation.beats.find(beat => beat.foreground === 'Disappointment')!.start);
  expect(await visibleContinuityFeelings(page, fixture.annotation.beats)).toEqual(['Renewed curiosity', 'Disappointment']);
  for (const feeling of ['Renewed curiosity', 'Disappointment']) await expect(page.locator('.reader').getByRole('button', { name: `${feeling}. Show interpretation.`, exact: true })).toBeVisible();
  await expect(page.locator('.reader .heartbeat-more')).toHaveCount(0);
  const keys = await measuredFeelingKeys(page, '.reader .heartbeat-legend-item');
  expect(keys.map(key => key.label)).toEqual(['Renewed curiosity', 'Disappointment']);
  expect(keys.every(key => key.font >= 14 && key.inside && !key.clipped && key.sample === key.rail && key.token === key.railToken)).toBe(true);
  expect(new Set(keys.map(key => key.sample)).size).toBe(2);
  await test.info().attach('narrow-two-feeling-key', { contentType: 'application/json', body: JSON.stringify({ width: 320, visible: await visibleContinuityFeelings(page, fixture.annotation.beats), keys }) });
  await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/mixed-two-feelings-320.png` });
  expect(await sourceState(page)).toBe(before);
});

test('Narrow long-label overflow gives an honest count and complete source-matched full key', async ({ page }) => {
  const fixture = await continuity(page, 320, 568);
  const text = fixture.workspace.documents[0].plainText, start = text.indexOf('Now she');
  const cuts = [0, start, start + 60, start + 120, start + 180, text.length];
  const labels = ['Opening reflection', 'Unacknowledged private yearning', 'Unresolved quiet apprehension', 'Patient renewed anticipation', 'Quiet reward'];
  const base = fixture.annotation.beats[0];
  fixture.annotation.id = 'synthetic-dense-long-foregrounds';
  fixture.annotation.beats = labels.map((foreground, index) => ({ ...base, foreground, undertone: undefined, tone: 'warm', trajectory: 'hold', start: cuts[index], end: cuts[index + 1], quote: text.slice(cuts[index], cuts[index + 1]), reasoning: 'Synthetic dense label boundary for display and exact-source checks, not emotional accuracy.' }));
  const before = await sourceState(page);
  await open(page); await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect(page.locator('.reader .heartbeat-legend-item').first()).toBeVisible();
  await positionContinuityOffset(page, start, 20);
  const visible = await visibleContinuityFeelings(page, fixture.annotation.beats); expect(visible.length).toBeGreaterThanOrEqual(3);
  const inline = await measuredFeelingKeys(page, '.reader .heartbeat-legend-item');
  expect(inline.every(key => visible.includes(key.label!))).toBe(true); expect(new Set(inline.map(key => key.label)).size).toBe(inline.length);
  expect(inline.every(key => key.font >= 14 && key.inside && !key.clipped && key.sample === key.rail && key.token === key.railToken)).toBe(true);
  const hidden = visible.length - inline.length; expect(hidden).toBeGreaterThan(0);
  const more = page.locator('.reader .heartbeat-more'); await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('aria-label', `All feelings. Show ${hidden} more feelings on this page`); await expect(more).toHaveText('All feelings');
  const requests = fixture.requests(); await more.click();
  const full = await measuredFeelingKeys(page, '.heartbeat-full-key .heartbeat-legend-item');
  expect(full.map(key => key.label)).toEqual(labels);
  expect(full.every(key => key.font >= 14 && key.inside && !key.clipped && key.accessible === `${key.label}. Show interpretation.` && key.sample === key.rail && key.token === key.railToken)).toBe(true);
  await test.info().attach('narrow-long-label-overflow', { contentType: 'application/json', body: JSON.stringify({ width: 320, visible, inline, hidden, full }) });
  await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/long-label-full-key-320.png` });
  const long = page.getByRole('dialog', { name: 'Color to feeling' }).getByRole('button', { name: `${labels[1]}. Show interpretation.`, exact: true });
  await long.focus(); await expect(long).toBeFocused(); await page.keyboard.press('Enter');
  const detail = page.getByRole('dialog', { name: 'A possible reading' }); await expect(detail).toContainText(labels[1]);
  await expect(detail.locator('blockquote')).toHaveText(fixture.annotation.beats[1].quote);
  expect(fixture.requests()).toBe(requests); expect(await sourceState(page)).toBe(before);
});

test('A facing spread keeps known document feelings separate from unanalysed next writing without extra fetches', async ({ page }) => {
  await isolated(page, 1366, 768);
  const fixture = await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__;
    await engine.createCollection('Synthetic facing spread');
    const collectionId = engine.getSnapshot().collections[0].id;
    const body = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const firstId = await engine.createDocument({ title: 'A known quiet arrival', collectionId, origin: 'ai', body: body('The last tram reached the river before the first lamps came on. Leena held the small parcel against her coat and looked up at the windows. She had waited for this evening, and the waiting had finally become a place she could enter.') });
    const secondId = await engine.createDocument({ title: 'A separate unanalysed page', collectionId, origin: 'ai', body: body('Across the water another story was beginning. These words have no supplied interpretation. They must stay visibly unanalysed even when the previous writing has a verified source match and its own colored current. Nothing in the other page supplies a feeling for this one.') });
    await engine.selectDocument(firstId);
    const state = engine.getSnapshot();
    const first = state.documents.find((document: any) => document.id === firstId);
    const second = state.documents.find((document: any) => document.id === secondId);
    const revision = state.revisions.find((item: any) => item.id === first.headRevisionId);
    return { first, second, revision };
  });
  const annotation: HeartbeatAnnotation = {
    id: 'synthetic-facing-source-reading', schema: 'noveliaa-heartbeat-1',
    anchor: { documentId: fixture.first.id, revisionId: fixture.revision.id, contentHash: fixture.revision.contentHash, title: fixture.first.title },
    attribution: { provider: 'Synthetic evaluation', model: 'Reference fixture' }, contextNote: 'Synthetic source-isolation check; no author writing or measured emotion.',
    beats: [{ start: 0, end: fixture.first.plainText.length, quote: fixture.first.plainText, foreground: 'Eager calm', tone: 'warm', trajectory: 'hold', weight: 3, reasoning: 'This invented annotation belongs only to the exact first source revision.' }],
    origin: 'ai', verification: 'unverified', createdAt: fixture.revision.createdAt,
  };
  const requested: string[] = [];
  await page.route('**/api/integrations/heartbeat?**', route => {
    const id = new URL(route.request().url()).searchParams.get('documentId') || '';
    requested.push(id);
    return route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: id === fixture.first.id ? [annotation] : [], sourceIsCurrent: true } });
  });
  const before = await sourceState(page);
  await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
  await page.locator('.collection-card-open').click();
  await page.getByRole('button', { name: 'Read collection', exact: true }).click(); await settled(page);
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-columns', '2');
  const stage = page.locator('.reader-stage');
  for (const id of [fixture.first.id, fixture.second.id]) {
    const visible = await page.locator(`.reader-source[data-reader-document="${id}"] [data-passage]`).evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const stage = document.querySelector('.reader-stage')!.getBoundingClientRect();
      return [...range.getClientRects()].some(rect => rect.width > .5 && rect.left >= stage.left && rect.right <= stage.right && rect.top >= stage.top && rect.bottom <= stage.bottom);
    });
    expect(visible, `actual source glyphs for ${id} are in this same facing spread`).toBe(true);
  }
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
  await expect(page.locator('.reader .heartbeat-legend-item[data-feeling-key="feeling:eager calm"]')).toBeVisible();
  await expect(page.locator('.reader-heartbeat')).toContainText('Unanalysed');
  const first = page.locator(`.reader-prose .heartbeat-rail-segment[data-document-id="${fixture.first.id}"][data-coverage="continuous"]`);
  const second = page.locator(`.reader-prose .heartbeat-rail-segment[data-document-id="${fixture.second.id}"][data-coverage="unanalysed"]`);
  await expect(first).toHaveCount(1); await expect(second).toHaveCount(1);
  await expect(first).toHaveAttribute('data-feeling-key', 'feeling:eager calm');
  await expect(second).toHaveAttribute('data-token', 'unanalysed'); await expect(second).toHaveAttribute('data-feeling-key', 'unanalysed');
  await expect(second).toHaveAttribute('data-source-start', '0'); await expect(second).toHaveAttribute('data-source-end', String(fixture.second.plainText.length));
  expect(await second.evaluate(element => getComputedStyle(element).strokeDasharray)).not.toBe('none');
  expect(requested).toEqual([fixture.first.id]);
  await test.info().attach('facing-source-isolation', { contentType: 'application/json', body: JSON.stringify({ firstDocumentId: fixture.first.id, unanalysedDocumentId: fixture.second.id, requested, page: await stage.getAttribute('data-page'), paths: await page.locator('.reader-prose .heartbeat-rail-segment').evaluateAll(paths => paths.map(path => ({ documentId: path.getAttribute('data-document-id'), coverage: path.getAttribute('data-coverage'), start: path.getAttribute('data-source-start'), end: path.getAttribute('data-source-end'), token: path.getAttribute('data-token'), stroke: getComputedStyle(path).stroke, pattern: getComputedStyle(path).strokeDasharray }))) }) });
  await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/facing-source-isolation-1366.png` });
  expect(await sourceState(page)).toBe(before);
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect(page.locator('.heartbeat-rail')).toHaveCount(0);
});

test('Forced colors retain readable labels and distinct Rest and unanalysed current patterns', async ({ page }) => {
  const fixture = await continuity(page, 390, 844);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const text = fixture.workspace.documents[0].plainText;
  const originalBeat = { ...fixture.annotation.beats[0] };
  fixture.annotation.id = 'synthetic-forced-rest-reading';
  fixture.annotation.beats = [{ ...originalBeat, start: 0, end: text.length, quote: text, foreground: 'Quiet interval', undertone: undefined, tone: 'neutral', trajectory: 'quiet', weight: 1 }];
  const before = await sourceState(page);
  const measurements: unknown[] = [];
  const measure = (scope: string, legend: string) => page.evaluate(({ scope, legend }) => {
    const luminance = (color: string) => {
      const values = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
    };
    const contrast = (ink: string, paper: string) => { const a = luminance(ink), b = luminance(paper); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const probe = document.createElement('i'); Object.assign(probe.style, { position: 'fixed', left: '-10000px', color: 'CanvasText', backgroundColor: 'Canvas' }); document.body.append(probe);
    const canvas = getComputedStyle(probe).backgroundColor, canvasText = getComputedStyle(probe).color; probe.remove();
    const label = document.querySelector<HTMLElement>(`${legend} .heartbeat-legend-item`)!;
    const labelPaint = getComputedStyle(label);
    const labelPaper = labelPaint.backgroundColor === 'rgba(0, 0, 0, 0)' || labelPaint.backgroundColor === 'transparent' ? canvas : labelPaint.backgroundColor;
    const sample = label.querySelector('svg path')!;
    const paths = [...document.querySelectorAll<SVGPathElement>(`${scope} .heartbeat-rail-segment`)];
    return {
      forced: matchMedia('(forced-colors: active)').matches, canvas, canvasText,
      label: label.textContent, labelContrast: contrast(labelPaint.color, labelPaper), labelRect: { width: label.getBoundingClientRect().width, height: label.getBoundingClientRect().height },
      sample: { stroke: getComputedStyle(sample).stroke, contrast: contrast(getComputedStyle(sample).stroke, labelPaper), pattern: getComputedStyle(sample).strokeDasharray },
      paths: paths.map(path => { const paint = getComputedStyle(path); return { token: path.dataset.token, stroke: paint.stroke, opacity: Number(paint.opacity) * Number(paint.strokeOpacity), pattern: paint.strokeDasharray, contrast: contrast(paint.stroke, canvas), length: path.getTotalLength() }; }),
    };
  }, { scope, legend });
  const check = async (state: string, scope: string, legend: string, token: 'rest' | 'unanalysed', pattern: number[]) => {
    const evidence = await measure(scope, legend); measurements.push({ state, ...evidence });
    expect(evidence.forced).toBe(true); expect(evidence.labelRect.width).toBeGreaterThan(0); expect(evidence.labelRect.height).toBeGreaterThan(0);
    expect(evidence.labelContrast).toBeGreaterThanOrEqual(4.5); expect(evidence.sample.contrast).toBeGreaterThanOrEqual(3);
    expect((evidence.sample.pattern.match(/[\d.]+/g) || []).map(Number)).toEqual(pattern);
    expect(evidence.paths.length).toBeGreaterThan(0);
    for (const path of evidence.paths) {
      expect(path.token).toBe(token); expect(path.stroke).toBe(evidence.canvasText); expect(path.opacity).toBe(1);
      expect(path.contrast).toBeGreaterThanOrEqual(3); expect(path.length).toBeGreaterThan(0);
      expect((path.pattern.match(/[\d.]+/g) || []).map(Number)).toEqual(pattern);
    }
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/forced-${state}.png` });
  };
  const writingToggle = () => page.locator('.format-toolbar').getByRole('button', { name: 'Emotional Heartbeat', exact: true });
  await writingToggle().click(); await expect(page.getByRole('button', { name: 'Rest. Show interpretation.', exact: true })).toBeVisible();
  const restKey = page.getByRole('button', { name: 'Rest. Show interpretation.', exact: true });
  await restKey.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await expect(restKey).toBeFocused();
  await check('writer-rest-focused', '.editor-body', '.writer-heartbeat', 'rest', [7, 4]);
  await open(page); await expect(page.locator('.reader').getByRole('button', { name: 'Rest. Show interpretation.', exact: true })).toBeVisible();
  await check('reader-rest', '.reader-prose', '.reader-heartbeat', 'rest', [7, 4]);
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click(); await writingToggle().click(); await expect(page.locator('.heartbeat-rail')).toHaveCount(0);
  // A source-matched sparse interpretation is unanalysed, never explicit Rest.
  fixture.annotation.id = 'synthetic-forced-sparse-reading';
  fixture.annotation.beats = [{ ...originalBeat, start: 0, end: 100, quote: text.slice(0, 100) }];
  await writingToggle().click(); await expect(page.getByRole('button', { name: 'Unanalysed writing. About this interpretation.', exact: true })).toBeVisible();
  await check('writer-unanalysed', '.editor-body', '.writer-heartbeat', 'unanalysed', [1, 4]);
  await open(page); await expect(page.locator('.reader').getByRole('button', { name: 'Unanalysed writing. About this interpretation.', exact: true })).toBeVisible();
  await check('reader-unanalysed', '.reader-prose', '.reader-heartbeat', 'unanalysed', [1, 4]);
  await test.info().attach('forced-colors-paint-and-patterns', { contentType: 'application/json', body: JSON.stringify(measurements) });
  expect(await sourceState(page)).toBe(before);
  await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click(); await expect(page.locator('.heartbeat-rail')).toHaveCount(0);
});
