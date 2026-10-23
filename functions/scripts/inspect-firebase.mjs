// Read-only metadata projection. Never print credentials, tokens or manuscripts.
import { applicationDefault } from 'firebase-admin/app';
const project = process.env.VERIFIED_PROJECT;
if (!project || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error('Verified project ID required.');
const credential = applicationDefault();
const access = await credential.getAccessToken();
const get = async (url, init = {}) => {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), headers: { Authorization: 'Bearer ' + access.access_token, 'Content-Type': 'application/json' } });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data : { status: response.status, error: data.error?.status || 'metadata unavailable', message: data.error?.message };
  } catch { return { error: 'Metadata request did not complete' }; }
};
// CLI target permissions are read from the pinned firebase-tools deployment
// implementation. Testing permissions is read-only and never grants them.
const requestedPermissions = [
  'serviceusage.services.get', 'serviceusage.services.enable',
  'firebase.clients.create', 'firebasehosting.sites.update',
  'cloudfunctions.functions.list', 'cloudfunctions.functions.create',
  'cloudfunctions.functions.get', 'cloudfunctions.functions.update',
  'cloudfunctions.functions.delete', 'cloudfunctions.operations.get',
  'cloudfunctions.functions.setIamPolicy', 'iam.serviceAccounts.actAs',
  'run.services.setIamPolicy',
  'datastore.indexes.list', 'datastore.indexes.create',
  'datastore.indexes.update', 'datastore.indexes.delete',
  'firebaserules.releases.create', 'firebaserules.rulesets.create',
  'firebaserules.releases.update',
];
const [apps, billing, auth, google, iam, users, hosting, firebase, permissions, database, buckets, hostingService] = await Promise.all([
  get(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`),
  get(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com`),
  get(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`, { method: 'POST', body: '{}' }),
  get(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=100&fields=users(localId,email,emailVerified,providerUserInfo(providerId)),nextPageToken`),
  get(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites`),
  get(`https://firebase.googleapis.com/v1beta1/projects/${project}`),
  get(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:testIamPermissions`, { method: 'POST', body: JSON.stringify({ permissions: requestedPermissions }) }),
  get(`https://firestore.googleapis.com/v1/projects/${project}/databases`),
  get(`https://storage.googleapis.com/storage/v1/b?project=${project}&fields=items(name,location)`),
  get(`https://serviceusage.googleapis.com/v1/projects/${project}/services/firebasehosting.googleapis.com`),
]);
const publicConfigs = await Promise.all((apps.apps ?? []).map(app => get(`https://firebase.googleapis.com/v1beta1/${app.name}/config`)));
const metadata = { checkedAt: new Date().toISOString(), project, firebase, hosting, apps: apps.apps ?? apps, publicConfigs, billing: { billingEnabled: billing.billingEnabled, status: billing.status, error: billing.error },
  auth: auth.error ? auth : { authorizedDomains: auth.authorizedDomains, signIn: { allowDuplicateEmails: auth.signIn?.allowDuplicateEmails, emailEnabled: auth.signIn?.email?.enabled } },
  google: google.error ? google : { enabled: google.enabled, clientIdConfigured: !!google.clientId },
  humanOwners: iam.bindings?.filter(binding => binding.role === 'roles/owner').flatMap(binding => binding.members).filter(member => member.startsWith('user:')) ?? iam,
  users: users.users ?? users, moreUsers: !!users.nextPageToken,
  deploymentPermissions: permissions.error ? permissions : { granted: permissions.permissions ?? [], missing: requestedPermissions.filter(permission => !permissions.permissions?.includes(permission)) },
  database, buckets, hostingService: hostingService.error ? hostingService : { name: hostingService.name, state: hostingService.state } };
console.log(JSON.stringify(metadata, null, 2));
