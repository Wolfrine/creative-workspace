import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedPopulatedWorkspace } from '../../../tests/helpers/populated-workspace.ts';

const out = path.resolve('.local/heartbeat/critic/color-review');
await mkdir(out, { recursive: true });
const port = Number(process.env.CRITIC_REVIEW_PORT || 5817);
let server;
if (port === 5823) {
  const { createServer } = await import('vite');
  server = await createServer({ cacheDir: path.resolve('.local/heartbeat/critic/vite-cache'), server: { port, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
}
const browser = await chromium.launch({ headless: true });
const evidence = { synthetic: true, route: `http://127.0.0.1:${port}/?local=1&notebook=<isolated>`, serverStartedByCritic: !!server, states: [], errors: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => evidence.errors.push(error.message));
    let annotation;
    await page.route('**/api/integrations/heartbeat?**', route => route.fulfill({ json: { schema: 'noveliaa-heartbeat-1', annotations: [annotation], sourceIsCurrent: true } }));
    const notebook = `critic-color-${width}-${Date.now()}`;
    await page.goto(`http://127.0.0.1:${port}/?local=1&notebook=${notebook}`);
    await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
    const snapshot = await seedPopulatedWorkspace(page, notebook);
    const document = snapshot.documents.find(item => item.id === 'salt-tide');
    const revision = snapshot.revisions.find(item => item.id === document.headRevisionId);
    const quote = 'Mira reached the harbour before the baker unlocked his shutters.';
    const start = document.plainText.indexOf(quote);
    annotation = { id: 'critic-color-synthetic', schema: 'noveliaa-heartbeat-1', anchor: { documentId: document.id, revisionId: revision.id, contentHash: revision.contentHash, title: document.title }, attribution: { provider: 'Synthetic critic', model: 'Color review only' }, contextNote: 'Synthetic context; no author intent or real response is inferred.', origin: 'ai', verification: 'unverified', createdAt: '2026-11-03T00:00:00.000Z', beats: [{ start, end: start + quote.length, quote, foreground: 'Quiet anticipation', undertone: 'Hidden grief', weight: 3, trajectory: 'build', tone: 'cool', reasoning: 'The early harbour offers one possible reading of expectation, with an undertone of remembered loss.' }] };
    const capture = async state => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `${state}-${width}.png`) });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const colors = await page.locator('.heartbeat-toggle, .heartbeat-caption, .heartbeat-unverified, .heartbeat-emotions strong, .heartbeat-emotions small, .heartbeat-trajectory, .heartbeat-attribution, .heartbeat-attribution span, .heartbeat-detail-label, .heartbeat-detail-label>span, .heartbeat-detail-meta, .heartbeat-context').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({ text: element.textContent, className: element.className, color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor, fontSize: getComputedStyle(element).fontSize })));
      const beatAccessibility = await page.locator('.heartbeat-beat').first().count() ? { snapshot: await page.locator('.heartbeat-beat').first().ariaSnapshot(), description: await page.locator('.heartbeat-beat').first().getAttribute('aria-description') } : null;
      evidence.states.push({ state, width, colors, beatAccessibility, violations: axe.violations, incompleteContrast: axe.incomplete.filter(item => item.id === 'color-contrast') });
      console.log(JSON.stringify({ state, width, violations: axe.violations.map(item => item.id) }));
    };
    await page.getByRole('textbox', { name: 'Writing canvas' }).waitFor(); await capture('writer-off');
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: /Quiet anticipation.*Hidden grief/ }).waitFor(); await capture('writer-on');
    await page.getByRole('button', { name: /Quiet anticipation.*Hidden grief/ }).click(); await page.getByRole('dialog').waitFor(); await capture('details');
    await page.getByRole('button', { name: 'Close a possible reading', exact: true }).click();
    await page.getByRole('button', { name: 'Read this page', exact: true }).click();
    await page.getByRole('button', { name: /Quiet anticipation.*Hidden grief/ }).waitFor(); await capture('reader-paper');
    await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.getByRole('button', { name: 'Close reading settings', exact: true }).click();
    await page.locator('.reader-night').waitFor(); await capture('reader-night');
    await page.getByRole('button', { name: /Quiet anticipation.*Hidden grief/ }).click(); await page.getByRole('dialog').waitFor(); await capture('night-details');
    await page.getByRole('button', { name: 'Close a possible reading', exact: true }).click();
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).hover(); await capture('night-off-hover');
    await context.close();
  }
} finally {
  await writeFile(path.join(out, 'contrast-review.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
  await server?.close();
}
console.log(JSON.stringify({ states: evidence.states.length, violations: evidence.states.reduce((sum, item) => sum + item.violations.length, 0), errors: evidence.errors }));
