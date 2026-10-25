import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// All collaboration data here is synthetic. API calls are intercepted before they
// leave the browser. Existing DEV + loopback device preview supplies no token.
const grant = { id: 'grant-sample', clientName: 'ChatGPT', universeNames: ['The Saltwater Ledger'], allowProposals: true, createdAt: '2026-10-25T12:00:00Z', revoked: false };
const record = { id: 'proposal-sample', kind: 'proposal', title: 'Let the harbour keep one secret', body: 'The key could connect the harbour scene to Mira’s earlier promise.\n\nThis is an interpretation, not an established story fact. One possibility: let her recognise the door but choose not to open it yet. That keeps the choice with Mira, without explaining the mystery too soon.\n\nA question for you: does the promise belong to her childhood, or to the ferry crossing?', createdAt: '2026-10-25T12:30:00Z', origin: 'ai', verification: 'unverified', anchor: { documentId: 'document-sample', revisionId: 'revision-sample', contentHash: '4d'.repeat(32), title: 'When the steps returned' }, decision: null, sourceIsCurrent: true };
type Fixture = { consent?: unknown; overview?: unknown; status?: number; delayed?: boolean };
async function mock(page: Page, fixture: Fixture = {}) {
  const calls: { path: string; method: string; body: any }[] = [];
  await page.route('**/api/integrations**', async route => {
    const request = route.request(); const url = new URL(request.url()); const body = request.postDataJSON();
    calls.push({ path: url.pathname + url.search, method: request.method(), body });
    if (fixture.delayed) await new Promise(resolve => setTimeout(resolve, 1000));
    if (url.pathname === '/api/integrations/consent' && request.method() === 'GET') return route.fulfill({ status: fixture.status || 200, json: fixture.consent ?? { clientName: 'ChatGPT', requestedWrite: true, universes: [{ id: 'saltwater', name: 'The Saltwater Ledger' }, { id: 'glass', name: 'The Glass Orchard' }] } });
    if (url.pathname === '/api/integrations/consent') return route.fulfill({ json: { redirect: 'http://127.0.0.1:5817/connections?local=1&consent=' + (body.deny ? 'denied' : 'allowed') } });
    if (url.pathname === '/api/integrations/export') return route.fulfill({ json: { schema: 'noveliaa-collaboration', version: 1, records: [record], decisions: [], digest: 'synthetic' } });
    if (request.method() === 'POST') return route.fulfill({ json: { ok: true } });
    return route.fulfill({ status: fixture.status || 200, json: fixture.overview ?? { grants: [grant], records: [record], nextCursor: null } });
  });
  return calls;
}
async function open(page: Page, route: string) { await page.goto(route); await page.evaluate(() => document.fonts.ready); }
async function capture(page: Page, cycle: number, name: string) {
  if (process.env.NOVELIAA_PLUGIN_CAPTURE !== '1') return;
  const folder = path.resolve('docs/evidence/plugin-2026-10-25/ui/' + (process.env.NOVELIAA_PLUGIN_CAPTURE_OVERRIDE === 'final' ? 'final' : 'cycle-' + cycle)); await mkdir(folder, { recursive: true });
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  const scrollY = await page.evaluate(() => window.scrollY);
  const viewportImage = await page.screenshot({ path: path.join(folder, name + '.viewport.png') });
  // Start full-page capture at the document top: Chromium otherwise projects a
  // fixed, offscreen skip link into tall document captures at the scroll offset.
  await page.evaluate(() => window.scrollTo(0, 0));
  const image = await page.screenshot({ path: path.join(folder, name + '.png'), fullPage: true });
  const topImage = await page.screenshot({ path: path.join(folder, name + '.top.png') }); await page.evaluate(y => window.scrollTo(0, y), scrollY);
  const regions: Record<string, string> = {};
  if (name.startsWith('long-source')) for (const region of ['record-source', 'record-reference']) {
    const image = await page.locator('.' + region).screenshot({ path: path.join(folder, name + '.' + region + '.png') });
    regions[region] = createHash('sha256').update(image).digest('hex');
  }
  const sourceFiles: Record<string, string> = {};
  const sourceFolder = path.join(folder, 'source'); await mkdir(sourceFolder, { recursive: true });
  for (const sourcePath of ['src/components/Integrations.tsx', 'src/components/integrations.css', 'src/cloud/integrations.ts', 'src/AppHost.tsx', 'src/App.tsx', 'src/styles.css', 'src/library-reader.css']) {
    const bytes = await readFile(sourcePath); sourceFiles[sourcePath] = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(sourceFolder, sourcePath.replaceAll('/', '_') + '.txt'), bytes);
  }
  const proof = { synthetic: true, route: new URL(page.url()).pathname, fixture: name, viewport: page.viewportSize(), focus: 'cleared for ordinary reading baseline; keyboard interaction checked separately', imageSha256: createHash('sha256').update(image).digest('hex'), viewportSha256: createHash('sha256').update(viewportImage).digest('hex'), topSha256: createHash('sha256').update(topImage).digest('hex'), regions, sourceFiles, sourceDigest: createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex'), capturedAt: new Date().toISOString() };
  await writeFile(path.join(folder, name + '.json'), JSON.stringify(proof, null, 2) + '\n');
}
async function fit(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('Plugin cycle 1: consent scope and returned proposal baseline', async ({ page }) => {
  const calls = await mock(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await open(page, '/connect?local=1&request=synthetic');
    await expect(page.getByRole('button', { name: 'Allow selected access' })).toBeDisabled();
    expect(await page.getByRole('checkbox').evaluateAll(inputs => inputs.every(input => !(input as HTMLInputElement).checked))).toBe(true);
    await expect(page.getByText('Access includes existing and future cloud-saved pages')).toBeVisible();
    await capture(page, 1, 'consent-' + width); await fit(page);
    await open(page, '/connections?local=1'); await expect(page.getByRole('heading', { name: 'Let the harbour keep one secret' })).toBeVisible();
    await capture(page, 1, 'review-' + width); await fit(page);
  }
  expect(calls.every(call => call.method === 'GET')).toBe(true);
});

test('Plugin cycle 2: scope choice, denial and long returned source', async ({ page }) => {
  const longTitle = 'A remembered conversation at the station — what Mira could not tell her brother about the room above the northern harbour';
  const longRecord = { ...record, title: 'A possibility, with room for uncertainty', body: (record.body + '\n\n').repeat(7) + '<script>window.__unsafe = true</script>', anchor: { ...record.anchor, title: longTitle, documentId: 'document-' + 'a'.repeat(130), revisionId: 'revision-' + 'b'.repeat(130) }, sourceIsCurrent: false };
  const calls = await mock(page, { overview: { grants: [grant], records: [longRecord], nextCursor: null } });
  await open(page, '/connect?local=1&request=synthetic'); await page.getByRole('checkbox', { name: 'The Saltwater Ledger' }).check();
  await expect(page.getByRole('button', { name: 'Allow selected access' })).toBeEnabled();
  await capture(page, 2, 'scope-selected-1440');
  await page.getByRole('button', { name: 'Allow selected access' }).click(); await expect(page).toHaveURL(/consent=allowed/);
  expect(calls.find(call => call.method === 'POST')?.body).toEqual({ requestId: 'synthetic', universeIds: ['saltwater'], allowProposals: false });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await open(page, '/connections?local=1');
    await page.getByText('Exact source reference', { exact: true }).click();
    await expect(page.getByText('Your cloud-saved page has changed since this revision.')).toBeVisible(); await fit(page);
    await capture(page, 2, 'long-source-' + width); expect(await page.evaluate(() => (window as any).__unsafe)).toBeUndefined();
  }
  await open(page, '/connect?local=1&request=synthetic'); await capture(page, 2, 'consent-refined-390'); await page.getByRole('button', { name: 'Don’t connect' }).click(); await expect(page).toHaveURL(/consent=denied/);
  expect(calls.some(call => call.body?.deny === true)).toBe(true);
});

