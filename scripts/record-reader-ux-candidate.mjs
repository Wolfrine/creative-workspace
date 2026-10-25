// Bind the populated-navigation and content-bearing-turn candidate; older
// release evidence is immutable and does not confer acceptance on this change.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/phase1/reader-ux-2026-10-25';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(`${path}/${item.name}`) : `${path}/${item.name}`))).flat(); }
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const base = await json('docs/evidence/phase1/library-reader-2026-10-25/manifest.json');
const client = await json(`${directory}/client-tests.json`);
const rules = await json(`${directory}/rules-tests.json`);
const browser = await json(`${directory}/browser-results.json`);
const cloud = await json(`${directory}/spark-browser-results.json`);
const crash = await json(`${directory}/crash-recovery.json`);
const review = await json(`${directory}/visual-review.json`);
const runtimePaths = (await list('src')).filter(path => /\.(tsx?|js|css)$/.test(path) && !path.endsWith('.test.ts')).sort();
const runtimeIdentity = hash(JSON.stringify(await Promise.all(runtimePaths.map(async path => [path, hash(await readFile(path))]))));
const finalCapture = await json(`${directory}/cycle-5/capture.json`);
const finalMotion = await json(`${directory}/cycle-5/motion/motion.json`);
const largeMotion = await json(`${directory}/cycle-5/large-motion/motion.json`);
assert.equal(finalCapture.sourceAfter, runtimeIdentity, 'Rendered final source differs from current runtime.');
assert.equal(finalMotion.sourceBefore, runtimeIdentity); assert.equal(finalMotion.sourceAfter, runtimeIdentity);
assert.equal(finalMotion.cases.length, 2); assert.equal(finalMotion.errors.length, 0);
assert.equal(largeMotion.sourceBefore, runtimeIdentity); assert.equal(largeMotion.sourceAfter, runtimeIdentity);
assert.equal(largeMotion.cases.length, 2); assert.equal(largeMotion.errors.length, 0); assert.equal(largeMotion.additionalProceduralStressWords, 50000);
assert(client.numPassedTests >= 89 && client.numFailedTests === 0);
assert(rules.numPassedTests >= 15 && rules.numFailedTests === 0);
assert(browser.stats.expected >= 53 && browser.stats.unexpected === 0 && browser.stats.skipped === 0);
assert(cloud.stats.expected >= 10 && cloud.stats.unexpected === 0 && cloud.stats.skipped === 0);
assert.equal(crash.checkpoints.length, 20); assert(crash.checkpoints.every(point => point.recovered));
assert.equal(review.result, 'pass'); assert.equal(review.ownerAcceptance, 'not inferred');
assert.equal(review.cycles.length, 5);
for (const cycle of review.cycles) {
  const capture = await json(`${directory}/cycle-${cycle.round}/capture.json`);
  assert.equal(capture.sourceBefore, capture.sourceAfter);
  assert(capture.captures.length >= 4 && capture.errors.length === 0);
  if (cycle.round <= 2) assert.equal(cycle.result, 'rejected; partial capture');
  else assert.equal(cycle.captureCompleted, true);
}
for (const score of Object.values(review.finalCriticScores)) assert(typeof score === 'number' && score >= 8 && score <= 10);
for (const score of Object.values(review.finalLeadScores)) assert(typeof score === 'number' && score >= 8 && score <= 10);
const extra = ['docs/design/READER_LIBRARY_UX.md', 'docs/design/populated-navigation-audit.md', 'docs/design/reader-library-ux-critic.md', 'docs/design/reader-library-ux-qa.md', 'docs/research/reader-motion-2026-10-25.md', ...await list('scripts')];
const sources = await inventory([...base.sources.map(item => item.path), ...await list('src'), ...await list('tests'), ...extra, '.gitattributes', 'package.json', 'package-lock.json']);
const retained = (await list(directory)).filter(path => !path.endsWith('/manifest.json'));
const image = path => /\.(png|jpe?g|webp)$/.test(path);
const manifest = {
  capturedAt: new Date().toISOString(), plan: 'Spark',
  scope: 'Owner-requested content-bearing page turns, Tile/List/Detailed Library, populated multi-universe navigation refinement. Private author rereading only; existing writing, originals, provenance and 10s/60s trailing-idle saves preserved.',
  dataset: 'Synthetic AI-generated unverified evaluation writing in isolated loopback DEV notebooks and actual Auth/Firestore emulators. No production manuscript accessed, seeded or reset.',
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
  limits: 'Actual Chromium viewport/transition recordings and emulators do not establish Safari, physical phone/keyboard, screen-reader comfort or owner acceptance. Historical reference videos do not establish current native Kindle/Play Books equivalence. Synthetic fiction is not author-approved canon. Reader and Library layout operations create no cloud writing; actual emulator inventories support the claim. Production usage is measured separately by the existing weekly review.'
};
await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, clientPasses: manifest.clientPasses, rulePasses: manifest.rulePasses, cloudBrowser: manifest.browserPasses, writingBrowser: manifest.writingBrowserPasses, crashRecoveries: manifest.crashRecoveries }));
