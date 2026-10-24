// The app candidate is unchanged. Preserve its published evidence and bind
// the separately tested monitoring diagnostics/fallback without rewriting it.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const basePath = 'docs/evidence/phase1/sync-2026-10-25/manifest.json';
const base = JSON.parse(await readFile(basePath, 'utf8'));
const operational = new Set(['.github/workflows/firestore-usage.yml', 'functions/scripts/firestore-usage.mjs', 'scripts/summarize-firestore-usage.mjs', 'scripts/firestore-usage.test.mjs', 'scripts/verify-deployment-candidate.mjs', 'docs/operations/firestore-usage.md']);
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
for (const item of [...base.sources.filter(item => !operational.has(item.path)), ...base.renders, ...base.testEvidence]) assert.equal(hash(await readFile(item.path)), item.sha256, 'Inherited app/evidence changed: ' + item.path);
const tests = 'docs/evidence/operations/2026-10-25-monitoring-audit-tests.log';
assert.match(await readFile(tests, 'utf8'), /pass 3/);
const sources = await inventory([...base.sources.map(item => item.path), 'scripts/record-usage-candidate.mjs']);
const manifest = { ...base, capturedAt: new Date().toISOString(), sourceDigest: hash(JSON.stringify(sources)), sources, testEvidence: [...base.testEvidence, ...await inventory([tests])], operationsEvidence: await inventory(['docs/evidence/operations/2026-10-25-firestore-baseline.md']), monitoringTests: 3, inheritedFrom: basePath, inheritanceReason: 'All application, Rules, browser tests, styles and original visual/integrity evidence byte-identical. Only aggregate monitoring diagnostics, fallback instructions and candidate verification path change; node monitoring tests rerun.' };
const directory = 'docs/evidence/phase1/sync-monitoring-2026-10-25'; await mkdir(directory, { recursive: true });
await writeFile(directory + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, inheritedAppUnchanged: true, monitoringTests: 3 }));
