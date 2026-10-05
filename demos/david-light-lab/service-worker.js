const CACHE_NAME = 'david-light-lab-shell-v14-pan';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=20261005-1912',
  './site-config.js?v=20261005-1912',
  './app.js?v=20261005-2202',
  './stl-worker.js?v=20261005-1640',
  './manifest.webmanifest',
  './icon.svg',
  './assets/david-head.dlb?v=20261005-H70',
  '../shared/demo-return.css',
  '../shared/demo-return.js',
  '../shared/demo-support.css',
  '../shared/demo-support.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (event.request.method === 'GET' && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
