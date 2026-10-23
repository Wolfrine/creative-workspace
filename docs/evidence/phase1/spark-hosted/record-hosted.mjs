import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url = 'https://noveliaa.web.app';
const sw = await (await fetch(url + '/sw.js', { cache: 'no-store' })).text();
const assetLine = sw.split('\n').find(line => line.startsWith('const ASSETS = '));
const paths = new Set([...assetLine.matchAll(/["'](\/[^"']*)["']/g)].map(match => match[1]).filter(path => path !== '/'));
paths.add('/sw.js');
const files = [];
for (const path of [...paths].sort()) {
  const response = await fetch(url + path, { cache: 'no-store' });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  files.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
assert.equal(files.length, 24);
const config = await (await fetch(url + '/__/firebase/init.json', { cache: 'no-store' })).json();
assert.equal(config.projectId, 'noveliaa'); assert.equal(config.appId, '1:278082781314:web:9a4b7acef07fa8e4dfb49b');
const denied = await fetch('https://firestore.googleapis.com/v1/projects/noveliaa/databases/(default)/documents/noveliaaWorkspaces/unsigned-probe/documents/missing');
assert.equal(denied.status, 403);
const result = { checkedAt: new Date().toISOString(), url, projectId: config.projectId, appId: config.appId, files, unsignedReadStatus: denied.status, releaseBuildComparison: 'Actions run 40000001285 compared all 24 files to its configured build and passed; this is an independent live-byte inventory.' };
await writeFile('docs/evidence/phase1/spark-hosted/files.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ files: files.length, project: config.projectId, appId: config.appId, unsignedReadStatus: denied.status }));
