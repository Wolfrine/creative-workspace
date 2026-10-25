import { test, expect, type Page } from '@playwright/test';

async function notebook(page: Page, name: string) {
  await page.goto('/?local=1&notebook=' + name + '-' + Date.now());
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
}
async function library(page: Page) {
  const phone = (page.viewportSize()?.width || 1440) < 651;
  await page.locator(phone ? '.mobile-bottom' : '.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Writing library', exact: true })).toBeVisible();
}

test('150-page library retrieves offline body matches without a sidebar inventory', async ({ page, context }) => {
  test.setTimeout(90000);
  await notebook(page, 'library-scale');
  await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__;
    for (let index = 0; index < 8; index++) await engine.createCollection('Collection ' + index);
    const groups = engine.getSnapshot().collections;
    for (let index = 0; index < 150; index++) {
      const text = index === 149 ? 'The brass key was hidden behind the last blue tile. हिंदी की एक पंक्ति।' : 'Synthetic retrieval note ' + index;
      await engine.createDocument({ title: index > 147 ? 'Two windows' : 'Harbour note ' + String(index).padStart(3, '0'), collectionId: groups[index % groups.length].id, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
    }
    await engine.flush();
  });
  await library(page);
  await expect(page.locator('.library-page-row')).toHaveCount(150);
  expect(await page.locator('.collection-shortcut').count()).toBeLessThanOrEqual(6);
  expect(await page.locator('.document-list button').count()).toBeLessThanOrEqual(10);
  await context.setOffline(true);
  const search = page.getByRole('textbox', { name: 'Search library', exact: true });
  await search.fill('last blue tile');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await expect(page.locator('.library-page-open')).toContainText('Two windows');
  await search.fill('हिंदी');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await page.locator('.library-page-open').click();
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toContainText('last blue tile');
  await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('Two windows');
  await context.setOffline(false);
});

for (const width of [1440, 390, 320]) test(`reader retains exact rich text and reaches every fragmented character at ${width}px`, async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await notebook(page, 'reader-fidelity-' + width);
  const original = await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__;
    const paragraph = 'Mira looked towards the harbour. आज खिड़की खुली है। é 🙂 ';
    const body = { type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A window left open' }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', attrs: { firstLineIndent: true }, content: [{ type: 'text', text: paragraph.repeat(130) }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Leave the key where the tide can find it.', marks: [{ type: 'italic' }] }] }] },
      { type: 'orderedList', attrs: { start: 3, type: 'A' }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The first remembered thing' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The second remembered thing' }] }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A bell beyond the rain', marks: [{ type: 'bold' }] }] }] }] },
      { type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text: 'Long reference: ' + 'unbroken'.repeat(60) }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Before the break' }, { type: 'hardBreak' }, { type: 'text', text: 'After the break', marks: [{ type: 'underline' }] }] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [{ type: 'text', text: 'THE FINAL LINE — still the author’s exact words.', marks: [{ type: 'link', attrs: { href: 'https://example.com/' } }] }] },
    ] };
    const id = await engine.createDocument({ title: 'Reader integrity fixture', body, origin: 'ai' });
    await engine.flush();
    return { id, body };
  });
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect(page.locator('.reader-stage')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText('AI-origin · unverified', { exact: true }).first()).toBeVisible();
  const before = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { documents: state.documents, revisions: state.revisions, originals: state.originals, receipts: state.receipts }; });
  const paragraphs = page.locator('[data-passage]');
  await expect(paragraphs).toHaveCount(original.body.content.length);
  const rendered = await paragraphs.evaluateAll(elements => elements.map(element => element.textContent));
  const flattened = (node: any): string => node.type === 'text' ? node.text : (node.content || []).map(flattened).join('');
  expect(rendered).toEqual(original.body.content.map(flattened));
  await expect(page.locator('.reader-prose ol')).toHaveAttribute('start', '3');
  await expect(page.locator('.reader-prose ol')).toHaveAttribute('type', 'A');
  await expect(paragraphs.nth(1).locator('br')).toHaveCount(1);
  await expect(paragraphs.nth(7).locator('br')).toHaveCount(1);
  expect(await paragraphs.nth(2).locator('p').evaluate(element => getComputedStyle(element).textIndent)).not.toBe('0px');

  // DOM Range fragments provide an independent oracle for actual browser
  // pagination: inspect every non-whitespace code point, not only the first page.
  const coverage = await page.locator('.reader-prose').evaluate(article => {
    const root = article as HTMLElement;
    const base = root.getBoundingClientRect(); const style = getComputedStyle(root);
    const column = parseFloat(style.columnWidth); const gap = parseFloat(style.columnGap);
    const stride = column + gap; const stage = document.querySelector<HTMLElement>('.reader-stage')!;
    const pageCount = Number(stage.dataset.pages); const failures: string[] = [];
    const seen = new Set<number>(); let checked = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      let offset = 0;
      for (const character of node.textContent || '') {
        if (!/\s/u.test(character)) {
          const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + character.length);
          const rect = range.getClientRects()[0]; checked++;
          if (!rect) failures.push('Missing character rectangle');
          else {
            const x = rect.left - base.left; const leaf = Math.max(0, Math.floor((x + 1) / stride)); seen.add(leaf);
            if (leaf >= pageCount || rect.top < base.top - 2 || rect.bottom > base.bottom + 2 || x - leaf * stride < -2 || x - leaf * stride + rect.width > column + 2) failures.push(`Clipped character on leaf ${leaf}`);
          }
        }
        offset += character.length;
      }
      node = walker.nextNode();
    }
    return { checked, pages: pageCount, leavesWithText: [...seen], failures: failures.slice(0, 12) };
  });
  expect(coverage.checked).toBeGreaterThan(5000);
  expect(coverage.pages).toBeGreaterThan(1);
  expect(coverage.failures).toEqual([]);
  const stage = page.locator('.reader-stage');
  let turns = 0;
  while (await page.getByRole('button', { name: 'Next reader page', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
    if (++turns > coverage.pages) throw new Error('Reader cannot reach the final leaf');
  }
  const lastStart = Number(await stage.getAttribute('data-page'));
  const columns = Number(await stage.getAttribute('data-columns'));
  expect(lastStart).toBe(Math.floor((coverage.pages - 1) / columns) * columns);
  await expect(stage).not.toHaveAttribute('data-turn', /forward|back/);
  const after = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { documents: state.documents, revisions: state.revisions, originals: state.originals, receipts: state.receipts }; });
  expect(after).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const persisted = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('noveliaa.reader.')).map(([key, value]) => ({ key, value })));
  expect(JSON.stringify(persisted)).not.toContain('THE FINAL LINE');
  expect(JSON.stringify(persisted)).not.toContain('Mira looked');
});
