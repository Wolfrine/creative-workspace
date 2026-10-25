// Time-stamped real browser frames, not a simulation of page-turn motion.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/phase1/library-reader-2026-10-25/motion';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { dataset: 'Synthetic isolated local notebook; actual Chromium animations and screenshots', browser: browser.version(), cases: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'no-preference', recordVideo: { dir: directory + '/video' } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5817/?local=1&notebook=motion-' + width + '-' + Date.now());
    await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
    await page.evaluate(async () => {
      const engine = window.__NOVELIAA_TEST__;
      await engine.createDocument({ title: 'The room above the sea', body: { type: 'doc', content: Array.from({ length: 32 }, () => ({ type: 'paragraph', content: [{ type: 'text', text: 'The sea had reached the bottom step by morning. Mira counted the stairs from the window, as she had done every day since the letter arrived. आज भी उसने खिड़की खुली रखी।' }] })) } });
    });
    await page.getByRole('button', { name: 'Read this page', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Number(document.querySelector('.reader-stage')?.getAttribute('data-pages')) > 2);
    const frames = [];
    const before = `${directory}/before-${width}.png`;
    await page.screenshot({ path: before });
    const started = performance.now();
    await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
    for (const target of [0, 90, 180, 270, 360, 500]) {
      const remaining = target - (performance.now() - started);
      if (remaining > 0) await page.waitForTimeout(remaining);
      const observed = await page.locator('.reader-turn').evaluateAll(elements => elements.map(element => ({ transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity, animationName: getComputedStyle(element).animationName })));
      const path = `${directory}/turn-${width}-${target}.png`;
      const elapsedMs = performance.now() - started;
      await page.screenshot({ path });
      frames.push({ targetMs: target, actualElapsedMs: Math.round(elapsedMs), path, observed, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
    }
    assert(frames.some(frame => frame.observed.length), 'Motion was never observed');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
    assert.equal(await page.locator('.reader-turn').count(), 0, 'Reduced motion must turn without the visual leaf');
    const video = page.video(); await context.close();
    report.cases.push({ width, before, frames, reducedMotionNoLeaf: true, video: await video.path() });
  }
} finally { await browser.close(); }
await writeFile(directory + '/motion.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ cases: report.cases.length, actualTimedFrames: report.cases.reduce((sum, item) => sum + item.frames.length, 0), reducedMotionPass: report.cases.every(item => item.reducedMotionNoLeaf) }));
