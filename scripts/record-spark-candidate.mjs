// Run only after actual checks and visual inspection; this records evidence,
// it does not decide aesthetic quality or human/production acceptance.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item => item.isDirectory() ? list(directory + '/' + item.name) : directory + '/' + item.name))).flat();
}
const evidence = 'docs/evidence/phase1/spark';
const sourcePaths = [...await list('src'), ...await list('public'), ...await list('tests/helpers'), ...await list('tests/spark-browser'), ...await list('tests/browser'),
  'package.json', 'package-lock.json', 'firebase.json', 'firestore.rules', '.firebaserc', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html',
  'firebase.spark-test.json', 'playwright.spark.config.ts', 'playwright.config.ts', 'deployment/firebase-binding.json',
  'functions/package.json', 'functions/package-lock.json', 'functions/scripts/prepare-spark-release.mjs', 'functions/scripts/inspect-firebase.mjs',
  '.github/workflows/firebase-deploy.yml', '.github/workflows/phase1-ci.yml',
  'scripts/record-spark-candidate.mjs', 'scripts/verify-deployment-candidate.mjs', 'scripts/verify-hosted.mjs'];
const inventory = async paths => Promise.all(paths.sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const sources = await inventory(sourcePaths);
const files = (await list(evidence)).filter(path => !path.endsWith('/manifest.json'));
const browser = JSON.parse(await readFile(evidence + '/browser-results.json', 'utf8'));
const ruleLog = await readFile(evidence + '/rules.log', 'utf8');
if (browser.stats.unexpected || browser.stats.expected !== 3 || !/11 passed/.test(ruleLog)) throw new Error('Spark checks must actually pass before recording.');
const manifest = {
  capturedAt: new Date().toISOString(), plan: 'Spark', dataset: 'Invented synthetic writing through actual Auth/Firestore emulators and browser app; no live manuscript or production Auth bypass',
  sourceDigest: hash(JSON.stringify(sources)), sources,
  renders: await inventory(files.filter(path => path.endsWith('.png'))),
  testEvidence: await inventory(files.filter(path => !path.endsWith('.png'))),
  localUnconfiguredBuild: await inventory(await list('dist')),
  browserPasses: browser.stats.expected, browserFailures: browser.stats.unexpected, rulePasses: 11, ruleFailures: 0,
  visualInspection: { route: 'http://127.0.0.1:5820/', desktop: '1440x1000 authenticated writing and denied gate', mobile: '390x844 authenticated writing; 320x640 denied gate', result: 'Inspected renders: readable hierarchy, usable writing controls, no clipping or horizontal overflow. Desktop/mobile axe scans passed.' },
  limits: 'Emulators are not production owner sign-in, authenticated offline cold start, physical mobile keyboard/IME or independent backup acceptance. Hosted release must verify its own configured build digests.',
};
await writeFile(evidence + '/manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, evidence: manifest.testEvidence.length }));
