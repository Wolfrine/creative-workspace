// Keep Firebase's normal deployment checks; recover only its first-build cleanup prompt.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { authenticatedRequest, ensureArtifactCleanup, reportCost, verifyFunctionLimits } from './configure-cost-controls.mjs';

const policy = JSON.parse(await readFile('deployment/cost-policy.json', 'utf8'));
const request = await authenticatedRequest();
await reportCost('plugin-artifacts', await ensureArtifactCleanup(request, policy, true));
async function publish() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'deploy', '--project', 'noveliaa', '--only', 'functions:noveliaa-plugin,hosting', '--non-interactive'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', bytes => { target.write(bytes); tail = (tail + bytes).slice(-32768); });
    child.on('error', reject); child.on('close', code => resolve({ code, tail }));
  });
}
let result = await publish();
if (result.code !== 0 && /Functions successfully deployed but could not set up cleanup policy in/.test(result.tail)) {
  // First deployment creates gcf-artifacts. No --force on deployment: unrelated
  // IAM/security/function deletion confirmations must still stop the release.
  await verifyFunctionLimits(request);
  await reportCost('plugin-artifacts', await ensureArtifactCleanup(request, policy));
  result = await publish();
}
if (result.code !== 0) process.exitCode = result.code || 1;
else {
  await reportCost('plugin-artifacts', await ensureArtifactCleanup(request, policy));
  await reportCost('plugin-function-limits', await verifyFunctionLimits(request));
}
