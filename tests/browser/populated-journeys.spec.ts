import { test, expect, type Page } from '@playwright/test';
import { buildPopulatedWorkspace, fixtureIds as x, populatedFixtureManifest, seedPopulatedWorkspace } from '../helpers/populated-workspace';

// Real application routes/interactions, isolated synthetic data, no production
// account. All generated story material is explicitly AI-origin and unverified.
test.beforeEach(async ({ page }, info) => {
  const notebook = 'populated-' + info.testId.replace(/[^a-z0-9]/gi, '').slice(0, 30) + '-' + Date.now();
  await page.goto('/?local=1&notebook=' + notebook);
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  await seedPopulatedWorkspace(page, notebook);
});

const libraryRegion = (page: Page) => page.getByRole('region', { name: 'Writing library', exact: true });
const mobile = (page: Page) => (page.viewportSize()?.width || 1440) < 651;
async function navigate(page: Page, name: 'Library' | 'Atlas' | 'Inbox') {
  const nav = page.locator(mobile(page) ? '.mobile-bottom' : '.main-nav');
  await nav.getByRole('button', { name: name === 'Atlas' && !mobile(page) ? 'Living Atlas' : new RegExp('^' + name + '(?:\\s*\\d+)?$') }).click();
}
async function openNavigation(page: Page) {
  if (mobile(page) && !(await page.locator('.app').getAttribute('class'))?.includes('nav-is-open')) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
}
async function switchUniverse(page: Page, id: string) {
  await openNavigation(page);
  await page.getByRole('combobox', { name: 'Story universe', exact: true }).selectOption(id);
  await expect.poll(() => page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().activeUniverseId)).toBe(id);
  if (mobile(page)) await expect(page.locator('.app')).not.toHaveClass(/nav-is-open/);
}
async function collections(page: Page) {
  await navigate(page, 'Library');
  await libraryRegion(page).getByRole('button', { name: /^Collections\s*\d*$/ }).click();
}
const collectionCard = (page: Page, name: string) => page.locator('.collection-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
const pageRow = (page: Page, name: string) => page.locator('.library-page-row').filter({ has: page.getByRole('heading', { name, exact: true }) });
async function openCollection(page: Page, name: string) { await collectionCard(page, name).locator('.collection-card-open').click(); }
async function snapshotIntegrity(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).__NOVELIAA_TEST__.getSnapshot();
    return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals, receipts: state.receipts });
  });
}
async function libraryBounds(page: Page, selector: string) {
  return libraryRegion(page).evaluate((region, cardSelector) => {
    const viewport = region.getBoundingClientRect();
    return [...region.querySelectorAll<HTMLElement>(cardSelector)].flatMap((card, index) => {
      const bounds = card.getBoundingClientRect();
      const open = card.querySelector<HTMLElement>('.library-page-open,.collection-card-open')?.getBoundingClientRect();
      const failures: string[] = [];
      if (bounds.left < viewport.left - 1 || bounds.right > viewport.right + 1) failures.push(`Card ${index} extends beyond Library viewport: ${bounds.left}..${bounds.right} vs ${viewport.left}..${viewport.right}`);
      if (open && (open.left < bounds.left - 1 || open.right > bounds.right + 1)) failures.push(`Card ${index} opening control extends beyond its card`);
      return failures;
    });
  }, selector);
}

test('Three coherent worlds retain exact originals and never claim approval', async ({ page }) => {
  const fixture = await buildPopulatedWorkspace();
  const manifest = await populatedFixtureManifest();
  expect(manifest.universes).toHaveLength(3);
  expect(manifest.collections).toHaveLength(12);
  expect(manifest.documents).toHaveLength(24);
  expect(manifest.collections.filter(item => item.pages === 0)).toHaveLength(3);
  expect(manifest.documents.filter(item => !item.trashed && item.collectionId === null)).toHaveLength(5);
  expect(manifest.approval).toBe('unverified');
  const stored = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { documents: state.documents, originals: state.originals, revisions: state.revisions, error: state.error }; });
  expect(stored.error).toBeNull();
  const byId = (items: { id: string }[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  expect(byId(stored.documents)).toEqual(byId(fixture.documents));
  expect(byId(stored.originals)).toEqual(byId(fixture.originals));
  expect(byId(stored.revisions)).toEqual(byId(fixture.revisions));
  expect(stored.documents.every((item: any) => ['ai', 'unknown', 'imported_chat'].includes(item.origin))).toBe(true);
  await navigate(page, 'Library');
  await libraryRegion(page).getByRole('button', { name: 'Detailed view', exact: true }).click();
  await expect(pageRow(page, 'Unreviewed possibility — a second harbour')).toContainText('AI-origin · unverified');
  await expect(pageRow(page, 'Found harbour notebook')).toContainText('Origin unverified');
  await expect(pageRow(page, 'Set aside — the talking compass')).toHaveCount(0);
});

