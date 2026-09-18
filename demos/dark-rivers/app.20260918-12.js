(()=>{"use strict";

const BUILD="20260918-12";
const NS="http://www.w3.org/2000/svg";
const fallbackData=window.DARK_RIVERS_DATA;
const config=window.DARK_RIVERS_CONFIG||{doi:"10.5281/zenodo.0000000",doiUrl:"https://zenodo.org/records/0000000"};

const $=id=>document.getElementById(id);
const els={
  map:$("riverMap"),island:document.querySelector(".island"),network:$("riverNetwork"),base:$("riverBase"),flashes:$("flashLayer"),
  play:$("playButton"),reset:$("resetButton"),range:$("yearRange"),year:$("yearDisplay"),count:$("reachCount"),samples:$("sampleCount"),
  speed:$("speedSelect"),detail:$("reachDetail"),provenance:$("dataProvenance"),modeNote:$("dataModeNote"),install:$("installApp"),
  dialog:$("installDialog"),instructions:$("installInstructions"),doi:$("doiPill"),doiText:$("doiText"),
  stateBar:$("stateBar"),stateLegend:$("stateLegend"),statYear:$("statYear"),statBeat:$("statBeat"),statRevealed:$("statRevealed"),
  statMedianAge:$("statMedianAge"),statStations:$("statStations"),historyChart:$("historyChart"),chartMidYear:$("chartMidYear"),share:$("shareButton")
};

let data=fallbackData;
let reachById=new Map();
const paths=new Map();
const pathWeights=new Map();
const reachMetrics=new Map();
const state={year:1971,playing:false,selected:null,last:0,carry:0,raf:null,prompt:null,flashTimers:[]};

const BOUNDS={minLon:-10.75,maxLon:-5.75,minLat:51.25,maxLat:55.55,left:128,right:872,top:32,bottom:685};
const STATUS_STROKES=Object.freeze({High:"#46b9ff",Good:"#68d26f",Moderate:"#ffc342",Poor:"#ff7a24",Bad:"#ff405b"});
const STATUS_ORDER=["Dark","High","Good","Moderate","Poor","Bad"];
const STATUS_LABELS={Dark:"Dark",High:"High (Q5)",Good:"Good (Q4)",Moderate:"Moderate (Q3)",Poor:"Poor (Q2)",Bad:"Bad (Q1)"};
const AGE_OPACITY=Object.freeze({fresh:.98,recent:.88,aged:.72,old:.55});
const UNOBSERVED_STROKE="#1c3038";

document.documentElement.dataset.darkRiversVersion=BUILD;

const project=(lon,lat)=>[
  BOUNDS.left+(Number(lon)-BOUNDS.minLon)/(BOUNDS.maxLon-BOUNDS.minLon)*(BOUNDS.right-BOUNDS.left),
  BOUNDS.bottom-(Number(lat)-BOUNDS.minLat)/(BOUNDS.maxLat-BOUNDS.minLat)*(BOUNDS.bottom-BOUNDS.top)
];

const pathFromCoords=coords=>coords.map((p,i)=>{
  const [x,y]=project(p[0],p[1]);
  return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(" ");

const latestAt=year=>{
  const m=new Map();
  data.events.filter(e=>e.year<=year&&e.reachId).forEach(e=>m.set(e.reachId,e));
  return m;
};

const latestFor=id=>data.events.filter(e=>e.reachId===id&&e.year<=state.year).at(-1)||null;
const ageBand=year=>{const age=state.year-year;if(age<=1)return"fresh";if(age<=5)return"recent";if(age<=15)return"aged";return"old"};
const hash01=value=>{
  let h=2166136261;
  for(const ch of String(value??"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return ((h>>>0)%1000)/1000;
};

function validOfficial(payload){
  const hasNetwork=(typeof payload?.networkPath==="string"&&payload.networkPath.length>0)||(Array.isArray(payload?.network)&&payload.network.length>0);
  return payload&&payload.meta?.official===true&&Array.isArray(payload.events)&&payload.events.length>0&&hasNetwork&&Array.isArray(payload.reaches);
}

function normalizeOfficial(payload){
  if(payload?.meta?.format!=="dark-rivers-compact-v1")return payload;
  return {
    meta:payload.meta,
    networkPath:payload.networkPath||"",
    network:[],
    reaches:(payload.reaches||[]).map(r=>({
      id:r[0],name:r[1],stationName:r[2],waterbodyCode:r[3],
      stationLon:r[4],stationLat:r[5],d:r[6],lengthKm:r[7]
    })),
    events:(payload.events||[]).map(e=>({
      year:e[0],reachId:e[1],q:e[2],status:e[3],
      ...(e.length>4?{lon:e[4],lat:e[5],stationName:e[6]}:{})
    }))
  };
}

async function loadData(){
  try{
    const response=await fetch("./data/official.json",{cache:"no-store"});
    if(response.ok){
      const payload=await response.json();
      if(validOfficial(payload))return normalizeOfficial(payload);
    }
  }catch(error){
    console.info("Dark Rivers: using bundled fallback data.",error);
  }
  return fallbackData;
}

function makePath(className,d){
  const p=document.createElementNS(NS,"path");
  p.setAttribute("d",d);
  p.setAttribute("class",className);
  return p;
}

function setVisual(path,obs,selected=false){
  const id=path.getAttribute("data-reach-id");
  const metric=reachMetrics.get(id)||{length:120,tier:1,activeWidth:.78};
  if(!obs){
    path.style.cssText="fill:none;stroke:transparent;opacity:0;stroke-width:0;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke";
    path.style.strokeDasharray="none";
    path.style.strokeDashoffset="0";
    path.setAttribute("data-rendered","unobserved");
    return;
  }

  const age=ageBand(obs.year);
  const stroke=STATUS_STROKES[obs.status]||"#829399";
  const opacityMap={fresh:.98,recent:.82,aged:.56,old:.34};
  const opacity=selected?1:(opacityMap[age]||.48);
  const width=selected?metric.activeWidth+.34:metric.activeWidth;
  const len=Math.max(1,metric.length);

  // Colour only a local section around the monitoring station. The whole
  // hydrological network remains visible underneath as fine capillaries.
  const segLen=Math.max(7,Math.min(len*.23,18+len*.055));
  const anchor=.14+hash01(obs.stationName||obs.reachId||id)*.72;
  const start=Math.max(0,Math.min(len-segLen,len*anchor-segLen/2));

  path.style.cssText=`fill:none;stroke:${stroke};color:${stroke};opacity:${opacity};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke`;
  path.style.strokeDasharray=`${segLen} ${len}`;
  path.style.strokeDashoffset=`${-start}`;
  path.setAttribute("data-rendered","observed");
}
function attachReach(path,r){
  path.classList.add("river-reach");
  path.setAttribute("tabindex","0");
  path.setAttribute("role","button");
  path.setAttribute("data-reach-id",r.id);
  path.addEventListener("click",()=>select(r.id));
  path.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();select(r.id)}
  });
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
  paths.clear();
  els.network.replaceChildren();
  for(const r of data.reaches){
    const d=r.d||pathFromCoords(r.coordinates||[]);
    if(!d)continue;
    const p=makePath("river-reach",d);
    attachReach(p,r);
    setVisual(p,null,false);
    els.network.appendChild(p);
  }
}

function addBaseNetwork(){
  els.base.replaceChildren();
  let d="";
  if(data.meta?.official){
    if(typeof data.networkPath==="string"&&data.networkPath)d=data.networkPath;
    else if(Array.isArray(data.network)){
      d=data.network.filter(line=>Array.isArray(line)&&line.length>=2).map(pathFromCoords).filter(Boolean).join(" ");
    }
  }else{
    d=data.reaches.map(r=>r.d).filter(Boolean).join(" ");
  }
  if(!d)return;
  els.base.appendChild(makePath("river-base-shadow",d));
  els.base.appendChild(makePath("river-base-core",d));
}

function measureReachWeights(){
  pathWeights.clear();
  for(const r of data.reaches){
    const p=paths.get(r.id);
    let weight=Number(r.lengthKm);
    if(!Number.isFinite(weight)||weight<=0){
      try{weight=p?.getTotalLength?.()||1}catch{weight=1}
    }
    pathWeights.set(r.id,Math.max(.001,weight));
  }
}


function computeReachMetrics(){
  reachMetrics.clear();
  const rows=[];
  for(const r of data.reaches){
    const p=paths.get(r.id);
    if(!p)continue;
    let length=1;
    try{length=Math.max(1,p.getTotalLength())}catch{}
    rows.push({id:r.id,length});
  }
  const sorted=rows.map(r=>r.length).sort((a,b)=>a-b);
  const q35=sorted[Math.floor(sorted.length*.35)]||1;
  const q78=sorted[Math.floor(sorted.length*.78)]||q35;
  for(const row of rows){
    const tier=row.length<q35?0:(row.length<q78?1:2);
    reachMetrics.set(row.id,{
      length:row.length,
      tier,
      activeWidth:[.56,.76,1.02][tier]
    });
  }
}

function fitOfficialGeometry(){
  let box;
  try{box=els.network.getBBox()}catch{return}
  if(!box||!box.width||!box.height)return;

  // The source paths were originally projected by scaling longitude and
  // latitude degrees equally. Around Ireland one degree of longitude is only
  // about 60% of a degree of latitude in ground distance, which made the
  // island look broad, receding and "tilted back". Correct the aspect here
  // while retaining true north-up orientation.
  const sourceRatio=box.width/box.height;
  const desiredRatio=.72;
  const xCorrection=Math.max(.50,Math.min(1,desiredRatio/sourceRatio));

  const target={x:145,y:24,width:690,height:650};
  const correctedWidth=box.width*xCorrection;
  const scale=Math.min(target.width/correctedWidth,target.height/box.height);

  const cx=box.x+box.width/2;
  const cy=box.y+box.height/2;
  const targetCx=target.x+target.width/2;
  const targetCy=target.y+target.height/2;

  const a=scale*xCorrection;
  const d=scale;
  const e=targetCx-cx*a;
  const f=targetCy-cy*d;
  const transform=`matrix(${a.toFixed(5)} 0 0 ${d.toFixed(5)} ${e.toFixed(2)} ${f.toFixed(2)})`;

  for(const layer of [els.base,els.network,els.flashes])layer.setAttribute("transform",transform);
  document.documentElement.dataset.darkRiversAspect=xCorrection.toFixed(3);
}

function assertRendered(latest){
  const observed=[...els.network.querySelectorAll('.river-reach[data-rendered="observed"]')];
  const visiblyColoured=observed.filter(path=>{
    const c=getComputedStyle(path);
    return Number.parseFloat(c.opacity||"0")>.01&&c.stroke!=="none"&&c.stroke!=="rgb(28, 48, 56)";
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
    const p=paths.get(r.id);
    if(!p)continue;
    const obs=latest.get(r.id),selected=state.selected===r.id;
    setVisual(p,obs,selected);
    p.classList.toggle("is-selected",selected);
    p.setAttribute("aria-label",obs?`${r.name}, ${obs.status}, ${obs.q}, observed ${obs.year}`:`${r.name}, no revealed observation`);
  }

  const revealedCount=data.events.filter(e=>e.year<=state.year).length;
  els.year.textContent=state.year;
  els.range.value=state.year;
  els.count.textContent=`${latest.size.toLocaleString("en-IE")} / ${data.reaches.length.toLocaleString("en-IE")}`;
  els.samples.textContent=revealedCount.toLocaleString("en-IE");

  renderAnalytics(latest);
  renderHistory();
  assertRendered(latest);
  if(flash)scheduleFlashes(data.events.filter(e=>e.year===state.year));
  renderDetail();
}

function eventPoint(e){
  if(Number.isFinite(Number(e.lon))&&Number.isFinite(Number(e.lat)))return project(e.lon,e.lat);
  const reach=e.reachId?reachById.get(e.reachId):null;
  if(reach&&Number.isFinite(Number(reach.stationLon))&&Number.isFinite(Number(reach.stationLat)))return project(reach.stationLon,reach.stationLat);
  const p=paths.get(e.reachId);
  if(p&&typeof p.getPointAtLength==="function"){
    const pt=p.getPointAtLength(p.getTotalLength()/2);
    return[pt.x,pt.y];
  }
  return null;
}

function clearFlashTimers(){
  state.flashTimers.forEach(clearTimeout);
  state.flashTimers=[];
}

function scheduleFlashes(events){
  if(!events.length)return;
  clearFlashTimers();

  const maxVisual=48;
  const sampled=events.length<=maxVisual?events:events.filter((_,i)=>i%Math.ceil(events.length/maxVisual)===0).slice(0,maxVisual);
  const speed=Math.max(1,Number(els.speed.value||3));
  const windowMs=Math.max(95,Math.min(760,800/speed));
  const ordered=[...sampled].sort((a,b)=>{
    const ka=String(a.reachId||"")+String(a.stationName||"");
    const kb=String(b.reachId||"")+String(b.stationName||"");
    return ka.localeCompare(kb);
  });

  ordered.forEach((e,i)=>{
    const jitter=((i*37 + state.year*13)%29)/29;
    const delay=Math.round(((i+jitter)/Math.max(1,ordered.length))*windowMs);
    const timer=setTimeout(()=>showFlash(e),delay);
    state.flashTimers.push(timer);
  });
}

function showFlash(e){
  const point=eventPoint(e);
  if(!point)return;
  const c=document.createElementNS(NS,"circle");
  c.setAttribute("cx",point[0]);c.setAttribute("cy",point[1]);c.setAttribute("r","1.4");c.setAttribute("class","sample-flash");
  els.flashes.appendChild(c);
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(c.animate&&!reduce){
    const a=c.animate(
      [{opacity:0,r:1.2},{opacity:.95,r:2.4,offset:.16},{opacity:.55,r:4.6,offset:.46},{opacity:.12,r:7.5,offset:.78},{opacity:0,r:9}],
      {duration:780,easing:"cubic-bezier(.16,.72,.26,1)"}
    );
    a.onfinish=()=>c.remove();
  }else setTimeout(()=>c.remove(),260);
}

function select(id){state.selected=id;els.detail.hidden=false;render(false)}

function renderDetail(){
  if(!state.selected){els.detail.hidden=true;return}
  els.detail.hidden=false;
  const r=reachById.get(state.selected),e=latestFor(state.selected);
  els.detail.innerHTML=e
    ?`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>${escapeHtml(e.status)} · ${escapeHtml(e.q)}</h2><p>Latest observation revealed by the selected year. Dimming reflects age of observation, not ecological change.</p><div class="detail-grid"><div><span>Observation</span><strong>${e.year}</strong></div><div><span>Sampling point</span><strong>${escapeHtml(e.stationName||r.stationName||e.station||"EPA station")}</strong></div></div>`
    :`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>Still dark in ${state.year}</h2><p>No observation has been revealed for this reach by the selected year.</p>`;
}

function renderAnalytics(latest){
  const totals={Dark:0,High:0,Good:0,Moderate:0,Poor:0,Bad:0};
  let total=0;

  for(const r of data.reaches){
    const w=pathWeights.get(r.id)||1;
    total+=w;
    const obs=latest.get(r.id);
    const key=obs&&STATUS_ORDER.includes(obs.status)?obs.status:"Dark";
    totals[key]+=w;
  }

  const pct={};
  let running=0;
  STATUS_ORDER.forEach((key,i)=>{
    if(i===STATUS_ORDER.length-1)pct[key]=Math.max(0,100-running);
    else{
      pct[key]=total?Math.round((totals[key]/total)*1000)/10:0;
      running+=pct[key];
    }
  });

  const colorFor=key=>key==="Dark"?UNOBSERVED_STROKE:STATUS_STROKES[key];
  els.stateBar.innerHTML=STATUS_ORDER.map(key=>
    `<span class="state-segment" title="${STATUS_LABELS[key]}: ${pct[key].toFixed(1)}%" style="width:${pct[key]}%;background:${colorFor(key)}"></span>`
  ).join("");

  els.stateLegend.innerHTML=STATUS_ORDER.map(key=>
    `<li class="state-row"><span class="state-label"><i class="state-dot" style="background:${colorFor(key)}"></i><span class="state-name">${STATUS_LABELS[key]}</span></span><strong class="state-percent">${pct[key].toFixed(1)}%</strong><span class="state-km">${formatWeight(totals[key],total)}</span></li>`
  ).join("");

  const revealedPct=Math.max(0,100-pct.Dark);
  const thisYear=data.events.filter(e=>e.year===state.year);
  const ages=[...latest.values()].map(e=>state.year-e.year).sort((a,b)=>a-b);
  const median=ages.length?(ages.length%2?ages[(ages.length-1)/2]:(ages[ages.length/2-1]+ages[ages.length/2])/2):null;
  const stations=new Set([...latest.values()].map(e=>e.stationName||reachById.get(e.reachId)?.stationName||e.station||e.reachId).filter(Boolean));

  els.statYear.textContent=state.year;
  els.statBeat.textContent=thisYear.length.toLocaleString("en-IE");
  els.statRevealed.textContent=`${revealedPct.toFixed(1)}%`;
  els.statMedianAge.textContent=median===null?"—":`${median.toFixed(median%1?1:0)} y`;
  els.statStations.textContent=stations.size.toLocaleString("en-IE");
}

function formatWeight(value,total){
  const officialKm=data.reaches.some(r=>Number.isFinite(Number(r.lengthKm))&&Number(r.lengthKm)>0);
  if(officialKm)return `${Math.round(value).toLocaleString("en-IE")} km`;
  return `${total?((value/total)*100).toFixed(1):"0.0"}%`;
}

function renderHistory(){
  if(!els.historyChart)return;
  const min=Number(data.meta.minYear),max=Number(data.meta.maxYear);
  const years=[];
  const counts=new Map();
  for(let y=min;y<=max;y++){years.push(y);counts.set(y,0)}
  for(const e of data.events)counts.set(e.year,(counts.get(e.year)||0)+1);
  const values=years.map(y=>counts.get(y)||0);
  const peak=Math.max(1,...values);

  const W=320,H=148,pad={l:2,r:2,t:6,b:4};
  const innerW=W-pad.l-pad.r,innerH=H-pad.t-pad.b;
  const barW=Math.max(.7,innerW/years.length*.72);
  let svg="";
  [0,.25,.5,.75,1].forEach(t=>{
    const y=pad.t+innerH-innerH*t;
    svg+=`<line class="chart-grid" x1="0" x2="${W}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  });
  years.forEach((year,i)=>{
    const v=values[i];
    const h=(v/peak)*innerH;
    const x=pad.l+(i+.5)*(innerW/years.length)-barW/2;
    const y=pad.t+innerH-h;
    svg+=`<rect class="chart-bar${year===state.year?" is-current":""}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(.5,h).toFixed(2)}" rx=".6"/>`;
  });
  els.historyChart.innerHTML=svg;
  els.chartMidYear.textContent=Math.round((min+max)/2);
}

function escapeHtml(value){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function setYear(y,flash=false){
  state.year=Math.max(Number(data.meta.minYear),Math.min(Number(data.meta.maxYear),+y));
  render(flash);
}

function setPlaying(on){
  state.playing=on;
  els.play.setAttribute("aria-pressed",String(on));
  els.play.textContent=on?"❚❚ Pause":"▶ Play";
  if(!on&&state.raf){cancelAnimationFrame(state.raf);state.raf=null}
  if(on){
    if(state.year>=data.meta.maxYear)setYear(data.meta.minYear);
    state.last=performance.now();state.carry=0;
    state.raf=requestAnimationFrame(tick);
  }
}

function tick(now){
  if(!state.playing)return;
  state.carry+=Math.min((now-state.last)/1000,.5)*Number(els.speed.value||3);
  state.last=now;
  while(state.carry>=1&&state.playing){
    state.carry-=1;
    if(state.year>=data.meta.maxYear){setPlaying(false);break}
    setYear(state.year+1,true);
  }
  if(state.playing)state.raf=requestAnimationFrame(tick);
}

function reset(){
  setPlaying(false);
  clearFlashTimers();
  state.selected=null;
  els.flashes.replaceChildren();
  setYear(data.meta.minYear);
  els.detail.innerHTML='<p class="detail-kicker">Select a reach</p><h2>What do we know here?</h2><p>Click or tap a river reach to inspect its latest revealed observation.</p>';
}

function configureData(){
  reachById=new Map(data.reaches.map(r=>[r.id,r]));
  const official=data.meta?.official===true;
  document.body.classList.toggle("has-official-data",official);

  if(official){
    renderOfficialGeometry();
    addBaseNetwork();
    computeReachMetrics();
    fitOfficialGeometry();
  }else{
    hydrateStaticFallback();
    addBaseNetwork();
    computeReachMetrics();
  }

  measureReachWeights();

  els.island?.setAttribute("aria-hidden",official?"true":"false");
  els.range.min=data.meta.minYear;els.range.max=data.meta.maxYear;
  document.querySelectorAll("[data-min-year]").forEach(el=>el.textContent=data.meta.minYear);
  document.querySelectorAll("[data-max-year]").forEach(el=>el.textContent=data.meta.maxYear);

  state.year=new URLSearchParams(location.search).has("smoke")?Number(data.meta.maxYear):Number(data.meta.minYear);

  if(els.provenance){
    els.provenance.innerHTML=official
      ?`EPA River Ecology Monitoring Programme · ${data.meta.eventCount?.toLocaleString("en-IE")||data.events.length.toLocaleString("en-IE")} observations · <a href="${escapeHtml(data.meta.sources?.q_map||"https://gis.epa.ie/EPAMaps/Water")}" target="_blank" rel="noopener">source</a>`
      :"Illustrative interaction data · awaiting generated EPA dataset";
  }

  if(els.modeNote){
    els.modeNote.innerHTML=official
      ?'<strong>EPA data:</strong> each observation is tied to a monitoring station. Colour is shown only on a short mapped section around that station.'
      :'<strong>Prototype:</strong> geometry and sampling events are illustrative; Q-value class semantics follow the EPA system.';
  }

  render(true);
}

function setupInstall(){
  if(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)els.install.hidden=true;
  addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.prompt=e;els.install.hidden=false;els.install.classList.add("is-ready")});
  addEventListener("appinstalled",()=>els.install.hidden=true);
  els.install.addEventListener("click",async()=>{
    if(state.prompt){
      const p=state.prompt;state.prompt=null;p.prompt();await p.userChoice;return;
    }
    els.instructions.innerHTML='<p>Use your browser’s <strong>Install app</strong> or <strong>Add to Home Screen</strong> command.</p>';
    els.dialog.showModal?.();
  });
}

async function setupPwa(){
  if(!("serviceWorker" in navigator)||location.protocol==="file:")return;
  try{
    const wanted=new URL("./service-worker.20260918-12.js",location.href).href;
    for(const reg of await navigator.serviceWorker.getRegistrations()){
      if(reg.scope.includes("/demos/dark-rivers/")){
        const urls=[reg.active?.scriptURL,reg.waiting?.scriptURL,reg.installing?.scriptURL].filter(Boolean);
        if(!urls.includes(wanted))await reg.unregister();
      }
    }
    if("caches" in window){
      for(const key of await caches.keys()){
        if(key.startsWith("salmon-dark-rivers-")&&key!=="salmon-dark-rivers-v12")await caches.delete(key);
      }
    }
    const reg=await navigator.serviceWorker.register("./service-worker.20260918-12.js",{scope:"./"});
    reg.update().catch(()=>{});
  }catch(error){
    console.warn("Dark Rivers service worker setup failed:",error);
  }
}

async function init(){
  data=await loadData();
  els.play.addEventListener("click",()=>setPlaying(!state.playing));
  els.reset.addEventListener("click",reset);
  els.range.addEventListener("input",e=>{setPlaying(false);clearFlashTimers();setYear(e.target.value,true)});
  els.speed.addEventListener("change",()=>{if(state.playing){state.last=performance.now();state.carry=0}});
  els.doiText.textContent=config.doi;
  els.doi.href=config.doiUrl;
  els.doi.classList.toggle("is-placeholder",config.doi.includes("0000000"));
  setupInstall();
  configureData();
  setupPwa();
}

init();
})();