// Retain the original visual evidence; allow only the independently verified
// Hosting site binding to differ from that candidate's Firebase configuration.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile('docs/evidence/phase1/round-6/manifest.json', 'utf8'));
const candidate = JSON.parse(await readFile('docs/evidence/phase1/candidate.json', 'utf8'));
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
assert.equal(binding.projectId, 'noveliaa');
assert.equal(binding.hostingSite, 'noveliaa');
assert.equal(binding.url, 'https://noveliaa.web.app');
let unchangedSources = 0;
for (const source of manifest.sourceInventory) {
  const bytes = await readFile(source.path);
  if (source.path === 'firebase.json') {
    const original = execFileSync('git', ['show', '82e930e803c1389906152c961811388786236f0d:firebase.json']);
    assert.equal(hash(original), source.sha256, 'Original Firebase config differs from reviewed evidence.');
    const current = JSON.parse(bytes);
    assert.equal(current.hosting.site, binding.hostingSite);
    delete current.hosting.site;
    assert.deepEqual(current, JSON.parse(original), 'Firebase changes exceed the verified Hosting site binding.');
  } else {
    assert.equal(hash(bytes), source.sha256, 'Source changed after visual capture: ' + source.path);
    unchangedSources++;
  }
}
for (const state of manifest.states) assert.equal(hash(await readFile(state.path)), state.sha256, 'Render changed: ' + state.path);
assert.equal(hash(await readFile('scripts/capture.mjs')), manifest.fixtureScriptSha256);
assert.equal(manifest.errors.length, 0);
assert.equal(manifest.lowerCaret.visible, true);
assert.equal(manifest.shortToolbar.receivesPointer, true);
assert.equal(manifest.axe.desktop.length + manifest.axe.mobile.length, 0);
for (const file of candidate.buildFiles) assert.equal(hash(await readFile(file.path)), file.sha256, 'Build changed: ' + file.path);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), originalCandidate: manifest.candidateSourceDigest, unchangedSources, configurationChange: 'Only hosting.site = noveliaa; .firebaserc and deployment scripts are separately reviewed deployment additions.', unchangedRenders: manifest.states.length, unchangedBuildFiles: candidate.buildFiles.length, deployed: false, verdict: 'The unconfigured production build and reviewed UI are unchanged. Authenticated live behavior remains unverified.' }, null, 2));