for (const width of [1440, 390, 320]) test(`Library layouts retrieve varied pages and collections at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const original = await snapshotIntegrity(page);
  await navigate(page, 'Library');
  await expect(page.locator('.library-page-row')).toHaveCount(9);
  await expect(libraryRegion(page).getByRole('button', { name: 'New thought', exact: true })).toHaveCount(0);
  for (const [label, value] of [['Tile view', 'tile'], ['List view', 'list'], ['Detailed view', 'detailed']]) {
    await libraryRegion(page).getByRole('button', { name: label, exact: true }).click();
    await expect(libraryRegion(page)).toHaveAttribute('data-layout', value);
    await expect(libraryRegion(page).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.library-page-row')).toHaveCount(9);
    expect(await libraryBounds(page, '.library-page-row')).toEqual([]);
    const search = page.getByRole('textbox', { name: 'Search library', exact: true });
    await search.fill('last blue tile');
    await expect(page.locator('.library-page-row')).toHaveCount(1);
    await expect(pageRow(page, 'The old harbour')).toBeVisible();
    await search.fill('');
    await page.getByRole('combobox', { name: 'Filter library by collection' }).selectOption('inbox');
    await expect(page.locator('.library-page-row')).toHaveCount(2);
    await expect(pageRow(page, 'Untitled')).toBeVisible();
    await page.getByRole('combobox', { name: 'Filter library by collection' }).selectOption('all');
    await libraryRegion(page).getByRole('button', { name: /^Collections/ }).click();
    await expect(page.locator('.collection-card')).toHaveCount(4);
    await expect(libraryRegion(page).getByRole('button', { name: 'New collection', exact: true })).toHaveCount(1);
    await expect(collectionCard(page, 'Fragments, remembered details, and questions still waiting for an answer')).toBeVisible();
    await expect(collectionCard(page, 'A room for the ending')).toContainText('0 pages');
    expect(await libraryBounds(page, '.collection-card')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await libraryRegion(page).getByRole('button', { name: /^Pages/ }).click();
  }
  expect(await snapshotIntegrity(page)).toBe(original);
  await page.reload();
  await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  await navigate(page, 'Library');
  await expect(libraryRegion(page)).toHaveAttribute('data-layout', 'detailed');
  await switchUniverse(page, x.signal);
  await expect(libraryRegion(page)).toHaveAttribute('data-layout', 'list');
  await libraryRegion(page).getByRole('button', { name: 'Tile view', exact: true }).click();
  await switchUniverse(page, x.salt);
  await expect(libraryRegion(page)).toHaveAttribute('data-layout', 'detailed');
});

test('Mobile backward curl actually transforms its leaf and returns visible first-page content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await collections(page); await openCollection(page, 'Draft chapters');
  const before = await snapshotIntegrity(page);
  await page.getByRole('button', { name: 'Read collection', exact: true }).click();
  await expect.poll(() => page.locator('.reader-stage').getAttribute('data-pages').then(Number)).toBeGreaterThan(3);
  for (const direction of ['Next reader page', 'Previous reader page']) {
    await page.getByRole('button', { name: direction, exact: true }).click();
    await expect(page.locator('.reader-turn')).toHaveCount(1);
    await expect.poll(() => page.locator('.reader-motion-leaf').evaluateAll(elements => elements.some(element => {
      const angle = (element as HTMLElement).style.transform.match(/rotate\((-?[\d.]+)rad\)/);
      return Boolean(angle && Math.abs(Number(angle[1])) > 0.005 && (element as HTMLElement).style.clipPath.startsWith('polygon('));
    })), { intervals: [20, 30, 50, 100], timeout: 900 }).toBe(true);
    await expect(page.locator('.reader-turn')).toHaveCount(0);
  }
  await expect(page.locator('.reader-stage')).toHaveAttribute('data-page', '0');
  const visible = await page.locator('.reader-prose .reader-source-heading h1').first().evaluate(heading => {
    const ink = heading.getBoundingClientRect(); const viewport = document.querySelector('.reader-stage')!.getBoundingClientRect();
    return { text: heading.textContent, inside: ink.left >= viewport.left - 1 && ink.right <= viewport.right + 1 && ink.top >= viewport.top - 1 && ink.bottom <= viewport.bottom + 1 };
  });
  expect(visible).toEqual({ text: 'When the steps returned', inside: true });
  await expect(page.locator('.reader-page-content')).toHaveCount(0);
  expect(await snapshotIntegrity(page)).toBe(before);
});

test('Collection detail, universe switching and shortcuts keep an unambiguous scope', async ({ page }) => {
  await page.getByRole('button', { name: 'All collections', exact: true }).click();
  await expect(libraryRegion(page).getByRole('button', { name: /^Collections/ })).toHaveAttribute('aria-pressed', 'true');
  await libraryRegion(page).getByRole('button', { name: /^Pages/ }).click();
  await page.getByRole('button', { name: 'Browse collections', exact: true }).click();
  await expect(libraryRegion(page).getByRole('button', { name: /^Collections/ })).toHaveAttribute('aria-pressed', 'true');
  await openCollection(page, 'Draft chapters');
  await expect(page.locator('.library-page-row')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search library' }).fill('third glass');
  await switchUniverse(page, x.signal);
  await expect(libraryRegion(page).getByRole('heading', { name: 'Your library.' })).toBeVisible();
  await expect(page.locator('.collection-card')).toHaveCount(4);
  await expect(collectionCard(page, 'Draft chapters')).toContainText('2 pages');
  await expect(collectionCard(page, 'People & places')).toHaveCount(0);
  await openCollection(page, 'Draft chapters');
  await expect(pageRow(page, 'First light at Relay Nine')).toBeVisible();
  await expect(pageRow(page, 'When the steps returned')).toHaveCount(0);
  await page.locator('.library-back').click();
  await expect(libraryRegion(page).getByRole('button', { name: /^Collections/ })).toHaveAttribute('aria-pressed', 'true');
  await switchUniverse(page, x.lantern);
  await libraryRegion(page).getByRole('button', { name: /^Pages/ }).click();
  await page.getByRole('textbox', { name: 'Search library' }).fill('काग़ज़');
  await expect(pageRow(page, 'काग़ज़ की रोशनी')).toBeVisible();
  await switchUniverse(page, x.signal);
  await expect(page.getByRole('textbox', { name: 'Search library' })).toHaveValue('');
  await expect(page.locator('.library-page-row')).toHaveCount(7);
  await page.getByRole('textbox', { name: 'Search library' }).fill('The window');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await pageRow(page, 'The window').locator('.library-page-open').click();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('apricot static');
  await switchUniverse(page, x.lantern);
  await navigate(page, 'Library');
  await page.getByRole('textbox', { name: 'Search library' }).fill('The window');
  await pageRow(page, 'The window').locator('.library-page-open').click();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('spoon-shaped moon');
  await switchUniverse(page, x.signal);
  await expect(page.getByRole('textbox', { name: 'Writing title' })).toHaveValue('The window');
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('apricot static');
});

test('One capture action follows a collection; move, rename and creating a world preserve writing', async ({ page }) => {
  const existing = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { documents: state.documents, originals: state.originals }; });
  await collections(page); await openCollection(page, 'A room for the ending');
  await expect(page.getByRole('button', { name: 'Read collection', exact: true })).toBeDisabled();
  await expect(libraryRegion(page).getByRole('button', { name: 'New thought', exact: true })).toHaveCount(0);
  await page.locator('.new-thought').click();
  const exact = 'The ending can remain a question. हिंदी é 🙂';
  await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('A possible last line');
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill(exact);
  const id = await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().activeDocumentId);
  expect(await page.evaluate(id => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === id).collectionId, id)).toBe(x.saltEmpty);
  await collections(page); await openCollection(page, 'A room for the ending');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill('An ending still open');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(libraryRegion(page).getByRole('heading', { name: 'An ending still open.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().collections.find((item: any) => item.id === 'salt-empty').name)).toBe('An ending still open');
  const row = pageRow(page, 'A possible last line');
  await row.locator('summary').click();
  await row.getByRole('combobox', { name: 'Move A possible last line to collection', exact: true }).selectOption('');
  await expect(page.locator('.library-page-row')).toHaveCount(0);
  await navigate(page, 'Inbox');
  await expect(page.getByRole('textbox', { name: 'Writing title' })).toHaveValue('A possible last line');
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText(exact);
  await page.getByRole('button', { name: 'New universe', exact: true }).click();
  await page.getByRole('textbox', { name: 'Universe name', exact: true }).fill('A new notebook — no taxonomy required');
  await page.getByRole('button', { name: 'Create universe', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Story universe' })).toContainText('A new notebook — no taxonomy required');
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveCount(0);
  await switchUniverse(page, x.salt);
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveText(exact);
  expect(await page.evaluate(id => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === id).collectionId, id)).toBeNull();
  const after = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { documents: state.documents, originals: state.originals }; });
  expect(after.documents.filter((item: any) => item.id !== id)).toEqual(existing.documents);
  expect(after.originals).toEqual(existing.originals);
});

for (const width of [1440, 768, 390]) test(`Atlas follows explicit links and backlinks without dropping into the editor at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await navigate(page, 'Atlas');
  const atlas = page.getByRole('region', { name: 'Living Atlas', exact: true });
  const mapBounds = async () => atlas.evaluate(region => {
    const viewport = region.getBoundingClientRect();
    return [...region.querySelectorAll<HTMLElement>('.atlas-map,.atlas-index,.atlas-reading-preview,.map-center,.map-node,.atlas-index > button')].flatMap(element => {
      const bounds = element.getBoundingClientRect();
      const parent = element.closest('.atlas-map,.atlas-index'); const parentBounds = parent && parent !== element ? parent.getBoundingClientRect() : viewport;
      const label = element.className || element.textContent?.slice(0, 35) || element.tagName;
      return bounds.left < parentBounds.left - 1 || bounds.right > parentBounds.right + 1 ? [`${label}: ${bounds.left}..${bounds.right} exceeds ${parentBounds.left}..${parentBounds.right}`] : [];
    });
  });
  await atlas.locator('.atlas-index').getByRole('button', { name: /^When the steps returned/ }).click();
  await expect(atlas.locator('.map-center')).toContainText('When the steps returned');
  await atlas.locator('.map-node').filter({ hasText: 'The old harbour' }).click();
  await expect(atlas).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveCount(0);
  await expect(atlas.locator('.map-center')).toContainText('The old harbour');
  await expect(atlas.locator('.atlas-index [aria-current="true"]')).toContainText('The old harbour');
  expect(await mapBounds()).toEqual([]);
  await atlas.locator('.map-node').filter({ hasText: 'When the steps returned' }).click();
  await expect(atlas.locator('.map-center')).toContainText('When the steps returned');
  const find = page.getByRole('textbox', { name: 'Find an Atlas page', exact: true });
  await find.fill('Who records a traveller');
  await expect(atlas.locator('.atlas-index > button')).toHaveCount(1);
  await atlas.locator('.atlas-index > button').click();
  await expect(atlas.locator('.map-center')).toContainText('The ferry ledger');
  await expect(atlas.locator('.map-node').filter({ hasText: 'The old harbour' })).toContainText('Links here');
  await atlas.getByRole('button', { name: 'Open writing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Writing title' })).toHaveValue('The ferry ledger');
  await navigate(page, 'Atlas');
  await expect(atlas.locator('.map-center')).toContainText('The ferry ledger');
  await switchUniverse(page, x.signal);
  await expect(page.getByRole('textbox', { name: 'Find an Atlas page' })).toHaveValue('');
  await expect(atlas.locator('.atlas-index > button')).toHaveCount(7);
  await expect(atlas).not.toContainText('The old harbour');
  expect(await mapBounds()).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

