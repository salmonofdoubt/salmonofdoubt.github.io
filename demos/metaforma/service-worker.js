/* MetaForma art gallery: versioned, network-first offline shell. */
const PREFIX='metaforma-static-';
const CACHE=PREFIX+'art-v1-20261026';
const SHELL=['./','./index.html','./art-gallery.css','./art-gallery.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/demos/metaforma/'))return;
 event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
   return response;
 }).catch(async()=>{
   const cached=await caches.match(request);if(cached)return cached;
   if(request.mode==='navigate'){const fallback=await caches.match('./index.html');if(fallback)return fallback;}
   return Response.error();
 }));
});