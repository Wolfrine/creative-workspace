// Supported Firebase Admin SDK Rules release, after CI's actual emulator tests.
// Uses the existing Actions identity's rulesets.create and releases.update access.
// No project:test/simulator permission, IAM expansion, API enablement or billing.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { readFile, appendFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
assert.equal(process.env.VERIFIED_PROJECT, 'noveliaa');
assert.equal(binding.projectId, 'noveliaa'); assert.equal(binding.planConstraint, 'Spark');
const source = await readFile('firestore.rules', 'utf8');
const hash = content => createHash('sha256').update(content).digest('hex');
const candidate = JSON.parse(await readFile('docs/evidence/phase1/reader-ux-2026-10-25/manifest.json', 'utf8'));
assert.equal(candidate.plan, 'Spark');
assert.equal(candidate.sources.find(item => item.path === 'firestore.rules')?.sha256, hash(source));
assert(candidate.rulePasses >= 15); assert.equal(candidate.ruleFailures, 0);
const rules = getSecurityRules(initializeApp({ credential: applicationDefault(), projectId: binding.projectId }));
const previous = await rules.getFirestoreRuleset();
const released = await rules.releaseFirestoreRulesetFromSource(source);
const current = await rules.getFirestoreRuleset();
assert.equal(current.name, released.name, 'Rules release readback differs.');
assert.equal(hash(current.source.find(file => file.name === 'firestore.rules')?.content ?? ''), hash(source), 'Deployed Rules source differs.');
const result = { checkedAt: new Date().toISOString(), projectId: binding.projectId, previousRuleset: previous.name, releasedRuleset: current.name, sha256: hash(source), emulatorChecks: candidate.rulePasses + ' passed in this workflow before release', method: 'Firebase Admin SDK releaseFirestoreRulesetFromSource; matching source readback verified' };
await mkdir('.local', { recursive: true });
await writeFile('.local/rules-release.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '\nFirestore Rules released and source digest readback verified: ' + current.name + '\n');
