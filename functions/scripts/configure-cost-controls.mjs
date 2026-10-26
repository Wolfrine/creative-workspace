// Owner-approved operational settings. Never inspect writing or print account IDs/tokens.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { applicationDefault } from 'firebase-admin/app';

export function budgetDefinition(policy) {
  assert.equal(policy.projectId, 'noveliaa'); assert.equal(policy.projectNumber, '278082781314');
  assert.equal(policy.currencyCode, 'INR'); assert.equal(policy.monthlyUnits, '100'); assert.equal(policy.alertThreshold, 1);
  return {
    displayName: policy.budgetDisplayName,
    budgetFilter: { projects: ['projects/' + policy.projectNumber], calendarPeriod: 'MONTH', creditTypesTreatment: 'INCLUDE_ALL_CREDITS' },
    amount: { specifiedAmount: { currencyCode: 'INR', units: '100', nanos: 0 } },
    thresholdRules: [{ thresholdPercent: 1, spendBasis: 'CURRENT_SPEND' }],
    notificationsRule: { disableDefaultIamRecipients: false, enableProjectLevelRecipients: true },
  };
}

export function assertBudget(actual, expected) {
  assert.equal(actual.displayName, expected.displayName);
  assert.deepEqual(actual.budgetFilter?.projects, expected.budgetFilter.projects);
  assert.equal(actual.budgetFilter?.calendarPeriod, 'MONTH');
  assert.equal(actual.budgetFilter?.creditTypesTreatment ?? 'INCLUDE_ALL_CREDITS', 'INCLUDE_ALL_CREDITS');
  for (const field of ['services', 'subaccounts', 'resourceAncestors', 'creditTypes']) assert.equal(actual.budgetFilter?.[field]?.length ?? 0, 0, 'Unexpected budget restriction: ' + field);
  assert.equal(Object.keys(actual.budgetFilter?.labels ?? {}).length, 0);
  assert.equal(actual.amount?.specifiedAmount?.currencyCode, 'INR');
  assert.equal(actual.amount?.specifiedAmount?.units, '100'); assert.equal(actual.amount?.specifiedAmount?.nanos ?? 0, 0);
  assert.deepEqual(actual.thresholdRules, expected.thresholdRules);
  assert.equal(actual.notificationsRule?.disableDefaultIamRecipients ?? false, false);
  assert.equal(actual.notificationsRule?.enableProjectLevelRecipients, true);
  assert.equal(actual.spendCap, undefined, 'A warning must never become a spend cap.');
}

export async function ensureBudget(request, policy) {
  const desired = budgetDefinition(policy);
  const billing = await request('https://cloudbilling.googleapis.com/v1/projects/noveliaa/billingInfo');
  assert.equal(billing.billingEnabled, true, 'Billing is not enabled; no billing link will be changed.');
  assert.match(billing.billingAccountName ?? '', /^billingAccounts\/[A-Z0-9-]+$/);
  const base = 'https://billingbudgets.googleapis.com/v1/' + billing.billingAccountName + '/budgets';
  const matches = [];
  let pageToken;
  do {
    const page = await request(base + '?pageSize=100' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
    matches.push(...(page.budgets ?? []).filter(b => b.displayName === desired.displayName));
    pageToken = page.nextPageToken;
  } while (pageToken);
  assert(matches.length <= 1, 'Duplicate warning names require owner review; no budgets changed.');
  let actual = matches[0], created = false;
  if (actual) assertBudget(actual, desired); // Never overwrite an existing, different budget.
  else { actual = await request(base, { method: 'POST', body: JSON.stringify(desired) }); created = true; }
  assert(actual.name?.startsWith(billing.billingAccountName + '/budgets/'));
  assert.match(actual.name.split('/').at(-1), /^[A-Za-z0-9_-]+$/);
  const verified = await request('https://billingbudgets.googleapis.com/v1/' + actual.name);
  assertBudget(verified, desired);
  return { status: 'verified', created, project: policy.projectId, monthlyAmount: 'INR 100', scope: 'this project, all services, after credits', threshold: '100% actual spend', recipients: 'default billing recipients and project owners', spendingCap: false };
}

export async function ensureArtifactCleanup(request, policy, allowMissing = false) {
  assert.equal(policy.projectId, 'noveliaa'); assert.equal(policy.region, 'asia-south1');
  assert.equal(policy.artifactRetentionSeconds, '86400s');
  const url = 'https://artifactregistry.googleapis.com/v1/projects/noveliaa/locations/asia-south1/repositories/gcf-artifacts';
  let repository;
  try { repository = await request(url); }
  catch (error) { if (allowMissing && error.status === 404) return { status: 'awaiting-first-function-build' }; throw error; }
  const id = 'firebase-functions-cleanup';
  const desired = { id, action: 'DELETE', condition: { tagState: 'ANY', olderThan: '86400s' } };
  let changed = false;
  if (!isDeepStrictEqual(repository.cleanupPolicies?.[id], desired) || (repository.cleanupPolicyDryRun ?? false) !== false || repository.labels?.['firebase-functions-cleanup-opted-out']) {
    // Only the default Functions image repository; retain every other policy and label.
    const labels = { ...repository.labels }; delete labels['firebase-functions-cleanup-opted-out'];
    await request(url + '?updateMask=cleanupPolicies,cleanupPolicyDryRun,labels', {
      method: 'PATCH', body: JSON.stringify({ name: repository.name, cleanupPolicies: { ...repository.cleanupPolicies, [id]: desired }, cleanupPolicyDryRun: false, labels }),
    }); changed = true;
  }
  const verified = await request(url);
  assert.equal(verified.cleanupPolicyDryRun ?? false, false);
  assert.deepEqual(verified.cleanupPolicies?.[id], desired);
  return { status: 'verified', changed, repository: 'asia-south1/gcf-artifacts', deleteBuildImagesOlderThan: '1 day', writingAndHistoryTouched: false };
}

export async function verifyFunctionLimits(request) {
  const fn = await request('https://cloudfunctions.googleapis.com/v2/projects/noveliaa/locations/asia-south1/functions/noveliaaMcp');
  assert.equal(fn.state, 'ACTIVE'); assert.equal(fn.serviceConfig?.minInstanceCount ?? 0, 0);
  assert.equal(fn.serviceConfig?.maxInstanceCount, 2); assert.equal(fn.serviceConfig?.maxInstanceRequestConcurrency, 1);
  return { status: 'verified', minimumInstances: 0, maximumInstances: 2, concurrency: 1, state: fn.state };
}

export async function authenticatedRequest() {
  assert.equal(process.env.VERIFIED_PROJECT, 'noveliaa', 'Expected verified project noveliaa.');
  const token = await applicationDefault().getAccessToken();
  return async (url, init = {}) => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`${new URL(url).hostname}: HTTP ${response.status} ${body.error?.status ?? 'request failed'}`);
      error.status = response.status; error.reason = body.error?.details?.find(d => d.reason)?.reason; throw error;
    }
    return body;
  };
}

export async function reportCost(name, result) {
  await mkdir('.local', { recursive: true });
  const report = { checkedAt: new Date().toISOString(), ...result };
  await writeFile('.local/' + name + '.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '### ' + name + '\n```json\n' + JSON.stringify(report, null, 2) + '\n```\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const policy = JSON.parse(await readFile('deployment/cost-policy.json', 'utf8'));
    await reportCost('plugin-budget', await ensureBudget(await authenticatedRequest(), policy));
  } catch (error) {
    await reportCost('plugin-budget', { status: 'unavailable', message: error.message, ...(error.reason ? { reason: error.reason } : {}), configured: false });
    process.exitCode = 1;
  }
}
