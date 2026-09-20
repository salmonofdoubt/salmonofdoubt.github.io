const CACHE_NAME="salmon-dark-rivers-v28";
const OFFLINE_ASSETS=["./","./styles.20260920-28.css","./app.20260920-28.js",
"./data.20260919-21.js","./site-config.20260919-21.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith("salmon-dark-rivers-")&&key!==CACHE_NAME).map(key=>caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith("/demos/dark-rivers/"))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&["document","script","style","image","manifest"].includes(event.request.destination)){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==="navigate")return caches.match("./");
    throw new Error("Offline resource unavailable");
  }));
});