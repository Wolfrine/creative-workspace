import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { budgetDefinition, ensureBudget, ensureArtifactCleanup, verifyFunctionLimits } from '../scripts/configure-cost-controls.mjs';
const policy = JSON.parse(await readFile(new URL('../../deployment/cost-policy.json', import.meta.url), 'utf8'));
const account = 'billingAccounts/TEST-ACCOUNT';
function budgetApi(existing = [], currency = 'INR') {
  const writes = []; let budgets = structuredClone(existing);
  const request = async (url, init = {}) => {
    if (url.endsWith('/billingInfo')) return { billingEnabled: true, billingAccountName: account };
    if (init.method === 'POST') {
      const body = JSON.parse(init.body); assert.equal(body.amount.specifiedAmount.currencyCode, currency);
      const created = { ...body, name: account + '/budgets/test' }; writes.push(body); budgets.push(created); return created;
    }
    if (url.includes('?pageSize=')) return { budgets };
    return budgets.find(b => url.endsWith(b.name));
  };
  return { request, writes };
}
test('project-only INR100 actual-spend alert, not a cap', () => {
  const definition = budgetDefinition(policy);
  assert.deepEqual(definition.budgetFilter.projects, ['projects/278082781314']);
  assert.equal(definition.spendCap, undefined); assert.equal(definition.amount.specifiedAmount.currencyCode, 'INR');
  assert.throws(() => budgetDefinition({ ...policy, monthlyUnits: '1000' }));
  assert.throws(() => budgetDefinition({ ...policy, projectId: 'another-project' }));
});
test('first budget creates once; later execution verifies without writing', async () => {
  const api = budgetApi(); assert.equal((await ensureBudget(api.request, policy)).created, true);
  assert.equal((await ensureBudget(api.request, policy)).created, false); assert.equal(api.writes.length, 1);
});
test('does not modify other budgets', async () => {
  const unrelated = { displayName: 'Other project', amount: { specifiedAmount: { units: '500' } } };
  const api = budgetApi([unrelated]); await ensureBudget(api.request, policy);
  assert.equal(api.writes.length, 1); assert.equal(api.writes[0].displayName, policy.budgetDisplayName);
});
test('duplicate name or existing drift stops without writes', async () => {
  const item = { ...budgetDefinition(policy), name: account + '/budgets/test' };
  for (const items of [[item, item], [{ ...item, budgetFilter: { ...item.budgetFilter, projects: [] } }], [{ ...item, spendCap: {} }]]) {
    const api = budgetApi(items); await assert.rejects(ensureBudget(api.request, policy)); assert.equal(api.writes.length, 0);
  }
});
test('no currency conversion, billing link or permission changes', async () => {
  const api = budgetApi([], 'USD'); await assert.rejects(ensureBudget(api.request, policy)); assert.equal(api.writes.length, 0);
  let calls = 0;
  await assert.rejects(ensureBudget(async () => { calls++; throw Object.assign(new Error('HTTP403'), { status: 403 }); }, policy), /HTTP403/);
  assert.equal(calls, 1);
});
test('budget create response requires readback to report verified', async () => {
  const api = budgetApi();
  await assert.rejects(ensureBudget(async (url, init) => url.endsWith('/budgets/test') ? { ...budgetDefinition(policy), amount: {} } : api.request(url, init), policy));
});
test('budget pagination does not create a duplicate on a later page', async () => {
  const item = { ...budgetDefinition(policy), name: account + '/budgets/test' }; let writes = 0;
  const result = await ensureBudget(async (url, init) => {
    if (init?.method) writes++;
    if (url.endsWith('/billingInfo')) return { billingEnabled: true, billingAccountName: account };
    if (url.includes('pageToken=')) return { budgets: [item] };
    if (url.includes('?pageSize=')) return { nextPageToken: 'next' };
    return item;
  }, policy);
  assert.equal(result.created, false); assert.equal(writes, 0);
});
test('console INR25 budget with INR100 fourth warning prevents duplicate creation', async () => {
  const item = { ...budgetDefinition(policy), displayName: 'Firebase Project noveliaa', name: account + '/budgets/test',
    amount: { specifiedAmount: { currencyCode: 'INR', units: '25' } },
    thresholdRules: [0.5, 0.9, 1, 4].map(thresholdPercent => ({ thresholdPercent, spendBasis: 'CURRENT_SPEND' })) };
  const api = budgetApi([item]); const result = await ensureBudget(api.request, policy);
  assert.equal(result.created, false); assert.equal(result.budgetBasis, 'INR 25'); assert.equal(api.writes.length, 0);
});
function artifactApi(repository) {
  const writes = []; let repo = structuredClone(repository);
  const request = async (url, init = {}) => {
    assert(url.startsWith('https://artifactregistry.googleapis.com/v1/projects/noveliaa/locations/asia-south1/repositories/gcf-artifacts'));
    if (init.method === 'PATCH') { const body = JSON.parse(init.body); writes.push(body); repo = { ...repo, ...body }; }
    return repo;
  };
  return { request, writes };
}
test('artifact cleanup preserves other policies and labels; repeat has no write', async () => {
  const other = { action: 'KEEP', mostRecentVersions: { keepCount: 2 } };
  const api = artifactApi({ name: 'projects/noveliaa/locations/asia-south1/repositories/gcf-artifacts', labels: { keep: 'true', 'firebase-functions-cleanup-opted-out': 'true' }, cleanupPolicies: { other } });
  assert.equal((await ensureArtifactCleanup(api.request, policy)).changed, true);
  assert.deepEqual(api.writes[0].cleanupPolicies.other, other); assert.deepEqual(api.writes[0].labels, { keep: 'true' });
  assert.equal((await ensureArtifactCleanup(api.request, policy)).changed, false); assert.equal(api.writes.length, 1);
});
test('missing artifact repository is pending before deployment, fails final verification', async () => {
  const missing = async () => { throw Object.assign(new Error('HTTP404'), { status: 404 }); };
  assert.equal((await ensureArtifactCleanup(missing, policy, true)).status, 'awaiting-first-function-build');
  await assert.rejects(ensureArtifactCleanup(missing, policy));
});
test('artifact write must be read back and dry-run must be off', async () => {
  const fake = async () => ({ name: 'test', cleanupPolicyDryRun: true });
  await assert.rejects(ensureArtifactCleanup(fake, policy));
});
test('actual function must be active with exact approved instance/concurrency limits', async () => {
  const fn = { state: 'ACTIVE', serviceConfig: { maxInstanceCount: 2, maxInstanceRequestConcurrency: 1 } };
  assert.equal((await verifyFunctionLimits(async () => fn)).minimumInstances, 0);
  for (const change of [{ minInstanceCount: 1 }, { maxInstanceCount: 3 }, { maxInstanceRequestConcurrency: 80 }]) await assert.rejects(verifyFunctionLimits(async () => ({ ...fn, serviceConfig: { ...fn.serviceConfig, ...change } })));
});
