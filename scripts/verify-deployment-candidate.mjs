// Verify this exact owner-approved plugin candidate, retaining earlier releases.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const heartbeat = existsSync('docs/evidence/heartbeat-2026-11-03/manifest.json');
const heartbeatRework = existsSync('docs/evidence/heartbeat-rework-2026-11-03/manifest.json');
const heartbeatCurrent = existsSync('docs/evidence/heartbeat-current-2026-11-03/manifest.json');
// A later feature binds the complete current source inventory. Do not rewrite
// or mistake the original plugin source hashes for the newly reviewed source.
if (existsSync('docs/evidence/page-links-2026-11-03/manifest.json')) await import('./verify-page-links-candidate.mjs');
else if (heartbeatCurrent) await import('./verify-heartbeat-current-candidate.mjs');
else if (heartbeatRework) await import('./verify-heartbeat-rework-candidate.mjs');
else if (heartbeat) await import('./verify-heartbeat-candidate.mjs');
const manifest = JSON.parse(await readFile('docs/evidence/plugin-2026-10-25/manifest.json', 'utf8'));
assert.equal(manifest.plan, 'Blaze');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest, 'Candidate source inventory digest differs.');
for (const item of [...(heartbeat ? [] : manifest.sources), ...manifest.renders, ...manifest.testEvidence, ...(manifest.operationsEvidence ?? [])]) {
  assert.equal(hash(await readFile(item.path)), item.sha256, 'Retained candidate changed: ' + item.path);
}
const firebase = JSON.parse(await readFile('firebase.json', 'utf8'));
assert.equal(firebase.hosting.site, 'noveliaa');
assert.equal(firebase.storage, undefined);
assert.equal(firebase.functions.length, 1); assert.equal(firebase.functions[0].source, 'functions'); assert.equal(firebase.functions[0].codebase, 'noveliaa-plugin');
const pkg = JSON.parse(await readFile('functions/package.json', 'utf8')); assert.equal(pkg.main, 'src/mcp-entry.mjs');
const entry = await readFile('functions/src/mcp-entry.mjs', 'utf8'); assert.deepEqual([...entry.matchAll(/^export const (\w+)/gm)].map(m => m[1]), ['noveliaaMcp']);
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
assert.equal(binding.appId, '1:278082781314:web:9a4b7acef07fa8e4dfb49b');
assert.equal(binding.planConstraint, 'Blaze');
assert.equal(manifest.browserFailures, 0); assert.equal(manifest.ruleFailures, 0);
assert.equal(manifest.writingBrowserFailures, 0); assert(manifest.browserPasses >= 10); assert(manifest.writingBrowserPasses >= 61);
assert(manifest.clientPasses >= 89); assert(manifest.rulePasses >= 15); assert.equal(manifest.visualInspection.result, 'agent-reviewed');
assert.equal(manifest.integrationPasses, 13); assert.equal(manifest.integrationFailures, 0);
assert.equal(manifest.priorCrashRecoveries, 20);
console.log(JSON.stringify({ plan: 'Blaze', sources: manifest.sources.length, actualRenders: manifest.renders.length, testEvidence: manifest.testEvidence.length, sourceDigest: manifest.sourceDigest, productionOwnerAcceptance: 'not inferred from emulator evidence' }));
