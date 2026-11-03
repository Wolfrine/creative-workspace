import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IntegrationStore, stable, now } from '../../functions/src/integration-store.mjs';
import { NoveliaaOAuthProvider, READ, PROPOSE } from '../../functions/src/integration-oauth.mjs';
import { WritingAccess } from '../../functions/src/integration-writing.mjs';
import { integrationApp } from '../../functions/src/integration-http.mjs';

// Actual app, HTTP server and Auth/Firestore emulators. No production project,
// manuscripts, credentials, or DEV-only author bypass are involved.
for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[name] || '')) throw new Error('Loopback emulator required: ' + name);
}
const requireAdmin = createRequire(path.resolve('functions/package.json'));
const { initializeApp, deleteApp } = requireAdmin('firebase-admin/app');
const { getAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore } = requireAdmin('firebase-admin/firestore');
const admin = initializeApp({ projectId: 'demo-noveliaa' }, 'heartbeat-browser');
const auth = getAuth(admin), db = getFirestore(admin), owner = 'heartbeat-browser-author';
const store = new IntegrationStore(db), access = new WritingAccess(db);
const root = db.doc('noveliaaWorkspaces/' + owner);
let loginToken: string;
test.beforeAll(async () => {
  await auth.createUser({ uid: owner, displayName: 'Synthetic Heartbeat author' });
  loginToken = await auth.createCustomToken(owner);
});
test.afterAll(async () => { await deleteApp(admin); });

test('real MCP annotation reaches authenticated writer and private Read without source mutations; revocation hides it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await db.doc('noveliaaConfig/access').set({ ownerUid: owner });
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const provider = new NoveliaaOAuthProvider(store, origin, (uid: string, at: number) => store.owner(uid, at));
  server.on('request', integrationApp({ provider, store, access, verifyIdentity: async (token: string) => {
    const identity = await auth.verifyIdToken(token);
    return { uid: identity.uid, authenticatedAt: identity.auth_time };
  } }));
  let privateReads = 0;
  // Proxy only this endpoint to the real loopback integration server. Its real
  // bearer middleware and Firestore queries execute; no response is mocked.
  await page.route('**/api/integrations/heartbeat?**', async route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    privateReads++;
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: origin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  try {
    await page.goto('/');
    await page.evaluate(async value => {
      const helper = await import(/* @vite-ignore */ '/tests/helpers/emulator-auth.ts');
      await helper.signIn(value);
    }, loginToken);
    await page.getByRole('button', { name: 'New thought ↗', exact: true }).click();
    await page.getByRole('textbox', { name: 'Writing title', exact: true }).fill('Synthetic Heartbeat shore');
    await page.getByRole('textbox', { name: 'Writing canvas', exact: true }).fill('The harbour held its breath. She smiled, but kept the unopened letter.');
    await page.getByRole('button', { name: 'Import & export', exact: true }).click();
    await page.getByRole('button', { name: 'Check cloud sync', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Cloud synchronization checked.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close your writing, in your hands', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Synced', exact: true })).toBeVisible();
    const heads = await root.collection('documents').get(); expect(heads.size).toBe(1);
    const head = heads.docs[0], universeId = head.data().universeId;
    const grant = { id: 'heartbeat-browser-grant', uid: owner, workspaceId: owner, authenticatedAt: now(), clientId: 'synthetic-client', clientName: 'Synthetic MCP client', universeIds: [universeId], universeNames: ['Synthetic world'], allowProposals: true, scopes: [READ, PROPOSE], revoked: false, createdAt: new Date().toISOString(), expiresAt: now() + 3600 };
    await store.put('grants', grant.id, grant);
    const bearer = 'synthetic-emulator-heartbeat-access';
    await store.put('access', bearer, { clientId: grant.clientId, grantId: grant.id, scopes: grant.scopes, resource: provider.resource, expiresAt: now() + 3600 });
    const { revision } = await access.page(grant, head.id);
    const namespaces = ['documents', 'revisions', 'originals', 'operations', 'chunks', 'blobs', 'documentIdentities'];
    const inventory = async () => stable(await Promise.all(namespaces.map(async name => ({ name, rows: (await root.collection(name).get()).docs.map((item: any) => ({ id: item.id, ...item.data() })) }))));
    const before = await inventory();
    const response = await fetch(origin + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + bearer }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'submit_heartbeat', arguments: { documentId: head.id, revisionId: revision.id, contentHash: revision.contentHash, idempotencyKey: 'real-browser-heartbeat-0001', provider: 'Synthetic test provider', model: 'Synthetic test model', contextNote: 'This invented scene only; no real reader response.', beats: [{ start: 0, end: revision.snapshot.plainText.length, quote: revision.snapshot.plainText, foreground: 'Quiet anticipation', undertone: 'Unease', weight: 2, trajectory: 'hold', tone: 'cool', reasoning: 'The harbour personification and unopened letter sustain suspended expectation through both sentences; this is a synthetic inference.' }] } } }) });
    expect(response.status).toBe(200); const receipt = (await response.json()).result; expect(receipt.isError).not.toBe(true);
    expect(receipt.structuredContent.coverage.status).toBe('continuous');
    expect(receipt.structuredContent.coverage.uncoveredMeaningfulCharacters).toBe(0);
    expect(privateReads).toBe(0);
    await page.getByRole('button', { name: 'Emotional Heartbeat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Quiet anticipation. Show interpretation.', exact: true })).toBeVisible();
    const evidence = '.local/heartbeat-rework/real-browser'; await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: evidence + '/writer.png' });
    await page.getByRole('button', { name: 'Read this page', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Private reading mode' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quiet anticipation. Show interpretation.', exact: true })).toBeVisible();
    await page.screenshot({ path: evidence + '/reader.png' });
    expect(await inventory()).toBe(before);
    await store.put('grants', grant.id, { ...grant, revoked: true });
    await page.getByRole('button', { name: 'Refresh Heartbeat', exact: true }).click();
    await expect(page.getByText('No Heartbeat for this revision. Ask your connected AI for a full reading.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quiet anticipation. Show interpretation.', exact: true })).toHaveCount(0);
    expect(await inventory()).toBe(before);
    await writeFile(evidence + '/result.json', JSON.stringify({ syntheticOnly: true, actualMcpHttp: true, actualFirebaseAuthor: true, actualServerScopedReads: privateReads, sourceCollectionsUnchanged: true, grantRevocationHidden: true }, null, 2));
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
