import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { seedPopulatedWorkspace, fixtureIds } from '../tests/helpers/populated-workspace.ts';

const root = '.local/critic-navigation';
await mkdir(root, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
async function files(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(directory + '/' + entry.name) : directory + '/' + entry.name))).flat(); }
async function fingerprint() { return hash(JSON.stringify(await Promise.all((await files('src')).filter(path => /\.(ts|tsx|js|css)$/.test(path) && !path.endsWith('.test.ts')).sort().map(async path => [path, hash(await readFile(path))])))); }
const report = { dataset: 'Independent critic UI journey; synthetic AI-generated unverified isolated DEV archive only', sourceBefore: await fingerprint(), sourceAfter: '', cases: [], errors: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ width, error: error.message }));
    const notebook = `critic-populated-${width}-${Date.now()}`;
    await page.goto(`http://127.0.0.1:5817/?local=1&notebook=${notebook}`);
    await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
    await seedPopulatedWorkspace(page, notebook);
    await page.evaluate(() => document.fonts.ready);
    const entry = { width, screenshots: [], checks: [] };
    report.cases.push(entry);
    const capture = async state => {
      const path = `${root}/${state}-${width}.png`;
      await page.screenshot({ path });
      entry.screenshots.push({ state, path, sha256: hash(await readFile(path)) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    const navigation = async () => {
      if (width < 651 && !await page.locator('.sidebar').isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      else if (width < 651 && !await page.locator('.app').evaluate(element => element.classList.contains('nav-is-open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    };
    const openLibrary = async () => { await navigation(); await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click(); };
    await openLibrary();
    await page.getByRole('button', { name: 'Detailed view', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('brass key');
    await expect(page.locator('.library-page-row')).toHaveCount(3);
    await expect(page.locator('.library-pages')).toContainText('When the steps returned');
    await expect(page.locator('.library-pages')).toContainText('Mira — what she refuses to forget');
    await expect(page.locator('.library-pages')).toContainText('The old harbour');
    await capture('salt-search');
    await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('');
    await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
    await page.locator('.collection-card-open').filter({ hasText: 'Draft chapters' }).click();
    await capture('salt-collection');
    const readCollection = page.getByRole('button', { name: 'Read collection', exact: true });
    await readCollection.click();
    await expect(page.getByRole('button', { name: 'Back to Library', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reading contents', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close reading settings', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to Library', exact: true }).click();
    await expect(readCollection).toBeFocused();
    await expect(page.locator('.library-workspace h1')).toHaveText('Draft chapters.');
    await expect(page.getByRole('button', { name: 'Detailed view', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await capture('reader-return-focus');
    entry.checks.push('Keyboard contents Escape and reader return preserve collection, Detailed layout and Read collection focus without editor activation');
    await navigation();
    await page.getByRole('combobox', { name: 'Story universe', exact: true }).selectOption(fixtureIds.signal);
    await expect(page.locator('.library-workspace h1')).toHaveText('Your library.');
    await expect(page.locator('.library-workspace')).not.toContainText('Mira');
    await page.locator('.library-tabs').getByRole('button', { name: /^Pages/ }).click();
    await expect(page.getByRole('textbox', { name: 'Search library', exact: true })).toHaveValue('');
    await capture('signal-library');
    entry.checks.push('Universe switch clears foreign collection and query and shows Signal Orchard only');
    await navigation();
    await page.locator('.main-nav').getByRole('button', { name: 'Living Atlas', exact: true }).click();
    await page.locator('.atlas-index').getByRole('button').filter({ hasText: 'Iona' }).click();
    await expect(page.locator('.atlas-map')).toContainText('Iona');
    await expect(page.getByRole('heading', { name: 'Living Atlas.', exact: true })).toBeVisible();
    await capture('signal-atlas');
    entry.checks.push('Atlas node/index inspection stays inside Atlas with matching focus');
    await page.getByRole('button', { name: 'Open writing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Writing title', exact: true })).toHaveValue('Iona');
    await capture('signal-edit');
    entry.checks.push('Explicit Open writing opens the inspected Iona source');
    await openLibrary();
    await navigation();
    await page.getByRole('combobox', { name: 'Story universe', exact: true }).selectOption(fixtureIds.lantern);
    await page.getByRole('textbox', { name: 'Search library', exact: true }).fill('spoon-shaped moon');
    await expect(page.locator('.library-page-row')).toHaveCount(1);
    await capture('lantern-search');
    entry.checks.push('Same-name The window page is scoped to Paper Lantern and its own prose');
    await context.close();
  }
} catch (error) {
  report.errors.push({ fatal: error.stack || String(error) });
  process.exitCode = 1;
} finally {
  report.sourceAfter = await fingerprint();
  report.browser = browser.version();
  await writeFile(root + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report));
}
