import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const url = 'http://127.0.0.1:5817/?local=1&notebook=profile-' + Date.now();
await page.goto(url); await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
const corpus = await page.evaluate(async () => {
  const engine = window.__NOVELIAA_TEST__; let longScene; const firstWorld = engine.getSnapshot().activeUniverseId;
  const counts = [];
  for (let world = 0; world < 2; world++) {
    if (world) await engine.createUniverse('Second independent world');
    for (let note = 0; note < 200; note++) {
      const words = note < 150 ? 100 : note === 150 ? 20000 : note === 199 ? 600 : 300;
      const text = `${world ? 'OTHER-WORLD-CANARY' : 'GOLDEN-PHRASE'} हिंदी ` + 'river '.repeat(words - 2).trimEnd();
      const id = await engine.createDocument({ title: `Same name ${note}`, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
      if (!world && note === 150) longScene = id;
      counts.push(words);
    }
  }
  await engine.selectUniverse(firstWorld); await engine.selectDocument(longScene);
  return { documents: counts.length, worlds: 2, words: counts.reduce((a, b) => a + b, 0), longSceneWords: 20000 };
});
const launches = [];
for (let i = 0; i < 10; i++) {
  const begin = performance.now(); await page.goto(url);
  await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).waitFor(); launches.push(performance.now() - begin);
}
const canvas = page.getByRole('textbox', { name: 'Writing canvas', exact: true });
await canvas.press('Control+End');
await page.evaluate(() => {
  window.__PAINT_SAMPLES__ = [];
  document.addEventListener('beforeinput', () => { const start = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => window.__PAINT_SAMPLES__.push(performance.now() - start))); }, true);
});
await page.keyboard.type(' A quiet sentence to keep writing.', { delay: 45 });
await page.waitForFunction(() => window.__NOVELIAA_TEST__.getSnapshot().saveState === 'local');
const inputSamples = await page.evaluate(() => window.__PAINT_SAMPLES__);
const checkpointSamples = [];
for (let i = 0; i < 10; i++) {
  const begin = performance.now(); await page.keyboard.type('x');
  await page.waitForFunction(() => window.__NOVELIAA_TEST__.getSnapshot().saveState === 'local'); checkpointSamples.push(performance.now() - begin);
}
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
const result = { dataset: 'synthetic', corpus, browser: browser.version(), environment: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryGiB: Math.round(os.totalmem() / 2 ** 30), platform: os.platform(), cpuThrottle: 1, network: 'loopback, no throttling' }, scope: 'Development build, 10 warm-library navigations; beforeinput-to-second-animation-frame proxy, not field INP or a physical phone profile. Does not establish the complete A24 gate.', launchesMs: launches, launchesUnder3000: launches.filter(value => value <= 3000).length, inputSamplesMs: inputSamples, inputProxyP95Ms: p95(inputSamples), checkpointSamplesMs: checkpointSamples, checkpointP95Ms: p95(checkpointSamples) };
await mkdir('docs/evidence/phase1', { recursive: true });
await writeFile('docs/evidence/phase1/performance.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ corpus, launchesUnder3000: result.launchesUnder3000, inputProxyP95Ms: result.inputProxyP95Ms, checkpointP95Ms: result.checkpointP95Ms, scope: result.scope }));
await browser.close();
