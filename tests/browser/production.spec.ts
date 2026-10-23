import { test, expect } from '@playwright/test';

test('production shell cold reloads offline and development notebook access is absent', async ({ page, context }) => {
  await page.goto('http://127.0.0.1:5818/?local=1&notebook=must-not-open');
  await expect(page.getByText('Private connection awaiting configuration', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__NOVELIAA_TEST__)).toBeUndefined();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cache = await page.evaluate(async () => {
    const keys = await caches.keys(); const entries = await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)));
    return entries.flat();
  });
  expect(cache.some(path => path.endsWith('.js'))).toBe(true);
  expect(cache.some(path => path.endsWith('.woff2'))).toBe(true);
  expect(cache.every(path => ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'].includes(path) || path.startsWith('/assets/'))).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByText('Private connection awaiting configuration', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.styleSheets.length)).toBeGreaterThan(0);
});
