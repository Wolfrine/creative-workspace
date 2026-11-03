import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = 'https://noveliaa.web.app';
const directory = '.local/heartbeat/hosted'; await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], states = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[1440,1000],[390,844],[320,640]]) {
    await page.setViewportSize({ width, height });
    const response = await page.goto(origin, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
    await page.getByRole('button', { name: /Sign in with Google/ }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.__NOVELIAA_TEST__)), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.equal(axe.violations.length, 0);
    await page.screenshot({ path: directory + `/public-${width}.png` });
    states.push({ width, height, status: response.status(), privateWritingVisible: false, axeViolations: axe.violations.length });
  }
  const configuration = await (await fetch(origin + '/__/firebase/init.json')).json();
  assert.equal(configuration.projectId, 'noveliaa');
  assert.equal(configuration.appId, '1:278082781314:web:9a4b7acef07fa8e4dfb49b');
  assert.deepEqual(errors, []);
  await writeFile(directory + '/ui-result.json', JSON.stringify({ checkedAt: new Date().toISOString(), origin, projectId: configuration.projectId, appId: configuration.appId, states, errors, scope: 'Signed-out public UI only; no real manuscripts accessed, no production bypass or writes.' }, null, 2));
  console.log(JSON.stringify({ origin, states, errors }));
} finally { await browser.close(); }