for (const width of [1440, 390]) test(`Library reading returns to its exact browse context and edits only on request at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await navigate(page, 'Library');
  await libraryRegion(page).getByRole('button', { name: 'Tile view', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter library by collection', exact: true }).selectOption(x.saltPeople);
  await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('last blue tile');
  await page.getByRole('combobox', { name: 'Sort library', exact: true }).selectOption('title');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Read The old harbour', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Library', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read The old harbour', exact: true })).toBeFocused();
  await expect(libraryRegion(page).getByRole('button', { name: /^Pages/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(libraryRegion(page)).toHaveAttribute('data-layout', 'tile');
  await expect(page.getByRole('textbox', { name: 'Search library', exact: true })).toHaveValue('last blue tile');
  await expect(page.getByRole('combobox', { name: 'Filter library by collection', exact: true })).toHaveValue(x.saltPeople);
  await expect(page.getByRole('combobox', { name: 'Sort library', exact: true })).toHaveValue('title');
  await expect(pageRow(page, 'The old harbour')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toHaveCount(0);
  await collections(page); await openCollection(page, 'Draft chapters');
  await libraryRegion(page).getByRole('button', { name: 'Detailed view', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort library', exact: true }).selectOption('title');
  await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('a purchase of lamp oil');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  const before = await snapshotIntegrity(page);
  await page.getByRole('button', { name: 'Read collection', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.reader-stage').getAttribute('data-pages'))).toBeGreaterThan(3);
  await expect(page.getByRole('button', { name: 'Back to Library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit current page', exact: true })).toHaveCount(1);
  await expect(libraryRegion(page)).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search library', exact: true })).toHaveCount(0);
  await expect(page.getByText('AI-origin · unverified', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
  const position = await page.locator('.reader-stage').getAttribute('data-page');
  await page.getByRole('button', { name: 'Back to Library', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read collection', exact: true })).toBeFocused();
  await expect(libraryRegion(page)).toBeVisible();
  await expect(libraryRegion(page).getByRole('heading', { name: 'Draft chapters.', exact: true })).toBeVisible();
  await expect(libraryRegion(page)).toHaveAttribute('data-layout', 'detailed');
  await expect(page.getByRole('textbox', { name: 'Search library', exact: true })).toHaveValue('a purchase of lamp oil');
  await expect(page.getByRole('combobox', { name: 'Sort library', exact: true })).toHaveValue('title');
  await expect(page.locator('.library-page-row')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Read collection', exact: true }).click();
  await expect(page.locator('.reader-book-title')).toHaveText('Draft chapters');
  await expect.poll(() => page.locator('.reader-stage').getAttribute('data-page')).toBe(position);
  await page.getByRole('button', { name: 'Reading contents', exact: true }).click();
  await page.getByRole('dialog', { name: 'Reading contents panel' }).getByRole('button', { name: /The third glass/ }).click();
  await page.getByRole('button', { name: 'Edit current page', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('The third glass');
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toContainText('a purchase of lamp oil');
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to writing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Library', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('The third glass');
  expect(await snapshotIntegrity(page)).toBe(before);
});

test('Leaving writing makes a recovery copy before idle; reload retains exact draft and originals', async ({ page, context }) => {
  const source = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { revisions: state.revisions.length, originals: state.originals, documents: state.documents }; });
  const addition = 'A temporary navigation note. हिंदी é 🙂 ';
  const exact = addition + source.documents.find((item: any) => item.id === x.tide).plainText;
  await context.setOffline(true);
  const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
  await canvas.press('Control+Home'); await canvas.pressSequentially(addition);
  await expect.poll(() => page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === 'salt-tide').plainText)).toBe(exact);
  await navigate(page, 'Library');
  await expect.poll(() => page.evaluate(async text => (await (window as any).__NOVELIAA_TEST__.db.all('drafts')).some((item: any) => item.document.id === 'salt-tide' && item.document.plainText === text), exact)).toBe(true);
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().revisions.length)).toBe(source.revisions);
  await context.setOffline(false); // DEV server itself has no offline app cache.
  await page.reload(); await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  await expect(page.getByRole('textbox', { name: 'Writing canvas', exact: true })).toContainText(addition);
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__.getSnapshot().documents.find((item: any) => item.id === 'salt-tide').plainText)).toBe(exact);
  const after = await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return { originals: state.originals, documents: state.documents, revisions: state.revisions }; });
  expect(after.originals).toEqual(source.originals);
  expect(after.documents.filter((item: any) => item.id !== x.tide)).toEqual(source.documents.filter((item: any) => item.id !== x.tide));
  expect(after.revisions.some((revision: any) => revision.documentId === x.tide && revision.snapshot.plainText.includes('Mira reached the harbour'))).toBe(true);
});
