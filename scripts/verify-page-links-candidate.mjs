import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/page-links-2026-11-03';
const manifest = JSON.parse(await readFile(directory + '/manifest.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.schema, 'noveliaa-page-links-evidence-1');
assert.equal(manifest.baseCommit, '3637a2c6e3b52c25edfbe0b6a1a84bf08c19b84f');
assert.equal(manifest.ownerAcceptance, 'not inferred');
assert.equal(manifest.central.lane, 'bounded refinement');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest);
const paths = new Set(manifest.sources.map(item => item.path));
for (const item of [...manifest.sources, ...manifest.artifacts]) assert.equal(hash(await readFile(item.path)), item.sha256, 'Reviewed candidate changed: ' + item.path);
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).filter(item => item.name !== '__pycache__').map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'functions/scripts', 'tests', 'plugin', 'scripts', '.github/workflows']) for (const path of await list(root)) assert(paths.has(path), 'Unrecorded source: ' + path);
// Preserve historical evidence; its old source inventory is not this candidate.
for (const name of ['plugin-2026-10-25', 'heartbeat-2026-11-03', 'heartbeat-rework-2026-11-03', 'heartbeat-current-2026-11-03']) {
  const previous = JSON.parse(await readFile(`docs/evidence/${name}/manifest.json`, 'utf8'));
  assert.equal(hash(Buffer.from(JSON.stringify(previous.sources))), previous.sourceDigest);
  for (const item of previous.sources) assert(paths.has(item.path), 'Missing inherited source path: ' + item.path);
  for (const item of [...(previous.artifacts || []), ...(previous.renders || []), ...(previous.testEvidence || []), ...(previous.operationsEvidence || [])]) assert.equal(hash(await readFile(item.path)), item.sha256, 'Historical evidence changed: ' + item.path);
}
for (const [name, count] of Object.entries({ client: 148, functions: 37, rules: 16, mcp: 19, evidence: 26, browser: 123, focusedBrowser: 16, cloud: 12, build: 0, typecheck: 0, 'functions-check': 0, package: 0 })) {
  assert.equal(manifest.checks[name].status, 'pass'); assert(manifest.checks[name].passes >= count);
  assert(manifest.artifacts.some(item => item.path === directory + '/' + manifest.checks[name].evidence));
}
const before = JSON.parse(await readFile(directory + '/before/measurements.json', 'utf8')), after = JSON.parse(await readFile(directory + '/after/measurements.json', 'utf8'));
for (const [i, current] of after.entries()) { assert.deepEqual(current.viewport, before[i].viewport); assert.equal(current.overflow, 0); assert.equal(current.book.height, before[i].book.height); assert.equal(current.header.height, before[i].header.height); }
assert.match(await readFile(directory + '/critic-review.md', 'utf8'), /no remaining visual blocker/);
console.log(JSON.stringify({ feature: 'private page links', sourceDigest: manifest.sourceDigest, sources: paths.size, ownerAcceptance: manifest.ownerAcceptance }));
