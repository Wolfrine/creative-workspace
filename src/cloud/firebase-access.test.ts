import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const app = { options: { projectId: 'demo-noveliaa' } };
  return { app, auth: { app, currentUser: { uid: 'author' } as { uid: string } | null }, db: {}, read: vi.fn(), next: undefined as undefined | ((snapshot: unknown) => void), error: undefined as undefined | ((error: Error) => void) };
});
vi.mock('firebase/app', () => ({ getApp: () => fake.app, getApps: () => [], initializeApp: () => fake.app }));
vi.mock('firebase/auth', async importOriginal => ({ ...await importOriginal<typeof import('firebase/auth')>(), getAuth: () => fake.auth }));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  initializeFirestore: () => fake.db, persistentLocalCache: vi.fn(), persistentMultipleTabManager: vi.fn(),
  doc: vi.fn(), getDocFromServer: fake.read,
  onSnapshot: (_reference: unknown, _options: unknown, next: (snapshot: unknown) => void, error: (error: Error) => void) => { fake.next = next; fake.error = error; return vi.fn(); },
}));
const snapshot = (workspaceId: string) => ({ exists: () => true, data: () => ({ ownerUid: 'author', workspaceId }), metadata: { fromCache: false, hasPendingWrites: false } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); fake.read.mockReset(); fake.next = undefined; fake.error = undefined; fake.auth.currentUser = { uid: 'author' };
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ apiKey: 'synthetic-key', authDomain: 'demo-noveliaa.firebaseapp.com', projectId: 'demo-noveliaa', appId: 'synthetic-app' }));
  vi.stubEnv('VITE_FIREBASE_EMULATORS', 'false');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('active workspace access races', () => {
  it('coalesces popup/Auth verification and never rolls back a newer listener-confirmed reset', async () => {
    const firebase = await import('./firebase'); await firebase.initializeFirebaseSession();
    const oldRead = deferred<ReturnType<typeof snapshot>>(); fake.read.mockReturnValue(oldRead.promise);
    const first = firebase.verifyAuthorAccess('author'), second = firebase.verifyAuthorAccess('author');
    await vi.waitFor(() => expect(fake.read).toHaveBeenCalledTimes(1));
    const changed = vi.fn(); firebase.watchAuthorAccess('author', changed, vi.fn());
    fake.next!(snapshot('reset_current')); oldRead.resolve(snapshot('author'));
    expect(await Promise.all([first, second])).toEqual(['reset_current', 'reset_current']);
    expect(changed).toHaveBeenCalledWith('reset_current');
    expect(JSON.parse(storage.get('noveliaa-author-access:demo-noveliaa:author')!)).toEqual({ workspaceId: 'reset_current' });
    expect(firebase.createCloudAdapter('author', 'reset_current').workspaceId).toBe('reset_current');
    await expect(firebase.createCloudAdapter('author').load()).rejects.toThrow('workspace was reset');
  });
  it('keeps current confirmed access when an older offline cache remains after a failed cache write', async () => {
    const firebase = await import('./firebase'); await firebase.initializeFirebaseSession();
    fake.read.mockResolvedValue(snapshot('reset_current'));
    expect(await firebase.verifyAuthorAccess('author')).toBe('reset_current');
    storage.set('noveliaa-author-access:demo-noveliaa:author', JSON.stringify({ workspaceId: 'reset_retired' }));
    vi.stubGlobal('navigator', { onLine: false });
    expect(await firebase.verifyAuthorAccess('author')).toBe('reset_current');
    expect(fake.read).toHaveBeenCalledTimes(1);
  });
  it('cannot restore revoked access from a late read and clears the pending read for a later retry', async () => {
    const firebase = await import('./firebase'); await firebase.initializeFirebaseSession();
    const oldRead = deferred<ReturnType<typeof snapshot>>(); fake.read.mockReturnValueOnce(oldRead.promise);
    const pending = firebase.verifyAuthorAccess('author');
    const rejected = expect(pending).rejects.toThrow('Author access changed');
    await vi.waitFor(() => expect(fake.read).toHaveBeenCalledTimes(1));
    firebase.watchAuthorAccess('author', vi.fn(), vi.fn());
    fake.error!(new Error('permission-denied')); oldRead.resolve(snapshot('author')); await rejected;
    fake.read.mockResolvedValueOnce(snapshot('reset_restored_access'));
    expect(await firebase.verifyAuthorAccess('author')).toBe('reset_restored_access');
  });
});
