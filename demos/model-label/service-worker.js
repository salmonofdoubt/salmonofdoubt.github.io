const CACHE_NAME = 'model-label-shell-v0.21.2';
const BASE = new URL('./', self.location.href);
const FILES = ['./','./index.html','./template.css?v=0.21.2','./styles.css?v=0.21.2','./passport.css?v=0.21.2','./shell.js?v=0.21.2','./app.js?v=0.21.2','./freshness.js?v=0.21.2','./analysis.js?v=0.21.2','./site-config.js?v=0.21.2','./manifest.webmanifest','./icon.svg'];
const SHELL = FILES.map(path => new URL(path, BASE).href);
// Shared controls are cached with this demo; data and API responses never are.
SHELL.push(...['demo-return.css','demo-return.js','demo-support.css','demo-support.js'].map(path => new URL('../shared/' + path, BASE).href));
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('model-label-shell-') && key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET' || !SHELL.includes(event.request.url))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
