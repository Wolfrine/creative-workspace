// Run after actual checks and visual inspection; prior evidence stays untouched.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item => item.isDirectory() ? list(directory + '/' + item.name) : directory + '/' + item.name))).flat(); }
const evidence = 'docs/evidence/phase1/sync-2026-10-25';
const previous = JSON.parse(await readFile('docs/evidence/phase1/workspace-reset-2026-10-24/manifest.json', 'utf8'));
const paths = [...previous.sources.map(item => item.path), ...await list('src'), ...await list('tests'), '.github/workflows/firestore-usage.yml', 'functions/scripts/firestore-usage.mjs', 'scripts/summarize-firestore-usage.mjs', 'scripts/firestore-usage.test.mjs', 'scripts/crash-recovery.mjs', 'scripts/record-sync-candidate.mjs', 'docs/SYNC.md', 'docs/operations/firestore-usage.md'];
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const browser = JSON.parse(await readFile(evidence + '/browser-results.json', 'utf8'));
const cloud = JSON.parse(await readFile(evidence + '/spark-browser-results.json', 'utf8'));
const client = await readFile(evidence + '/client.log', 'utf8'), rules = await readFile(evidence + '/rules.log', 'utf8');
const clientPasses = Number(client.match(/Tests\s+(\d+) passed/)?.[1]), rulePasses = Number(rules.match(/Tests\s+(\d+) passed/)?.[1]);
assert(clientPasses >= 71 && !/\d+ failed/.test(client)); assert(rulePasses >= 12 && !/\d+ failed/.test(rules));
assert.equal(cloud.stats.unexpected, 0); assert.equal(cloud.stats.expected, 7);
assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.expected, 23);
const crash = JSON.parse(await readFile(evidence + '/crash-recovery.json', 'utf8'));
assert.equal(crash.checkpoints.length, 20); assert(crash.checkpoints.every(point => point.recovered));
const review = JSON.parse(await readFile(evidence + '/visual-review.json', 'utf8')); assert.equal(review.result, 'pass');
const sources = await inventory(paths), files = (await list(evidence)).filter(path => !path.endsWith('/manifest.json'));
const isImage = path => /\.(png|jpg|jpeg)$/.test(path);
const manifest = { capturedAt: new Date().toISOString(), plan: 'Spark', scope: 'Owner-approved 10s device / 60s cloud idle save, local-only lifecycle recovery, quiet sync icon, current-state listeners and weekly aggregate Firestore monitoring', dataset: 'Synthetic author writing, actual Chromium/IndexedDB/Auth/Firestore emulator execution. Production usage and release separately verified after push; no production manuscript is used as a fixture.', sourceDigest: hash(JSON.stringify(sources)), sources, renders: await inventory(files.filter(isImage)), testEvidence: await inventory(files.filter(path => !isImage(path))), localUnconfiguredBuild: await inventory(await list('dist')), clientPasses, rulePasses, ruleFailures: 0, browserPasses: cloud.stats.expected, browserFailures: 0, writingBrowserPasses: browser.stats.expected, writingBrowserFailures: 0, crashRecoveries: 20, visualInspection: review, limits: 'Browser viewport/emulator checks do not establish physical phone/keyboard or human author acceptance. Existing immutable cloud format retained; actual per-revision write cost remains. Cold head ancestry is still loaded. Monitoring availability, daily observations and actual hosted assets must be read back separately.' };
await writeFile(evidence + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, clientPasses, rulePasses, cloudBrowser: cloud.stats.expected, writingBrowser: browser.stats.expected, crashRecoveries: 20 }));
