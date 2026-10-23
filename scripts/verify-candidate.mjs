import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestPath = 'docs/evidence/phase1/round-6/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const source of manifest.sourceInventory) if (hash(await readFile(source.path)) !== source.sha256) throw new Error('Source changed after visual capture: ' + source.path);
for (const state of manifest.states) if (hash(await readFile(state.path)) !== state.sha256) throw new Error('Render digest differs: ' + state.path);
if (hash(await readFile('scripts/capture.mjs')) !== manifest.fixtureScriptSha256) throw new Error('Capture fixture changed.');
if (manifest.errors.length || !manifest.lowerCaret.visible || !manifest.shortToolbar.receivesPointer || manifest.axe.desktop.length || manifest.axe.mobile.length) throw new Error('Final visual QA includes unresolved failures.');
async function list(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? list(directory + '/' + entry.name) : directory + '/' + entry.name))).flat(); }
const buildFiles = [];
for (const file of (await list('dist')).sort()) { const bytes = await readFile(file); buildFiles.push({ path: file, bytes: bytes.length, sha256: hash(bytes) }); }
const artifacts = [];
for (const file of (await list('docs/evidence/phase1')).filter(file => !file.endsWith('/candidate.json')).sort()) artifacts.push({ path: file, sha256: hash(await readFile(file)) });
const tests = [];
for (const file of [...await list('tests'), ...await list('evals'), ...await list('src'), ...await list('functions/test'), ...await list('scripts')].filter(file => !file.includes('__pycache__') && (/test|spec|scripts\//.test(file))).sort()) tests.push({ path: file, sha256: hash(await readFile(file)) });
const record = { capturedAt: new Date().toISOString(), baseCommit: '055314bb8ec2f1e64624570bde31a9b2ade7d669', candidateSourceDigest: manifest.candidateSourceDigest, dataset: 'invented synthetic fixtures executed through real application, browser and emulator code; no author manuscript', visualManifest: manifestPath, visualManifestSha256: hash(await readFile(manifestPath)), buildFiles, tests, artifacts, deployed: false, verdict: 'Hash integrity and declared QA flags only; human/visual/release acceptance is separate.' };
await writeFile('docs/evidence/phase1/candidate.json', JSON.stringify(record, null, 2));
console.log(JSON.stringify({ candidateSourceDigest: record.candidateSourceDigest, verifiedSources: manifest.sourceInventory.length, renders: manifest.states.length, buildFiles: buildFiles.length, testAndScriptFiles: tests.length, evidenceFiles: artifacts.length }));
