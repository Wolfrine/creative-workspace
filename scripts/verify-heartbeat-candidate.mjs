// Bind this feature's reviewed source, actual renders and test evidence.
// Historical plugin evidence remains immutable and is checked separately.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/heartbeat-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(directory + '/manifest.json', 'utf8'));
assert.equal(manifest.schema, 'noveliaa-heartbeat-evidence-1');
assert.equal(manifest.dataset, 'synthetic-only');
assert.equal(manifest.verdict, 'agent-reviewed');
assert.equal(manifest.ownerAcceptance, 'not inferred');
assert.equal(manifest.baseCommit, 'cfea728a56921a89786644b8a4af6a900be1124c');
assert.equal(manifest.central.version, '0.2.3');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest);
for (const item of [...manifest.sources, ...manifest.artifacts]) {
  assert.equal(hash(await readFile(item.path)), item.sha256, 'Heartbeat candidate changed: ' + item.path);
}
async function list(path) {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat();
}
const sourcePaths = new Set(manifest.sources.map(item => item.path));
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'tests', 'plugin', '.github/workflows']) {
  for (const path of await list(root)) assert(sourcePaths.has(path), 'Unrecorded source: ' + path);
}
const historical = JSON.parse(await readFile('docs/evidence/plugin-2026-10-25/manifest.json', 'utf8'));
for (const item of historical.sources) assert(sourcePaths.has(item.path), 'Missing inherited source path: ' + item.path);
for (const check of ['client', 'functions', 'rules', 'mcpIntegration', 'browser', 'cloud', 'typecheck', 'build', 'evidence']) {
  const result = manifest.checks[check];
  assert.equal(result.status, 'pass', 'Required check: ' + check);
  assert.equal(result.failures, 0, 'Required check failures: ' + check);
  assert(manifest.artifacts.some(item => item.path === result.evidence), 'Unbound check evidence: ' + check);
}
for (const [check, minimum] of Object.entries({ client: 93, functions: 34, rules: 16, mcpIntegration: 17, browser: 81, cloud: 11, evidence: 26 })) {
  assert(manifest.checks[check].passes >= minimum, 'Incomplete required suite: ' + check);
}
for (const viewport of ['1440', '390']) for (const mode of ['writer', 'reader']) {
  assert(manifest.artifacts.some(item => item.path.endsWith(`/baseline/${mode}-${viewport}.png`)), 'Missing baseline');
  assert(manifest.artifacts.some(item => item.path.endsWith(`/after/${mode}-${viewport}.png`)), 'Missing candidate render');
}
assert.equal(manifest.visual.critic, 'pass');
assert.equal(manifest.visual.parentQA, 'pass');
assert.equal(manifest.visual.unresolvedBlockers, 0);
console.log(JSON.stringify({ feature: 'Emotional Heartbeat', sourceDigest: manifest.sourceDigest, sources: manifest.sources.length, artifacts: manifest.artifacts.length, verdict: manifest.verdict }));
