const CACHE_NAME = "diandre-art-v1";

const CORE_ASSETS = [
  "/art/",
  "/art/index.html",
  "/art/manifest.webmanifest",
  "/art/assets/diandre-app-icon.svg",
  "/art/assets/diandre-app-icon-192.png",
  "/art/assets/diandre-app-icon-512.png",
  "/art/assets/diandre-app-icon-maskable-512.png",
  "/art/oil-paintings/",
  "/art/watercolours/",
  "/art/drawings/",
  "/art/experimental/",
  "/art/geospatial-imagery/",
  "/art/documentation/"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
        return Promise.resolve();
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith("/art/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(match => match || caches.match("/art/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
