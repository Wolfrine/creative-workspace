// Read-only metadata projection. Never print credentials, tokens or manuscripts.
import { applicationDefault } from 'firebase-admin/app';
const project = process.env.VERIFIED_PROJECT;
if (!project || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error('Verified project ID required.');
const credential = applicationDefault();
const access = await credential.getAccessToken();
const get = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers: { Authorization: 'Bearer ' + access.access_token, 'Content-Type': 'application/json' } });
  const data = await response.json();
  return response.ok ? data : { status: response.status, error: data.error?.status || 'metadata unavailable' };
};
const [apps, billing, auth, google, iam, users] = await Promise.all([
  get(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`),
  get(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com`),
  get(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`, { method: 'POST', body: '{}' }),
  get(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=100&fields=users(localId,email,emailVerified,providerUserInfo(providerId)),nextPageToken`),
]);
const metadata = { project, apps: apps.apps ?? apps, billing: { billingEnabled: billing.billingEnabled, status: billing.status, error: billing.error },
  auth: auth.error ? auth : { authorizedDomains: auth.authorizedDomains, signIn: { allowDuplicateEmails: auth.signIn?.allowDuplicateEmails, emailEnabled: auth.signIn?.email?.enabled } },
  google: google.error ? google : { enabled: google.enabled, clientIdConfigured: !!google.clientId },
  humanOwners: iam.bindings?.filter(binding => binding.role === 'roles/owner').flatMap(binding => binding.members).filter(member => member.startsWith('user:')) ?? iam,
  users: users.users ?? users, moreUsers: !!users.nextPageToken };
console.log(JSON.stringify(metadata, null, 2));
