import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedPopulatedWorkspace } from '../../../tests/helpers/populated-workspace.ts';

const out = path.resolve('.local/heartbeat/critic');
await mkdir(path.join(out, 'tmp'), { recursive: true });
const server = await createServer({ cacheDir: path.join(out, 'vite-cache'), server: { port: 5823, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({ headless: true, downloadsPath: path.join(out, 'downloads') });
const evidence = { synthetic: true, source: 'current working tree; independent critic browser', route: 'http://127.0.0.1:5823/?local=1&notebook=<isolated>', viewports: [], errors: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => evidence.errors.push(error.message));
    let mode = 'ready'; let requests = 0; let annotation;
    await page.route('**/api/integrations/heartbeat?**', async route => {
      requests++;
      if (mode === 'error') { await route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } }); return; }
      const currentAnnotation = mode === 'long' ? { ...annotation, beats: annotation.beats.map(beat => ({ ...beat, foreground: 'Unacknowledged private yearning', undertone: 'Unresolved quiet apprehension' })) } : annotation;
      await route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: mode === 'quiet' ? [{ ...annotation, beats: [] }] : mode === 'empty' ? [] : [currentAnnotation], sourceIsCurrent: mode !== 'stale' } });
    });
    const notebook = `critic-heartbeat-${width}-${Date.now()}`;
    await page.goto(`http://127.0.0.1:5823/?local=1&notebook=${notebook}`);
    await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
    const snapshot = await seedPopulatedWorkspace(page, notebook);
    const source = snapshot.documents.find(document => document.id === 'salt-tide');
    const revision = snapshot.revisions.find(item => item.id === source.headRevisionId);
    const quote = 'Mira reached the harbour before the baker unlocked his shutters.';
    const second = 'She had carried the brass key for eleven years without knowing which door it belonged to.';
    annotation = { id: 'critic-synthetic-annotation', schema: 'noveliaa-heartbeat-1', anchor: { documentId: source.id, revisionId: revision.id, contentHash: revision.contentHash, title: source.title }, attribution: { provider: 'Synthetic critic fixture', model: 'Reference only' }, contextNote: 'Only this synthetic scene is available. No real reader response or author intent is inferred.', origin: 'ai', verification: 'unverified', createdAt: '2026-11-03T00:00:00.000Z', beats: [
      { start: source.plainText.indexOf(quote), end: source.plainText.indexOf(quote) + quote.length, quote, foreground: 'Quiet anticipation', undertone: 'Hidden grief', weight: 2, trajectory: 'build', tone: 'cool', reasoning: 'The early harbour and unopened shutters suggest expectation; the undertone is only a possible reading.' },
      { start: source.plainText.indexOf(second), end: source.plainText.indexOf(second) + second.length, quote: second, foreground: 'Longing', undertone: 'Unease', weight: 4, trajectory: 'shift', tone: 'tender', reasoning: 'The long-held key suggests longing while its unknown purpose leaves unease. Synthetic inference only.' }
    ] };
    await page.getByRole('textbox', { name: 'Writing canvas' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const sourceBefore = await page.evaluate(() => { const value = window.__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: value.documents, revisions: value.revisions, originals: value.originals }); });
    const entry = { width, height: width === 390 ? 844 : 1000, offRequests: requests, screenshots: [], geometry: {} };
    const shot = async name => { await page.screenshot({ path: path.join(out, `${name}-${width}.png`) }); entry.screenshots.push(`${name}-${width}.png`); };
    const geometry = async name => { entry.geometry[name] = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, highlighted: [...CSS.highlights.keys()], readerStage: document.querySelector('.reader-stage')?.getBoundingClientRect().toJSON(), buttons: [...document.querySelectorAll('.heartbeat-toggle, .reader-turn-control')].map(item => ({ label: item.getAttribute('aria-label'), box: item.getBoundingClientRect().toJSON() })) })); };
    await shot('writer-off');
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: /Quiet anticipation.*Show reasoning/ }).waitFor();
    await shot('writer-on'); await geometry('writer-on');
    await page.getByRole('button', { name: /Quiet anticipation.*Show reasoning/ }).click();
    await page.getByRole('dialog').waitFor(); await shot('reasoning');
    entry.geometry.reasoning = await page.locator('.heartbeat-detail').evaluate(element => { const style = getComputedStyle(element); return { paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }; });
    await page.getByRole('button', { name: 'Close a possible reading', exact: true }).click();
    await page.getByRole('button', { name: 'Read this page', exact: true }).click();
    await page.locator('.reader-stage[data-pages]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.reader-stage')?.getAttribute('data-pages')) > 1);
    await page.getByRole('button', { name: /Quiet anticipation.*Show reasoning/ }).waitFor();
    await shot('reader-on'); await geometry('reader-on');
    mode = 'long';
    await page.getByRole('button', { name: 'Refresh Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: /Unacknowledged private yearning.*Show reasoning/ }).first().waitFor();
    await shot('reader-long');
    entry.geometry.readerLong = await page.locator('.reader-heartbeat .heartbeat-emotions').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, font: getComputedStyle(element.querySelector('strong')).fontSize, nowrap: getComputedStyle(element.querySelector('strong')).whiteSpace, label: element.closest('button').getAttribute('aria-label') })));
    await page.getByRole('button', { name: /Unacknowledged private yearning.*Show reasoning/ }).first().click();
    await page.getByRole('dialog').waitFor(); await shot('reasoning-long');
    await page.getByRole('button', { name: 'Close a possible reading', exact: true }).click();
    mode = 'ready';
    await page.getByRole('button', { name: 'Refresh Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: /Quiet anticipation.*Show reasoning/ }).waitFor();
    await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
    await shot('reader-next'); await geometry('reader-next');
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: 'Previous reader page', exact: true }).click();
    await shot('reader-off'); await geometry('reader-off');
    await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
    const sourceAfter = await page.evaluate(() => { const value = window.__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: value.documents, revisions: value.revisions, originals: value.originals }); });
    entry.sourceUnchangedThroughToggleAndRead = sourceBefore === sourceAfter;
    mode = 'quiet';
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await page.getByText('A quiet passage. No marked emotional turn.').waitFor();
    await shot('writer-quiet');
    mode = 'stale';
    await page.getByRole('button', { name: 'Refresh Heartbeat', exact: true }).click();
    await page.getByText('Writing changed. Heartbeat is hidden until this exact revision has a fresh annotation.').waitFor();
    await shot('writer-stale'); await geometry('writer-stale');
    mode = 'error';
    await page.getByRole('button', { name: 'Refresh Heartbeat', exact: true }).click();
    await page.getByText('Private annotations are unavailable. Your writing is safe.').waitFor();
    await shot('writer-error');
    evidence.viewports.push(entry);
    await context.close();
  }
} finally {
  await writeFile(path.join(out, 'browser-review.json'), JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
console.log(JSON.stringify({ result: 'CAPTURED', viewports: evidence.viewports.length, errors: evidence.errors, evidence: '.local/heartbeat/critic/browser-review.json' }));
