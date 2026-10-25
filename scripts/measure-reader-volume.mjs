// Isolated DEV measurement. Synthetic AI-origin volume; never production data.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance as nodeClock } from 'node:perf_hooks';

const root = process.cwd();
assert.match(root.replaceAll('\\', '/'), /^F:\/Workspace\/Programs\/Independent-Products\/Noveliaa$/i);
const output = path.join(root, '.local', 'large-reader-measure');
await mkdir(output, { recursive: true });
const runLabel = (process.argv[2] || 'adaptive').replace(/[^A-Za-z0-9_-]/g, '');
const reportFile = path.join(output, runLabel + '-report.json');
const sizes = process.argv[3] ? process.argv[3].split(',').map(Number) : [1000, 3000, 5000, 10000, 50000];
assert.ok(sizes.every(size => [1000, 3000, 5000, 10000, 50000].includes(size)));
const digest = text => createHash('sha256').update(text).digest('hex');
const sourceFiles = ['src/App.tsx', 'src/components/Reader.tsx', 'src/reader/page-turn.ts', 'src/vendor/pageflip/page-flip.js', 'src/library-reader.css'];
async function sourceHashes() { return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, digest(await readFile(path.join(root, file)))]))); }

const report = {
  measuredAt: new Date().toISOString(), runLabel, scope: 'isolated actual loopback DEV application', synthetic: true,
  material: { generated: 'AI-generated procedural volume, unverified; not the distinct three-world navigation corpus or owner manuscripts', approval: 'none', testedWords: sizes, sourceDocuments: 10, paragraphWords: 125, richInternalLinks: true, generatedBodyRule: 'Eachbook has exactly requested whitespace-separated words in ten ordered sources; paragraphs contain up to125words. Scene/route/object combinations vary; sentence vocabulary repeats for volume measurement.' },
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, totalMemoryBytes: os.totalmem(), freeMemoryBytesAtStart: os.freemem(), node: process.version },
  browser: null, launch: { headless: true, cpuThrottleRate: 1, network: 'loopback; no simulated throttle', otherBrowserLoad: 'root paused capture/lifecycle runners for this measurement' },
  sourceHashesBefore: await sourceHashes(), cases: [], errors: [],
  interpretation: { caution: 'Observed timings on this Windows host and headless Chromium only. A phone-sized viewport is not a physical phone performance test. CDP JS heap excludes substantial native DOM/layout/GPU memory; DOM counters are separate.', reviewSignal: 'Flag observed click main-thread/first-RAF delay above approximately150ms for review; no universal product pass budget is inferred.' },
};

