// Run after the actual checks and desktop/mobile inspection. Older release
// evidence remains immutable; this manifest binds the authorized reset repair.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item => item.isDirectory() ? list(directory + '/' + item.name) : directory + '/' + item.name))).flat(); }
const evidence = 'docs/evidence/phase1/workspace-reset-2026-10-24';
const previous = JSON.parse(await readFile('docs/evidence/phase1/refinement-2026-10-24/manifest.json', 'utf8'));
const paths = [...previous.sources.map(item => item.path), ...await list('src'), ...await list('tests'), 'deployment/workspace-reset-request.json', 'functions/scripts/reset-workspace.mjs', 'scripts/record-workspace-reset-candidate.mjs'];
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const cloud = JSON.parse(await readFile(evidence + '/spark-browser-results.json', 'utf8'));
const browser = JSON.parse(await readFile(evidence + '/browser-results.json', 'utf8'));
const client = await readFile(evidence + '/client.log', 'utf8'), rules = await readFile(evidence + '/rules.log', 'utf8');
const clientPasses = Number(client.match(/Tests\s+(\d+) passed/)?.[1]);
const rulePasses = Number(rules.match(/Tests\s+(\d+) passed/)?.[1]);
assert(clientPasses >= 58 && !/\d+ failed/.test(client)); assert(rulePasses >= 12 && !/\d+ failed/.test(rules));
assert.equal(cloud.stats.unexpected, 0); assert.equal(cloud.stats.expected, 7);
assert.equal(browser.stats.unexpected, 0); assert(browser.stats.expected >= 20);
const review = JSON.parse(await readFile(evidence + '/visual-review.json', 'utf8'));
assert.equal(review.result, 'pass');
const sources = await inventory(paths), files = (await list(evidence)).filter(path => !path.endsWith('/manifest.json'));
const images = path => /\.(png|jpg|jpeg)$/.test(path);
const manifest = {
  capturedAt: new Date().toISOString(), plan: 'Spark', scope: 'Explicit full workspace reset with retired-device write fencing; page-specific conflict review and acknowledged resolution',
  dataset: 'Synthetic fixtures in real app, IndexedDB, Auth/Firestore emulators and Chromium. Production reset is separately recorded after deployment; no manuscript in test fixtures.',
  sourceDigest: hash(JSON.stringify(sources)), sources, renders: await inventory(files.filter(images)), testEvidence: await inventory(files.filter(path => !images(path))),
  localUnconfiguredBuild: await inventory(await list('dist')),
  browserPasses: cloud.stats.expected, browserFailures: cloud.stats.unexpected, writingBrowserPasses: browser.stats.expected, writingBrowserFailures: browser.stats.unexpected,
  clientPasses, rulePasses, ruleFailures: 0, visualInspection: review,
  limits: 'Emulators and rendered browser viewports do not prove physical phone keyboard, screen-reader or human author acceptance. Retired offline caches are cleared after the updated connected app learns the active key; Rules deny retired cloud writes immediately. Downloaded archives remain outside app control.',
};
await writeFile(evidence + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, clientPasses, rulePasses, cloudBrowser: cloud.stats.expected, writingBrowser: browser.stats.expected }));
