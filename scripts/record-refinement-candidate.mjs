// Record only after the actual tests and visual review. Historical candidates
// stay intact; this manifest binds the source for the October 24 refinements.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function list(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item => item.isDirectory() ? list(directory + '/' + item.name) : directory + '/' + item.name))).flat(); }
const evidence = 'docs/evidence/phase1/refinement-2026-10-24';
const sourcePaths = [...await list('src'), ...await list('public'), ...await list('tests'),
  'package.json', 'package-lock.json', 'firebase.json', 'firestore.rules', '.firebaserc', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html',
  'firebase.spark-test.json', 'playwright.spark.config.ts', 'playwright.config.ts', 'deployment/firebase-binding.json',
  'functions/package.json', 'functions/package-lock.json', 'functions/scripts/prepare-spark-release.mjs', 'functions/scripts/deploy-spark-rules.mjs',
  '.github/workflows/firebase-deploy.yml', '.github/workflows/phase1-ci.yml', 'scripts/record-refinement-candidate.mjs', 'scripts/verify-deployment-candidate.mjs', 'scripts/verify-hosted.mjs'];
const inventory = async paths => Promise.all([...new Set(paths)].sort().map(async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
const cloud = JSON.parse(await readFile(evidence + '/spark-browser-results.json', 'utf8'));
const browser = JSON.parse(await readFile(evidence + '/browser-results.json', 'utf8'));
const rules = await readFile(evidence + '/rules.log', 'utf8');
const client = await readFile(evidence + '/client.log', 'utf8');
if (cloud.stats.unexpected || cloud.stats.expected !== 5 || browser.stats.unexpected || browser.stats.expected !== 17 || !/11 passed/.test(rules) || !/47 passed/.test(client)) throw new Error('Actual refinement checks must pass before recording.');
const sources = await inventory(sourcePaths), files = (await list(evidence)).filter(path => !path.endsWith('/manifest.json'));
const manifest = {
  capturedAt: new Date().toISOString(), plan: 'Spark', scope: 'Themed collection movement, paragraph indentation, quiet minute uploads and live clean-device refresh',
  dataset: 'Invented synthetic fixtures through real application, Auth/Firestore emulators and Chromium. No production manuscript or login bypass.',
  sourceDigest: hash(JSON.stringify(sources)), sources,
  renders: await inventory(files.filter(path => path.endsWith('.png'))), testEvidence: await inventory(files.filter(path => !path.endsWith('.png'))),
  localUnconfiguredBuild: await inventory(await list('dist')),
  browserPasses: cloud.stats.expected, browserFailures: cloud.stats.unexpected, writingBrowserPasses: browser.stats.expected, writingBrowserFailures: browser.stats.unexpected,
  clientPasses: 47, rulePasses: 11, ruleFailures: 0,
  visualInspection: { result: 'Parent and independent critic personally inspected actual desktop and mobile renders. Themed menu, per-paragraph first-line layout and mobile More controls have no visible blocker.', desktop: '1440x1000', mobile: ['390x844', '320x844'], independentLiveInteraction: false },
  limits: 'Synthetic browser/emulator evidence is distinct from owner production sign-in, physical mobile keyboard/IME, screen-reader and independent backup acceptance. Initial metadata reads and every retained revision still have Firestore cost. Actual hosted release must verify its own configured assets.',
};
await writeFile(evidence + '/manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ sourceDigest: manifest.sourceDigest, sources: sources.length, renders: manifest.renders.length, evidence: manifest.testEvidence.length }));
