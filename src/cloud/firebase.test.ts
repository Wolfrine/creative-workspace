import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFirebaseConfig } from './firebase';

const publicConfig = { apiKey: 'synthetic-public-api-key', authDomain: 'demo-noveliaa.firebaseapp.com', projectId: 'demo-noveliaa', storageBucket: 'demo-noveliaa.appspot.com', appId: 'synthetic-public-app-id' };
describe('public Firebase setup and offline discovery', () => {
  let cache: Map<string, string>;
  beforeEach(() => {
    cache = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value) });
    vi.stubEnv('VITE_FIREBASE_CONFIG', '');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('does not fabricate production configuration when discovery is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await readFirebaseConfig()).toBeNull();
  });
  it('retains only public config for an offline restart after Hosting discovery', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(publicConfig), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await readFirebaseConfig()).toEqual(publicConfig);
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await readFirebaseConfig()).toEqual(publicConfig);
    expect(cache.size).toBe(1);
  });
  it('rejects incomplete or malformed explicit setup', async () => {
    vi.stubEnv('VITE_FIREBASE_CONFIG', '{');
    await expect(readFirebaseConfig()).rejects.toThrow('invalid');
    vi.stubEnv('VITE_FIREBASE_CONFIG', '{"projectId":"synthetic"}');
    await expect(readFirebaseConfig()).rejects.toThrow('incomplete');
  });
  it('public env setup remains usable when browser config cache is denied', async () => {
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify(publicConfig));
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('denied'); } });
    expect(await readFirebaseConfig()).toEqual(publicConfig);
  });
});
