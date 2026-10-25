// Read-only production checks. Never create a grant or proposal for a probe.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const origin = 'https://noveliaa.web.app';
const get = async path => {
  const response = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, path); return response.json();
};
const health = await get('/api/integrations/health'); assert.equal(health.service, 'noveliaa-plugin'); assert.equal(health.resource, origin + '/mcp');
const authorization = await get('/.well-known/oauth-authorization-server');
assert(authorization.code_challenge_methods_supported.includes('S256'));
for (const key of ['authorization_endpoint', 'registration_endpoint', 'token_endpoint']) assert.equal(new URL(authorization[key]).origin, origin);
assert.equal(new URL(authorization.authorization_endpoint).pathname, '/api/oauth/authorize');
// This unknown-client lookup reaches Firestore without creating an OAuth request
// or accessing manuscripts. A runtime IAM/configuration failure must fail release.
const readiness = await fetch(authorization.authorization_endpoint + '?client_id=invalid-readiness-probe&redirect_uri=' + encodeURIComponent('https://chatgpt.com/connector_platform_oauth_redirect'), { cache: 'no-store', signal: AbortSignal.timeout(45000) });
assert.equal(readiness.status, 400); const readinessError = await readiness.json(); assert.equal(readinessError.error, 'invalid_client');
const resource = await get('/.well-known/oauth-protected-resource/mcp'); assert.equal(resource.resource, origin + '/mcp'); assert(resource.authorization_servers.includes(authorization.issuer));
const request = async (method, params, token) => {
  const response = await fetch(origin + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(45000) });
  return { response, body: await response.json() };
};
const discovery = await request('tools/list', {}); assert.equal(discovery.response.status, 200);
const tools = discovery.body.result.tools;
assert.deepEqual(tools.map(t => t.name).sort(), ['fetch_page', 'get_profile', 'list_pages', 'list_universes', 'search_writing', 'submit_record']);
assert(tools.every(t => t._meta.securitySchemes?.[0].type === 'oauth2'));
const challenge = await request('tools/call', { name: 'list_universes', arguments: {} }); assert.equal(challenge.body.result.isError, true); assert(challenge.body.result._meta['mcp/www_authenticate']);
const denied = await request('tools/list', {}, 'invalid-probe-not-a-credential'); assert.equal(denied.response.status, 401); assert(denied.response.headers.get('www-authenticate').includes('resource_metadata='));
const result = { checkedAt: new Date().toISOString(), origin, health, authorization, resource, tools,
  runtimeReadiness: 'Unknown-client Firestore lookup returned invalid_client; no grant or record created.',
  privateAccess: 'Anonymous private tools challenged; invalid bearer rejected. No production author content accessed or mutated.',
  connection: 'Package creation, installation, author OAuth consent and authenticated tool execution require separate verification.' };
await mkdir('.local', { recursive: true }); await writeFile('.local/plugin-hosted-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ origin, version: health.version, discoveredTools: tools.length, oauth: 'PKCE/DCR metadata checked', anonymousPrivateAccess: 'denied' }));
