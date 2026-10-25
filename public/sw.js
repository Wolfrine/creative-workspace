/* Cache only public application assets. Private writing is never in this cache. */
const CACHE = 'noveliaa-shell-__BUILD_ID__';
const ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', /*__PRECACHE__*/];
self.addEventListener('install', event => {
  // A replacement worker cannot activate until its ENTIRE version is cached.
  // No skipWaiting: an open writer keeps its current coherent application version.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('noveliaa-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/__/') || url.pathname.startsWith('/.well-known/') || ['/mcp', '/authorize', '/token', '/register', '/revoke'].includes(url.pathname) || url.pathname.includes('api') || !(event.request.mode === 'navigate' || url.pathname.startsWith('/assets/') || ['/favicon.svg', '/manifest.webmanifest'].includes(url.pathname))) return;
  // This cache contains only identical public shell bytes. Development/preview
  // Vary: Origin must not make a CORS asset miss its precached same-origin copy.
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request.mode === 'navigate' ? '/index.html' : event.request, { ignoreVary: true })) || fetch(event.request)));
});
