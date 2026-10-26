// Read-only release metadata. Never print credentials or manuscripts.
import { applicationDefault } from 'firebase-admin/app';
const project = process.env.VERIFIED_PROJECT;
if (project !== 'noveliaa') throw new Error('Expected verified project noveliaa.');
const token = await applicationDefault().getAccessToken();
const get = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  return response.ok ? data : { status: response.status, error: data.error?.status, message: data.error?.message };
};
const requested = ['serviceusage.services.get', 'firebasehosting.sites.update', 'firebaserules.rulesets.create', 'firebaserules.releases.update'];
const requiredServices = ['cloudfunctions.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'run.googleapis.com', 'eventarc.googleapis.com', 'pubsub.googleapis.com', 'storage.googleapis.com', 'cloudbilling.googleapis.com'];
const services = await Promise.all(requiredServices.map(async service => {
  const result = await get(`https://serviceusage.googleapis.com/v1/projects/278082781314/services/${service}`);
  return { service, state: result.state ?? 'UNKNOWN', ...(result.status ? { status: result.status, error: result.error } : {}) };
}));
const [firebase, apps, hosting, database, google, auth, permissions] = await Promise.all([
  get(`https://firebase.googleapis.com/v1beta1/projects/${project}`),
  get(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`),
  get(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/noveliaa`),
  get(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com?fields=enabled`),
  get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config?fields=authorizedDomains`),
  get(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:testIamPermissions`, { method: 'POST', body: JSON.stringify({ permissions: requested }) }),
]);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), planConstraint: 'Approved Blaze plugin; read only, no billing/IAM/API changes', services, disabledServices: services.filter(item => item.state === 'DISABLED').map(item => item.service), firebase, apps, hosting, database, google, auth, permissions }, null, 2));
