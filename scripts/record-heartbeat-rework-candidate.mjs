// Record only inspected, successful checks and synthetic public captures.
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const local = '.local/heartbeat-rework', directory = 'docs/evidence/heartbeat-rework-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
async function copy(source, target) { await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true }); await copyFile(source, target); }
for (const folder of ['baseline', 'backend', 'checks', 'real-browser', 'usable-height', 'ci-motion-diagnostic', 'ci-motion-diagnostic-settled', 'critic/matched-baseline', 'critic/round1-alternatives', 'critic/round2', 'critic/round3', 'critic/round3-details', 'critic/round4-details', 'critic/round4-semantics', 'critic/round5', 'critic/round5-motion', 'critic/round5-slide', 'critic/round6', 'critic/round6-motion', 'critic/round6-slide', 'critic/round6-fallback', 'critic/round7-final', 'critic/round7-final-motion', 'critic/round7-final-rich', 'critic/round7-final-slide', 'critic/round7-final-fallback']) {
  if (!existsSync(local + '/' + folder)) continue;
  for (const source of await list(local + '/' + folder)) {
    if (!/\.(png|md|json|log|txt|html|webm)$/.test(source) || /\/(?:vite-cache|tmp|downloads|node_modules|private)\//.test(source) || /firebase\.emulator-test\.json$/.test(source)) continue;
    await copy(source, directory + source.slice(local.length));
  }
}
for (const path of ['parent-qa.md', 'UI-HANDOFF.md', 'proposal-quality.json', 'critic/review.md', 'critic/verdict-round6.json', 'critic/verdict-round7-final.json', 'ui-browser-final.log', 'typecheck-final.log', 'rich-regression.log', 'browse-regression.log', 'ci-motion-probe.log', 'ci-motion-probe-summary.json', 'ui-before-motion-test.json', 'ui-after-motion-test.json', 'diagnose-ci-motion.mjs', 'diagnose-ci-motion-settled.mjs', 'round-3-sources.json', 'round-5-sources.json', 'round-6-sources.json', 'round-7-sources.json']) if (existsSync(local + '/' + path)) await copy(local + '/' + path, directory + '/' + path);
await copy('.local/spark-browser-results.json', directory + '/checks/cloud-results.json');
await copy('.local/plugin-package/validation.json', directory + '/checks/plugin-package.json');
const browser = JSON.parse(await readFile(directory + '/checks/browser-results.json', 'utf8'));
const cloud = JSON.parse(await readFile(directory + '/checks/cloud-results.json', 'utf8'));
for (const value of [browser, cloud]) { assert.equal(value.stats.unexpected, 0); assert.equal(value.stats.skipped, 0); assert.equal(value.stats.flaky, 0); assert.equal(value.errors.length, 0); }
assert(browser.stats.expected >= 93); assert(cloud.stats.expected >= 11);
async function output(path) { const bytes = await readFile(directory + '/' + path); return bytes[0] === 255 && bytes[1] === 254 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8'); }
const probe = JSON.parse(await output('ci-motion-probe-summary.json'));
assert.equal(probe.nativeExit, 0); assert.equal(probe.emptyProjectionFailures, 0); assert.equal(probe.unpaintedProjectionFailures, 0); assert.equal(probe.offWhileActivePasses, probe.tests); assert(probe.tests >= 45);
assert.deepEqual(JSON.parse(await output('ui-before-motion-test.json')), JSON.parse(await output('ui-after-motion-test.json')));
const checks = {
  client: { passes: 98, skipped: 16, evidence: 'checks/client.log', pattern: /98 passed/ },
  functions: { passes: 37, skipped: 1, evidence: 'checks/functions.log', pattern: /pass 37/ },
  rules: { passes: 16, evidence: 'checks/rules.log', pattern: /16 passed/ },
  mcpIntegration: { passes: 18, evidence: 'backend/emulator-tests.txt', pattern: /pass 18/ },
  browser: { passes: browser.stats.expected, evidence: 'checks/browser-results.json' },
  cloud: { passes: cloud.stats.expected, evidence: 'checks/cloud-results.json' },
  evidence: { passes: 26, evidence: 'checks/evidence.log', pattern: /Ran 26 tests/ },
  typecheck: { evidence: 'checks/typecheck.log' }, build: { evidence: 'checks/build.log', pattern: /built in/ },
  functionsCheck: { evidence: 'checks/functions-check.log' }, packaging: { evidence: 'checks/plugin-package.json' },
  motionProbe: { passes: probe.tests, evidence: 'ci-motion-probe-summary.json' },
};
for (const value of Object.values(checks)) if (value.pattern) assert.match(await output(value.evidence), value.pattern);
const review = JSON.parse(await readFile(local + '/final-review.json', 'utf8'));
const finalRound = review.finalRound;
assert(Number.isInteger(finalRound) && finalRound >= 6 && finalRound <= 9);
const finalCapture = review.finalCapture;
assert.equal(finalCapture, 'round7-final');
const before = JSON.parse(await readFile(directory + '/baseline/measurements.json', 'utf8'));
const after = JSON.parse(await readFile(directory + '/critic/' + finalCapture + '/evidence.json', 'utf8'));
assert.equal(after.sourceStable, true);
for (const [path, digest] of Object.entries(after.hashes)) assert.equal(hash(await readFile(path)), digest, 'Final visual source changed: ' + path);
const comparison = Object.fromEntries(before.viewports.map(viewport => {
  const key = viewport.width + 'x' + viewport.height, old = viewport.states.find(state => state.state === 'on');
  const current = after.records.find(state => state.state === 'reader-on' && state.geometry.viewport[0] === viewport.width), value = current.geometry;
  return [key, {
    before: { lines: old.geometry.visibleProseLines, areaPercent: old.geometry.visibleTextRectAreaPercent, bookHeight: old.geometry.book.height, headerHeight: old.geometry.header.height, footerHeight: old.geometry.footer.height, screenshot: directory + '/' + old.screenshot },
    after: { lines: value.visibleParagraphLines, areaPercent: value.visibleTextAreaPercent, bookHeight: value.book.height, headerHeight: value.header.height, footerHeight: value.footer.height, overflow: value.rootOverflow, screenshot: directory + '/critic/' + finalCapture + '/' + current.screenshot },
  }];
}));
await copy(local + '/final-review.json', directory + '/final-review.json');
const paths = new Set();
for (const priorPath of ['docs/evidence/plugin-2026-10-25/manifest.json', 'docs/evidence/heartbeat-2026-11-03/manifest.json']) for (const item of JSON.parse(await readFile(priorPath, 'utf8')).sources) paths.add(item.path);
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'functions/scripts', 'tests', 'plugin', '.github/workflows', 'scripts']) for (const path of await list(root)) if (!path.includes('__pycache__')) paths.add(path);
paths.add('docs/design/EMOTIONAL_HEARTBEAT.md');
const inventory = async paths => Promise.all([...paths].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const sources = await inventory(paths);
const artifacts = await inventory((await list(directory)).filter(path => !path.endsWith('/manifest.json')));
const manifest = {
  schema: 'noveliaa-heartbeat-rework-evidence-1', recordedAt: new Date().toISOString(), baseCommit: '73b8455337f0c4223fa8973fe072755bd622f23c',
  priorOwnerVerdict: 'rejected', ownerAcceptance: 'not inferred', verdict: 'agent-reviewed', dataset: 'synthetic public renders; private source not published',
  central: { version: '0.2.3', baseRevision: 'd097786cf3d6c5a2859439112afdd39538316567', method: 'rejected redesign; three structural alternatives; retained implementation review rounds' },
  topology: 'Same native parent; independent backend, designer, visual critic and two raw-prose-only blind reading children. All children explicitly gpt-6.1-sol/xhigh; spawn settings accepted. Parent integrates, checks and delivers.',
  sources, sourceDigest: hash(Buffer.from(JSON.stringify(sources))), artifacts,
  checks: Object.fromEntries(Object.entries(checks).map(([name, { pattern, ...value }]) => [name, { ...value, evidence: directory + '/' + value.evidence, status: 'pass', failures: 0 }])),
  rounds: Array.from({ length: finalRound - 1 }, (_, index) => index + 2).map(round => ({ round, evidence: directory + '/critic/' + (round === finalRound ? finalCapture : round === 4 ? 'round4-details' : 'round' + round) + '/evidence.json' })),
  comparison, visual: review,
  continuity: { uncoveredMeaningfulCharacters: 0, blindReadings: 2, qualityEvidence: directory + '/proposal-quality.json', scope: 'Structural completeness is checked separately from literary judgment; AI inference is not measured reader emotion.' },
  limits: ['Public captures use a synthetic four-paragraph counterpart, not the private original.', 'Agent visual review does not establish owner comfort or physical-device acceptance.', '1366x768 is CSS viewport size at DPR1/zoom1; a separate 1366x590 usable-height diagnostic is retained.', 'Browsers without Custom Highlight retain labels and details with an explicit colors-unavailable notice.', 'Legacy sparse annotations remain append-only evidence and require regeneration; no gap emotions are inferred.', 'Existing quote/beat/size bounds remain; over-limit full readings cannot claim coverage.', 'No polling or Firestore listener additions; only local DOM viewport/scroll observation.'],
};
await writeFile(directory + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sources: sources.length, artifacts: artifacts.length, sourceDigest: manifest.sourceDigest, checks: manifest.checks, comparison }));