const browser = await chromium.launch({ headless: true });
report.browser = browser.version();
const browserCdp = await browser.newBrowserCDPSession();
const cpuSnapshot = () => { const all = os.cpus().map(cpu => cpu.times); return { idle: all.reduce((sum, value) => sum + value.idle, 0), total: all.reduce((sum, value) => sum + Object.values(value).reduce((part, time) => part + time, 0), 0), at: nodeClock.now() }; };
async function browserCpu() { try { return { available: true, processes: (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo }; } catch (error) { return { available: false, error: error.message }; } }
async function integrity(page) {
  return page.evaluate(async () => {
    const state = window.__NOVELIAA_TEST__.getSnapshot();
    const text = JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals, receipts: state.receipts, pendingCount: state.pendingCount });
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return { sha256: Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(''), documents: state.documents.length, revisions: state.revisions.length, originals: state.originals.length, words: state.documents.reduce((sum, item) => sum + item.plainText.trim().split(/\s+/u).length, 0), origins: [...new Set(state.documents.map(item => item.origin))] };
  });
}
async function memory(cdp, page) {
  const [heap, dom, metrics, counters] = await Promise.all([
    cdp.send('Runtime.getHeapUsage'), cdp.send('Memory.getDOMCounters'), cdp.send('Performance.getMetrics'),
    page.evaluate(() => ({ elements: document.getElementsByTagName('*').length, projections: document.querySelectorAll('.reader-motion-leaf').length, canonicalSources: document.querySelectorAll('.reader-prose').length, nativeScrollWidth: document.querySelector('.reader-prose')?.scrollWidth })),
  ]);
  return { at: new Date().toISOString(), heap, dom, counters, metrics: Object.fromEntries(metrics.metrics.filter(item => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'LayoutObjects', 'TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].includes(item.name)).map(item => [item.name, item.value])) };
}
async function collect(cdp) { try { await cdp.send('HeapProfiler.collectGarbage'); return { available: true, method: 'CDP HeapProfiler.collectGarbage', performed: true }; } catch (error) { return { available: false, performed: false, error: error.message }; } }
async function arm(page) {
  await page.evaluate(() => {
    const probe = { clickAt: null, mode: null, projectionMountedAt: null, canonicalAnimationStartedAt: null, firstRafAt: null, settledAt: null, maxProjections: 0, maxCanonicalSources: 0, maxCanonicalAnimations: 0, maxElements: 0, longTasks: [], clickEvents: [], canonicalAnimationFinishes: [], observedTypes: PerformanceObserver.supportedEntryTypes || [] };
    window.__largeReaderProbe = probe;
    const animations = new Set();
    const article = document.querySelector('.reader-prose');
    const sample = () => {
      const count = document.querySelectorAll('.reader-motion-leaf').length;
      probe.maxProjections = Math.max(probe.maxProjections, count);
      probe.maxCanonicalSources = Math.max(probe.maxCanonicalSources, document.querySelectorAll('.reader-prose').length);
      probe.maxElements = Math.max(probe.maxElements, document.getElementsByTagName('*').length);
      if (probe.clickAt !== null && count && probe.projectionMountedAt === null) { probe.projectionMountedAt = performance.now(); probe.mode = 'curl'; }
      if (probe.clickAt !== null) {
        const running = article.getAnimations().filter(animation => animation.playState === 'running' || animation.playState === 'pending');
        probe.maxCanonicalAnimations = Math.max(probe.maxCanonicalAnimations, running.length);
        for (const animation of running) if (!animations.has(animation)) {
          animations.add(animation); probe.mode = probe.mode || 'slide'; probe.canonicalAnimationStartedAt = probe.canonicalAnimationStartedAt || performance.now();
          animation.finished.then(() => { probe.canonicalAnimationFinishes.push({ at: performance.now(), state: 'finished' }); if (probe.mode === 'slide') probe.settledAt = performance.now(); }).catch(() => { probe.canonicalAnimationFinishes.push({ at: performance.now(), state: 'cancelled' }); if (probe.mode === 'slide') probe.settledAt = performance.now(); });
        }
      }
      if (probe.projectionMountedAt !== null && !count && probe.settledAt === null) probe.settledAt = performance.now();
    };
    const mutations = new MutationObserver(sample); mutations.observe(document.querySelector('.reader-motion-host'), { childList: true, subtree: true }); mutations.observe(article, { attributes: true, attributeFilter: ['style'] });
    const observers = [];
    if (probe.observedTypes.includes('longtask')) { const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) if (probe.clickAt !== null && entry.startTime + entry.duration >= probe.clickAt) probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name }); }); observer.observe({ type: 'longtask' }); observers.push(observer); }
    if (probe.observedTypes.includes('event')) { const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.name === 'click' && probe.clickAt !== null && entry.processingStart >= probe.clickAt - 10) probe.clickEvents.push({ startTime: entry.startTime, duration: entry.duration, processingStart: entry.processingStart, processingEnd: entry.processingEnd, handlerMs: entry.processingEnd - entry.processingStart }); }); observer.observe({ type: 'event', durationThreshold: 16 }); observers.push(observer); }
    const button = document.querySelector('[aria-label="Next reader page"]');
    button.addEventListener('click', () => { probe.clickAt = performance.now(); requestAnimationFrame(() => { probe.firstRafAt = performance.now(); sample(); }); }, { once: true, capture: true });
    window.__finishLargeReaderProbe = () => { sample(); mutations.disconnect(); observers.forEach(observer => observer.disconnect()); return structuredClone(probe); };
  });
}