test('Plugin cycle 3: author decisions, revoke and collaboration archive', async ({ page }) => {
  const calls = await mock(page, { overview: { grants: [grant], records: [record, { ...record, id: 'discussion-sample', kind: 'discussion', title: 'Questions about the ferry crossing' }], nextCursor: null } });
  await open(page, '/connections?local=1'); await page.locator('.collaboration-record').first().getByRole('button', { name: 'Mark reviewed' }).click();
  await expect(page.getByRole('status')).toContainText('does not approve'); await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.getByRole('button', { name: 'All material' }).click(); await expect(page.getByText('Reviewed · still unverified')).toBeVisible(); await expect(page.getByText('Dismissed · preserved in your archive')).toBeVisible();
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click(); await expect(page.getByText('Stop future access?')).toBeVisible(); await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export collaboration' }).click(); expect((await download).suggestedFilename()).toMatch(/^noveliaa-collaboration-/);
  for (const width of [1440, 390]) { await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await capture(page, 3, 'decisions-revoked-' + width); await fit(page); }
  expect(calls.filter(call => call.path.endsWith('/decision')).map(call => call.body.decision)).toEqual(['reviewed', 'dismissed']);
  expect(calls.filter(call => call.path.endsWith('/revoke'))).toHaveLength(1);
});

