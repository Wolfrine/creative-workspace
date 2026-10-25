import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test.use({ serviceWorkers: 'allow' });
for (const width of [1440, 390]) test(`Previous deployed offline worker cannot swallow plugin connection navigation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const source = await readFile('tests/helpers/legacy-writing-worker.js');
  const provenance = JSON.parse(await readFile('tests/helpers/legacy-writing-worker.json', 'utf8'));
  expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sha256);
  const legacy = source.toString('utf8').replace('__BUILD_ID__', 'legacy-plugin-regression');
  let authorizationRequests = 0;
  // Serve the exact former worker against the real production client build.
  // Only this loopback fixture origin receives the deliberately stale shell.
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      if (path === '/sw.js') { response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }); response.end(legacy); return; }
      if (path === '/api/oauth/authorize') {
        authorizationRequests++; response.writeHead(400, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'invalid_client', probe: 'legacy-cache probe reached server' })); return;
      }
      const upstream = await fetch('http://127.0.0.1:5818' + (request.url || '/'));
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { response.writeHead(500); response.end('Loopback fixture unavailable'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Loopback server missing');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(origin);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.evaluate(async () => {
      const cache = await caches.open('noveliaa-shell-legacy-plugin-regression');
      await cache.put('/index.html', new Response('<!doctype html><html><body>OLD_WRITER_SHELL — synthetic stale-cache sentinel</body></html>', { headers: { 'Content-Type': 'text/html' } }));
    });
    await page.goto(origin + '/connect?request=fixture');
    await expect(page.locator('body')).toContainText('OLD_WRITER_SHELL');
    for (const path of ['/api/integrations/connect?request=fixture', '/api/integrations/review']) {
      await page.goto(origin + path);
      await expect(page.locator('body')).not.toContainText('OLD_WRITER_SHELL');
      await expect(page.getByRole('heading', { name: 'Your words. Your permission.' })).toBeVisible();
      // Production aliases keep the normal author gate; they are not a bypass.
      await expect(page.getByRole('heading', { name: 'Choose what leaves the page.' })).toHaveCount(0);
    }
    const auth = await page.goto(origin + '/api/oauth/authorize?client_id=invalid-probe');
    expect(auth?.status()).toBe(400); expect(authorizationRequests).toBe(1);
    await expect(page.locator('body')).toContainText('legacy-cache probe reached server');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
