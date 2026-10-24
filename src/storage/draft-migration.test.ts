import { expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { DeviceDatabase, completed, request } from './database';
import { WritingEngine } from '../state/engine';

it('adds device drafts to a version-one store without rewriting originals, immutable history or pending operations', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('BroadcastChannel', undefined);
  const source = new WritingEngine('source', null);
  try {
    await source.initialize(); await source.importText(new File(['Exact source\r\nहिंदी é 🙂'], 'source.txt'), 'recovered_original');
    const seed = await DeviceDatabase.open('source'), snapshot = await seed.snapshot(), pending = await seed.all('outbox'); seed.close();
    const legacyRequest = indexedDB.open('noveliaa-writing-v1-author', 1);
    const stores = ['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts', 'outbox', 'preferences'];
    legacyRequest.onupgradeneeded = () => stores.forEach(name => legacyRequest.result.createObjectStore(name, { keyPath: name === 'receipts' ? 'key' : 'id' }));
    const legacy = await request(legacyRequest), tx = legacy.transaction(stores, 'readwrite'), done = completed(tx);
    for (const name of ['documents', 'revisions', 'originals', 'universes', 'collections'] as const) snapshot[name].forEach(value => tx.objectStore(name).put(value));
    snapshot.receipts.forEach(receipt => tx.objectStore('receipts').put({ ...receipt, key: receipt.revisionId + ':' + receipt.level }));
    pending.forEach(value => tx.objectStore('outbox').put(value)); await done; legacy.close();
    const upgraded = await DeviceDatabase.open('author'), result = await upgraded.snapshot();
    expect(upgraded.db.version).toBe(2); expect(await upgraded.all('drafts')).toEqual([]);
    for (const name of ['documents', 'revisions', 'originals', 'universes', 'collections', 'receipts'] as const) expect(result[name]).toEqual(snapshot[name]);
    expect(await upgraded.all('outbox')).toEqual(pending); upgraded.close();
  } finally { source.dispose(); vi.unstubAllGlobals(); }
});
