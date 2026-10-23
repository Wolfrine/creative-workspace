import { signInWithCustomToken } from 'firebase/auth';
import { initializeFirebaseSession } from '../../src/cloud/firebase';

// Loaded explicitly by Vite browser tests. Never imported by the application.
// This uses the real Auth emulator; it cannot bypass production authentication.
export async function signIn(token: string) {
  if (!import.meta.env.DEV || import.meta.env.VITE_FIREBASE_EMULATORS !== 'true' || !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Loopback emulator test only.');
  const client = await initializeFirebaseSession();
  if (!client || client.auth.app.options.projectId !== 'demo-noveliaa') throw new Error('Synthetic project required.');
  await signInWithCustomToken(client.auth, token);
}
