// Isolated browser QA fixtures only. Never connects to a production notebook.
import { chromium } from '@playwright/test';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const round = Number(process.argv[2] || 1);
assert(round >= 1 && round <= 5);
const directory = process.env.NOVELIAA_EVIDENCE_DIR || `docs/evidence/phase1/library-reader-2026-10-25/cycle-${round}`;
await mkdir(directory, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? files(`${path}/${item.name}`) : `${path}/${item.name}`))).flat(); }
async function fingerprint() { return hash(JSON.stringify(await Promise.all((await files('src')).filter(path => /\.(tsx|css)$/.test(path) || path.startsWith('src/reader/') && !path.endsWith('.test.ts')).sort().map(async path => [path, hash(await readFile(path))])))); }
const sourceBefore = await fingerprint();
const browser = await chromium.launch({ headless: true });
const report = { round, dataset: 'Synthetic test writing; no production author data or cloud access', browser: browser.version(), sourceBefore, sourceAfter: '', captures: [], videos: [], errors: [] };
const widths = round === 1 ? [1440, 390] : round === 4 ? [1440, 768, 390, 320] : [1440, 390, 320];
try { for (const width of widths) {
  const height = round === 4 ? (width === 1440 ? 720 : width === 768 ? 620 : 568) : width === 1440 ? 1000 : 844;
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: round === 4 ? 'no-preference' : 'reduce', ...(round === 4 ? { recordVideo: { dir: `${directory}/video`, size: { width, height } } } : {}) });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push({ width, error: error.message }));
  await page.goto(`http://127.0.0.1:5817/?local=1&notebook=library-review-${round}-${width}-${Date.now()}`);
  await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
  const fixture = await page.evaluate(async () => {
    const engine = window.__NOVELIAA_TEST__;
    const names = ['The house beyond the tide', 'People & passing voices', 'Places remembered', 'Loose beginnings'];
    for (const name of names) await engine.createCollection(name);
    const groups = engine.getSnapshot().collections;
    const openings = ['The room above the sea', 'A letter with no address', 'When the lantern went out', 'The mapmaker', 'A quieter morning', 'The last ferry', 'The orchard in winter', 'Notes on the old harbour', 'A key without a door', 'What Mira remembered', 'The empty platform', 'Before the rain'];
    const passage = 'The sea had reached the bottom step by morning. Mira counted the stairs from the window, as she had done every day since the letter arrived. On the table lay a brass key and a cup that was still warm. Nobody in the house would say who had left them there.';
    const ids = [];
    for (let i = 0; i < openings.length; i++) {
      const content = Array.from({ length: i === 0 ? 24 : 2 }, (_, index) => ({ type: 'paragraph', ...(index === 0 ? { attrs: { firstLineIndent: true } } : {}), content: [{ type: 'text', text: index === 2 ? 'आज भी उसने खिड़की खुली रखी। Somewhere beyond the rain, a bell answered. é 🙂' : passage }] }));
      ids.push(await engine.createDocument({ title: openings[i], body: { type: 'doc', content }, collectionId: i < 5 ? groups[0].id : i < 9 ? groups[(i % 3) + 1].id : null }));
    }
    await engine.selectDocument(ids[0]); await engine.flush();
    return { group: groups[0].id, first: ids[0], title: openings[0] };
  });
  await page.evaluate(() => document.fonts.ready);
  const capture = async state => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const path = `${directory}/${state}-${width}.png`;
    await page.screenshot({ path, fullPage: true });
    const bounds = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight, brokenImages: [...document.images].some(image => !image.complete || image.naturalWidth === 0) }));
    assert(bounds.scrollWidth <= bounds.width + 1, `Horizontal overflow in ${state} ${width}`);
    assert.equal(bounds.brokenImages, false);
    if (state.startsWith('reader-')) assert(bounds.scrollHeight <= bounds.height + 1, `Reader controls exceed the viewport in ${state} ${width}`);
    report.captures.push({ state, viewport: { width, height }, path, sha256: hash(await readFile(path)), bounds });
  };
  const openLibrary = async () => {
    if (width < 651) {
      const destination = page.locator('.mobile-bottom').getByRole('button', { name: 'Library', exact: true });
      if (await destination.isVisible()) await destination.click();
      else { await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click(); }
    }
    else await page.locator('.main-nav').getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('region', { name: 'Writing library', exact: true }).waitFor();
  };
  await openLibrary();
  if (round === 1 || round === 2 || round === 5) {
    await capture('library-pages');
    await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
    await capture('library-collections');
  } else await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
  await page.locator('.collection-card-open').filter({ hasText: 'The house beyond the tide' }).click();
  if (round === 2 || round === 5) {
    await capture('collection-detail');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await capture('collection-rename');
    await page.getByRole('dialog').getByRole('button', { name: /^Close/ }).click();
  }
  if (round >= 3) {
    await page.getByRole('button', { name: 'Read collection', exact: true }).click();
    await page.locator('.reader-stage[data-pages]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.reader-stage')?.getAttribute('data-pages')) > 1);
    await capture('reader-prose');
    if (round >= 4) {
      await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
      if (round === 4) await page.waitForTimeout(90);
      await capture('reader-next');
    }
    await page.getByRole('button', { name: 'Reading contents', exact: true }).click();
    await capture('reader-contents');
    await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
    await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
    await capture('reader-appearance');
    if (round === 4) {
      await page.getByRole('slider', { name: 'Reading text size', exact: true }).press('End');
      await page.getByRole('slider', { name: 'Reading line spacing', exact: true }).press('End');
      await page.getByRole('combobox', { name: 'Reading margins', exact: true }).selectOption('wide');
      await page.getByRole('button', { name: 'Night', exact: true }).click();
      await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
      await capture('reader-night-large');
    }
    if (round === 5) {
      await page.getByRole('button', { name: 'Night', exact: true }).click();
      await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
      await capture('reader-night');
      await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
      await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).waitFor();
      await capture('writing-after-reading');
      await page.goto(`http://127.0.0.1:5817/?local=1&notebook=empty-library-review-${width}-${Date.now()}`);
      await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
      await openLibrary();
      await capture('library-empty');
    }
  }
  const video = page.video();
  await context.close();
  if (video) { const path = await video.path(); report.videos.push({ path, sha256: hash(await readFile(path)), viewport: { width, height } }); }
} } finally { await browser.close(); }
report.sourceAfter = await fingerprint();
await writeFile(`${directory}/capture.json`, JSON.stringify(report, null, 2) + '\n');
assert.equal(report.sourceBefore, report.sourceAfter, 'Source changed during captures; recapture the cycle before review');
assert.equal(report.errors.length, 0, 'Browser errors during visual captures');
console.log(JSON.stringify({ round, source: sourceBefore, captures: report.captures.length, directory }));
