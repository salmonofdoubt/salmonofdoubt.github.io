(()=>{"use strict";

const BUILD="20260920-28";
const NS="http://www.w3.org/2000/svg";
const fallbackData=window.DARK_RIVERS_DATA;
const config=window.DARK_RIVERS_CONFIG||{doi:"10.5281/zenodo.0000000",doiUrl:"https://zenodo.org/records/0000000"};

const $=id=>document.getElementById(id);
const els={
  map:$("riverMap"),shell:document.querySelector(".map-shell"),coast:$("irelandCoastline"),world:$("mapWorld"),island:document.querySelector(".island"),network:$("riverNetwork"),base:$("riverBase"),continuity:$("riverContinuity"),systems:$("riverSystems"),flashes:$("flashLayer"),
  play:$("playButton"),reset:$("resetButton"),range:$("yearRange"),year:$("yearDisplay"),count:$("reachCount"),samples:$("sampleCount"),
  speed:$("speedSelect"),detail:$("reachDetail"),provenance:$("dataProvenance"),modeNote:$("dataModeNote"),install:$("installApp"),
  dialog:$("installDialog"),instructions:$("installInstructions"),doi:$("doiPill"),doiText:$("doiText"),
  stateBar:$("stateBar"),stateLegend:$("stateLegend"),statYear:$("statYear"),statBeat:$("statBeat"),statRevealed:$("statRevealed"),
  statMedianAge:$("statMedianAge"),statStations:$("statStations"),historyChart:$("historyChart"),chartMidYear:$("chartMidYear"),qualityChart:$("qualityChart"),qualityAxis:$("qualityAxis"),qualityYear:$("qualityYear"),qualitySummary:$("qualitySummary"),share:$("shareButton"),zoomIn:$("mapZoomIn"),zoomOut:$("mapZoomOut"),zoomReset:$("mapZoomReset"),zoomLabel:$("mapZoomLabel")
};

let data=fallbackData;
let reachById=new Map();
const paths=new Map();
const pathWeights=new Map();
let fullNetworkWeight=0;
let qualityTimeline=[];
const reachMetrics=new Map();
const reachToSystem=new Map();
let contextMainPath=null,contextBranchPath=null,contextYear=-Infinity;
const contextualReachIds=new Set(),contextMainParts=[],contextBranchParts=[];
let systemIndexPromise=null;
let selectedSystemId=null;
let selectionGeneration=0;
const state={year:1971,playing:false,selected:null,last:0,carry:0,raf:null,prompt:null,flashTimers:[],mapZoom:1.05,mapPanX:-25,mapPanY:-18,mapDragging:false,mapDragStart:null};
let hydroBase={a:1,d:1,e:0,f:0};
const INITIAL_MAP_ZOOM=1,MIN_MAP_ZOOM=.72,MAX_MAP_ZOOM=12;
let mapViewportHeight=720;
let mapResizeObserver=null;

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
      stationLon:r[4],stationLat:r[5],d:r[6],
      lengthKm:typeof r[7]==="number"?r[7]:undefined,
      systemId:typeof r[7]==="string"?r[7]:"",
      contextMain:typeof r[8]==="string"?r[8]:"",
      contextBranches:typeof r[9]==="string"?r[9]:""
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

  const stroke=STATUS_STROKES[obs.status]||"#829399";
  // The recorded class persists until a later observation replaces it.
  // Observation age remains available in the detail/stats, not opacity.
  const opacity=selected?1:.88;
  const width=selected?metric.activeWidth+.34:metric.activeWidth;
  const len=Math.max(1,metric.length);

  // Colour only a local section around the monitoring station. The whole
  // hydrological network remains visible underneath as fine capillaries.
  const segLen=Math.max(6,Math.min(len*.18,14+len*.040));
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


function resetContinuity(){
  contextYear=-Infinity;
  contextualReachIds.clear();
  contextMainParts.length=0;
  contextBranchParts.length=0;
  els.continuity.replaceChildren();
  contextMainPath=null;
  contextBranchPath=null;
  if(!data.meta?.official)return;
  contextMainPath=makePath("river-continuity-main","");
  contextBranchPath=makePath("river-continuity-branches","");
  els.continuity.append(contextBranchPath,contextMainPath);
}

function renderContinuity(latest){
  if(!contextMainPath||!data.meta?.continuityMeaning)return;
  if(contextYear===state.year)return;
  // Moving backwards replays the real station evidence from the selected year.
  if(state.year<contextYear){
    contextualReachIds.clear();
    contextMainParts.length=0;
    contextBranchParts.length=0;
  }
  let changed=false;
  for(const [id] of latest){
    if(contextualReachIds.has(id))continue;
    contextualReachIds.add(id);
    const r=reachById.get(id);
    if(r?.contextMain){contextMainParts.push(r.contextMain);changed=true}
    if(r?.contextBranches){contextBranchParts.push(r.contextBranches);changed=true}
  }
  if(changed||contextYear>state.year){
    contextMainPath.setAttribute("d",contextMainParts.join(""));
    contextBranchPath.setAttribute("d",contextBranchParts.join(""));
  }
  contextYear=state.year;
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

function observedSegmentWeight(id){
  const metric=reachMetrics.get(id)||{length:120};
  const len=Math.max(1,metric.length);
  return Math.max(6,Math.min(len*.18,14+len*.040));
}

function measureReachWeights(){
  pathWeights.clear();
  for(const r of data.reaches){
    // Weight is the actual coloured local segment, not the full station clip.
    pathWeights.set(r.id,observedSegmentWeight(r.id));
  }
  fullNetworkWeight=0;
  try{
    const base=els.base.querySelector(".river-base-core");
    fullNetworkWeight=Math.max(1,base?.getTotalLength?.()||0);
  }catch{}
  if(!fullNetworkWeight){
    fullNetworkWeight=[...pathWeights.values()].reduce((a,b)=>a+b,0)||1;
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

// Sea names are geospatial annotations, never fixed screen decorations.
function updateSeaLabels(){
  if(!els.shell||!els.world)return;
  const matrix=els.world.getScreenCTM();
  const rect=els.shell.getBoundingClientRect();
  for(const label of els.shell.querySelectorAll(".sea-label[data-sea-lon]")){
    const lon=Number(label.dataset.seaLon),lat=Number(label.dataset.seaLat);
    if(!data.meta?.official||!matrix||!Number.isFinite(lon)||!Number.isFinite(lat)||!rect.width||!rect.height){
      label.hidden=true;
      continue;
    }
    const [sx,sy]=project(lon,lat);
    const point=els.map.createSVGPoint();
    point.x=sx;point.y=sy;
    const screen=point.matrixTransform(matrix);
    const x=screen.x-rect.left,y=screen.y-rect.top;
    label.hidden=false;
    const width=label.offsetWidth,height=label.offsetHeight;
    const left=label.dataset.seaAlign==="end"?x-width:x-width/2;
    const top=y-height/2;
    // A sea name must never be clamped onto land when the sea is off-screen.
    if(left<8||top<8||left+width>rect.width-8||top+height>rect.height-8){
      label.hidden=true;
      continue;
    }
    // CSS translate centres the label on this projected sea anchor.
    label.style.left=`${x.toFixed(1)}px`;
    label.style.top=`${y.toFixed(1)}px`;
  }
}

function applyHydroTransform(){
  const z=state.mapZoom;
  const a=hydroBase.a*z;
  const d=hydroBase.d*z;
  const e=hydroBase.e*z+state.mapPanX;
  const f=hydroBase.f*z+state.mapPanY;
  const transform=`matrix(${a.toFixed(5)} 0 0 ${d.toFixed(5)} ${e.toFixed(2)} ${f.toFixed(2)})`;
  els.world.setAttribute("transform",transform);
  els.shell.classList.toggle("is-zoomed",z>1.75);
  els.map.dataset.zoom=String(z);
  if(els.zoomLabel)els.zoomLabel.textContent=`${Math.round(z*100)}%`;
  updateSeaLabels();
}

function updateMapViewport(){
  const rect=els.map.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  // Match viewBox aspect to the actual map panel: no 1000:720 letterboxing.
  mapViewportHeight=Math.max(720,Math.min(2000,1000*rect.height/rect.width));
  els.map.setAttribute("viewBox",`0 0 1000 ${mapViewportHeight.toFixed(2)}`);
}

function resetHydroView(){
  state.mapZoom=INITIAL_MAP_ZOOM;
  const cx=500,cy=mapViewportHeight/2;
  state.mapPanX=cx*(1-state.mapZoom);
  state.mapPanY=cy*(1-state.mapZoom);
  applyHydroTransform();
}

function setHydroZoom(nextZoom,anchor={x:500,y:mapViewportHeight/2}){
  const oldZoom=state.mapZoom;
  const next=Math.max(MIN_MAP_ZOOM,Math.min(MAX_MAP_ZOOM,nextZoom));
  if(Math.abs(next-oldZoom)<.0001)return;
  const ratio=next/oldZoom;
  state.mapPanX=anchor.x-(anchor.x-state.mapPanX)*ratio;
  state.mapPanY=anchor.y-(anchor.y-state.mapPanY)*ratio;
  state.mapZoom=next;
  applyHydroTransform();
}

function svgPointFromClient(clientX,clientY){
  // Use the actual SVG screen matrix, not the full element bounding box:
  // preserveAspectRatio and responsive viewport layouts otherwise misplace
  // the wheel-zoom anchor and cause visible jumps.
  const point=els.map.createSVGPoint();
  point.x=clientX;
  point.y=clientY;
  const matrix=els.map.getScreenCTM();
  if(matrix){
    const local=point.matrixTransform(matrix.inverse());
    return {x:local.x,y:local.y};
  }
  return {x:500,y:mapViewportHeight/2};
}

function setupMapNavigation(){
  els.zoomIn?.addEventListener("click",()=>setHydroZoom(state.mapZoom*1.32));
  els.zoomOut?.addEventListener("click",()=>setHydroZoom(state.mapZoom/1.32));
  els.zoomReset?.addEventListener("click",()=>{
    updateMapViewport();
    if(data.meta?.official===true)fitOfficialGeometry();else resetHydroView();
  });

  els.map.addEventListener("wheel",event=>{
    // Ordinary page scrolling must never silently turn a full-island map into a coastal crop.
    // Trackpad pinch gestures generate ctrlKey and continue to zoom the map.
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();
    // Keep wheel movement smooth while allowing detailed reach inspection.
    const factor=Math.exp(-Math.max(-140,Math.min(140,event.deltaY))*.0019);
    setHydroZoom(state.mapZoom*factor,svgPointFromClient(event.clientX,event.clientY));
  },{passive:false});

  els.map.addEventListener("dblclick",event=>{
    event.preventDefault();
    setHydroZoom(state.mapZoom*1.75,svgPointFromClient(event.clientX,event.clientY));
  });

  els.map.addEventListener("pointerdown",event=>{
    if(event.button!==0||event.target.closest?.(".river-reach"))return;
    const p=svgPointFromClient(event.clientX,event.clientY);
    state.mapDragging=true;
    state.mapDragStart={x:p.x,y:p.y,panX:state.mapPanX,panY:state.mapPanY};
    els.map.setPointerCapture?.(event.pointerId);
    els.map.classList.add("is-panning");
  });

  els.map.addEventListener("pointermove",event=>{
    if(!state.mapDragging||!state.mapDragStart)return;
    const p=svgPointFromClient(event.clientX,event.clientY);
    state.mapPanX=state.mapDragStart.panX+(p.x-state.mapDragStart.x);
    state.mapPanY=state.mapDragStart.panY+(p.y-state.mapDragStart.y);
    applyHydroTransform();
  });

  const stopPan=event=>{
    if(!state.mapDragging)return;
    state.mapDragging=false;
    state.mapDragStart=null;
    if(els.map.hasPointerCapture?.(event.pointerId))els.map.releasePointerCapture(event.pointerId);
    els.map.classList.remove("is-panning");
  };
  els.map.addEventListener("pointerup",stopPan);
  els.map.addEventListener("pointercancel",stopPan);

  // Refit the projected coastline and river network together on resize.
  if(typeof ResizeObserver!=="undefined"){
    mapResizeObserver=new ResizeObserver(()=>{
      const previous=mapViewportHeight;
      updateMapViewport();
      if(Math.abs(previous-mapViewportHeight)<1){
        // Pixel anchors still move when the shell resizes at a fixed ratio.
        updateSeaLabels();
        return;
      }
      if(data.meta?.official===true)fitOfficialGeometry();else resetHydroView();
    });
    mapResizeObserver.observe(els.shell);
  }
}

function fitOfficialGeometry(){
  // Frame by the actual island outline, never by a changing set of EPA stations.
  let box;
  try { box=els.coast.getBBox(); } catch {}
  if(!box||!box.width||!box.height){
    try { box=els.base.getBBox(); } catch {}
  }
  if(!box||!box.width||!box.height)return;
  const svgUnitsPerLon=(BOUNDS.right-BOUNDS.left)/(BOUNDS.maxLon-BOUNDS.minLon);
  const svgUnitsPerLat=(BOUNDS.bottom-BOUNDS.top)/(BOUNDS.maxLat-BOUNDS.minLat);
  const xCorrection=Math.cos(53.4*Math.PI/180)*svgUnitsPerLat/svgUnitsPerLon;
  const target={x:74,y:36,width:852,height:mapViewportHeight-72};
  const scale=Math.min(target.width/(box.width*xCorrection),target.height/box.height);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  hydroBase={
    a:scale*xCorrection,
    d:scale,
    e:target.x+target.width/2-cx*scale*xCorrection,
    f:target.y+target.height/2-cy*scale
  };
  resetHydroView();
  document.documentElement.dataset.darkRiversAspect=xCorrection.toFixed(3);
  // Rendering a river stroke does not prove the island fits inside the viewport.
  if(new URLSearchParams(location.search).has("smoke")){
    const x0=box.x*hydroBase.a+hydroBase.e;
    const x1=(box.x+box.width)*hydroBase.a+hydroBase.e;
    const y0=box.y*hydroBase.d+hydroBase.f;
    const y1=(box.y+box.height)*hydroBase.d+hydroBase.f;
    const pass=Number.isFinite(x0+y0+x1+y1)&&x0>=8&&x1<=992&&y0>=8&&y1<=mapViewportHeight-8;
    document.documentElement.dataset.darkRiversCoastFit=pass?"pass":"fail";
    document.documentElement.dataset.darkRiversCoastBounds=[x0,y0,x1,y1].map(v=>Math.round(v)).join(",");
    if(!pass)console.error("Dark Rivers overview clips coastline",{x0,x1,y0,y1,viewHeight:mapViewportHeight});
  }
}
function assertRendered(latest){
  const observed=[...els.network.querySelectorAll('.river-reach[data-rendered="observed"]')];
  const visiblyColoured=observed.filter(path=>{
    const c=getComputedStyle(path);
    const inlineStroke=(path.style.stroke||"").trim();
    const computedStroke=(c.stroke||"").trim();
    const inlineOpacity=Number.parseFloat(path.style.opacity||"");
    const computedOpacity=Number.parseFloat(c.opacity||"");
    const opacity=Number.isFinite(inlineOpacity)?inlineOpacity:(Number.isFinite(computedOpacity)?computedOpacity:0);
    const stroke=inlineStroke&&inlineStroke!=="transparent"?inlineStroke:computedStroke;
    return opacity>.01&&stroke&&stroke!=="none"&&stroke!=="transparent";
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
    // Only touch SVG style when an observation, its age band or selection
    // actually changes. Most reaches remain untouched across each beat.
    const key=obs?`${obs.year}|${obs.status}|${obs.q}|${selected?1:0}`:"dark";
    if(p._drVisualKey!==key){
      setVisual(p,obs,selected);
      p.classList.toggle("is-selected",selected);
      p.setAttribute("aria-label",obs?`${r.name}, ${obs.status}, ${obs.q}, observed ${obs.year}`:`${r.name}, no revealed observation`);
      p._drVisualKey=key;
    }
  }

  const revealedCount=data.events.filter(e=>e.year<=state.year).length;
  els.year.textContent=state.year;
  els.range.value=state.year;
  els.count.textContent=`${latest.size.toLocaleString("en-IE")} / ${data.reaches.length.toLocaleString("en-IE")}`;
  els.samples.textContent=revealedCount.toLocaleString("en-IE");

  renderContinuity(latest);
  renderAnalytics(latest);
  renderQualityTimeline();
  renderHistory();
  // getComputedStyle() for 5,000+ paths on every frame was the primary
  // browser slowdown. The full DOM verification is retained in CI smoke mode.
  if(new URLSearchParams(location.search).has("smoke"))assertRendered(latest);
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

function stablePulseKey(e){
  return String(e.year||"")+"|"+String(e.reachId||"")+"|"+String(e.stationName||"")+"|"+String(e.q||"");
}

function choosePulseEvents(events,maxVisual=6){
  if(events.length<=maxVisual)return [...events];
  const ranked=events.map(e=>({e,k:hash01(stablePulseKey(e))}))
    .sort((a,b)=>a.k-b.k||stablePulseKey(a.e).localeCompare(stablePulseKey(b.e)));
  // Deterministic sampling, no fabricated observations or status values.
  const step=ranked.length/maxVisual;
  return Array.from({length:maxVisual},(_,i)=>ranked[Math.floor((i+.5)*step)].e);
}

function scheduleFlashes(events,windowMs=690){
  clearFlashTimers();
  if(!events.length)return;
  // At most six distinct event flashes, spaced over virtually the full beat.
  // Many observations can occur in the same year; do not fire them all at once.
  const ordered=choosePulseEvents(events,6)
    .sort((a,b)=>hash01("order|"+stablePulseKey(a))-hash01("order|"+stablePulseKey(b)));
  const n=ordered.length;
  ordered.forEach((e,i)=>{
    const base=((i+.5)/n)*windowMs;
    const jitter=(hash01("offset|"+stablePulseKey(e))-.5)*Math.min(36,windowMs/n*.25);
    const delay=Math.max(0,Math.round(base+jitter));
    state.flashTimers.push(setTimeout(()=>showFlash(e),delay));
  });
}

function pulseGeometry(e){
  const p=e.reachId?paths.get(e.reachId):null;
  const station=eventPoint(e);
  if(p&&typeof p.getTotalLength==="function"){
    const cached=reachMetrics.get(e.reachId);
    const len=Math.max(1,cached?.length||p.getTotalLength());
    const segLen=Math.max(7,Math.min(23,len*.17));
    // Find the path position closest to the station in SVG source coordinates.
    // A bounded, coarse search is sufficient on the already local 2.5 km reach.
    let center=len*.5,closest=Infinity;
    if(station){
      for(let i=0;i<=16;i++){
        const at=i*len/16;
        const pt=p.getPointAtLength(at);
        const d=(pt.x-station[0])**2+(pt.y-station[1])**2;
        if(d<closest){closest=d;center=at}
      }
    }
    const start=Math.max(0,Math.min(len-segLen,center-segLen/2));
    const pt=p.getPointAtLength(Math.min(len,start+segLen/2));
    return {path:p,len,segLen,start,point:[pt.x,pt.y]};
  }
  return station?{path:null,len:0,segLen:0,start:0,point:station}:null;
}

function showFlash(e){
  const g=pulseGeometry(e);
  if(!g)return;

  const colour=STATUS_STROKES[e.status]||"#dff8ff";
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. A short luminous impulse runs along the sampled reach.
  let pulsePath=null;
  if(g.path){
    pulsePath=document.createElementNS(NS,"path");
    pulsePath.setAttribute("d",g.path.getAttribute("d"));
    pulsePath.setAttribute("class","observation-pulse");
    pulsePath.style.stroke=colour;
    pulsePath.style.color=colour;
    pulsePath.style.strokeDasharray=`${g.segLen} ${g.len}`;
    pulsePath.style.strokeDashoffset=`${-g.start}`;
    els.flashes.appendChild(pulsePath);
  }

  // 2. A tiny core and a much softer ring mark the actual observation.
  const core=document.createElementNS(NS,"circle");
  core.setAttribute("cx",g.point[0]);core.setAttribute("cy",g.point[1]);core.setAttribute("r","1.35");
  core.setAttribute("class","sample-flash-core");
  core.style.fill=colour;
  core.style.color=colour;

  const ring=document.createElementNS(NS,"circle");
  ring.setAttribute("cx",g.point[0]);ring.setAttribute("cy",g.point[1]);ring.setAttribute("r","1.7");
  ring.setAttribute("class","sample-flash-ring");
  ring.style.stroke=colour;
  ring.style.color=colour;

  els.flashes.append(ring,core);

  if(reduce){
    setTimeout(()=>{pulsePath?.remove();core.remove();ring.remove()},220);
    return;
  }

  const duration=360;
  if(pulsePath?.animate){
    const travel=Math.min(10,Math.max(3,g.segLen*.24));
    const a=pulsePath.animate([
      {opacity:0,strokeWidth:.7,strokeDashoffset:`${-(g.start-travel)}`},
      {opacity:.98,strokeWidth:2.0,strokeDashoffset:`${-g.start}`,offset:.18},
      {opacity:.62,strokeWidth:1.25,strokeDashoffset:`${-(g.start+travel*.55)}`,offset:.58},
      {opacity:0,strokeWidth:.55,strokeDashoffset:`${-(g.start+travel)}`}
    ],{duration,easing:"cubic-bezier(.16,.72,.24,1)"});
    a.onfinish=()=>pulsePath.remove();
  }else setTimeout(()=>pulsePath?.remove(),duration);

  if(core.animate){
    const a=core.animate([
      {opacity:0,r:1.0},
      {opacity:1,r:2.25,offset:.16},
      {opacity:.88,r:1.65,offset:.38},
      {opacity:0,r:1.05}
    ],{duration:330,easing:"cubic-bezier(.18,.72,.22,1)"});
    a.onfinish=()=>core.remove();
  }else setTimeout(()=>core.remove(),720);

  if(ring.animate){
    const a=ring.animate([
      {opacity:0,r:1.8,strokeWidth:1.25},
      {opacity:.72,r:3.2,strokeWidth:1.05,offset:.14},
      {opacity:.26,r:7.0,strokeWidth:.72,offset:.55},
      {opacity:0,r:11.5,strokeWidth:.35}
    ],{duration:410,easing:"cubic-bezier(.12,.58,.22,1)"});
    a.onfinish=()=>ring.remove();
  }else setTimeout(()=>ring.remove(),980);
}

function initialiseSystemSelection(){
  els.systems.replaceChildren();
  reachToSystem.clear();
  selectedSystemId=null;
  selectionGeneration++;
  for(const r of data.reaches){
    if(r.systemId)reachToSystem.set(r.id,r.systemId);
  }
  // Full network stays visible in the single static base path. Only one
  // connected drainage system is mounted on selection, never every system.
}

function loadConnectedSystems(){
  if(!systemIndexPromise){
    systemIndexPromise=fetch("./data/systems.json",{cache:"no-store"})
      .then(response=>{
        if(!response.ok)throw new Error("Connected-system data unavailable");
        return response.json();
      })
      .then(payload=>{
        if(payload?.format!=="dark-rivers-connected-systems-v1"||!Array.isArray(payload.systems)){
          throw new Error("Unexpected connected-system data");
        }
        return new Map(payload.systems.map(row=>[row[0],{label:row[1],d:row[2]}]));
      })
      .catch(error=>{
        systemIndexPromise=null;
        console.info("Dark Rivers: connected-system layer not available yet.",error);
        return null;
      });
  }
  return systemIndexPromise;
}

async function highlightRiverSystem(reachId){
  const request=++selectionGeneration;
  els.systems.replaceChildren();
  selectedSystemId=null;

  const systemId=reachToSystem.get(reachId);
  if(!systemId)return;
  const index=await loadConnectedSystems();
  if(request!==selectionGeneration||state.selected!==reachId||!index)return;

  const system=index.get(systemId);
  if(!system?.d)return;
  const path=makePath("river-system is-selected",system.d);
  path.setAttribute("aria-hidden","true");
  els.systems.replaceChildren(path);
  selectedSystemId=systemId;
  // Do not recolour the entire river with one station's ecological class:
  // selected drainage topology is neutral blue; the observed Q pulse is local.
}

function select(id){state.selected=id;els.detail.hidden=false;render(false);highlightRiverSystem(id)}

function renderDetail(){
  if(!state.selected){els.detail.hidden=true;return}
  els.detail.hidden=false;
  const r=reachById.get(state.selected),e=latestFor(state.selected);
  els.detail.innerHTML=e
    ?`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>${escapeHtml(e.status)} · ${escapeHtml(e.q)}</h2><p>Last recorded Q-value by the selected year. This is historical evidence, not a measurement of current ecological condition.</p><div class="detail-grid"><div><span>Observation</span><strong>${e.year}</strong></div><div><span>Sampling point</span><strong>${escapeHtml(e.stationName||r.stationName||e.station||"EPA station")}</strong></div></div>`
    :`<p class="detail-kicker">${escapeHtml(r.name)}</p><h2>Still dark in ${state.year}</h2><p>No observation has been revealed for this reach by the selected year.</p>`;
}

function renderAnalytics(latest){
  const totals={Dark:0,High:0,Good:0,Moderate:0,Poor:0,Bad:0};
  const total=Math.max(1,fullNetworkWeight);

  // Coloured share is measured against the complete mapped river network.
  // Previously the denominator was only station-associated reaches, so 2025
  // misleadingly read as 100% revealed while most visible river lines were dark.
  let coloured=0;
  for(const r of data.reaches){
    const obs=latest.get(r.id);
    if(!obs||!STATUS_ORDER.includes(obs.status))continue;
    const w=pathWeights.get(r.id)||0;
    totals[obs.status]+=w;
    coloured+=w;
  }

  // Overlapping station clips can slightly double-count. Clamp only the visual
  // coverage denominator; Q classes themselves remain based on real observations.
  if(coloured>total){
    const scale=total/coloured;
    for(const key of STATUS_ORDER.slice(1))totals[key]*=scale;
    coloured=total;
  }
  totals.Dark=Math.max(0,total-coloured);

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
  // Projected SVG lengths are suitable for a visual share, not geographic km.
  return `${total?((value/total)*100).toFixed(1):"0.0"}%`;
}

// One latest known observation per mapped sampled reach, for every historical year.
// The chart describes the observed subset, not an estimate for unsampled rivers.
function renderQualityAxis(){
  if(!els.qualityAxis)return;
  const min=Number(data.meta.minYear),max=Number(data.meta.maxYear);
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return;
  // Decade ticks are anchored to actual years, not evenly distributed labels.
  const years=[min];
  for(let year=Math.ceil((min+1)/10)*10;year<max;year+=10)years.push(year);
  if(max>min)years.push(max);
  const span=Math.max(1,max-min);
  els.qualityAxis.innerHTML=years.map((year,i)=>{
    const kind=i===0?"is-start":i===years.length-1?"is-end":"is-decade";
    const left=((year-min)/span*100).toFixed(2);
    return `<span class="quality-tick ${kind}" style="left:${left}%" data-year="${year}">${year}</span>`;
  }).join("");
}

function prepareQualityTimeline(){
  const min=Number(data.meta.minYear),max=Number(data.meta.maxYear);
  const grouped=new Map();
  for(const e of data.events){
    const year=Number(e.year);
    if(!e.reachId||!STATUS_STROKES[e.status]||!Number.isInteger(year)||year<min||year>max)continue;
    if(!grouped.has(year))grouped.set(year,[]);
    grouped.get(year).push(e);
  }
  const lastByReach=new Map();
  qualityTimeline=[];
  for(let year=min;year<=max;year++){
    for(const e of grouped.get(year)||[])lastByReach.set(e.reachId,e.status);
    const counts={High:0,Good:0,Moderate:0,Poor:0,Bad:0};
    for(const status of lastByReach.values())counts[status]++;
    qualityTimeline.push({year,counts,count:lastByReach.size});
  }
}

function renderQualityTimeline(){
  if(!els.qualityChart)return;
  const current=qualityTimeline.find(row=>row.year===state.year);
  const W=330,H=82,n=qualityTimeline.length,step=W/Math.max(1,n);
  const stack=["Bad","Poor","Moderate","Good","High"];
  let svg='<rect width="330" height="82" rx="3" fill="#101d23"/>';
  let renderedYears=0;
  for(let i=0;i<n;i++){
    const row=qualityTimeline[i];
    if(row.year>state.year||!row.count)continue;
    const x=(i*step).toFixed(2),width=Math.max(.4,step-.42).toFixed(2);
    let bottom=H;
    for(const status of stack){
      const height=H*row.counts[status]/row.count;
      if(height<=0)continue;
      bottom-=height;
      svg+=`<rect x="${x}" y="${Math.max(0,bottom).toFixed(2)}" width="${width}" height="${height.toFixed(2)}" fill="${STATUS_STROKES[status]}"/>`;
    }
    renderedYears++;
  }
  const i=Math.max(0,qualityTimeline.findIndex(row=>row.year===state.year));
  const marker=((i+.5)*step).toFixed(2);
  svg+=`<line x1="${marker}" y1="0" x2="${marker}" y2="82" stroke="#eef4f6" stroke-opacity=".9" stroke-width="1.1"/>`;
  els.qualityChart.innerHTML=svg;
  const observed=current?.count||0;
  const highGood=observed?100*(current.counts.High+current.counts.Good)/observed:0;
  const summary=observed?`${highGood.toFixed(0)}% high/good · ${observed.toLocaleString("en-IE")} reaches`:"No sampled reaches yet";
  els.qualityYear.textContent=String(state.year);
  els.qualitySummary.textContent=summary;
  els.qualityChart.setAttribute("aria-label",`Recorded Q-class mix from ${data.meta.minYear} to ${state.year}. ${summary}. Based only on sampled reaches; the most recent record for each reach is carried forward.`);
  if(new URLSearchParams(location.search).has("smoke")){
    const pass=n>0&&Boolean(current)&&renderedYears>0&&observed>0&&els.qualityChart.querySelectorAll("rect").length>1;
    document.documentElement.dataset.darkRiversQualityHistory=pass?"pass":"fail";
  }
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
  state.beatCount=null;
  render(false);
  if(flash)scheduleFlashes(data.events.filter(e=>e.year===state.year),690);
}

function eventsBetween(fromYear,toYear){
  return data.events.filter(e=>e.year>fromYear&&e.year<=toYear);
}

function advanceBeat(){
  if(state.year>=data.meta.maxYear){setPlaying(false);return}
  const step=Math.max(1,Number(els.speed.value||3));
  const from=state.year;
  const to=Math.min(Number(data.meta.maxYear),from+step);
  const batch=eventsBetween(from,to);
  setYear(to,false);
  state.beatCount=batch.length;
  els.statBeat.textContent=batch.length.toLocaleString("en-IE");
  scheduleFlashes(batch,690);
}

function setPlaying(on){
  state.playing=on;
  els.play.setAttribute("aria-pressed",String(on));
  els.play.textContent=on?"❚❚ Pause":"▶ Play";
  if(!on&&state.raf){cancelAnimationFrame(state.raf);state.raf=null}
  if(!on){clearFlashTimers();return}

  if(state.year>=data.meta.maxYear)setYear(data.meta.minYear);
  clearFlashTimers();
  state.last=performance.now();
  state.carry=0;

  // Start with a beat immediately, then settle into a measured rhythm.
  advanceBeat();
  state.last=performance.now();
  state.raf=requestAnimationFrame(tick);
}

function tick(now){
  if(!state.playing)return;
  const beatMs=790;
  state.carry+=Math.min(now-state.last,250);
  state.last=now;

  if(state.carry>=beatMs){
    state.carry%=beatMs;
    advanceBeat();
  }

  if(state.playing)state.raf=requestAnimationFrame(tick);
}
function reset(){
  setPlaying(false);
  clearFlashTimers();
  state.selected=null;
  highlightRiverSystem(null);
  els.flashes.replaceChildren();
  // The prominently labelled Reset control must restore the map as well as time.
  // Previously it left the map at 514% or whatever zoom page scrolling induced.
  updateMapViewport();
  if(data.meta?.official===true)fitOfficialGeometry();else resetHydroView();
  setYear(data.meta.minYear);
  els.detail.innerHTML='<p class="detail-kicker">Select a reach</p><h2>What do we know here?</h2><p>Click or tap a river reach to inspect its latest revealed observation.</p>';
}

function configureData(){
  reachById=new Map(data.reaches.map(r=>[r.id,r]));
  const official=data.meta?.official===true;
  document.body.classList.toggle("has-official-data",official);
  updateMapViewport();
  initialiseSystemSelection();
  resetContinuity();

  if(official){
    renderOfficialGeometry();
    addBaseNetwork();
    computeReachMetrics();
    fitOfficialGeometry();
  }else{
    hydrateStaticFallback();
    addBaseNetwork();
    computeReachMetrics();
    hydroBase={a:1,d:1,e:0,f:0};
    resetHydroView();
  }

  measureReachWeights();
  prepareQualityTimeline();
  renderQualityAxis();

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
      ?'<strong>EPA data:</strong> bright Q-value colour marks sampled sections. The state bar uses the complete mapped river network as its denominator; softly lit neighbouring threads show connectivity, not measured ecological quality.'
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
    const wanted=new URL("./service-worker.20260920-28.js",location.href).href;
    for(const reg of await navigator.serviceWorker.getRegistrations()){
      if(reg.scope.includes("/demos/dark-rivers/")){
        const urls=[reg.active?.scriptURL,reg.waiting?.scriptURL,reg.installing?.scriptURL].filter(Boolean);
        if(!urls.includes(wanted))await reg.unregister();
      }
    }
    if("caches" in window){
      for(const key of await caches.keys()){
        if(key.startsWith("salmon-dark-rivers-")&&key!=="salmon-dark-rivers-v28")await caches.delete(key);
      }
    }
    const reg=await navigator.serviceWorker.register("./service-worker.20260920-28.js",{scope:"./"});
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
  setupMapNavigation();
  setupPwa();
}

init();
})();