import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { mcpAuthRouter, createOAuthMetadata } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { FieldPath } from 'firebase-admin/firestore';
import { createIntegrationServer } from './integration-tools.mjs';
import { digest, secret, stable, validId } from './integration-store.mjs';
import { READ, PROPOSE } from './integration-oauth.mjs';
export function integrationApp({ provider, store, access, verifyIdentity }) {
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 1);
  app.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }); next(); });
  app.use(express.json({ limit: '128kb' }));
  app.get('/api/integrations/health', (_req, res) => res.json({ service: 'noveliaa-plugin', version: '0.1.0', resource: provider.resource }));
  const oauthOptions = { provider, issuerUrl: new URL(provider.origin), resourceServerUrl: new URL(provider.resource), scopesSupported: [READ, PROPOSE], resourceName: 'Noveliaa private writing',
    clientRegistrationOptions: { clientSecretExpirySeconds: 0, rateLimit: { max: 20 } } };
  const oauth = mcpAuthRouter(oauthOptions);
  // Previously installed workers cache navigation except paths containing api.
  // Publish an uncached authorization entry without forcing a live writer's
  // coherent offline shell to activate a new worker or discard unsaved work.
  app.get('/.well-known/oauth-authorization-server', (_req, res) => res.set('Access-Control-Allow-Origin', '*').json({ ...createOAuthMetadata(oauthOptions), authorization_endpoint: provider.origin + '/api/oauth/authorize' }));
  app.use('/api/oauth', oauth);
  app.use(oauth);
  const csrf = req => /(?:^|;\s*)__session=([^;]+)/.exec(req.get('cookie') || '')?.[1];
  app.use('/api/integrations', rateLimit({ windowMs: 60000, max: 90, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
    if (req.method !== 'GET' && (req.get('origin') !== provider.origin || !req.is('application/json'))) { res.status(403).json({ error: 'This action must start in Noveliaa.' }); return; }
    try {
      const token = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '')?.[1];
      if (!token) throw new Error('Sign in to Noveliaa.');
      const identity = await verifyIdentity(token);
      req.author = await provider.checkIdentity(identity.uid, identity.authenticatedAt); next();
    } catch { res.status(403).json({ error: 'Sign in with the authorized Noveliaa author account.' }); }
  });
  app.get('/api/integrations/consent', async (req, res) => {
    const pending = await provider.pending(String(req.query.request || ''), csrf(req));
    const universes = await store.db.collection(`noveliaaWorkspaces/${req.author.workspaceId}/universes`).limit(100).get();
    res.json({ clientName: pending.clientName, requestedWrite: pending.scopes.includes(PROPOSE), universes: universes.docs.map(d => ({ id: d.id, name: d.data().name })) });
  });
  app.post('/api/integrations/consent', async (req, res) => {
    if (typeof req.body.requestId !== 'string') throw new Error('Missing connection request.');
    const redirect = await provider.approve(req.body.requestId, csrf(req), { uid: req.author.uid, authenticatedAt: req.author.authenticatedAt }, req.body);
    res.clearCookie('__session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); res.json({ redirect });
  });
  const recordPage = async (owner, before) => {
    const root = access.root(owner);
    let query = root.collection('collaboration').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(51);
    if (before) {
      if (!validId(before)) throw new Error('Invalid record cursor.');
      const cursor = await root.collection('collaboration').doc(before).get();
      if (!cursor.exists) throw new Error('Record cursor is unavailable.');
      query = query.startAfter(cursor);
    }
    const found = await query.get(), items = found.docs.slice(0, 50);
    if (!items.length) return { records: [], nextCursor: null };
    const states = await store.db.getAll(...items.map(item => root.collection('collaborationReview').doc(item.id)));
    const heads = await store.db.getAll(...items.map(item => root.collection('documents').doc(item.data().anchor.documentId)));
    return { records: items.map((doc, i) => ({ ...doc.data(), decision: states[i].data()?.decision ?? null, sourceIsCurrent: heads[i].data()?.headRevisionId === doc.data().anchor.revisionId })), nextCursor: found.size > 50 ? items.at(-1).id : null };
  };
  app.get('/api/integrations', async (req, res) => {
    const grants = await store.db.collection('_noveliaaMcp/grants/oauthItems').where('workspaceId', '==', req.author.workspaceId).limit(100).get();
    const safe = grants.docs.map(doc => doc.data()).filter(g => g.uid === req.author.uid).map(g => ({ id: g.id, clientName: g.clientName, universeNames: g.universeNames, allowProposals: g.allowProposals, createdAt: g.createdAt, revoked: g.revoked || g.expiresAt <= Date.now() / 1000 }));
    res.json({ grants: safe, ...await recordPage(req.author, req.query.before) });
  });
  app.post('/api/integrations/revoke', async (req, res) => {
    const grant = await store.get('grants', String(req.body.grantId));
    if (!grant || grant.uid !== req.author.uid || grant.workspaceId !== req.author.workspaceId) throw new Error('Connection is unavailable.');
    await store.put('grants', grant.id, { ...grant, revoked: true }); res.json({ ok: true });
  });
  app.post('/api/integrations/decision', async (req, res) => {
    const { recordId, decision } = req.body;
    if (!validId(recordId) || !['reviewed', 'dismissed'].includes(decision)) throw new Error('Invalid review decision.');
    const root = access.root(req.author);
    await store.db.runTransaction(async tx => {
      const [record, config, prior] = await tx.getAll(root.collection('collaboration').doc(recordId), store.db.doc('noveliaaConfig/access'), root.collection('collaborationReview').doc(recordId));
      if (!record.exists || config.data()?.ownerUid !== req.author.uid || (config.data().workspaceId ?? req.author.uid) !== req.author.workspaceId) throw new Error('Writing workspace changed. Reopen this page.');
      if (prior.data()?.decision === decision) return;
      const event = { recordId, decision, authorUid: req.author.uid, createdAt: new Date().toISOString(), approvesCanon: false };
      tx.create(root.collection('collaborationDecisions').doc(secret()), event);
      tx.set(root.collection('collaborationReview').doc(recordId), event);
    });
    res.json({ ok: true });
  });
  app.get('/api/integrations/export', async (req, res) => {
    const root = access.root(req.author), [records, decisions] = await Promise.all([root.collection('collaboration').get(), root.collection('collaborationDecisions').get()]);
    const archive = { schema: 'noveliaa-collaboration-1', exportedAt: new Date().toISOString(), workspaceId: req.author.workspaceId,
      records: records.docs.map(d => d.data()), decisions: decisions.docs.map(d => ({ id: d.id, ...d.data() })), includesWritingArchive: false,
      note: 'External submissions remain AI-origin and unverified. Review is not canon approval. Export writing separately using Import & export.' };
    const bytes = stable(archive);
    if (Buffer.byteLength(bytes) > 24 * 1024 * 1024) { res.status(413).json({ error: 'Collaboration archive exceeds one download. Contact support for a partitioned export; all records remain preserved.' }); return; }
    res.json({ ...archive, sha256: digest(bytes) });
  });
  app.use('/mcp', rateLimit({ windowMs: 60000, max: 120, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
    const origin = req.get('origin');
    if (origin && ![provider.origin, 'https://chatgpt.com'].includes(origin)) { res.status(403).end(); return; }
    const raw = req.get('authorization');
    if (raw) {
      try { req.mcpAuth = await provider.verifyAccessToken(/^Bearer (\S+)$/.exec(raw)?.[1] || ''); }
      catch { res.set('WWW-Authenticate', `Bearer resource_metadata="${provider.origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token"`).status(401).json({ error: 'Reconnect Noveliaa from ChatGPT.' }); return; }
    }
    next();
  });
  app.post('/mcp', async (req, res) => {
    // Public discovery contains schemas only. Every private tool enforces OAuth.
    const server = createIntegrationServer({ access, provider, store, auth: req.mcpAuth });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport); await transport.handleRequest(req, res, req.body);
  });
  app.all('/mcp', (_req, res) => res.set('Allow', 'POST').status(405).end());
  app.use((_req, res) => res.status(404).json({ error: 'Unknown integration endpoint.' }));
  app.use((error, _req, res, _next) => {
    // Never log incoming tokens, request bodies or writing.
    if (!res.headersSent) res.status(400).json({ error: error.message?.slice(0, 300) || 'Request could not complete. Reconnect and try again.' });
  });
  return app;
}