try {
  for (const targetWords of sizes) for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'no-preference' });
    const page = await context.newPage(); const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const current = { words: targetWords, viewport: { width, height: width === 1440 ? 1000 : 844 }, errors: [], turns: [] };
    report.cases.push(current);
    page.on('pageerror', error => current.errors.push(error.message));
    await page.goto('http://127.0.0.1:5817/?local=1&notebook=synthetic-large-reader-' + targetWords + '-' + width + '-' + Date.now());
    await page.waitForFunction(() => window.__NOVELIAA_TEST__?.getSnapshot().ready);
    await page.evaluate(async wordsRequested => {
      const engine = window.__NOVELIAA_TEST__;
      if (!engine.getSnapshot().localOnly || engine.getSnapshot().documents.length) throw new Error('Volume fixture needs an empty isolated DEV-only notebook.');
      await engine.createCollection('Synthetic ' + wordsRequested.toLocaleString() + '-word reading volume');
      const collection = engine.getSnapshot().collections[0];
      const ids = [];
      for (let chapter = 0; chapter < 10; chapter++) ids.push(await engine.createDocument({ title: `Volume scene ${String(chapter + 1).padStart(2, '0')} — unverified test material`, collectionId: collection.id, origin: 'ai' }));
      const people = ['Mira', 'Iona', 'Salim', 'Nila', 'Kavi', 'Leela', 'Aman', 'Rafi', 'Tara', 'Noor'];
      const places = ['the harbour', 'the orchard', 'the railway platform', 'the winter kitchen', 'the ferry gate', 'the observatory', 'the river steps', 'the reading room', 'the market roof', 'the north bridge'];
      const objects = ['a brass key', 'a folded ticket', 'a receiver spool', 'a blue cup', 'a copper wire', 'a red scarf', 'a paper lantern', 'a repaired notebook', 'a shell', 'an unsigned letter'];
      for (let chapter = 0; chapter < 10; chapter++) {
        const paragraphs = [];
        const chapterWords = wordsRequested / 10;
        for (let index = 0; index < Math.ceil(chapterWords / 125); index++) {
          const who = people[(chapter + index) % people.length]; const where = places[(chapter * 3 + index) % places.length]; const object = objects[(chapter * 7 + index) % objects.length];
          const sentences = [
            `${who} crossed ${where} with ${object}, listening to the rain settle into the empty spaces between the buildings.`,
            `At this point in scene ${chapter + 1}, observation ${index + 1}, the route changed because a familiar door had been left open and nobody could say who had passed through it.`,
            'The unanswered question belonged to the person holding the notebook, and the next sentence waited until they could name what they wanted without borrowing another voice.',
            'No map could decide the meaning of the journey. The smell of tea, the sound of a distant bell, and a small practical kindness remained separate details worth preserving.',
            'हिंदी की एक पंक्ति। A hand rested on the latch; outside, the weather was becoming ordinary again.',
          ].join(' ').split(/\s+/u);
          const words = Array.from({ length: Math.min(125, chapterWords - index * 125) }, (_, n) => sentences[n % sentences.length]);
          const linkedText = words.slice(20, 25).join(' ');
          paragraphs.push({ type: 'paragraph', ...(index % 2 ? { attrs: { firstLineIndent: true } } : {}), content: [
            { type: 'text', text: words.slice(0, 20).join(' ') + ' ' },
            { type: 'text', text: linkedText, marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + ids[(chapter + 1) % ids.length] } }, ...(index % 3 ? [] : [{ type: 'italic' }])] },
            { type: 'text', text: ' ' + words.slice(25).join(' ') },
          ] });
        }
        engine.updateDocument(ids[chapter], { body: { type: 'doc', content: paragraphs } });
      }
      await engine.checkpoint(); await engine.selectDocument(ids[0]);
    }, targetWords);
    const nav = page.locator(width < 651 ? '.mobile-bottom' : '.main-nav');
    await nav.getByRole('button', { name: 'Library', exact: true }).click();
    await page.locator('.library-tabs').getByRole('button', { name: /^Collections/ }).click();
    await page.locator('.collection-card-open').click();
    await page.getByRole('button', { name: 'Read collection', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('.reader-stage')?.getAttribute('data-pages')) > 3);
    await page.evaluate(() => document.fonts.ready);
    current.sourceBefore = await integrity(page);
    assert.equal(current.sourceBefore.words, targetWords); assert.deepEqual(current.sourceBefore.origins, ['ai']);
    current.reader = await page.locator('.reader-stage').evaluate(element => ({ pages: Number(element.dataset.pages), columns: Number(element.dataset.columns), width: element.clientWidth, height: element.clientHeight }));
    current.sourceComplexity = await page.locator('.reader-prose').evaluate(element => ({ textCharacters: element.textContent.length, descendantElements: element.querySelectorAll('*').length, allNodes: (() => { const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL); let count = 0; while (walker.nextNode()) count++; return count; })() }));
    current.gcBefore = await collect(cdp); current.before = await memory(cdp, page);
    const cpuBefore = cpuSnapshot(); const browserCpuBefore = await browserCpu();
    for (let index = 0; index < 3; index++) {
      await arm(page);
      const nodeStart = nodeClock.now(); await page.getByRole('button', { name: 'Next reader page', exact: true }).click();
      const clickCallMs = nodeClock.now() - nodeStart;
      await page.waitForFunction(() => window.__largeReaderProbe?.projectionMountedAt !== null || window.__largeReaderProbe?.canonicalAnimationStartedAt !== null);
      const during = await memory(cdp, page);
      await page.waitForFunction(() => window.__largeReaderProbe?.settledAt !== null);
      await page.waitForTimeout(80); // Allow the long-task/event observers to deliver completed entries.
      const probe = await page.evaluate(() => window.__finishLargeReaderProbe());
      await page.waitForFunction(() => document.querySelector('.reader-stage')?.getAttribute('data-motion-active') === 'false' && !document.querySelector('.reader-prose').getAnimations().some(animation => animation.playState === 'running' || animation.playState === 'pending'));
      const declaredMotion = await page.locator('.reader-stage').evaluate(element => ({ kind: element.dataset.motion, active: element.dataset.motionActive, activeCanonicalAnimations: document.querySelector('.reader-prose').getAnimations().filter(animation => animation.playState === 'running' || animation.playState === 'pending').length }));
      const turn = { index: index + 1, clickCallMs, probe, during,
        clickToProjectionMs: probe.projectionMountedAt === null ? null : probe.projectionMountedAt - probe.clickAt,
        clickToCanonicalAnimationMs: probe.canonicalAnimationStartedAt === null ? null : probe.canonicalAnimationStartedAt - probe.clickAt,
        clickToFirstRafMs: probe.firstRafAt - probe.clickAt,
        clickToSettleMs: probe.settledAt - probe.clickAt,
        maxLongTaskMs: Math.max(0, ...probe.longTasks.map(item => item.duration)), declaredMotion,
      };
      turn.flagForReview = turn.clickToFirstRafMs > 150 || turn.maxLongTaskMs > 150 || probe.clickEvents.some(item => item.handlerMs > 150);
      current.turns.push(turn);
      assert.ok(probe.maxProjections <= 4); assert.equal(probe.maxCanonicalSources, 1);
      assert.equal(declaredMotion.kind, probe.mode); assert.equal(declaredMotion.active, 'false');
      if (probe.mode === 'slide') { assert.equal(probe.maxProjections, 0); assert.ok(probe.maxCanonicalAnimations > 0); }
      else assert.ok(probe.mode === 'curl' && probe.maxProjections > 0);
      assert.equal(await page.locator('.reader-motion-leaf').count(), 0);
      console.log(JSON.stringify({ words: targetWords, viewport: width, mode: probe.mode, turn: index + 1, clickToProjectionMs: turn.clickToProjectionMs, clickToFirstRafMs: turn.clickToFirstRafMs, settleMs: turn.clickToSettleMs, maxLongTaskMs: turn.maxLongTaskMs, flagForReview: turn.flagForReview }));
    }
    const cpuAfter = cpuSnapshot(); const browserCpuAfter = await browserCpu();
    current.cpu = { elapsedMs: cpuAfter.at - cpuBefore.at, systemBusyPercentAcrossLogicalCores: 100 * (1 - (cpuAfter.idle - cpuBefore.idle) / (cpuAfter.total - cpuBefore.total)), scope: 'System CPU includes unrelated background processes; own browser process CPU sampled separately when CDP supports it.', before: browserCpuBefore, after: browserCpuAfter };
    if (browserCpuBefore.available && browserCpuAfter.available) current.cpu.ownProcessCpuSeconds = browserCpuAfter.processes.map(after => { const before = browserCpuBefore.processes.find(item => item.id === after.id); return { type: after.type, id: after.id, cpuSeconds: before ? after.cpuTime - before.cpuTime : null }; });
    current.afterSettled = await memory(cdp, page); current.gcAfter = await collect(cdp); current.afterGc = await memory(cdp, page);
    current.sourceAfter = await integrity(page); current.sourceUnchanged = current.sourceAfter.sha256 === current.sourceBefore.sha256;
    assert.equal(current.sourceUnchanged, true); assert.deepEqual(current.errors, []);
    current.maxProjections = Math.max(...current.turns.map(item => item.probe.maxProjections));
    current.anyReviewFlag = current.turns.some(item => item.flagForReview);
    await context.close();
  }
} catch (error) { report.errors.push({ message: error.message, stack: error.stack }); process.exitCode = 1; }
finally {
  report.sourceHashesAfter = await sourceHashes(); report.sourcesUnchanged = JSON.stringify(report.sourceHashesBefore) === JSON.stringify(report.sourceHashesAfter);
  report.completedAt = new Date().toISOString();
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ report: reportFile, sourceUnchanged: report.sourcesUnchanged, errors: report.errors.length, flagged: report.cases.filter(item => item.anyReviewFlag).map(item => ({ words: item.words, width: item.viewport.width })) }));
}
