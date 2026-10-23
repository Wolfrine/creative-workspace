import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import { createFirestoreAdapter } from './spark';
import type { CloudAdapter, Session } from '../domain/model';


interface FirebaseClient { auth: Auth; db: Firestore }
let pendingClient: Promise<FirebaseClient | null> | undefined;
let initialized: FirebaseClient | null = null;
let emulatorConnected = false;
export async function readFirebaseConfig(): Promise<FirebaseOptions | null> {
  const cacheKey = 'noveliaa-public-firebase-config-v1';
  const configured = import.meta.env.VITE_FIREBASE_CONFIG;
  let config: FirebaseOptions;
  if (configured) {
    try { config = JSON.parse(configured); } catch { throw new Error('Firebase configuration is invalid. The private workspace requires verified Firebase setup.'); }
  } else {
    try {
      const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error('Public Firebase configuration is unavailable.');
      config = await response.json();
    } catch {
      // Hosting discovery must not become an online prerequisite for reopening
      // acknowledged writing. Only public web configuration is cached here.
      try { const cached = localStorage.getItem(cacheKey); if (!cached) return null; config = JSON.parse(cached); }
      catch { return null; }
    }
  }
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error('Firebase public configuration is incomplete. The private workspace requires verified Firebase setup.');
  try { localStorage.setItem(cacheKey, JSON.stringify(config)); } catch { /* Storage failure is surfaced by the writing checkpoint layer. */ }
  return config;
}
export async function initializeFirebaseSession(): Promise<FirebaseClient | null> {
  if (!pendingClient) pendingClient = (async () => {
    const config = await readFirebaseConfig();
    if (!config) return null;
    const app = getApps().length ? getApp() : initializeApp(config);
    const client = { auth: getAuth(app), db: getFirestore(app) };
    if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
      if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Firebase emulators are restricted to local development.');
      if (!emulatorConnected) {
        connectAuthEmulator(client.auth, 'http://127.0.0.1:19099', { disableWarnings: true });
        connectFirestoreEmulator(client.db, '127.0.0.1', 18080);
        emulatorConnected = true;
      }
    }
    initialized = client;
    return client;
  })();
  return pendingClient;
}
export const firebaseAuth = (): Auth | null => initialized?.auth ?? null;
export async function verifyAuthorAccess(uid: string): Promise<void> {
  const client = await initializeFirebaseSession();
  if (!client || client.auth.currentUser?.uid !== uid) throw new Error('Your signed-in account changed.');
  const key = 'noveliaa-author-access:' + client.auth.app.options.projectId + ':' + uid;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (localStorage.getItem(key) === 'verified') return;
    throw new Error('Sign in online once to verify this device for your private writing.');
  }
  const access = await getDocFromServer(doc(client.db, 'noveliaaConfig/access')).catch(error => {
    if (error.code === 'permission-denied') throw new Error('This Google account does not have author access to this workspace. Choose your authorized author account.');
    throw error;
  });
  if (!access.exists() || access.data().ownerUid !== uid) throw new Error('This Google account does not have author access to this workspace.');
  try { localStorage.setItem(key, 'verified'); } catch { /* Device checkpoint errors have their own visible path. */ }
}
export async function signInWithGoogle(): Promise<Session> {
  const client = await initializeFirebaseSession();
  if (!client) throw new Error('Cloud sign-in is not configured. Complete the verified Firebase setup before opening the private workspace.');
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(client.auth, provider);
  await verifyAuthorAccess(user.uid);
  return { uid: user.uid, displayName: user.displayName || user.email || 'Author', localOnly: false, signOut: signOutFirebase };
}
export async function signOutFirebase(): Promise<void> {
  const client = await initializeFirebaseSession();
  if (client) await signOut(client.auth);
}
export function createCloudAdapter(uid: string): CloudAdapter {
  if (!initialized) throw new Error('Firebase session has not been initialized.');
  return createFirestoreAdapter(initialized.db, uid, async () => {
    if (!initialized || initialized.auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Writing remains in its original device workspace.');
  });
}
