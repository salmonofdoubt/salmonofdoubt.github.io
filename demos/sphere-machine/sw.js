const CACHE_NAME = 'sphere-machine-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=20260818-8',
  './ux.css?v=20260818-1',
  './stage-controls.css?v=20260819-2',
  './polish.css?v=20260819-4',
  './app.js?v=20260819-2',
  './quantum.js?v=20260819-2',
  './radial-probability.js',
  './classical-profile.js',
  './shape-model.js',
  './pwa.js',
  './startup-slow.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  '../../assets/css/site.css',
  '../shared/demo-return.css',
  '../shared/demo-return.js',
  '../shared/demo-support.css',
  '../shared/demo-support.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
