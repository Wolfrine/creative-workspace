// Adapted from PTI's working SDK OAuth provider; Noveliaa adds universe grants,
// reset generation isolation, expiring refresh families and author revocation.
import { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { digest, secret, now, validId } from './integration-store.mjs';
export const READ = 'noveliaa:read', PROPOSE = 'noveliaa:propose';
const valid = v => !!v && Number.isFinite(v.expiresAt) && v.expiresAt > now();
const checked = v => { if (!valid(v)) throw new InvalidGrantError('Connection request expired or already used. Reconnect from ChatGPT.'); return v; };
export class NoveliaaOAuthProvider {
  constructor(store, origin, checkIdentity) {
    this.store = store; this.origin = origin; this.resource = origin + '/mcp'; this.checkIdentity = checkIdentity;
    this.clientsStore = {
      getClient: async id => store.get('clients', id),
      registerClient: async metadata => {
        if (!metadata.redirect_uris?.length || metadata.redirect_uris.length > 4 || !['none', 'client_secret_post'].includes(metadata.token_endpoint_auth_method ?? 'none')) throw new InvalidClientMetadataError('Unsupported client.');
        for (const uri of metadata.redirect_uris) {
          const u = new URL(uri);
          // Exact registered URI matching is then enforced by the SDK. Restrict
          // registration to documented ChatGPT callbacks; no wildcard origins.
          if (u.origin !== 'https://chatgpt.com' || u.search || u.hash || u.username || u.password || !(u.pathname === '/connector_platform_oauth_redirect' || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname))) throw new InvalidClientMetadataError('Only ChatGPT OAuth callback URIs are supported.');
        }
        // SDK registration generates a secret when the request omits a method.
        // Return an explicit supported method; undefined would mean Basic to a
        // standards-based client, whereas this SDK implements secret-in-body.
        const client = { ...metadata, token_endpoint_auth_method: metadata.token_endpoint_auth_method ?? (metadata.client_secret ? 'client_secret_post' : 'none'),
          client_name: String(metadata.client_name || 'ChatGPT').slice(0, 120), client_id: secret(), client_id_issued_at: now() };
        await store.put('clients', client.client_id, client); return client;
      }
    };
  }
  target(resource) { if (!resource || resource.href !== this.resource) throw new InvalidTargetError('Use the Noveliaa MCP resource.'); }
  scopes(scopes) {
    const values = scopes?.length ? [...new Set(scopes)] : [READ];
    if (!values.includes(READ) || values.some(s => ![READ, PROPOSE].includes(s))) throw new InvalidScopeError('Unsupported Noveliaa scope.');
    return values;
  }
  async authorize(client, params, res) {
    this.target(params.resource);
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidGrantError('S256 PKCE is required.');
    const requestId = secret(), csrf = secret();
    await this.store.put('pending', requestId, { clientId: client.client_id, clientName: client.client_name,
      redirectUri: params.redirectUri, state: params.state || '', challenge: params.codeChallenge,
      scopes: this.scopes(params.scopes), csrf: digest(csrf), expiresAt: now() + 600 });
    // Hosting forwards only __session. Use that cookie, not a custom cookie name.
    res.cookie('__session', csrf, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600000 });
    res.redirect(this.origin + '/connect?request=' + encodeURIComponent(requestId));
  }
  async pending(id, csrf) {
    const pending = checked(await this.store.get('pending', id));
    if (!csrf || pending.csrf !== digest(csrf)) throw new InvalidGrantError('Consent browser session does not match. Reconnect from ChatGPT.');
    return pending;
  }
  async approve(requestId, csrf, identity, options) {
    const owner = await this.checkIdentity(identity.uid, identity.authenticatedAt);
    const pending = await this.pending(requestId, csrf);
    const url = new URL(pending.redirectUri);
    if (pending.state) url.searchParams.set('state', pending.state);
    if (options.deny === true) {
      await this.store.consume('pending', requestId, v => { checked(v); if (v.csrf !== digest(csrf)) throw new InvalidGrantError('Consent session changed.'); }, []);
      url.searchParams.set('error', 'access_denied'); return url.href;
    }
    const ids = options.universeIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => !validId(id))) throw new InvalidScopeError('Select between one and ten universes.');
    const docs = await this.store.db.getAll(...ids.map(id => this.store.db.doc(`noveliaaWorkspaces/${owner.workspaceId}/universes/${id}`)));
    if (docs.some(doc => !doc.exists)) throw new InvalidScopeError('A selected universe is no longer available.');
    const allowProposals = options.allowProposals === true && pending.scopes.includes(PROPOSE);
    const grantId = secret(), code = secret(), expiresAt = now() + 90 * 86400;
    const grant = { id: grantId, uid: owner.uid, workspaceId: owner.workspaceId, authenticatedAt: identity.authenticatedAt,
      clientId: pending.clientId, clientName: pending.clientName, universeIds: ids, universeNames: docs.map(doc => String(doc.data().name)),
      allowProposals, scopes: allowProposals ? [READ, PROPOSE] : [READ], revoked: false, createdAt: new Date().toISOString(), expiresAt };
    await this.store.consume('pending', requestId, v => { checked(v); if (v.csrf !== digest(csrf)) throw new InvalidGrantError('Consent session changed.'); }, [
      { kind: 'grants', key: grantId, value: grant },
      { kind: 'codes', key: code, value: { ...pending, grantId, expiresAt: now() + 120 } }
    ]);
    url.searchParams.set('code', code); return url.href;
  }
  async grant(grantId) {
    const grant = checked(await this.store.get('grants', grantId));
    if (grant.revoked) throw new InvalidGrantError('Connection revoked.');
    const owner = await this.checkIdentity(grant.uid, grant.authenticatedAt);
    if (owner.workspaceId !== grant.workspaceId) throw new InvalidGrantError('Workspace was reset. Reconnect with the current writing.');
    return grant;
  }
  async challengeForAuthorizationCode(client, code) {
    const value = checked(await this.store.get('codes', code));
    if (value.clientId !== client.client_id) throw new InvalidGrantError('Client mismatch.'); return value.challenge;
  }
  async exchange(kind, key, client, redirectUri, scopes, resource) {
    this.target(resource);
    const value = checked(await this.store.get(kind, key)), grant = await this.grant(value.grantId);
    const validate = v => { checked(v); if (v.clientId !== client.client_id || kind === 'codes' && v.redirectUri !== redirectUri) throw new InvalidGrantError('Client or redirect mismatch.'); };
    validate(value);
    const selected = scopes ? this.scopes(scopes) : grant.scopes;
    if (selected.some(s => !grant.scopes.includes(s)) || selected.some(s => value.scopes && !value.scopes.includes(s))) throw new InvalidScopeError('Scope cannot be increased.');
    const access = secret(), refresh = secret();
    const base = { clientId: client.client_id, grantId: grant.id, scopes: selected, resource: this.resource };
    try { await this.store.consume(kind, key, validate, [
      { kind: 'access', key: access, value: { ...base, expiresAt: now() + 3600 } },
      { kind: 'refresh', key: refresh, value: { ...base, expiresAt: grant.expiresAt } },
      { kind: 'spent', key, value: { grantId: grant.id, clientId: client.client_id, expiresAt: grant.expiresAt } }
    ]); } catch { throw new InvalidGrantError('Grant already used.'); }
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope: selected.join(' ') };
  }
  exchangeAuthorizationCode(client, code, _verifier, redirectUri, resource) { return this.exchange('codes', code, client, redirectUri, undefined, resource); }
  async revokeReplay(client, token) {
    const spent = await this.store.get('spent', token);
    if (valid(spent) && spent.clientId === client.client_id) {
      const grant = await this.store.get('grants', spent.grantId);
      if (grant && !grant.revoked) await this.store.put('grants', grant.id, { ...grant, revoked: true });
      return true;
    }
    return false;
  }
  async exchangeRefreshToken(client, token, scopes, resource) {
    if (await this.revokeReplay(client, token)) throw new InvalidGrantError('Refresh replay detected. Reconnect from ChatGPT.');
    try { return await this.exchange('refresh', token, client, undefined, scopes, resource); }
    catch (error) {
      // Cover both race windows: losing transaction consumption AND finding the
      // source already consumed after an initially empty spent-marker read.
      await this.revokeReplay(client, token); throw error;
    }
  }
  async verifyAccessToken(token) {
    try {
      const value = checked(await this.store.get('access', token));
      if (value.resource !== this.resource) throw new Error('Resource mismatch.');
      const grant = await this.grant(value.grantId);
      return { token, clientId: value.clientId, scopes: value.scopes, resource: new URL(this.resource), expiresAt: value.expiresAt, extra: { grant } };
    } catch { throw new InvalidTokenError('Connection expired, revoked or reset. Reconnect from ChatGPT.'); }
  }
  async revokeToken(client, request) {
    const value = await this.store.get('access', request.token) || await this.store.get('refresh', request.token) || await this.store.get('spent', request.token);
    if (value?.clientId === client.client_id) {
      const grant = await this.store.get('grants', value.grantId);
      if (grant) await this.store.put('grants', grant.id, { ...grant, revoked: true });
    }
  }
}
