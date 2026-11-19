/* EnvAI offline support. Network-first for editorial content and source files;
   local revisions should not silently be masked by an old cached version. */
const CACHE='sod-envai-v22-docked-key';
const ASSETS=[
 './','./index.html','./styles.css?v=docked-key-1','./app.js?v=docked-key-1',
 './semantic-search.js?v=envai-guide-1','./live-data.js?v=usable-1','./site-config.js','./header-controls.css?v=header-1','./header-secondary.js?v=header-1',
 './how-it-works.html','./how-it-works.css?v=guide-1','./how-it-works.js?v=usable-1',
 './whats-new.html','./whats-new.js?v=usable-1','./news.css?v=envai-guide-1',
 './data/tools.json','./data/discoveries.json','./data/live-updates.json',
 './icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'
];
self.addEventListener('install',event=>{event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
)});
self.addEventListener('activate',event=>{event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>
 (key.startsWith('sod-envai-')||key.startsWith('sod-environmental-atlas-'))&&key!==CACHE
 ).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
)});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 const inScope=url.pathname.startsWith(new URL('./',self.location.href).pathname);
 if(!inScope)return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
  return response;
 }).catch(async()=>{
  const saved=await caches.match(request);
  return saved||Response.error();
 }));
});
