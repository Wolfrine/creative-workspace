// Spark supersedes the original Functions/Storage candidate. Retain that original
// evidence; verify the new source and actual browser renders independently.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile('docs/evidence/phase1/library-reader-2026-10-25/manifest.json', 'utf8'));
assert.equal(manifest.plan, 'Spark');
assert.equal(hash(Buffer.from(JSON.stringify(manifest.sources))), manifest.sourceDigest, 'Candidate source inventory digest differs.');
for (const item of [...manifest.sources, ...manifest.renders, ...manifest.testEvidence, ...(manifest.operationsEvidence ?? [])]) {
  assert.equal(hash(await readFile(item.path)), item.sha256, 'Retained candidate changed: ' + item.path);
}
const firebase = JSON.parse(await readFile('firebase.json', 'utf8'));
assert.equal(firebase.hosting.site, 'noveliaa');
assert.equal(firebase.functions, undefined); assert.equal(firebase.storage, undefined);
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
assert.equal(binding.appId, '1:278082781314:web:9a4b7acef07fa8e4dfb49b');
assert.equal(binding.planConstraint, 'Spark');
assert.equal(manifest.browserFailures, 0); assert.equal(manifest.ruleFailures, 0);
assert.equal(manifest.writingBrowserFailures, 0); assert(manifest.browserPasses >= 10); assert(manifest.writingBrowserPasses >= 30);
assert(manifest.clientPasses >= 88); assert(manifest.rulePasses >= 15); assert.equal(manifest.visualInspection.result, 'pass');
assert.equal(manifest.crashRecoveries, 20);
console.log(JSON.stringify({ plan: 'Spark', sources: manifest.sources.length, actualRenders: manifest.renders.length, testEvidence: manifest.testEvidence.length, sourceDigest: manifest.sourceDigest, productionOwnerAcceptance: 'not inferred from emulator evidence' }));
