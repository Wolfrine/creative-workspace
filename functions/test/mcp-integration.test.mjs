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
import { heartbeatCoverage, readHeartbeat, submitHeartbeat } from '../src/integration-heartbeat.mjs';

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
    await t.test('discovery advertises PKCE, resource, original six tools and heartbeat; anonymous private calls challenge', async () => {
      const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
      assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
      assert.equal(metadata.authorization_endpoint, origin + '/api/oauth/authorize');
      const resource = await (await request('/.well-known/oauth-protected-resource/mcp')).json(); assert.equal(resource.resource, provider.resource);
      const result = await rpc('tools/list', {}); assert.equal(result.body.result.tools.length, 7);
      assert.deepEqual(result.body.result.tools.map(tool => tool.name).sort(), ['fetch_page', 'get_profile', 'list_pages', 'list_universes', 'search_writing', 'submit_heartbeat', 'submit_record']);
      for (const tool of result.body.result.tools) assert.equal(tool._meta.securitySchemes[0].type, 'oauth2');
      const profile = result.body.result.tools.find(t => t.name === 'get_profile'); assert.equal(profile._meta['openai/profile'], true); assert.deepEqual(profile.outputSchema.required, ['id', 'name']);
      const heartbeatTool = result.body.result.tools.find(tool => tool.name === 'submit_heartbeat');
      assert.deepEqual(Object.keys(heartbeatTool.inputSchema.properties).sort(), ['beats', 'contentHash', 'contextNote', 'documentId', 'idempotencyKey', 'model', 'provider', 'revisionId']);
      assert.equal(heartbeatTool.inputSchema.additionalProperties, false);
      assert.deepEqual(Object.keys(heartbeatTool.inputSchema.properties.beats.items.properties).sort(), ['end', 'foreground', 'quote', 'reasoning', 'start', 'tone', 'trajectory', 'undertone', 'weight']);
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
    await t.test('page URLs use the same exact revision, grants and integrity checks without additional reads', async () => {
      const url = 'https://noveliaa.web.app/u/granted/old-collection/old-title/scene';
      const read = args => rpc('tools/call', { name: 'fetch_page', arguments: args }, tokens.access_token);
      const byId = await read({ documentId: 'scene', revisionId: 'r1' });
      const traceReads = async args => {
        const prototype = Object.getPrototypeOf(root), get = prototype.get, getAll = db.getAll, trace = [];
        prototype.get = function (...args) { trace.push(['get', this.path]); return get.apply(this, args); };
        db.getAll = function (...refs) { trace.push(['getAll', ...refs.map(ref => ref.path)]); return getAll.apply(this, refs); };
        try { await read(args); return trace; } finally { prototype.get = get; db.getAll = getAll; }
      };
      const idTrace = await traceReads({ documentId: 'scene', revisionId: 'r1' });
      assert(idTrace.length > 0);
      assert.deepEqual(await traceReads({ pageUrl: url, revisionId: 'r1' }), idTrace, 'URL and ID must have identical Firestore SDK read traces');
      for (const pageUrl of [url, 'https://noveliaa.web.app/?page=scene']) {
        const result = await read({ pageUrl, revisionId: 'r1' });
        assert.deepEqual(result.body.result.structuredContent, byId.body.result.structuredContent);
        assert.equal(result.body.result.structuredContent.integrity, 'sha256-verified');
        assert.equal(result.body.result.structuredContent.pageUrl, 'https://noveliaa.web.app/u/granted/inbox/synthetic-scene/scene');
      }
      assert.deepEqual((await read({ documentId: url, revisionId: 'r1' })).body.result.structuredContent, byId.body.result.structuredContent);
      for (const args of [{}, { documentId: 'secret-scene', pageUrl: url }, { pageUrl: url.replace('/granted/', '/private/') }, { pageUrl: url.replace('/scene', '/secret-scene') }, { pageUrl: url.replace('/scene', '/trashed-scene') }, { pageUrl: url.replace('noveliaa.web.app', 'evil.invalid') }, { pageUrl: url + '?page=secret-scene' }, { pageUrl: url, revisionId: 'secret-r1' }]) {
        const result = await read(args); assert(result.body.result?.isError || result.body.error);
        assert(!JSON.stringify(result.body).includes(original.snapshot.plainText));
      }
      const listing = await rpc('tools/call', { name: 'list_pages', arguments: {} }, tokens.access_token);
      assert.equal(listing.body.result.structuredContent.pages[0].pageUrl, byId.body.result.structuredContent.pageUrl);
      const grantRef = (await db.collection('_noveliaaMcp/grants/oauthItems').get()).docs.find(row => !row.data().revoked);
      const grant = grantRef.data();
      for (const patch of [{ revoked: true }, { universeIds: ['private'] }]) {
        await grantRef.ref.set({ ...grant, ...patch });
        const denied = await read({ pageUrl: url }); assert(denied.status === 401 || denied.body.result?.isError);
        await grantRef.ref.set(grant);
      }
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
    await t.test('heartbeat HTTP append/read, exact retry, independent storage and strict source boundaries', async t => {
      const beat = { start: 0, end: 14, quote: original.snapshot.plainText.slice(0, 14), foreground: 'Quiet tension', undertone: 'Resolve', weight: 3, trajectory: 'hold', tone: 'cool', reasoning: 'A possible interpretation of the exact opening; no measured reader response.' };
      const heartbeat = { documentId: 'scene', revisionId: 'r1', contentHash: original.contentHash, idempotencyKey: 'heartbeat-integration-0001', provider: 'Synthetic provider', model: 'Synthetic model', contextNote: 'Only this synthetic scene was considered.', beats: [beat] };
      const sourceCollections = ['documents', 'revisions', 'chunks', 'blobs', 'operations', 'originals', 'documentIdentities'];
      const sourceState = async () => stable(await Promise.all(sourceCollections.map(async name => (await root.collection(name).get()).docs.map(doc => ({ id: doc.id, ...doc.data() })))));
      const before = await sourceState(), value = await provider.verifyAccessToken(tokens.access_token), grant = value.extra.grant;
      const call = data => rpc('tools/call', { name: 'submit_heartbeat', arguments: data }, tokens.access_token);
      const readUrl = '/api/integrations/heartbeat?' + new URLSearchParams({ documentId: 'scene', revisionId: 'r1', contentHash: original.contentHash });
      const read = async (token = ownerToken) => request(readUrl, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
      const first = await call(heartbeat); assert.equal(first.body.result.structuredContent.verification, 'unverified'); assert.equal(first.body.result.structuredContent.replayed, false);
      assert.deepEqual(first.body.result.structuredContent.coverage, heartbeatCoverage(original.snapshot.plainText, heartbeat.beats));
      assert.equal(first.body.result.structuredContent.coverage.status, 'sparse');
      const replay = await call(heartbeat); assert.deepEqual(replay.body.result.structuredContent, { ...first.body.result.structuredContent, replayed: true });
      assert((await call({ ...heartbeat, contextNote: 'Different content.' })).body.result.isError);
      assert((await call({ ...heartbeat, approved: true })).body.result.isError);
      assert((await call({ ...heartbeat, idempotencyKey: 'heartbeat-invalid-quote', beats: [{ ...beat, quote: 'wrong' }] })).body.result.isError);
      assert.equal((await root.collection('heartbeatReceipts').get()).size, 1);
      const annotationPath = root.collection('heartbeatAnnotations').doc('scene').collection('revisions').doc('r1').collection('entries');
      assert.equal((await annotationPath.get()).size, 1);
      const response = await read(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
      const shown = await response.json(); assert.equal(shown.sourceIsCurrent, true); assert.equal(shown.annotations.length, 1); assert.deepEqual(shown.annotations[0].beats, heartbeat.beats);
      assert.deepEqual(shown.annotations[0].attribution, { provider: heartbeat.provider, model: heartbeat.model }); assert.equal(shown.annotations[0].origin, 'ai'); assert.equal(shown.annotations[0].grantId, undefined);
      assert.deepEqual(shown.annotations[0].coverage, first.body.result.structuredContent.coverage);
      assert.deepEqual((await annotationPath.doc(first.body.result.structuredContent.id).get()).data().coverage, shown.annotations[0].coverage);
      assert.equal((await read(null)).status, 403); assert.equal((await read(await login('other-author'))).status, 403);
      const stale = await request(readUrl.replace(original.contentHash, '0'.repeat(64)), { headers: { Authorization: 'Bearer ' + ownerToken } });
      assert.deepEqual((await stale.json()).annotations, []);
      assert.equal((await request(readUrl + '&extra=invalid', { headers: { Authorization: 'Bearer ' + ownerToken } })).status, 400);
      for (const change of [{ documentId: 'secret-scene', revisionId: 'secret-r1' }, { documentId: 'trashed-scene', revisionId: 'trash-r1' }, { contentHash: '0'.repeat(64) }]) assert((await call({ ...heartbeat, ...change })).body.result.isError);
      const readonlyConnection = await connect(false), readonly = await (await readonlyConnection.exchange()).json();
      assert((await rpc('tools/call', { name: 'submit_heartbeat', arguments: heartbeat }, readonly.access_token)).body.result.isError);
      await t.test('read filters current grant revocation, write permission, narrowed universes and reset', async () => {
        const config = (await db.doc('noveliaaConfig/access').get()).data();
        for (const patch of [{ revoked: true }, { allowProposals: false }, { scopes: [READ] }, { universeIds: ['private'] }, { uid: 'other-author' }, { workspaceId: 'other-workspace' }, { expiresAt: now() - 1 }]) {
          await store.put('grants', grant.id, { ...grant, ...patch });
          assert.deepEqual((await (await read()).json()).annotations, []);
        }
        await store.put('grants', grant.id, grant);
        assert.equal((await (await read()).json()).annotations.length, 1);
        await db.doc('noveliaaConfig/access').set({ ...config, workspaceId: 'heartbeat-reset' });
        assert.deepEqual((await (await read()).json()).annotations, []);
        await assert.rejects(readHeartbeat({ access, store }, { uid, workspaceId }, { documentId: 'scene', revisionId: 'r1', contentHash: original.contentHash }), /workspace changed/);
        await db.doc('noveliaaConfig/access').set(config);
      });
      await t.test('write transaction rechecks revocation, scope, owner reset and current source after preflight', async () => {
        const config = (await db.doc('noveliaaConfig/access').get()).data(), head = (await root.collection('documents').doc('scene').get()).data();
        const raced = mutate => ({ root: access.root.bind(access), page: async (...args) => { const result = await access.page(...args); await mutate(); return result; } });
        const fresh = { ...heartbeat, idempotencyKey: 'heartbeat-raced-attempt' };
        const attempts = [
          () => store.put('grants', grant.id, { ...grant, revoked: true }),
          () => store.put('grants', grant.id, { ...grant, universeIds: ['private'] }),
          () => store.put('grants', grant.id, { ...grant, allowProposals: false }),
          () => db.doc('noveliaaConfig/access').set({ ...config, workspaceId: 'heartbeat-reset' }),
          () => root.collection('documents').doc('scene').set({ ...head, headRevisionId: 'changed-during-preflight' })
        ];
        for (const mutate of attempts) {
          await assert.rejects(submitHeartbeat({ access: raced(mutate), store }, grant, fresh), /Connection changed|Writing changed/);
          await store.put('grants', grant.id, grant); await db.doc('noveliaaConfig/access').set(config); await root.collection('documents').doc('scene').set(head);
        }
        assert.equal((await root.collection('heartbeatReceipts').get()).size, 1);
        const concurrent = { ...heartbeat, idempotencyKey: 'heartbeat-concurrent-0001' };
        const duplicates = await Promise.all([submitHeartbeat({ access, store }, grant, concurrent), submitHeartbeat({ access, store }, grant, concurrent)]);
        assert.deepEqual(duplicates.map(receipt => receipt.replayed).sort(), [false, true]);
        assert.equal((await annotationPath.get()).size, 2);
        const conflicts = await Promise.allSettled([submitHeartbeat({ access, store }, grant, { ...heartbeat, idempotencyKey: 'heartbeat-concurrent-conflict', contextNote: 'First interpretation.' }), submitHeartbeat({ access, store }, grant, { ...heartbeat, idempotencyKey: 'heartbeat-concurrent-conflict', contextNote: 'Second interpretation.' })]);
        assert.deepEqual(conflicts.map(result => result.status).sort(), ['fulfilled', 'rejected']);
      });
      await t.test('continuous explicit rest is computed, and legacy receipts/records retain their original stored content', async () => {
        const continuous = { ...heartbeat, idempotencyKey: 'heartbeat-continuous-rest', beats: [{ ...beat, start: 0, end: original.snapshot.plainText.length, quote: original.snapshot.plainText, foreground: 'Rest', tone: 'neutral', trajectory: 'quiet' }] };
        const result = await call(continuous), receipt = result.body.result.structuredContent;
        assert.equal(receipt.coverage.status, 'continuous'); assert.equal(receipt.coverage.uncoveredMeaningfulCharacters, 0);
        const saved = (await annotationPath.doc(receipt.id).get()).data();
        assert.deepEqual(saved.coverage, heartbeatCoverage(original.snapshot.plainText, continuous.beats));
        assert.deepEqual(saved.beats, continuous.beats);
        // Seed only synthetic historical integration metadata, never source writing.
        const legacyInput = { ...heartbeat, idempotencyKey: 'heartbeat-pre-continuity' }, legacyId = digest(grant.id + ':' + legacyInput.idempotencyKey);
        const { coverage: _coverage, ...legacy } = (await annotationPath.doc(first.body.result.structuredContent.id).get()).data();
        const createdAt = '2099-01-01T00:00:00.000Z';
        const legacyRecord = { ...legacy, id: legacyId, createdAt };
        const legacyReceipt = { id: legacyId, schema: 'noveliaa-heartbeat-1', verification: 'unverified', sourceIsCurrent: true, createdAt };
        const receiptRef = root.collection('heartbeatReceipts').doc(legacyId);
        await annotationPath.doc(legacyId).create(legacyRecord);
        await receiptRef.create({ fingerprint: digest(stable(legacyInput)), receipt: legacyReceipt, annotationPath: annotationPath.doc(legacyId).path });
        try {
          assert.deepEqual((await call(legacyInput)).body.result.structuredContent, { ...legacyReceipt, replayed: true });
          const legacyRead = await (await read()).json();
          assert.equal(legacyRead.annotations[0].id, legacyId); assert.equal(legacyRead.annotations[0].coverage.status, 'sparse');
          assert.deepEqual((await annotationPath.doc(legacyId).get()).data(), legacyRecord);
          assert.deepEqual((await receiptRef.get()).data().receipt, legacyReceipt);
          assert((await call({ ...legacyInput, contextNote: 'Changed historical content.' })).body.result.isError);
        } finally { await annotationPath.doc(legacyId).delete(); await receiptRef.delete(); }
      });
      await t.test('legacy empty beats remain accepted as sparse; source changes hide history and reject stale retry', async () => {
        const quiet = await call({ ...heartbeat, idempotencyKey: 'heartbeat-quiet-0001', beats: [] }); assert.equal(quiet.body.result.structuredContent.replayed, false);
        assert.equal(quiet.body.result.structuredContent.coverage.status, 'sparse');
        assert.equal((await (await read()).json()).annotations.length, 1);
        const newer = await stage('scene', 'granted', 'heartbeat-r2', 'Changed synthetic source.');
        assert.deepEqual(await (await read()).json(), { schema: 'noveliaa-heartbeat-1', annotations: [], sourceIsCurrent: false });
        assert((await call(heartbeat)).body.result.isError);
        const newUrl = '/api/integrations/heartbeat?' + new URLSearchParams({ documentId: 'scene', revisionId: newer.id, contentHash: newer.contentHash });
        assert.deepEqual((await (await request(newUrl, { headers: { Authorization: 'Bearer ' + ownerToken } })).json()).annotations, []);
        await root.collection('documents').doc('scene').set({ id: 'scene', universeId: 'granted', headRevisionId: 'r1' });
        await root.collection('revisions').doc(newer.id).delete();
        const meta = (await root.collection('revisions').doc('r1').get()).data();
        const manifest = (await root.collection('blobs').doc(meta.blobHash).get()).data();
        const chunkRef = root.collection('chunks').doc(manifest.chunks[0]), saved = (await chunkRef.get()).data();
        await chunkRef.set({ ...saved, bytes: Buffer.from('corrupt') }); assert.equal((await read()).status, 400); await chunkRef.set(saved);
        // Temporary source fixtures are removed only from this synthetic lane.
        const allBlobs = await root.collection('blobs').get();
        for (const blob of allBlobs.docs) if (blob.id !== meta.blobHash && !(await root.collection('revisions').where('blobHash', '==', blob.id).get()).size) {
          for (const chunk of blob.data().chunks) await root.collection('chunks').doc(chunk).delete();
          await blob.ref.delete();
        }
      });
      assert.equal(await sourceState(), before);
      assert.equal((await root.collection('collaboration').get()).size, 1);
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
