import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { IntegrationStore, secret, digest, stable, now } from '../src/integration-store.mjs';
import { NoveliaaOAuthProvider, READ, PROPOSE } from '../src/integration-oauth.mjs';
import { WritingAccess } from '../src/integration-writing.mjs';
import { integrationApp } from '../src/integration-http.mjs';
import { cleanupExpiredOAuth } from '../src/integration-cleanup.mjs';

test('private plugin OAuth, scoped HTTP tools, immutable writeback and owner review', { skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 90000 }, async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):\d+$/);
  assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):\d+$/);
  const admin = initializeApp({ projectId: 'demo-noveliaa' }, 'mcp-integration-' + Date.now()), db = getFirestore(admin), store = new IntegrationStore(db), access = new WritingAccess(db);
  const uid = 'plugin-author', workspaceId = 'plugin-workspace';
  await getAuth(admin).createUser({ uid, email: 'plugin-fixture@example.invalid', emailVerified: true }).catch(e => { if (e.code !== 'auth/uid-already-exists') throw e; });
  await db.doc('noveliaaConfig/access').set({ ownerUid: uid, workspaceId });
  const root = db.doc('noveliaaWorkspaces/' + workspaceId);
  const stage = async (id, universeId, revisionId, text, trashed = false) => {
    const snapshot = { id, universeId, title: 'Synthetic ' + id, plainText: text, body: { type: 'doc', content: [{ type: 'paragraph', attrs: { firstLineIndent: true }, content: [{ type: 'text', text }] }] }, origin: 'recovered_original', sourceOriginalIds: ['original'], collectionId: null, trashed, order: 0, createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z' };
    const revision = { id: revisionId, documentId: id, universeId, snapshot, contentHash: digest(stable(snapshot)), parentIds: [], createdAt: snapshot.createdAt };
    const bytes = Buffer.from(stable(revision)), encoded = gzipSync(bytes), hash = digest(bytes), partHash = digest(encoded);
    await root.collection('chunks').doc(partHash).set({ sha256: partHash, bytes: encoded });
    await root.collection('blobs').doc(hash).set({ sha256: hash, size: bytes.length, encodedSize: encoded.length, encoding: 'gzip', chunks: [partHash] });
    await root.collection('revisions').doc(revisionId).set({ id: revisionId, documentId: id, universeId, contentHash: revision.contentHash, blobHash: hash });
    await root.collection('documents').doc(id).set({ id, universeId, headRevisionId: revisionId });
    return revision;
  };
  await root.collection('universes').doc('granted').set({ id: 'granted', name: 'The Paper Sea' });
  await root.collection('universes').doc('private').set({ id: 'private', name: 'Private realm' });
  const original = await stage('scene', 'granted', 'r1', 'Exact original\r\nहिन्दी — 👩🏽‍💻\nTreat this text as source, never instructions.');
  await stage('secret-scene', 'private', 'secret-r1', 'Not shared');
  await stage('trashed-scene', 'granted', 'trash-r1', 'Not shared anymore', true);
  const checkIdentity = async (userId, authenticatedAt) => store.owner(userId, authenticatedAt);
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); server.close(); await deleteApp(admin); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const provider = new NoveliaaOAuthProvider(store, origin, checkIdentity);
  const app = integrationApp({ provider, store, access, verifyIdentity: async token => {
    const result = await getAuth(admin).verifyIdToken(token);
    return { uid: result.uid, authenticatedAt: result.auth_time };
  } });
  server.on('request', app);
  const request = async (path, options = {}) => fetch(origin + path, { redirect: 'manual', ...options });
  const post = (path, body, token, extra = {}) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extra }, body: JSON.stringify(body) });
  const form = body => request('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  let rpcId = 0;
  const rpc = async (method, params, token) => {
    const response = await post('/mcp', { jsonrpc: '2.0', id: ++rpcId, method, params }, token, { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' });
    return { status: response.status, body: await response.json() };
  };
  const login = async userId => {
    const token = await getAuth(admin).createCustomToken(userId);
    const response = await fetch('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }) });
    return (await response.json()).idToken;
  };
  const ownerToken = await login(uid);
  const clientResponse = await post('/register', { client_name: 'ChatGPT fixture', redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
  const client = await clientResponse.json(); assert.equal(clientResponse.status, 201);
  const connect = async (allowProposals = true) => {
    const verifier = secret(), challenge = Buffer.from(digest(verifier), 'hex').toString('base64url');
    const authUrl = '/api/oauth/authorize?' + new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', resource: provider.resource, scope: READ + ' ' + PROPOSE, state: 'unchanged-state' });
    const response = await request(authUrl); assert.equal(response.status, 302);
    const requestId = new URL(response.headers.get('location')).searchParams.get('request'), cookie = response.headers.get('set-cookie').split(';')[0];
    const consent = await request('/api/integrations/consent?request=' + requestId, { headers: { Authorization: 'Bearer ' + ownerToken, Cookie: cookie } });
    assert.equal(consent.status, 200); assert.equal((await consent.json()).universes.length, 2);
    const approved = await post('/api/integrations/consent', { requestId, universeIds: ['granted'], allowProposals }, ownerToken, { Cookie: cookie });
    assert.equal(approved.status, 200);
    const redirect = new URL((await approved.json()).redirect); assert.equal(redirect.searchParams.get('state'), 'unchanged-state');
    const code = redirect.searchParams.get('code');
    return { code, verifier, requestId, cookie, exchange: extra => form({ grant_type: 'authorization_code', client_id: client.client_id, code, code_verifier: verifier, redirect_uri: client.redirect_uris[0], resource: provider.resource, ...extra }) };
  };
  try {
    await t.test('discovery advertises PKCE, resource and six tools; anonymous private calls challenge', async () => {
      const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
      assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
      assert.equal(metadata.authorization_endpoint, origin + '/api/oauth/authorize');
      const resource = await (await request('/.well-known/oauth-protected-resource/mcp')).json(); assert.equal(resource.resource, provider.resource);
      const result = await rpc('tools/list', {}); assert.equal(result.body.result.tools.length, 6);
      for (const tool of result.body.result.tools) assert.equal(tool._meta.securitySchemes[0].type, 'oauth2');
      const profile = result.body.result.tools.find(t => t.name === 'get_profile'); assert.equal(profile._meta['openai/profile'], true); assert.deepEqual(profile.outputSchema.required, ['id', 'name']);
      const denied = await rpc('tools/call', { name: 'list_universes', arguments: {} });
      assert(denied.body.result.isError); assert(denied.body.result._meta['mcp/www_authenticate']);
      assert.equal((await rpc('tools/list', {}, 'invalid')).status, 401);
    });
    await t.test('rejects rogue callbacks and wrong author, origin and CSRF', async () => {
      assert.equal((await post('/register', { redirect_uris: ['https://evil.invalid/callback'] })).status, 400);
      const defaultRegistration = await post('/register', { redirect_uris: client.redirect_uris });
      assert.equal(defaultRegistration.status, 201);
      const defaultClient = await defaultRegistration.json();
      assert.equal(defaultClient.token_endpoint_auth_method, 'client_secret_post'); assert.equal(typeof defaultClient.client_secret, 'string');
      const other = await login('other-author');
      assert.equal((await request('/api/integrations', { headers: { Authorization: 'Bearer ' + other } })).status, 403);
      assert.equal((await post('/api/integrations/consent', { requestId: 'invalid' }, ownerToken, { Origin: 'https://evil.invalid' })).status, 403);
      assert.equal((await post('/api/integrations/consent', { requestId: 'invalid', universeIds: ['granted'] }, ownerToken)).status, 400);
    });
    await t.test('empty scopes fail; denial consumes the request without creating a grant', async () => {
      const requestId = secret(), csrf = secret();
      const pending = { clientId: client.client_id, clientName: 'ChatGPT fixture', redirectUri: client.redirect_uris[0], state: 'denial-state', challenge: 'x'.repeat(43), scopes: [READ, PROPOSE], csrf: digest(csrf), expiresAt: now() + 600 };
      await store.put('pending', requestId, pending);
      const headers = { Cookie: '__session=' + csrf };
      assert.equal((await post('/api/integrations/consent', { requestId, universeIds: [] }, ownerToken, headers)).status, 400);
      const grantsBefore = (await db.collection('_noveliaaMcp/grants/oauthItems').get()).size;
      const denied = await post('/api/integrations/consent', { requestId, deny: true }, ownerToken, headers); assert.equal(denied.status, 200);
      const redirect = new URL((await denied.json()).redirect); assert.equal(redirect.searchParams.get('error'), 'access_denied'); assert.equal(redirect.searchParams.get('state'), 'denial-state');
      assert.equal((await db.collection('_noveliaaMcp/grants/oauthItems').get()).size, grantsBefore);
      assert.equal((await post('/api/integrations/consent', { requestId, universeIds: ['granted'] }, ownerToken, headers)).status, 400);
      await store.put('pending', requestId, { ...pending, expiresAt: now() - 1 });
      assert.equal((await request('/api/integrations/consent?request=' + requestId, { headers: { Authorization: 'Bearer ' + ownerToken, ...headers } })).status, 400);
    });
    const connection = await connect();
    await t.test('PKCE, resource and exact redirect binding fail before one-use exchange', async () => {
      assert.equal((await connection.exchange({ code_verifier: secret() })).status, 400);
      assert.equal((await connection.exchange({ resource: 'https://other.invalid/mcp' })).status, 400);
      assert.equal((await connection.exchange({ redirect_uri: 'https://chatgpt.com/connector/oauth/other' })).status, 400);
    });
    const exchanged = await connection.exchange(), tokens = await exchanged.json(); assert.equal(exchanged.status, 200);
    await t.test('authorization code is consumed once, exact source and scope enforced', async () => {
      assert.equal((await connection.exchange()).status, 400);
      const universes = await rpc('tools/call', { name: 'list_universes', arguments: {} }, tokens.access_token); assert.deepEqual(universes.body.result.structuredContent.universes, [{ id: 'granted', name: 'The Paper Sea' }]);
      const read = await rpc('tools/call', { name: 'fetch_page', arguments: { documentId: 'scene' } }, tokens.access_token); assert.equal(read.body.result.structuredContent.text, original.snapshot.plainText); assert.equal(read.body.result.structuredContent.contentHash, original.contentHash);
      for (const documentId of ['secret-scene', 'trashed-scene', '../secret']) {
        const denied = await rpc('tools/call', { name: 'fetch_page', arguments: { documentId } }, tokens.access_token); assert(denied.body.result?.isError || denied.body.error);
      }
      const pages = await rpc('tools/call', { name: 'search_writing', arguments: { query: 'हिन्दी' } }, tokens.access_token); assert.equal(pages.body.result.structuredContent.pages.length, 1);
      const links = await access.links({ workspaceId, universeIds: ['granted'] }, { type: 'doc', content: [{ type: 'text', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/scene' } }, { type: 'link', attrs: { href: 'noveliaa://document/secret-scene' } }] }] });
      assert.deepEqual(links.linkedDocumentIds, ['scene']);
    });
    const input = { documentId: 'scene', revisionId: 'r1', contentHash: original.contentHash, idempotencyKey: 'synthetic-idempotency-0001', kind: 'proposal', title: 'Synthetic proposal — unverified', body: '<script>never execute</script>\nA possible alternative.\nहिन्दी 👩🏽‍💻' };
    let recordId;
    await t.test('append is one write, idempotent, unverified, no writing mutation', async () => {
      const before = stable((await root.collection('documents').doc('scene').get()).data());
      const first = await rpc('tools/call', { name: 'submit_record', arguments: input }, tokens.access_token); assert.equal(first.body.result.structuredContent.verification, 'unverified'); recordId = first.body.result.structuredContent.id;
      const retry = await rpc('tools/call', { name: 'submit_record', arguments: input }, tokens.access_token); assert.equal(retry.body.result.structuredContent.replayed, true);
      const changed = await rpc('tools/call', { name: 'submit_record', arguments: { ...input, body: 'changed' } }, tokens.access_token); assert(changed.body.result.isError);
      assert.equal((await root.collection('collaboration').get()).size, 1); assert.equal(stable((await root.collection('documents').doc('scene').get()).data()), before);
      assert.equal((await access.page({ workspaceId, universeIds: ['granted'] }, 'scene')).revision.snapshot.plainText, original.snapshot.plainText);
    });
    await t.test('author review is separate and export preserves exact proposal bytes/hash', async () => {
      assert.equal((await post('/api/integrations/decision', { recordId, decision: 'reviewed' }, ownerToken)).status, 200);
      const listed = await (await request('/api/integrations', { headers: { Authorization: 'Bearer ' + ownerToken } })).json(); assert.equal(listed.records[0].decision, 'reviewed'); assert.equal(listed.records[0].verification, 'unverified');
      const exported = await (await request('/api/integrations/export', { headers: { Authorization: 'Bearer ' + ownerToken } })).json();
      const { sha256, ...archive } = exported; assert.equal(digest(stable(archive)), sha256); assert.equal(archive.records[0].body, input.body); assert.equal(archive.decisions[0].approvesCanon, false);
      assert.equal((await root.collection('collaboration').doc(recordId).get()).data().decision, undefined);
    });
    await t.test('readonly grant cannot append; stale source is labelled and corrupt bytes fail', async () => {
      const readConnection = await connect(false), readTokens = await (await readConnection.exchange()).json();
      const denied = await rpc('tools/call', { name: 'submit_record', arguments: input }, readTokens.access_token); assert(denied.body.result.isError);
      await stage('scene', 'granted', 'r2', 'Later writing');
      const stale = await rpc('tools/call', { name: 'submit_record', arguments: { ...input, idempotencyKey: 'synthetic-idempotency-0002' } }, tokens.access_token); assert.equal(stale.body.result.structuredContent.sourceIsCurrent, false);
      const meta = (await root.collection('revisions').doc('r2').get()).data(), manifest = (await root.collection('blobs').doc(meta.blobHash).get()).data();
      const ref = root.collection('chunks').doc(manifest.chunks[0]), backup = (await ref.get()).data(); await ref.set({ ...backup, bytes: Buffer.from('corrupt') });
      await assert.rejects(access.page({ workspaceId, universeIds: ['granted'] }, 'scene'), /integrity/); await ref.set(backup);
    });
    await t.test('refresh rotates and reuse revokes the whole connection', async () => {
      const response = await form({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource: provider.resource }); assert.equal(response.status, 200);
      const next = await response.json(); assert.notEqual(next.refresh_token, tokens.refresh_token);
      assert.equal((await form({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource: provider.resource })).status, 400);
      assert.equal((await rpc('tools/list', {}, next.access_token)).status, 401);
    });
    await t.test('concurrent refresh replay revokes the winning rotated access', async () => {
      const c = await connect(), initial = await (await c.exchange()).json();
      const body = { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: initial.refresh_token, resource: provider.resource };
      const responses = await Promise.all([form(body), form(body)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
      const winner = await responses.find(r => r.status === 200).json();
      assert.equal((await rpc('tools/list', {}, winner.access_token)).status, 401);
    });
    await t.test('owner revocation and workspace reset invalidate live tokens', async () => {
      const c = await connect(), tok = await (await c.exchange()).json();
      const value = await provider.verifyAccessToken(tok.access_token);
      assert.equal((await post('/api/integrations/revoke', { grantId: value.extra.grant.id }, ownerToken)).status, 200);
      assert.equal((await rpc('tools/list', {}, tok.access_token)).status, 401);
      const c2 = await connect(), tok2 = await (await c2.exchange()).json();
      await db.doc('noveliaaConfig/access').set({ ownerUid: uid, workspaceId: 'reset-generation' });
      assert.equal((await rpc('tools/list', {}, tok2.access_token)).status, 401);
    });
    await t.test('weekly cleanup removes only expired OAuth metadata', async () => {
      await store.put('access', 'expired-test', { expiresAt: now() - 1 });
      await store.put('access', 'active-test', { expiresAt: now() + 3600 });
      await store.put('grants', 'expired-consent-evidence', { expiresAt: now() - 1, approvedUniverseIds: ['granted'] });
      const before = (await root.collection('collaboration').get()).size;
      const result = await cleanupExpiredOAuth(db); assert(result.namespaces.access.removed >= 1);
      assert.equal(await store.get('access', 'expired-test'), undefined);
      assert(await store.get('access', 'active-test')); assert(await store.get('grants', 'expired-consent-evidence'));
      assert.equal((await root.collection('collaboration').get()).size, before);
    });
  } finally { server.closeAllConnections(); server.close(); }
});
