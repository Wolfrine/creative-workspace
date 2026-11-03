// Run only after inspecting the real check results and independent visual review.
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'docs/evidence/heartbeat-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
async function copy(source, target) { await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true }); await copyFile(source, target); }
for (const folder of ['baseline', 'after', 'backend', 'critic', 'real-browser', 'parent']) {
  for (const source of await list('.local/heartbeat/' + folder)) {
    // Keep deliberate evidence, excluding transient caches/profiles/downloads.
    if (!/\.(png|md|json|log|mjs)$/.test(source) || /\/(?:vite-cache|tmp|downloads|node_modules)\//.test(source)) continue;
    await copy(source, directory + source.slice('.local/heartbeat'.length));
  }
}
for (const name of ['client', 'rules', 'cloud', 'browser', 'typecheck', 'build', 'evidence', 'functions-check', 'usage-regression']) {
  await copy('.local/heartbeat/' + name + '.log', directory + '/checks/' + name + '.log');
}
await copy('.local/browser-results.json', directory + '/checks/browser-results.json');
await copy('.local/spark-browser-results.json', directory + '/checks/cloud-results.json');
await copy('.local/heartbeat/parent-qa.md', directory + '/parent-qa.md');
const browser = JSON.parse(await readFile(directory + '/checks/browser-results.json', 'utf8'));
const cloud = JSON.parse(await readFile(directory + '/checks/cloud-results.json', 'utf8'));
for (const result of [browser, cloud]) {
  assert.equal(result.stats.unexpected, 0); assert.equal(result.stats.skipped, 0); assert.equal(result.stats.flaky, 0);
  assert.equal(result.errors.length, 0);
}
assert(browser.stats.expected >= 81, 'The complete browser suite must run.');
assert(cloud.stats.expected >= 11, 'The complete authenticated cloud suite must run.');
const text = async path => {
  const bytes = await readFile(directory + '/' + path);
  // Windows PowerShell redirects native output as BOM-prefixed UTF-16LE.
  // Preserve original evidence bytes, decoding only for the result assertions.
  return bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8');
};
const checks = {
  client: { passes: 93, evidence: 'checks/client.log' },
  functions: { passes: 34, evidence: 'backend/functions-test.log' },
  rules: { passes: 16, evidence: 'checks/rules.log' },
  mcpIntegration: { passes: 17, evidence: 'backend/emulator-integration.log' },
  browser: { passes: browser.stats.expected, evidence: 'checks/browser-results.json' },
  cloud: { passes: cloud.stats.expected, evidence: 'checks/cloud-results.json' },
  typecheck: { evidence: 'checks/typecheck.log' }, build: { evidence: 'checks/build.log' },
  evidence: { passes: 26, evidence: 'checks/evidence.log' },
};
assert.match(await text(checks.client.evidence), /93 passed/);
assert.match(await text(checks.functions.evidence), /pass 34/);
assert.match(await text(checks.rules.evidence), /16 passed/);
assert.match(await text(checks.mcpIntegration.evidence), /pass 17/);
assert.match(await text(checks.evidence.evidence), /Ran 26 tests/);
assert.match(await text(checks.build.evidence), /built in/);
const prior = JSON.parse(await readFile('docs/evidence/plugin-2026-10-25/manifest.json', 'utf8'));
const paths = new Set(prior.sources.map(item => item.path));
for (const folder of ['src', 'public', 'functions/src', 'functions/test', 'functions/scripts', 'tests', 'plugin', '.github/workflows', 'scripts']) {
  for (const path of await list(folder)) if (!path.includes('__pycache__')) paths.add(path);
}
paths.add('docs/design/EMOTIONAL_HEARTBEAT.md');
const inventory = async paths => Promise.all([...paths].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const sources = await inventory(paths);
const artifacts = await inventory((await list(directory)).filter(path => !path.endsWith('/manifest.json')));
const manifest = {
  schema: 'noveliaa-heartbeat-evidence-1', recordedAt: new Date().toISOString(),
  baseCommit: 'cfea728a56921a89786644b8a4af6a900be1124c', dataset: 'synthetic-only',
  verdict: 'agent-reviewed', ownerAcceptance: 'not inferred',
  central: { version: '0.2.3', baseRevision: 'd097786cf3d6c5a2859439112afdd39538316567', method: 'bounded existing-product refinement' },
  topology: 'One existing native parent; separate backend, designer and read-only critic children; all child spawn calls accepted gpt-6.1-sol/xhigh. Parent integration/QA/delivery.',
  sources, sourceDigest: hash(Buffer.from(JSON.stringify(sources))), artifacts,
  historicalPluginManifest: 'docs/evidence/plugin-2026-10-25/manifest.json',
  checks: Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, { ...value, evidence: directory + '/' + value.evidence, status: 'pass', failures: 0 }])),
  visual: { critic: 'pass', parentQA: 'pass', unresolvedBlockers: 0, viewports: ['1440x1000', '390x844', '320x640 (browser assertions)'] },
  limits: ['Synthetic model annotations do not establish interpretation quality or author intent.', 'No production manuscripts read or written.', 'Real ChatGPT execution, author session and physical-device/IME acceptance remain separate.', 'Read considers newest50 exact-revision annotations before current grant filtering; older valid entries may be omitted, never deleted.', 'CSS Highlight unsupported browsers keep text labels without passage tint.'],
};
await writeFile(directory + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, artifacts: artifacts.length, checks: manifest.checks }));
