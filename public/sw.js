const APP_CACHE = 'transit-pwa-clean-v2';
const TILE_CACHE = 'transit-pwa-tiles-pk-v2';
const APP_SHELL = [
  './',
  './app.html',
  './manifest.json',
  './feed.zip',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './gtfs-rt/vehicle_positions.json',
  './vendor/jszip.min.js',
  './gtfs/routes.txt',
  './gtfs/trips.txt',
  './gtfs/stops.txt',
  './gtfs/shapes.txt',
  './gtfs/stop_times.txt'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => ![APP_CACHE, TILE_CACHE].includes(key))
      .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  const isTile =
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname.endsWith('cartocdn.com');

  if (isTile) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'PRELOAD_TILES' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(TILE_CACHE);
    const unique = [...new Set(data.urls)].slice(0, 1200);
    for (const url of unique) {
      const request = new Request(url, { mode: 'cors' });
      if (await cache.match(request)) continue;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
        }
      } catch (_) {}
    }
  })());
});
