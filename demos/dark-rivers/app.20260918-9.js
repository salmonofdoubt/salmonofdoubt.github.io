(()=>{"use strict";
const BUILD="20260918-9",NS="http://www.w3.org/2000/svg",fallbackData=window.DARK_RIVERS_DATA,config=window.DARK_RIVERS_CONFIG||{doi:"10.5281/zenodo.0000000",doiUrl:"https://zenodo.org/records/0000000"};
const $=id=>document.getElementById(id);
const els={map:$("riverMap"),island:document.querySelector(".island"),network:$("riverNetwork"),base:$("riverBase"),flashes:$("flashLayer"),play:$("playButton"),reset:$("resetButton"),range:$("yearRange"),year:$("yearDisplay"),count:$("reachCount"),samples:$("sampleCount"),speed:$("speedSelect"),detail:$("reachDetail"),provenance:$("dataProvenance"),modeNote:$("dataModeNote"),install:$("installApp"),dialog:$("installDialog"),instructions:$("installInstructions"),doi:$("doiPill"),doiText:$("doiText")};
let data=fallbackData;
const state={year:1971,playing:false,selected:null,last:0,carry:0,raf:null,prompt:null},paths=new Map();
let reachById=new Map();
const BOUNDS={minLon:-10.75,maxLon:-5.75,minLat:51.25,maxLat:55.55,left:145,right:855,top:45,bottom:680};
const STATUS_STROKES=Object.freeze({High:"#6babb6",Good:"#769c84",Moderate:"#b5a36d",Poor:"#b18163",Bad:"#a3656a"});
const AGE_OPACITY=Object.freeze({fresh:.98,recent:.91,aged:.82,old:.74});
const UNOBSERVED_STROKE="#223039";
document.documentElement.dataset.darkRiversVersion=BUILD;
const project=(lon,lat)=>[BOUNDS.left+(Number(lon)-BOUNDS.minLon)/(BOUNDS.maxLon-BOUNDS.minLon)*(BOUNDS.right-BOUNDS.left),BOUNDS.bottom-(Number(lat)-BOUNDS.minLat)/(BOUNDS.maxLat-BOUNDS.minLat)*(BOUNDS.bottom-BOUNDS.top)];
const pathFromCoords=coords=>coords.map((p,i)=>{const [x,y]=project(p[0],p[1]);return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join(" ");
const latestAt=year=>{const m=new Map();data.events.filter(e=>e.year<=year&&e.reachId).forEach(e=>m.set(e.reachId,e));return m};
const latestFor=id=>data.events.filter(e=>e.reachId===id&&e.year<=state.year).at(-1)||null;
const ageBand=year=>{const age=state.year-year;if(age<=1)return"fresh";if(age<=5)return"recent";if(age<=15)return"aged";return"old"};
function validOfficial(payload){
  const hasNetwork=typeof payload?.networkPath==="string"&&payload.networkPath.length>0||Array.isArray(payload?.network)&&payload.network.length>0;
  return payload&&payload.meta?.official===true&&Array.isArray(payload.events)&&payload.events.length>0&&hasNetwork&&Array.isArray(payload.reaches)
}
function normalizeOfficial(payload){
  if(payload?.meta?.format!=="dark-rivers-compact-v1")return payload;
  return {
    meta:payload.meta,
    networkPath:payload.networkPath||"",
    network:[],
    reaches:(payload.reaches||[]).map(r=>({
      id:r[0],name:r[1],stationName:r[2],waterbodyCode:r[3],
      stationLon:r[4],stationLat:r[5],d:r[6]
    })),
    events:(payload.events||[]).map(e=>({
      year:e[0],reachId:e[1],q:e[2],status:e[3],
      ...(e.length>4?{lon:e[4],lat:e[5],stationName:e[6]}:{})
    }))
  }
}
async function loadData(){try{const response=await fetch("./data/official.json",{cache:"no-store"});if(response.ok){const payload=await response.json();if(validOfficial(payload))return normalizeOfficial(payload)}}catch(error){console.info("Dark Rivers: using bundled fallback data.",error)}return fallbackData}
function makePath(className,d){const p=document.createElementNS(NS,"path");p.setAttribute("d",d);p.setAttribute("class",className);return p}
function setVisual(path,obs,selected=false){
  const age=obs?ageBand(obs.year):null;
  const stroke=obs?(STATUS_STROKES[obs.status]||"#829399"):UNOBSERVED_STROKE;
  const opacity=selected?1:(obs?(AGE_OPACITY[age]||.86):.88);
  const width=selected?7.5:(obs?5.5:4.25);
  path.style.cssText=`fill:none;stroke:${stroke};opacity:${opacity};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke`;
  path.setAttribute("data-rendered",obs?"observed":"unobserved");
}
function attachReach(path,r){
  path.classList.add("river-reach");
  path.setAttribute("tabindex","0");
  path.setAttribute("role","button");
  path.setAttribute("data-reach-id",r.id);
  path.addEventListener("click",()=>select(r.id));
  path.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(r.id)}});
  paths.set(r.id,path);
}
function hydrateStaticFallback(){
  paths.clear();
  for(const r of data.reaches){
    let p=els.network.querySelector(`.river-reach[data-reach-id="${CSS.escape(r.id)}"]`);
    if(!p){p=makePath("river-reach",r.d);els.network.appendChild(p)}
    attachReach(p,r);
    setVisual(p,null,false);
  }
}
function renderOfficialGeometry(){
  paths.clear();els.network.replaceChildren();
  for(const r of data.reaches){
    const d=r.d||pathFromCoords(r.coordinates||[]);
    if(!d)continue;
    const p=makePath("river-reach",d);
    attachReach(p,r);setVisual(p,null,false);els.network.appendChild(p);
  }
}
function addBaseNetwork(){
  els.base.replaceChildren();
  if(!data.meta?.official)return;
  if(typeof data.networkPath==="string"&&data.networkPath){
    els.base.appendChild(makePath("river-base",data.networkPath));
    return;
  }
  if(!Array.isArray(data.network))return;
  const d=data.network.filter(line=>Array.isArray(line)&&line.length>=2).map(pathFromCoords).filter(Boolean).join(" ");
  if(d)els.base.appendChild(makePath("river-base",d));
}
function assertRendered(latest){
  const observed=[...els.network.querySelectorAll('.river-reach[data-rendered="observed"]')];
  const visiblyColoured=observed.filter(path=>{
    const c=getComputedStyle(path);
    return Number.parseFloat(c.opacity||"0")>.01&&c.stroke!=="none"&&c.stroke!=="rgb(34, 48, 57)";
  });
  const pass=observed.length===latest.size&&visiblyColoured.length===latest.size;
  document.documentElement.dataset.darkRiversRender=pass?"pass":"fail";
  document.documentElement.dataset.darkRiversExpected=String(latest.size);
  document.documentElement.dataset.darkRiversVisible=String(visiblyColoured.length);
  if(!pass)console.error("Dark Rivers render mismatch",{expected:latest.size,markedObserved:observed.length,visiblyColoured:visiblyColoured.length,year:state.year,build:BUILD});
}
function render(flash=false){
  const latest=latestAt(state.year);
  for(const r of data.reaches){
    const p=paths.get(r.id);if(!p)continue;
    const obs=latest.get(r.id),selected=state.selected===r.id;
    setVisual(p,obs,selected);p.classList.toggle("is-selected",selected);
    p.setAttribute("aria-label",obs?`${r.name}, ${obs.status}, ${obs.q}, observed ${obs.year}`:`${r.name}, no revealed observation`);
  }
  els.year.textContent=state.year;els.range.value=state.year;els.count.textContent=`${latest.size} / ${data.reaches.length}`;els.samples.textContent=data.events.filter(e=>e.year<=state.year).length;
  assertRendered(latest);
  if(flash)data.events.filter(e=>e.year===state.year).forEach(showFlash);
  renderDetail();
}
function eventPoint(e){
  if(Number.isFinite(Number(e.lon))&&Number.isFinite(Number(e.lat)))return project(e.lon,e.lat);
  const reach=e.reachId?reachById.get(e.reachId):null;
  if(reach&&Number.isFinite(Number(reach.stationLon))&&Number.isFinite(Number(reach.stationLat)))return project(reach.stationLon,reach.stationLat);
  const p=paths.get(e.reachId);if(p&&typeof p.getPointAtLength==="function"){const pt=p.getPointAtLength(p.getTotalLength()/2);return[pt.x,pt.y]}return null
}
function showFlash(e){
  const point=eventPoint(e);if(!point)return;
  const p=e.reachId?paths.get(e.reachId):null;if(p){p.style.strokeWidth="6.5";p.style.opacity="1";setTimeout(()=>render(false),650)}
  const c=document.createElementNS(NS,"circle");c.setAttribute("cx",point[0]);c.setAttribute("cy",point[1]);c.setAttribute("r","3");c.setAttribute("class","sample-flash");els.flashes.appendChild(c);
  if(c.animate&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const a=c.animate([{opacity:0,r:2},{opacity:.9,r:5,offset:.24},{opacity:.45,r:9,offset:.6},{opacity:0,r:12}],{duration:650,easing:"ease-out"});a.onfinish=()=>c.remove()}else setTimeout(()=>c.remove(),300)
}
function select(id){state.selected=id;render()}
function renderDetail(){
  if(!state.selected)return;
  const r=reachById.get(state.selected),e=latestFor(state.selected);
  els.detail.innerHTML=e?`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>${escapeHtml(e.status)} · ${escapeHtml(e.q)}</h2><p>Latest observation revealed by the selected year. Dimming reflects age of observation, not ecological change.</p><div class="detail-grid"><div><span>Observation</span><strong>${e.year}</strong></div><div><span>Sampling point</span><strong>${escapeHtml(e.stationName||r.stationName||e.station||"EPA station")}</strong></div></div>`:`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>Still dark in ${state.year}</h2><p>No observation has been revealed for this reach by the selected year.</p>`
}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function setYear(y,flash=false){state.year=Math.max(Number(data.meta.minYear),Math.min(Number(data.meta.maxYear),+y));render(flash)}
function setPlaying(on){
  state.playing=on;els.play.setAttribute("aria-pressed",String(on));els.play.textContent=on?"❚❚ Pause":"▶ Play";
  if(!on&&state.raf){cancelAnimationFrame(state.raf);state.raf=null}
  if(on){if(state.year>=data.meta.maxYear)setYear(data.meta.minYear);state.last=performance.now();state.carry=0;state.raf=requestAnimationFrame(tick)}
}
function tick(now){
  if(!state.playing)return;
  state.carry+=Math.min((now-state.last)/1000,.5)*Number(els.speed.value||3);state.last=now;
  while(state.carry>=1&&state.playing){state.carry-=1;if(state.year>=data.meta.maxYear){setPlaying(false);break}setYear(state.year+1,true)}
  if(state.playing)state.raf=requestAnimationFrame(tick)
}
function reset(){setPlaying(false);state.selected=null;els.flashes.replaceChildren();setYear(data.meta.minYear);els.detail.innerHTML='<p class="detail-kicker">Select a reach</p><h2>What do we know here?</h2><p>Click or tap a river reach to inspect its latest revealed observation.</p>'}
function configureData(){
  reachById=new Map(data.reaches.map(r=>[r.id,r]));
  const official=data.meta?.official===true;
  document.body.classList.toggle("has-official-data",official);
  if(official){renderOfficialGeometry();addBaseNetwork()}else{els.base.replaceChildren();hydrateStaticFallback()}
  els.island?.setAttribute("aria-hidden",official?"true":"false");
  els.range.min=data.meta.minYear;els.range.max=data.meta.maxYear;
  document.querySelectorAll("[data-min-year]").forEach(el=>el.textContent=data.meta.minYear);document.querySelectorAll("[data-max-year]").forEach(el=>el.textContent=data.meta.maxYear);
  state.year=new URLSearchParams(location.search).has("smoke")?Number(data.meta.maxYear):Number(data.meta.minYear);
  if(els.provenance)els.provenance.innerHTML=official?`EPA River Ecology Monitoring Programme · ${data.meta.eventCount?.toLocaleString("en-IE")||data.events.length.toLocaleString("en-IE")} observations · <a href="${escapeHtml(data.meta.sources?.q_map||"https://gis.epa.ie/EPAMaps/Water")}" target="_blank" rel="noopener">source</a>`:"Illustrative interaction data · awaiting generated EPA dataset";
  if(els.modeNote)els.modeNote.innerHTML=official?'<strong>EPA data:</strong> each observation is tied to a monitoring station. Colour is shown only on a short mapped section around that station.':'<strong>Prototype:</strong> geometry and sampling events are illustrative; Q-value class semantics follow the EPA system.';
  render(true);
}
function setupInstall(){
  if(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)els.install.hidden=true;
  addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.prompt=e;els.install.hidden=false;els.install.classList.add("is-ready")});
  addEventListener("appinstalled",()=>els.install.hidden=true);
  els.install.addEventListener("click",async()=>{if(state.prompt){const p=state.prompt;state.prompt=null;p.prompt();await p.userChoice;return}els.instructions.innerHTML='<p>Use your browser’s <strong>Install app</strong> or <strong>Add to Home Screen</strong> command.</p>';els.dialog.showModal?.()})
}
async function setupPwa(){
  if(!("serviceWorker" in navigator)||location.protocol==="file:")return;
  try{
    const wanted=new URL("./service-worker.20260918-9.js",location.href).href;
    for(const reg of await navigator.serviceWorker.getRegistrations()){
      if(reg.scope.includes("/demos/dark-rivers/")){
        const urls=[reg.active?.scriptURL,reg.waiting?.scriptURL,reg.installing?.scriptURL].filter(Boolean);
        if(!urls.includes(wanted))await reg.unregister();
      }
    }
    if("caches" in window){for(const key of await caches.keys()){if(key.startsWith("salmon-dark-rivers-")&&key!=="salmon-dark-rivers-v9")await caches.delete(key)}}
    const reg=await navigator.serviceWorker.register("./service-worker.20260918-9.js",{scope:"./"});
    reg.update().catch(()=>{});
  }catch(error){console.warn("Dark Rivers service worker setup failed:",error)}
}
async function init(){
  data=await loadData();
  els.play.addEventListener("click",()=>setPlaying(!state.playing));els.reset.addEventListener("click",reset);els.range.addEventListener("input",e=>{setPlaying(false);setYear(e.target.value)});
  els.doiText.textContent=config.doi;els.doi.href=config.doiUrl;els.doi.classList.toggle("is-placeholder",config.doi.includes("0000000"));
  setupInstall();configureData();setupPwa();
}
init();
})();