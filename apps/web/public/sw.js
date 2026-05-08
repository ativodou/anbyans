const CACHE_VERSION = 'v2';
const CACHE_NAME = `anbyans-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// URLs that should never be served from cache
const NETWORK_ONLY_PATTERNS = [
  /^https:\/\/firestore\.googleapis\.com/,
  /^https:\/\/firebase\.googleapis\.com/,
  /^https:\/\/identitytoolkit\.googleapis\.com/,
  /^https:\/\/securetoken\.googleapis\.com/,
  /^https:\/\/api\.stripe\.com/,
  /^https:\/\/r\.stripe\.com/,
  /\/api\//,
];

// Static assets that are safe to cache aggressively
const CACHE_FIRST_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\/logo\./,
  /\.(?:woff2?|ttf|otf|eot)$/,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = request.url;

  if (NETWORK_ONLY_PATTERNS.some(p => p.test(url))) return;

  if (CACHE_FIRST_PATTERNS.some(p => p.test(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    return new Response('Offline', { status: 503 });
  }
}