test('Plugin cycle 4: empty, expired, pending and offline recoveries', async ({ page }) => {
  await mock(page, { consent: { clientName: 'ChatGPT', requestedWrite: true, universes: [] }, overview: { grants: [], records: [], nextCursor: null } });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await open(page, '/connect?local=1&request=synthetic');
    await expect(page.getByText('There are no universes to share yet.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Allow selected access' })).toBeDisabled(); await capture(page, 4, 'no-universes-' + width);
    await open(page, '/connections?local=1'); await expect(page.getByText('No AI connections yet.')).toBeVisible(); await capture(page, 4, 'empty-' + width);
  }
  await page.unroute('**/api/integrations**'); await mock(page, { status: 410, consent: { error: 'This request has expired. Start again from ChatGPT.' } });
  await open(page, '/connect?local=1&request=expired'); await expect(page.getByRole('alert')).toContainText('expired'); await capture(page, 4, 'expired-390');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 4, 'expired-1440');
  await page.unroute('**/api/integrations**'); await mock(page, { status: 503, overview: { error: 'The connection is temporarily unavailable. Try again in a moment.' } });
  await open(page, '/connections?local=1'); await expect(page.getByRole('alert')).toContainText('temporarily unavailable'); await expect(page.getByText('No AI connections yet.')).toHaveCount(0); await capture(page, 4, 'error-1440');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 4, 'error-390');
  await page.unroute('**/api/integrations**'); await mock(page); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(page.getByRole('heading', { name: record.title })).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.unroute('**/api/integrations**'); await mock(page, { status: 403, consent: { error: 'This request was denied. Start again from ChatGPT.' } });
  await open(page, '/connect?local=1&request=denied'); await expect(page.getByRole('alert')).toContainText('denied'); await capture(page, 4, 'denied-390');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 4, 'denied-1440');
  await page.unroute('**/api/integrations**'); await mock(page, { delayed: true }); await page.goto('/connect?local=1&request=pending'); await expect(page.getByRole('status')).toContainText('Opening the access request'); await capture(page, 4, 'pending-1440');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 4, 'pending-390');
  await page.waitForTimeout(1100); await page.context().setOffline(true); await expect(page.getByText('You’re offline.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Allow selected access' })).toBeDisabled(); await capture(page, 4, 'offline-390'); await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 4, 'offline-1440'); await page.context().setOffline(false);
});

