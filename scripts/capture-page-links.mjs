// Loopback DEV-only synthetic notebook; never accesses an author's writing.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const phase = process.argv[2] || 'after';
const directory = `.local/page-links/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const measurements = [];
for (const [width, height] of [[1440, 1000], [390, 844], [320, 568]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`http://127.0.0.1:5817/?local=1&notebook=page-links-${phase}-${width}-${Date.now()}`);
  await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
  await page.evaluate(async () => {
    const engine = window.__NOVELIAA_TEST__;
    await engine.createCollection('The tide notebooks');
    const id = await engine.createDocument({ title: 'The room above the sea', collectionId: engine.getSnapshot().collections[0].id });
    engine.updateDocument(id, { body: { type: 'doc', content: Array.from({ length: 8 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Passage ${i + 1}. The tide rose through the reeds. The window held the last of the light. She opened the notebook and left a little room for tomorrow.` }] })) } });
    await engine.flush();
  });
  await page.getByRole('textbox', { name: 'Writing title' }).waitFor();
  await page.screenshot({ path: `${directory}/${width}-writing.png` });
  if (phase === 'after') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy page link', exact: true }).focus();
    await page.locator('.document-topline').screenshot({ path: `${directory}/${width}-writing-link-focus.png` });
  }
  await page.getByRole('button', { name: 'Read this page', exact: true }).click();
  await page.locator('.reader-prose').waitFor();
  await page.waitForFunction(() => document.querySelector('.reader-prose')?.style.opacity === '1');
  await page.screenshot({ path: `${directory}/${width}-reader.png` });
  if (phase === 'after') {
    await page.getByRole('button', { name: 'Copy page link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Page link copied.' }).waitFor();
    await page.locator('.reader-header').screenshot({ path: `${directory}/${width}-reader-link-copied.png` });
    await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Synthetic clipboard denial'); } }); });
    await page.getByRole('button', { name: 'Copy page link', exact: true }).click();
    await page.getByRole('textbox', { name: 'Page URL' }).waitFor();
    await page.screenshot({ path: `${directory}/${width}-copy-fallback.png` });
    await page.keyboard.press('Escape');
  }
  measurements.push(await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth - innerWidth, header: document.querySelector('.reader-header').getBoundingClientRect().toJSON(), book: document.querySelector('.reader-book').getBoundingClientRect().toJSON() })));
  await page.close();
}
await browser.close();
await writeFile(`${directory}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log(JSON.stringify({ directory, dataset: 'synthetic', measurements }));
