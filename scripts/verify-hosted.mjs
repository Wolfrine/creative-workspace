import { readdir, readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
assert.equal(binding.url, 'https://noveliaa.web.app');
assert.equal(binding.projectId, 'noveliaa');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
async function check(directory = 'dist', prefix = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) { await check(directory + '/' + item.name, relative + '/'); continue; }
    const expected = hash(await readFile(directory + '/' + item.name));
    const response = await fetch(binding.url + '/' + relative + '?release=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Hosted file missing: ' + relative);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), expected, 'Hosted bytes differ: ' + relative);
    files.push({ path: relative, sha256: expected });
  }
}
await check();
const response = await fetch(binding.url + '/__/firebase/init.json', { cache: 'no-store' });
assert.equal(response.status, 200);
const config = await response.json();
assert.equal(config.projectId, binding.projectId);
assert.equal(config.appId, binding.appId);
const result = { checkedAt: new Date().toISOString(), url: binding.url, projectId: config.projectId, appId: config.appId, files, authenticatedOwnerAcceptance: 'Requires the human owner Google account; no production Auth bypass or writing seed.' };
await mkdir('.local', { recursive: true });
await writeFile('.local/hosted-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ url: result.url, projectId: config.projectId, appId: config.appId, verifiedBuildFiles: files.length }));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '\nLive Noveliaa: ' + binding.url + '\n\nVerified all ' + files.length + ' hosted file digests and matching Firebase app/project. Owner Google sign-in acceptance remains a human check.\n');
