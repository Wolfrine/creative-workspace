// Bind reviewed local evidence to the complete current source inventory.
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const local = '.local/page-links', directory = 'docs/evidence/page-links-2026-11-03';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(path) { return (await Promise.all((await readdir(path, { withFileTypes: true })).filter(item => item.name !== '__pycache__').map(item => item.isDirectory() ? list(path + '/' + item.name) : path + '/' + item.name))).flat(); }
async function copy(source, target) { await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true }); await copyFile(source, target); }
function decoded(bytes) { return bytes[0] === 255 && bytes[1] === 254 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8'); }
const checks = { client: [148, /148 passed/], functions: [37, /pass 37/], rules: [16, /16 passed/], mcp: [19, /pass 19/], evidence: [26, /Ran 26 tests/], build: [0, /built in/], typecheck: [0, /tsc -b/], 'functions-check': [0, /node --check/], package: [0, /packaged byte equality and ZIP integrity passed/] };
for (const [name, [passes, pattern]] of Object.entries(checks)) {
  const source = `${local}/${name}.log`, bytes = await readFile(source);
  assert.match(decoded(bytes), pattern, 'Missing successful check: ' + name);
  await copy(source, `${directory}/checks/${name}.log`);
  checks[name] = { status: 'pass', passes, evidence: `checks/${name}.log` };
}
for (const [name, source, minimum] of [['browser', '.local/browser-results.json', 123], ['cloud', '.local/spark-browser-results.json', 12]]) {
  const result = JSON.parse(await readFile(source, 'utf8'));
  assert.equal(result.stats.unexpected, 0); assert.equal(result.stats.flaky, 0); assert.equal(result.stats.skipped, 0); assert.equal(result.errors.length, 0); assert(result.stats.expected >= minimum);
  await copy(source, `${directory}/checks/${name}.json`);
  checks[name] = { status: 'pass', passes: result.stats.expected, evidence: `checks/${name}.json` };
}
for (const phase of ['before', 'after']) for (const source of await list(`${local}/${phase}`)) await copy(source, directory + source.slice(local.length));
await copy(`${local}/critic-review.md`, `${directory}/critic-review.md`);
for (const name of ['browser-first.log', 'cloud-first.log']) await copy(`${local}/${name}`, `${directory}/checks/${name}`);
const paths = new Set(['firebase.json', 'package.json', 'tsconfig.json', 'vite.config.ts', 'docs/design/PAGE_LINKS.md']);
for (const name of ['plugin-2026-10-25', 'heartbeat-2026-11-03', 'heartbeat-rework-2026-11-03', 'heartbeat-current-2026-11-03']) for (const item of JSON.parse(await readFile(`docs/evidence/${name}/manifest.json`, 'utf8')).sources) paths.add(item.path);
for (const root of ['src', 'public', 'functions/src', 'functions/test', 'functions/scripts', 'tests', 'plugin', 'scripts', '.github/workflows']) for (const path of await list(root)) paths.add(path);
const inventory = async paths => Promise.all([...paths].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const sources = await inventory(paths), artifacts = await inventory((await list(directory)).filter(path => !path.endsWith('/manifest.json')));
const manifest = { schema: 'noveliaa-page-links-evidence-1', baseCommit: '3637a2c6e3b52c25edfbe0b6a1a84bf08c19b84f', recordedAt: new Date().toISOString(), dataset: 'synthetic loopback DEV notebooks and actual Auth/Firestore emulators', route: '/u/{universeId}/{collection-slug}/{title-slug}/{documentId}', central: { version: '0.2.3', baseRevision: 'd097786cf3d6c5a2859439112afdd39538316567', lane: 'bounded refinement' }, topology: 'parent implementation and QA; independent read-only visual critic', ownerAcceptance: 'not inferred', sources, sourceDigest: hash(Buffer.from(JSON.stringify(sources))), artifacts, checks };
await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sources: sources.length, artifacts: artifacts.length, checks, sourceDigest: manifest.sourceDigest }));
