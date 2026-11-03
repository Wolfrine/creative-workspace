import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'docs/evidence/heartbeat-current-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(directory + '/manifest.json', 'utf8'));
assert.equal(manifest.schema, 'noveliaa-heartbeat-current-evidence-1');
assert.equal(manifest.baseCommit, '6044ccf324a9a2f0aab42e523b63384bedef75f8');
assert.equal(manifest.priorOwnerVerdict, 'rejected');
assert.equal(manifest.ownerAcceptance, 'not inferred');
assert.equal(manifest.dataset, 'synthetic public renders; no production manuscript writes');
assert.equal(manifest.central.version, '0.2.3');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest);
for (const item of [...manifest.sources, ...manifest.artifacts]) {
  assert(!item.path.includes('/private/'), 'Private source must not enter public evidence.');
  assert.equal(hash(await readFile(item.path)), item.sha256, 'Current candidate changed: ' + item.path);
}
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
const paths = new Set(manifest.sources.map(item => item.path));
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'tests', 'plugin', 'scripts', '.github/workflows']) {
  for (const path of await list(root)) assert(paths.has(path), 'Unrecorded current source: ' + path);
}
// Historical renders and declared source inventories remain immutable. Their
// old source bytes and internal visual scores do not describe this candidate.
for (const path of ['docs/evidence/plugin-2026-10-25/manifest.json', 'docs/evidence/heartbeat-2026-11-03/manifest.json', 'docs/evidence/heartbeat-rework-2026-11-03/manifest.json']) {
  const prior = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(hash(Buffer.from(JSON.stringify(prior.sources))), prior.sourceDigest);
  for (const item of prior.sources) assert(paths.has(item.path), 'Missing inherited source path: ' + item.path);
  for (const item of [...(prior.artifacts || []), ...(prior.renders || []), ...(prior.testEvidence || []), ...(prior.operationsEvidence || [])]) {
    assert.equal(hash(await readFile(item.path)), item.sha256, 'Historical evidence changed: ' + item.path);
  }
}
for (const [name, minimum] of Object.entries({ client: 129, functions: 37, rules: 16, mcpIntegration: 18, browser: 115, cloud: 11, evidence: 26, focusedBrowser: 52, typecheck: 0, build: 0, packaging: 0 })) {
  const result = manifest.checks[name];
  assert.equal(result.status, 'pass', 'Required check: ' + name);
  assert.equal(result.failures, 0);
  assert((result.passes || 0) >= minimum, 'Incomplete suite: ' + name);
  assert(manifest.artifacts.some(item => item.path === result.evidence), 'Unbound check evidence: ' + name);
}
assert(manifest.rounds.length >= 5 && manifest.rounds.length <= 10);
for (const round of manifest.rounds) assert(manifest.artifacts.some(item => item.path === round.evidence), 'Unbound review pass');
assert.equal(manifest.visual.humanParticipants, false);
assert.equal(manifest.visual.ownerAcceptance, 'not inferred');
assert(manifest.visual.blindReviewers >= 2);
assert.equal(manifest.visual.creatorSelfApproval, false);
assert.equal(manifest.visual.sourceStable, true);
for (const [path, digest] of Object.entries(manifest.visual.renderedSources)) assert.equal(hash(await readFile(path)), digest, 'Final rendered source differs: ' + path);
// Perception scores are evidence, not a programmable claim of owner approval.
// Preserve low scores and residual criticism rather than changing a threshold.
for (const key of ['1366x590', '1366x768', '390x700', '390x844', '320x568']) {
  const value = manifest.comparison[key];
  assert(value.after.lines >= value.before.lines, 'Prose capacity regressed: ' + key);
  assert(value.after.bookHeight >= value.before.bookHeight);
  assert(value.after.footerHeight <= 70);
  assert.equal(value.after.overflow, 0);
  assert.equal(value.after.fontSize, 20);
  assert.equal(value.after.lineHeight, 37);
  for (const state of ['before', 'after']) assert(manifest.artifacts.some(item => item.path === value[state].screenshot), 'Missing comparison image');
}
assert.equal(manifest.preservedBackend.changed, false);
assert.equal(manifest.preservedBackend.productionWrites, 0);
assert.equal(manifest.preservedBackend.pluginVersion, '0.1.2');
console.log(JSON.stringify({ feature: 'Emotional Heartbeat margin current', sources: manifest.sources.length, artifacts: manifest.artifacts.length, sourceDigest: manifest.sourceDigest, visualVerdict: manifest.visual.verdict, ownerAcceptance: manifest.ownerAcceptance }));
