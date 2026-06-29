const CACHE_NAME = "catchment-pulse-wq-v0-6-0";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./debug.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./data/latest.json",
  "./data/thresholds.json",
  "./data/focus-areas.json",
  "./js/api.js",
  "./js/charts.js",
  "./js/cqEngine.js",
  "./js/freshness.js",
  "./js/sourceScope.js",
  "./js/liveSignals.js",
  "./js/chemistryLayer.js",
  "./js/config.js",
  "./js/debug.js",
  "./js/dataExplorer.js",
  "./js/format.js",
  "./js/map.js",
  "./js/panels.js",
  "./js/pwa.js",
  "./js/pulse.js",
  "./js/pulseEngine.js",
  "./js/records.js",
  "./js/thresholds.js",
  "./js/units.js",
  "./js/view.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.endsWith("/data/latest.json")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
