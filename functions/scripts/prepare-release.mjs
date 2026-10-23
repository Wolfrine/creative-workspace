// Runs only inside the authorized GitHub Actions deployment. No credentials or
// manuscript are printed. Missing cloud setup blocks promotion, not authorship.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile, appendFile } from 'node:fs/promises';

const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
if (process.env.VERIFIED_PROJECT !== binding.projectId || binding.projectId !== 'noveliaa' || binding.hostingSite !== 'noveliaa') throw new Error('Deployment identity does not match the independently verified Noveliaa project/site.');
const credential = applicationDefault();
const token = await credential.getAccessToken();
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${result.error?.status || 'Firebase operation failed'}: ${result.error?.message || new URL(url).pathname}`);
  return result;
};
const project = binding.projectId;
const site = await request(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${binding.hostingSite}`);
if (site.defaultUrl !== binding.url) throw new Error('Hosting URL mismatch. Nothing was deployed.');
// Hosting versions/releases use sites.update; Firebase IAM has no separate
// firebasehosting.versions.create permission.
const granted = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:testIamPermissions`, { method: 'POST', body: JSON.stringify({ permissions: ['serviceusage.services.get', 'serviceusage.services.enable', 'firebase.clients.create', 'firebasehosting.sites.update'] }) });
console.log('Verified deployment permissions: ' + JSON.stringify(granted.permissions ?? []));
const missing = ['serviceusage.services.get', 'firebasehosting.sites.update'].filter(permission => !granted.permissions?.includes(permission));
if (missing.length) throw new Error('GitHub Actions deployment permissions missing: ' + missing.join(', ') + '. Project owner must grant the deployment identity the required permissions; this workflow does not expand its own IAM access.');

const apps = await request(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`);
let app = (apps.apps ?? []).find(candidate => candidate.appId === site.appId) ?? (apps.apps ?? []).find(candidate => candidate.displayName === 'Noveliaa');
if (!app && !(apps.apps ?? []).length) {
  let operation = await request(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`, { method: 'POST', body: JSON.stringify({ displayName: 'Noveliaa' }) });
  for (let attempt = 0; !operation.done && attempt < 30; attempt++) { await new Promise(resolve => setTimeout(resolve, 2000)); operation = await request(`https://firebase.googleapis.com/v1beta1/${operation.name}`); }
  if (operation.error || !operation.done) throw new Error('Web app registration did not complete. No Hosting release was published.');
  app = operation.response;
}
if (!app) throw new Error('Cannot unambiguously match a Firebase Web App to Noveliaa.');
const config = await request(`https://firebase.googleapis.com/v1beta1/${app.name}/config`);
const blockers = [];
const inspect = async (label, url) => { try { return await request(url); } catch (error) { blockers.push(label + ': ' + error.message); return null; } };
const [auth, google, database] = await Promise.all([
  inspect('Initialize Firebase Authentication', `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`),
  inspect('Enable Google sign-in', `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com`),
  inspect('Create the native Firestore database', `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`),
]);
if (google && !google.enabled) blockers.push('Enable Google sign-in for the verified Firebase app.');
if (!config.storageBucket) blockers.push('Initialize Firebase Storage and its default bucket, then verify billing prerequisites in the Firebase console.');
if (auth && !auth.authorizedDomains?.includes(new URL(binding.url).hostname)) blockers.push('Authorize noveliaa.web.app for Google sign-in.');
if (database && database.type !== 'FIRESTORE_NATIVE') blockers.push('The default database must use Firestore native mode.');
if (blockers.length) throw new Error('Cloud setup required before publishing a usable private app:\n' + blockers.join('\n'));
if (site.appId && site.appId !== app.appId) throw new Error('The Hosting site is linked to a different web app.');
if (!site.appId) await request(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${binding.hostingSite}?updateMask=appId`, { method: 'PATCH', body: JSON.stringify({ appId: app.appId }) });

const admin = initializeApp({ credential, projectId: project, storageBucket: config.storageBucket });
const author = await getAuth(admin).getUserByEmail(binding.authorEmail).catch(error => {
  if (error.code !== 'auth/user-not-found') throw error;
  return getAuth(admin).createUser({ email: binding.authorEmail, displayName: 'Author', emailVerified: false });
});
const access = getFirestore(admin).doc('noveliaaConfig/access');
await getFirestore(admin).runTransaction(async transaction => {
  const prior = await transaction.get(access);
  if (prior.exists && prior.data().ownerUid !== author.uid) throw new Error('Existing author identity differs. No allowlist was overwritten.');
  if (!prior.exists) transaction.create(access, { ownerUid: author.uid });
});
await writeFile(`functions/.env.${project}`, `NOVELIAA_OWNER_UID=${author.uid}\nNOVELIAA_STORAGE_BUCKET=${config.storageBucket}\nNOVELIAA_REGION=${binding.functionsRegion}\n`);
await appendFile(process.env.GITHUB_ENV, `VITE_FIREBASE_CONFIG=${JSON.stringify(config)}\nVITE_FIREBASE_REGION=${binding.functionsRegion}\n`);
const firebase = JSON.parse(await readFile('firebase.json', 'utf8'));
firebase.storage.bucket = config.storageBucket;
await writeFile('firebase.json', JSON.stringify(firebase, null, 2));
console.log(JSON.stringify({ project, appId: app.appId, site: binding.hostingSite, url: binding.url, authorConfigured: true, bucket: config.storageBucket, region: binding.functionsRegion }));
