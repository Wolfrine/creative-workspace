// Existing Actions identity and exact Web App/site/author binding, retained for
// the owner-approved Blaze plugin. No credential inspection or replacement.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, appendFile } from 'node:fs/promises';
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
if (process.env.VERIFIED_PROJECT !== 'noveliaa' || binding.projectId !== 'noveliaa' || binding.hostingSite !== 'noveliaa' || binding.url !== 'https://noveliaa.web.app' || binding.planConstraint !== 'Blaze') throw new Error('Deployment identity/site/approved-plan mismatch.');
const credential = applicationDefault(), token = await credential.getAccessToken();
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(response.status) + ' ' + (data.error?.message || 'Firebase request failed'));
  return data;
};
const project = binding.projectId;
const siteUrl = 'https://firebasehosting.googleapis.com/v1beta1/projects/' + project + '/sites/' + binding.hostingSite;
const site = await request(siteUrl);
if (site.defaultUrl !== binding.url) throw new Error('Verified Hosting URL differs.');
const apps = await request('https://firebase.googleapis.com/v1beta1/projects/' + project + '/webApps');
const app = (apps.apps ?? []).find(value => value.appId === site.appId) ?? (apps.apps ?? []).find(value => value.displayName === 'Noveliaa');
if (!app || app.appId !== binding.appId || site.appId && site.appId !== app.appId) throw new Error('Cannot match the Noveliaa Web App to its site.');
const config = await request('https://firebase.googleapis.com/v1beta1/' + app.name + '/config');
const database = await request('https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)');
if (database.type !== 'FIRESTORE_NATIVE') throw new Error('A native Firestore database is required.');
let auth, google;
try {
  auth = await request('https://identitytoolkit.googleapis.com/admin/v2/projects/' + project + '/config?fields=authorizedDomains');
  google = await request('https://identitytoolkit.googleapis.com/admin/v2/projects/' + project + '/defaultSupportedIdpConfigs/google.com?fields=enabled');
} catch {
  throw new Error('Unable to verify the existing Google sign-in setup. Inspect the Actions error before changing keys or permissions.');
}
if (!google.enabled) throw new Error('Enable the Google sign-in provider in the Noveliaa Firebase console.');
const requiredDomains = ['noveliaa.web.app', 'noveliaa.firebaseapp.com'];
if (requiredDomains.some(domain => !auth.authorizedDomains?.includes(domain))) {
  await request('https://identitytoolkit.googleapis.com/admin/v2/projects/' + project + '/config?updateMask=authorizedDomains', { method: 'PATCH', body: JSON.stringify({ authorizedDomains: [...new Set([...(auth.authorizedDomains ?? []), ...requiredDomains])] }) });
}
if (!site.appId) await request(siteUrl + '?updateMask=appId', { method: 'PATCH', body: JSON.stringify({ appId: app.appId }) });
const admin = initializeApp({ credential, projectId: project });
const author = await getAuth(admin).getUserByEmail(binding.authorEmail).catch(error => {
  if (error.code !== 'auth/user-not-found') throw error;
  return getAuth(admin).createUser({ email: binding.authorEmail, displayName: 'Author', emailVerified: false });
});
const access = getFirestore(admin).doc('noveliaaConfig/access');
await getFirestore(admin).runTransaction(async transaction => {
  const prior = await transaction.get(access);
  if (prior.exists && prior.data().ownerUid !== author.uid) throw new Error('Existing owner allowlist differs; it was not overwritten.');
  if (!prior.exists) transaction.create(access, { ownerUid: author.uid });
});
await appendFile(process.env.GITHUB_ENV, 'VITE_FIREBASE_CONFIG=' + JSON.stringify(config) + '\n');
console.log(JSON.stringify({ project, appId: app.appId, site: binding.hostingSite, url: binding.url, databaseLocation: database.locationId, authorConfigured: true, deployment: 'Blaze: existing Firestore writing, Hosting, Rules and private plugin HTTP Function' }));
