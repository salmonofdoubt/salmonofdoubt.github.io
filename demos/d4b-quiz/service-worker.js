const CACHE_NAME = 'salmon-d4b-evidence-quiz-student-notice-20261121-14';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=20261009-1',
  './app.js?v=20261008-5',
  './site-config.js?v=20261008-5',
  './manifest.webmanifest',
  './icon.svg',
  './quiz.css?v=notice-20261121-14',
  './questions.js?v=dtr-outline-20261121-11',
  './moodle-genai-w1-w6-20261121.js?v=1',
  './moodle-inno-w1-w10-20261121.js?v=2',
  './moodle-dtr-t1-t4-20261121.js?v=1',
  './moodle-dtr-t5-20261121.js?v=1',
  './mock-genai-20261119.js?v=20261119-1',
  './concept-groups-20261119.js?v=1',
  './quiz.js?v=dtr-all25-20261121-12',
  './refresh.js?v=ledger-20261010-v1'
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
