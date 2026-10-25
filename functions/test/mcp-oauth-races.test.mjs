import test from 'node:test';
import assert from 'node:assert/strict';
import { NoveliaaOAuthProvider, READ, PROPOSE } from '../src/integration-oauth.mjs';

// Synthetic in-memory schedules exercise the actual OAuth provider. No Firebase,
// network, credentials or author writing is needed. consume() models one atomic
// transaction; read barriers model strongly consistent reads at different times.
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function raceStore(sourceSchedule) {
  const now = Math.floor(Date.now() / 1000);
  const values = new Map();
  const key = (kind, id) => kind + ':' + id;
  const grant = { id: 'synthetic-grant', uid: 'synthetic-author', workspaceId: 'synthetic-workspace', clientId: 'synthetic-client',
    authenticatedAt: now, scopes: [READ, PROPOSE], universeIds: ['synthetic-universe'], allowProposals: true, revoked: false, expiresAt: now + 3600 };
  const original = 'synthetic-original-refresh';
  const clone = (kind, id) => values.has(key(kind, id)) ? structuredClone(values.get(key(kind, id))) : undefined;
  values.set(key('grants', grant.id), grant);
  values.set(key('refresh', original), { clientId: grant.clientId, grantId: grant.id, scopes: grant.scopes, resource: 'https://noveliaa.web.app/mcp', expiresAt: grant.expiresAt });
  let spentReads = 0, sourceReads = 0;
  const initialMarkersRead = deferred(), initialSourcesRead = deferred(), winnerCommitted = deferred();
  const store = {
    async get(kind, id) {
      if (kind === 'spent' && id === original && ++spentReads <= 2) {
        // Both preflight reads snapshot the absent marker before any rotation.
        const snapshot = clone(kind, id);
        if (spentReads === 2) initialMarkersRead.resolve();
        await initialMarkersRead.promise;
        return snapshot;
      }
      if (kind === 'refresh' && id === original) {
        sourceReads++;
        if (sourceSchedule === 'both-before-consume') {
          const snapshot = clone(kind, id);
          if (sourceReads === 2) initialSourcesRead.resolve();
          await initialSourcesRead.promise;
          return snapshot;
        }
        if (sourceReads === 2) await winnerCommitted.promise;
      }
      // All later spent reads observe the committed replay marker normally.
      return clone(kind, id);
    },
    async put(kind, id, value) { values.set(key(kind, id), structuredClone(value)); },
    async consume(kind, id, validate, writes) {
      const value = clone(kind, id);
      validate(value);
      values.delete(key(kind, id));
      for (const write of writes) values.set(key(write.kind, write.key), structuredClone(write.value));
      winnerCommitted.resolve();
      return value;
    }
  };
  return { store, grant, original, currentGrant: () => clone('grants', grant.id) };
}

for (const schedule of ['both-before-consume', 'winner-before-second-source-read']) {
  test('concurrent refresh replay revokes the family: ' + schedule, { timeout: 5000 }, async () => {
    const { store, grant, original, currentGrant } = raceStore(schedule);
    const provider = new NoveliaaOAuthProvider(store, 'https://noveliaa.web.app', async () => ({ uid: grant.uid, workspaceId: grant.workspaceId, authenticatedAt: grant.authenticatedAt }));
    const exchange = () => provider.exchangeRefreshToken({ client_id: grant.clientId }, original, undefined, new URL(provider.resource));
    const results = await Promise.allSettled([exchange(), exchange()]);
    assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
    const winner = results.find(result => result.status === 'fulfilled').value;
    assert.equal(currentGrant().revoked, true);
    await assert.rejects(provider.verifyAccessToken(winner.access_token), /expired, revoked or reset/);
    await assert.rejects(provider.exchangeRefreshToken({ client_id: grant.clientId }, winner.refresh_token, undefined, new URL(provider.resource)), /revoked/);
  });
}
