// Offline support for Sky Mood.
// - Page and forecast requests: try the network first, fall back to the last saved copy.
// - Everything else from this site (scripts, styles, icons) and fonts: serve the saved copy
//   straight away and refresh it in the background.

const CACHE = 'sky-mood-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isApi = url.hostname.endsWith('open-meteo.com');
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isSame = url.origin === self.location.origin;
  if (!isApi && !isFont && !isSame) return;

  if (isApi || req.mode === 'navigate') {
    event.respondWith(networkFirst(req, isApi));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req, markOffline) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (!cached) throw err;
    if (!markOffline) return cached;
    // Tell the page this forecast came from the saved copy
    const headers = new Headers(cached.headers);
    headers.set('X-Sky-Offline', '1');
    headers.set('Access-Control-Expose-Headers', 'X-Sky-Offline');
    return new Response(await cached.blob(), { status: 200, headers });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fresh;
}
