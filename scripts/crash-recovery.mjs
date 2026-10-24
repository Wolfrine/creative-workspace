import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const profile = await mkdtemp(path.join(tmpdir(), 'noveliaa-crash-'));
const url = 'http://127.0.0.1:5817/?local=1&notebook=forced-browser-crash';
const report = { dataset: 'synthetic', profile: 'Chromium persistent device store, offline checkpoint then Browser.crash; developer shell reopened online', limitation: 'Does not prove authenticated offline cold bootstrap or physical power-loss durability.', browser: '', checkpoints: [] };
let random = 20261023; const next = () => (random = (random * 1664525 + 1013904223) >>> 0);
let documentId; let context; const expected = new Map();
for (let i = 0; i <= 20; i++) {
  context = await chromium.launchPersistentContext(profile, { headless: true }); report.browser = context.browser().version();
  const page = await context.newPage(); await page.goto(url);
  await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
  if (i) {
    const recovered = await page.evaluate(() => window.__NOVELIAA_TEST__.getSnapshot());
    for (const [draftId, text] of expected) if (!recovered.revisions.some(revision => revision.snapshot.plainText === text)) throw new Error('Acknowledged draft was not recovered: ' + draftId);
    if (recovered.documents.find(doc => doc.id === documentId)?.plainText !== [...expected.values()].at(-1)) throw new Error('Latest acknowledged device draft was not reopened');
    report.checkpoints[i - 1].recovered = true;
  }
  if (i === 20) break;
  if (!documentId) documentId = await page.evaluate(() => window.__NOVELIAA_TEST__.createDocument());
  await context.setOffline(true);
  const text = `Independent oracle ${i} ${next()} — हिंदी e\u0301 🙂\n${'word '.repeat(next() % 160)}`;
  const revisionId = await page.evaluate(async ({ documentId, text }) => {
    const engine = window.__NOVELIAA_TEST__;
    engine.updateDocument(documentId, { body: { type: 'doc', content: text.split('\n').map(line => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) } });
    await engine.flush();
    if (engine.getSnapshot().saveState !== 'local') throw new Error('No device acknowledgement');
    return (await engine.db.all('drafts')).find(draft => draft.document.id === documentId && draft.document.plainText === text).id;
  }, { documentId, text });
  expected.set(revisionId, text);
  const pauseMs = next() % 180;
  await page.waitForTimeout(pauseMs);
  report.checkpoints.push({ revisionId, inputSha256: createHash('sha256').update(text).digest('hex'), pauseAfterAcknowledgementMs: pauseMs, offlineAtCrash: true, recovered: false });
  const session = await context.newCDPSession(page);
  await Promise.race([session.send('Browser.crash').catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
  await Promise.race([context.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
}
await context.close();
const evidence = process.env.NOVELIAA_EVIDENCE_DIR ?? '.local/sync-recovery';
await mkdir(evidence, { recursive: true });
await writeFile(evidence + '/crash-recovery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ recovered: report.checkpoints.filter(x => x.recovered).length, interruptions: report.checkpoints.length, browser: report.browser, limitation: report.limitation }));
