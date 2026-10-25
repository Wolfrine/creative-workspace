// Retained exact-source proof; review and human approval are separate.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/plugin-2026-10-25';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const baseline = await json('docs/evidence/phase1/reader-ux-2026-10-25/manifest.json');
const client = await json(directory + '/checks/client-tests.json'), rules = await json(directory + '/checks/rules-tests.json');
const browser = await json(directory + '/checks/browser-results.json'), cloud = await json(directory + '/checks/spark-browser-results.json');
const review = await json(directory + '/ui/lead-review.json');
const integration = await readFile(directory + '/checks/mcp-integration.log', 'utf8');
assert(client.numPassedTests >= 89 && client.numFailedTests === 0);
assert(rules.numPassedTests >= 15 && rules.numFailedTests === 0);
assert(browser.stats.expected >= 61 && browser.stats.unexpected === 0 && browser.stats.skipped === 0 && browser.stats.flaky === 0);
assert(cloud.stats.expected >= 10 && cloud.stats.unexpected === 0 && cloud.stats.skipped === 0);
assert.match(integration, /(?:pass|# pass) 13/); assert.match(integration, /(?:fail|# fail) 0/);
assert.equal(review.result, 'agent-reviewed'); assert.equal(review.ownerAcceptance, 'not inferred'); assert.equal(review.cycles, 5);
for (const scores of [review.criticScores, review.leadScores]) for (const score of Object.values(scores)) assert(score >= 8 && score <= 10);
const final = (await list(directory + '/ui/final')).filter(p => p.endsWith('.json') && !p.endsWith('/browser-results.json'));
assert(final.length >= 20);
for (const path of final) {
  const evidence = await json(path);
  if (!evidence.sourceFiles) continue;
  for (const [path, digest] of Object.entries(evidence.sourceFiles)) assert.equal(hash(await readFile(path)), digest, 'Final rendered source changed: ' + path);
  assert.equal(evidence.sourceDigest, review.uiSourceDigest);
}
const sources = await inventory([...baseline.sources.map(item => item.path), ...await list('src'), ...await list('public'), ...await list('tests'), ...await list('functions/src'), ...await list('functions/test'), ...await list('functions/scripts'), ...await list('scripts'), ...await list('plugin'), ...await list('.github/workflows'),
  'AGENTS.md', 'INTENT.md', '.harness/objective.md', 'docs/ARCHITECTURE.md', 'docs/DEPLOYMENT.md', 'docs/design/PLUGIN_CONNECTION.md', 'package.json', 'package-lock.json', 'functions/package.json', 'functions/package-lock.json', 'firebase.json', 'firestore.rules', 'deployment/firebase-binding.json']);
const retained = (await list(directory)).filter(p => !p.endsWith('/manifest.json') && !p.includes('/release/'));
const image = p => /\.(png|jpg|webp)$/.test(p);
const manifest = { capturedAt: new Date().toISOString(), plan: 'Blaze',
  scope: 'Full private ChatGPT plugin: three skills, scoped OAuth/DCR, six MCP tools, author consent/review/revoke/export. MCP never modifies source writing.',
  dataset: 'Synthetic AI-origin unverified fixtures, loopback UI interception and actual Firebase Auth/Firestore emulators. No production manuscript seeded, reset or read.',
  sources, sourceDigest: hash(JSON.stringify(sources)), renders: await inventory(retained.filter(image)), testEvidence: await inventory(retained.filter(p => !image(p))),
  clientPasses: client.numPassedTests, rulePasses: rules.numPassedTests, ruleFailures: rules.numFailedTests,
  browserPasses: cloud.stats.expected, browserFailures: cloud.stats.unexpected, writingBrowserPasses: browser.stats.expected, writingBrowserFailures: browser.stats.unexpected,
  integrationPasses: 13, integrationFailures: 0, priorCrashRecoveries: baseline.crashRecoveries, visualInspection: review,
  limits: 'Chromium viewport QA is not physical-device/Safari/human acceptance. Public discovery does not prove installation, human consent or authenticated ChatGPT execution. No canon approval, publication, shared readers or Storage backup. Search scans bounded batches; unsynced device material is unavailable. Collaboration exports above24MiB require partitioned support export.' };
await writeFile(directory + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sourceFiles: sources.length, renders: manifest.renders.length, browser: manifest.writingBrowserPasses, integration: manifest.integrationPasses }));
