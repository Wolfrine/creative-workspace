// Standard Google-managed Functions identity recovery, not a new key or IAM grant.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applicationDefault } from 'firebase-admin/app';
import { authenticatedRequest, ensureArtifactCleanup, reportCost } from './configure-cost-controls.mjs';
assert.equal(process.env.VERIFIED_PROJECT, 'noveliaa');
const request = await authenticatedRequest();
const policy = JSON.parse(await readFile('deployment/cost-policy.json', 'utf8'));
const deployer = await applicationDefault().getServiceAccountEmail();
const managedServices = {
  'cloudfunctions.googleapis.com': 'service-278082781314@gcf-admin-robot.iam.gserviceaccount.com',
  'cloudbuild.googleapis.com': 'service-278082781314@gcp-sa-cloudbuild.iam.gserviceaccount.com',
  'run.googleapis.com': 'service-278082781314@serverless-robot-prod.iam.gserviceaccount.com',
};
for (const [service, expectedIdentity] of Object.entries(managedServices)) {
  let operation = await request(`https://serviceusage.googleapis.com/v1beta1/projects/278082781314/services/${service}:generateServiceIdentity`, { method: 'POST', body: '{}' });
  for (let attempt = 0; !operation.done && attempt < 15; attempt++) {
    assert.match(operation.name, /^operations\/[A-Za-z0-9_./-]+$/);
    await new Promise(resolve => setTimeout(resolve, 2000));
    operation = await request('https://serviceusage.googleapis.com/v1beta1/' + operation.name);
  }
  assert(operation.done, 'Service identity setup did not finish in the bounded wait: ' + service);
  assert(!operation.error, 'Service identity setup failed: ' + service + ' code ' + operation.error?.code);
  assert.equal(operation.response?.email, expectedIdentity);
}
const [projectPolicy, runtimeActAs, repository] = await Promise.all([
  request('https://cloudresourcemanager.googleapis.com/v1/projects/noveliaa:getIamPolicy', { method: 'POST', body: '{}' }),
  request('https://iam.googleapis.com/v1/projects/noveliaa/serviceAccounts/278082781314-compute@developer.gserviceaccount.com:testIamPermissions', { method: 'POST', body: JSON.stringify({ permissions: ['iam.serviceAccounts.actAs'] }) }),
  request('https://artifactregistry.googleapis.com/v1/projects/noveliaa/locations/asia-south1/repositories/gcf-artifacts'),
]);
await reportCost('plugin-bootstrap', { status: 'identity-ready', deployer, managedServices,
  serviceAgentRoles: Object.fromEntries(Object.entries(managedServices).map(([service, identity]) => [service, (projectPolicy.bindings ?? []).filter(b => b.members?.includes('serviceAccount:' + identity)).map(b => b.role)])),
  runtimeActAs: runtimeActAs.permissions?.includes('iam.serviceAccounts.actAs') ?? false,
  artifactPolicy: repository.cleanupPolicies?.['firebase-functions-cleanup'], artifactDryRun: repository.cleanupPolicyDryRun ?? false,
  arbitraryIamChanges: false, apiEnablement: false, keysCreated: false });
await reportCost('plugin-artifacts', await ensureArtifactCleanup(request, policy));
