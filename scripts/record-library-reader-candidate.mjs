// Bind the actually tested and visually reviewed author-reading candidate.
// Historical release manifests and original captures remain untouched.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'docs/evidence/phase1/library-reader-2026-10-25';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(`${path}/${item.name}`) : `${path}/${item.name}`))).flat(); }
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const base = await json('docs/evidence/phase1/sync-monitoring-2026-10-25/manifest.json');
const client = await json(`${directory}/client-tests.json`);
const rules = await json(`${directory}/collection-rules-tests.json`);
const browser = await json(`${directory}/browser-results.json`);
const cloud = await json(`${directory}/spark-browser-results.json`);
const crash = await json(`${directory}/crash-recovery.json`);
const review = await json(`${directory}/visual-review.json`);
assert(client.numPassedTests >= 88 && client.numFailedTests === 0);
assert(rules.numPassedTests >= 15 && rules.numFailedTests === 0);
assert(browser.stats.expected >= 30 && browser.stats.unexpected === 0 && browser.stats.skipped === 0);
assert(cloud.stats.expected >= 10 && cloud.stats.unexpected === 0 && cloud.stats.skipped === 0);
assert.equal(crash.checkpoints.length, 20); assert(crash.checkpoints.every(point => point.recovered));
assert.equal(review.result, 'pass'); assert.equal(review.ownerAcceptance, 'not inferred');
assert.equal(review.cycles.length, 5);
for (const cycle of review.cycles) {
  const capture = await json(`${directory}/cycle-${cycle.round}/capture.json`);
  assert.equal(capture.sourceBefore, capture.sourceAfter);
  assert(capture.captures.length >= 4 && capture.errors.length === 0);
}
const extra = ['AGENTS.md', 'INTENT.md', '.harness/objective.md', '.harness/dev-environment.ps1', 'docs/ARCHITECTURE.md', 'docs/design/LIBRARY_READER.md', 'docs/design/library-reader-qa.md', 'docs/design/library-reader-critic.md', 'scripts/capture-library-reader.mjs', 'scripts/capture-reader-motion.mjs', 'scripts/record-library-reader-candidate.mjs', 'scripts/verify-deployment-candidate.mjs'];
const sources = await inventory([...base.sources.map(item => item.path), ...await list('src'), ...await list('tests'), ...extra]);
const retained = (await list(directory)).filter(path => !path.endsWith('/manifest.json'));
const image = path => /\.(png|jpe?g|webp)$/.test(path);
const manifest = {
  capturedAt: new Date().toISOString(), plan: 'Spark',
  scope: 'Owner-approved stable collection renaming, dedicated Library/collection views and private semantic paginated author Read mode, optional paper-turn motion, mobile Read destination; flat collections and 10s/60s writing contract retained.',
  dataset: 'Synthetic writing only in isolated browser notebooks and actual loopback Auth/Firestore emulators. No production manuscript was accessed or used as a fixture. Existing production release separately verified after main push.',
  sourceDigest: hash(JSON.stringify(sources)), sources,
  renders: await inventory(retained.filter(image)),
  testEvidence: await inventory(retained.filter(path => !image(path))),
  operationsEvidence: await inventory(['docs/evidence/operations/2026-10-25-f-drive-migration.json']),
  localUnconfiguredBuild: await inventory(await list('dist')),
  clientPasses: client.numPassedTests, rulePasses: rules.numPassedTests, ruleFailures: rules.numFailedTests,
  browserPasses: cloud.stats.expected, browserFailures: cloud.stats.unexpected,
  writingBrowserPasses: browser.stats.expected, writingBrowserFailures: browser.stats.unexpected,
  crashRecoveries: crash.checkpoints.filter(point => point.recovered).length,
  visualInspection: review,
  limits: 'Desktop/mobile Chromium viewport and emulator execution do not establish physical Android/iPhone keyboards, Safari, screen-reader comfort or human author acceptance. Private author rereading grants no publication or AI approval. Paper-turn motion is a restrained visual leaf effect; full physical paper simulation is not claimed. No per-page-turn Firestore write; server inventories are actual emulator evidence, not production usage measurements. Retained pre-migration evidence records its actual context; all final development and verification use the verified F checkout.'
};
await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, clientPasses: manifest.clientPasses, rulePasses: manifest.rulePasses, cloudBrowser: manifest.browserPasses, writingBrowser: manifest.writingBrowserPasses, crashRecoveries: manifest.crashRecoveries }));
