const CACHE_NAME = 'salmon-d4b-evidence-quiz-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=20261008-2',
  './app.js?v=20261008-2',
  './site-config.js?v=20261008-2',
  './manifest.webmanifest',
  './icon.svg',
  './quiz.css?v=20261008-2',
  './questions.js?v=20261008-2',
  './quiz.js?v=20261008-2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('salmon-d4b-evidence-quiz-') && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/demos/d4b-quiz/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./') || caches.match('./index.html');
        throw new Error('Offline resource unavailable');
      })
  );
});
