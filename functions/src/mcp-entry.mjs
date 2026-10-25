import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { IntegrationStore } from './integration-store.mjs';
import { NoveliaaOAuthProvider } from './integration-oauth.mjs';
import { WritingAccess } from './integration-writing.mjs';
import { integrationApp } from './integration-http.mjs';
initializeApp();
const db = getFirestore(), auth = getAuth(), store = new IntegrationStore(db);
const checkIdentity = async (uid, authenticatedAt) => {
  const user = await auth.getUser(uid);
  if (user.disabled || !Number.isFinite(authenticatedAt) || authenticatedAt * 1000 < Date.parse(user.tokensValidAfterTime || '1970-01-01')) throw new Error('Author sign-in was revoked.');
  return store.owner(uid, authenticatedAt);
};
const provider = new NoveliaaOAuthProvider(store, 'https://noveliaa.web.app', checkIdentity);
const app = integrationApp({ provider, store, access: new WritingAccess(db), verifyIdentity: async token => {
  const identity = await auth.verifyIdToken(token, true);
  return { uid: identity.uid, authenticatedAt: identity.auth_time };
} });
// This is the ONLY deployed export. The old Storage callables/scheduled backup
// remain reference source and are deliberately absent from this entrypoint.
export const noveliaaMcp = onRequest({ region: 'asia-south1', memory: '512MiB', timeoutSeconds: 60, maxInstances: 2, minInstances: 0, concurrency: 1, invoker: 'public' }, app);
