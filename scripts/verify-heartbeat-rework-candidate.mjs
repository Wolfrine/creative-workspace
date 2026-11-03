import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/heartbeat-rework-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(directory + '/manifest.json', 'utf8'));
assert.equal(manifest.schema, 'noveliaa-heartbeat-rework-evidence-1');
assert.equal(manifest.baseCommit, '73b8455337f0c4223fa8973fe072755bd622f23c');
assert.equal(manifest.priorOwnerVerdict, 'rejected');
assert.equal(manifest.ownerAcceptance, 'not inferred');
assert.equal(manifest.dataset, 'synthetic public renders; private source not published');
assert.equal(manifest.verdict, 'agent-reviewed');
assert.equal(manifest.central.version, '0.2.3');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest);
for (const item of [...manifest.sources, ...manifest.artifacts]) {
  assert(!item.path.includes('/private/'), 'Private source must not enter public evidence.');
  assert.equal(hash(await readFile(item.path)), item.sha256, 'Rework candidate changed: ' + item.path);
}
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
const paths = new Set(manifest.sources.map(item => item.path));
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'tests', 'plugin', '.github/workflows']) for (const path of await list(root)) assert(paths.has(path), 'Unrecorded current source: ' + path);
// Preserve every historical artifact and its declared source inventory; those
// old source bytes are not mistaken for the owner-rejected current candidate.
for (const path of ['docs/evidence/plugin-2026-10-25/manifest.json', 'docs/evidence/heartbeat-2026-11-03/manifest.json']) {
  const prior = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(hash(Buffer.from(JSON.stringify(prior.sources))), prior.sourceDigest);
  for (const item of prior.sources) assert(paths.has(item.path), 'Missing inherited source path: ' + item.path);
  for (const item of [...(prior.artifacts || []), ...(prior.renders || []), ...(prior.testEvidence || []), ...(prior.operationsEvidence || [])]) assert.equal(hash(await readFile(item.path)), item.sha256, 'Historical evidence changed: ' + item.path);
}
for (const [name, minimum] of Object.entries({ client: 98, functions: 37, rules: 16, mcpIntegration: 18, browser: 93, cloud: 11, evidence: 26, typecheck: 0, build: 0, packaging: 0 })) {
  const result = manifest.checks[name]; assert.equal(result.status, 'pass', 'Required check: ' + name); assert.equal(result.failures, 0);
  assert((result.passes || 0) >= minimum, 'Incomplete suite: ' + name);
  assert(manifest.artifacts.some(item => item.path === result.evidence), 'Unbound check evidence: ' + name);
}
assert(manifest.rounds.length >= 5 && manifest.rounds.length <= 10);
for (const round of manifest.rounds) assert(manifest.artifacts.some(item => item.path === round.evidence), 'Unbound review round');
for (const reviewer of ['critic', 'parent']) for (const name of ['narrative', 'craft', 'ergonomics', 'mobile', 'access', 'overall']) assert(manifest.visual[reviewer][name] >= 8, 'Visual gate: ' + reviewer + '/' + name);
assert.equal(manifest.visual.unresolvedBlockers, 0);
const currentVisual = JSON.parse(await readFile(directory + '/critic/' + manifest.visual.finalCapture + '/evidence.json', 'utf8'));
assert.equal(currentVisual.sourceStable, true);
for (const [path, digest] of Object.entries(currentVisual.hashes)) assert.equal(hash(await readFile(path)), digest, 'Final rendered source differs: ' + path);
for (const key of ['1366x768', '390x844', '320x568']) {
  const value = manifest.comparison[key]; assert(value.after.lines > value.before.lines); assert.equal(value.after.overflow, 0);
  for (const state of ['before', 'after']) assert(manifest.artifacts.some(item => item.path === value[state].screenshot), 'Missing comparison image');
}
assert.equal(manifest.continuity.uncoveredMeaningfulCharacters, 0);
assert.equal(manifest.continuity.blindReadings, 2);
console.log(JSON.stringify({ feature: 'Emotional Heartbeat rework', sourceDigest: manifest.sourceDigest, sources: manifest.sources.length, artifacts: manifest.artifacts.length, rounds: manifest.rounds.length, verdict: manifest.verdict }));