test('Consent narrows large catalogues to ten universes and supports read only requests', async ({ page }) => {
  const calls = await mock(page, { consent: { clientName: 'ChatGPT', requestedWrite: false, universes: Array.from({ length: 11 }, (_, index) => ({ id: 'universe-' + index, name: 'World ' + index })) } });
  await open(page, '/connect?local=1&request=synthetic'); await expect(page.getByText('Choose up to 10 universes')).toBeVisible();
  for (let index = 0; index < 10; index++) await page.getByRole('checkbox', { name: 'World ' + index, exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'World 10', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Also allow discussions & proposals' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'World 0', exact: true }).uncheck(); await page.getByRole('checkbox', { name: 'World 10', exact: true }).check();
  await page.getByRole('button', { name: 'Allow selected access' }).click(); await expect(page).toHaveURL(/consent=allowed/);
  const submitted = calls.find(call => call.method === 'POST')!.body;
  expect(submitted.universeIds).toHaveLength(10); expect(submitted.universeIds).not.toContain('universe-0'); expect(submitted.allowProposals).toBe(false);
});

test('Plugin cycle 5: pagination, accessibility and 320px author journey', async ({ page }) => {
  await mock(page, { overview: { grants: [grant], records: [record, { ...record, id: 'research-sample', kind: 'research', title: 'Where the harbour detail came from' }, { ...record, id: 'critique-sample', kind: 'critique', title: 'A question about the ending' }], nextCursor: 'older-sample' } });
  await open(page, '/connections?local=1');
  await page.route('**/api/integrations?before=*', route => route.fulfill({ json: { grants: [grant], records: [{ ...record, id: 'older-sample', kind: 'discussion', title: 'The first question' }], nextCursor: null } }));
  await page.getByRole('button', { name: 'Load older material' }).click(); await expect(page.getByRole('heading', { name: 'The first question' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Load older material' })).toHaveCount(0);
  await expect(page.locator('.record-origin').filter({ hasText: 'Research' })).toBeVisible(); await expect(page.locator('.record-origin').filter({ hasText: 'Critique' })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await capture(page, 5, 'review-final-' + width); await fit(page);
    const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await open(page, '/connect?local=1&request=synthetic');
  await page.getByRole('checkbox', { name: 'The Glass Orchard' }).check(); await page.getByRole('checkbox', { name: 'Also allow discussions & proposals' }).check(); await capture(page, 5, 'consent-final-390');
  const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
});

test('Current source navigation resolves a real page and preserves writing across universes', async ({ page }) => {
  const notebook = 'plugin-source-' + Date.now();
  await page.goto('/?local=1&notebook=' + notebook); await page.waitForFunction(() => (window as any).__NOVELIAA_TEST__?.getSnapshot().ready);
  const fixture = await page.evaluate(async () => {
    const engine = (window as any).__NOVELIAA_TEST__; const firstUniverse = engine.getSnapshot().activeUniverseId;
    await engine.createUniverse('Another private world'); const id = await engine.createDocument({ title: 'The actual source page', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original words, kept exactly as written.' }] }] } });
    await engine.flush(); await engine.selectUniverse(firstUniverse);
    const state = engine.getSnapshot(); return { id, source: JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals }) };
  });
  await mock(page, { overview: { grants: [grant], records: [{ ...record, anchor: { ...record.anchor, documentId: fixture.id, title: 'The actual source page' } }], nextCursor: null } });
  await page.locator('.utility-nav').getByRole('button', { name: 'AI connections' }).click();
  await expect(page).toHaveURL(new RegExp('notebook=' + notebook));
  await page.getByRole('link', { name: 'Open current page' }).click();
  await expect(page.getByRole('textbox', { name: 'Writing title' })).toHaveValue('The actual source page');
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toContainText('Original words, kept exactly as written.');
  await expect(page).not.toHaveURL(/page=/);
  expect(await page.evaluate(() => { const state = (window as any).__NOVELIAA_TEST__.getSnapshot(); return JSON.stringify({ documents: state.documents, revisions: state.revisions, originals: state.originals }); })).toBe(fixture.source);
});

test('Production consent ignores device preview and does not request private data before sign-in', async ({ page }) => {
  let privateRequests = 0;
  await page.route('**/__/firebase/init.json', route => route.fulfill({ status: 404, body: 'No test Firebase configuration' }));
  await page.route('**/api/integrations**', route => { privateRequests++; return route.fulfill({ status: 401, json: { error: 'Author session required' } }); });
  await page.goto('http://127.0.0.1:5818/connect?local=1&request=synthetic');
  await expect(page.getByRole('heading', { name: /Your words/ })).toBeVisible();
  await expect(page.getByText('Sign in as the author to choose AI access')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0); expect(privateRequests).toBe(0);
});
