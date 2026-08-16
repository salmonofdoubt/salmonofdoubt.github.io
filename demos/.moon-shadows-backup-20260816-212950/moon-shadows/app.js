(() => {
  "use strict";

  const RE = 6378.137;
  const MIN_VIEW = 9000;
  const MAX_VIEW = 430000;
  const MEAN_LUNAR = 384400;

  const el = id => document.getElementById(id);
  const canvas = el("shadowCanvas");
  const ctx = canvas.getContext("2d");

  const state = {
    data: null,
    events: null,
    viewHalf: MAX_VIEW,
    selectedTrack: 0,
    accumulation: "cycle",
    showAll: true,
    showEclipseTracks: true,
    showPenumbra: true,
    showCentral: true,
    showLens: true,
    animating: false,
    animIndex: 0,
    animTimer: null,
    deferredInstallPrompt: null,
    touchDistance: null
  };

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function fmtKm(v){
    const n=Math.abs(v);
    if(n>=100000) return `${Math.round(v/1000).toLocaleString()}k km`;
    if(n>=10000) return `${Math.round(v/1000)}k km`;
    return `${Math.round(v).toLocaleString()} km`;
  }
  function pct(n,d){ return d ? `${(n/d*100).toFixed(1)}% of passes` : "—"; }

  function viewToSlider(view){
    const t=(Math.log(view)-Math.log(MIN_VIEW))/(Math.log(MAX_VIEW)-Math.log(MIN_VIEW));
    return Math.round(clamp(t,0,1)*1000);
  }
  function sliderToView(v){
    const t=Number(v)/1000;
    return Math.exp(Math.log(MIN_VIEW)+t*(Math.log(MAX_VIEW)-Math.log(MIN_VIEW)));
  }

  function setViewHalf(v){
    state.viewHalf=clamp(v,MIN_VIEW,MAX_VIEW);
    el("zoomSlider").value=viewToSlider(state.viewHalf);
    updateViewText();
    draw();
    updateStats();
  }

  function lensRadius(){
    return clamp(state.viewHalf*0.08, RE, 40000);
  }

  function setupCanvas(){
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const w=Math.max(320,Math.round(rect.width));
    const h=Math.max(320,Math.round(rect.height));
    if(canvas.width!==w*dpr || canvas.height!==h*dpr){
      canvas.width=w*dpr; canvas.height=h*dpr;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return {w,h,dpr};
  }

  function projector(w,h){
    const span=Math.min(w,h)*0.88;
    const pxPerKm=span/(state.viewHalf*2);
    const cx=w/2, cy=h/2;
    return {
      pxPerKm,cx,cy,
      point(x,y){ return [cx+x*pxPerKm, cy-y*pxPerKm]; },
      radius(km){ return km*pxPerKm; }
    };
  }

  function clear(w,h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#f9fbfa";
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(14,31,38,.035)";
    ctx.lineWidth=1;
    const step=34;
    for(let x=0;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  }

  function drawReference(p,w,h){
    const [cx,cy]=p.point(0,0);

    if(state.viewHalf>150000){
      const r=p.radius(MEAN_LUNAR);
      if(r<Math.max(w,h)*1.2){
        ctx.strokeStyle="rgba(6,55,70,.16)";
        ctx.setLineDash([3,5]);
        ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if(state.showLens){
      const r=p.radius(lensRadius());
      ctx.strokeStyle="rgba(255,182,76,.66)";
      ctx.setLineDash([6,5]);
      ctx.lineWidth=1.1;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    }

    const earthR=Math.max(.9,p.radius(RE));
    ctx.fillStyle="#2078c8";
    ctx.strokeStyle="#052f4c";
    ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(cx,cy,earthR,0,Math.PI*2);ctx.fill();ctx.stroke();

    if(earthR>10){
      const grad=ctx.createRadialGradient(cx-earthR*.28,cy-earthR*.3,1,cx,cy,earthR);
      grad.addColorStop(0,"rgba(220,250,255,.88)");
      grad.addColorStop(.18,"rgba(74,160,216,.46)");
      grad.addColorStop(1,"rgba(0,34,70,.16)");
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.arc(cx,cy,earthR*.94,0,Math.PI*2);ctx.fill();
    }

    ctx.fillStyle="#092630";
    ctx.font="700 11px system-ui,sans-serif";
    ctx.textAlign="left";
    ctx.fillText("Earth",cx+earthR+7,cy-4);
  }

  function drawTrack(track,p,style){
    const pts=track.points;
    if(!pts || pts.length<2) return;
    ctx.strokeStyle=style.stroke;
    ctx.lineWidth=style.width;
    ctx.globalAlpha=style.alpha;
    ctx.beginPath();
    pts.forEach((q,i)=>{
      const [x,y]=p.point(q[1],q[2]);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.stroke();
    ctx.globalAlpha=1;
  }

  function selectedTrackSet(){
    const tracks=state.data.tracks;
    if(state.accumulation==="one") return [tracks[state.selectedTrack]];
    if(state.accumulation==="year"){
      const a=Math.max(0,state.selectedTrack-6);
      const b=Math.min(tracks.length,state.selectedTrack+7);
      return tracks.slice(a,b);
    }
    return tracks;
  }

  function drawEclipseTrack(et,p){
    if(!et.points || et.points.length<2) return;
    ctx.strokeStyle="#d06e12";
    ctx.lineWidth=1.6;
    ctx.globalAlpha=.78;
    ctx.beginPath();
    et.points.forEach((q,i)=>{
      const [x,y]=p.point(q[1],q[2]);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.stroke();
    ctx.globalAlpha=1;
  }

  function currentPoint(){
    const tr=state.data.tracks[state.selectedTrack];
    if(!tr || !tr.points.length) return null;
    const i=clamp(state.animIndex,0,tr.points.length-1);
    return tr.points[i];
  }

  function drawCurrentShadow(p){
    const q=currentPoint();
    if(!q) return;
    const [x,y]=p.point(q[1],q[2]);
    const pen=q[3], central=q[4];

    if(state.showPenumbra){
      ctx.fillStyle="rgba(8,20,28,.055)";
      ctx.strokeStyle="rgba(8,20,28,.18)";
      ctx.lineWidth=.8;
      ctx.beginPath();ctx.arc(x,y,Math.max(.7,p.radius(pen)),0,Math.PI*2);ctx.fill();ctx.stroke();
    }

    if(state.showCentral){
      const centralR=Math.abs(central);
      if(p.radius(centralR)>.45){
        ctx.fillStyle=central>=0 ? "rgba(1,4,8,.52)" : "rgba(255,182,76,.22)";
        ctx.strokeStyle=central>=0 ? "rgba(1,4,8,.8)" : "rgba(208,110,18,.8)";
        ctx.lineWidth=.8;
        ctx.beginPath();ctx.arc(x,y,Math.max(.55,p.radius(centralR)),0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }

    ctx.fillStyle="#ff6b62";
    ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();

    const rho=Math.hypot(q[1],q[2]);
    el("axisReadout").textContent=fmtKm(rho);
    el("moonReadout").textContent=fmtKm(q[5]);

    const earthTouch = rho <= RE + pen;
    let stateText="misses Earth";
    if(earthTouch){
      if(Math.abs(central)>0 && rho <= RE + Math.abs(central)){
        stateText=central>=0 ? "central shadow can reach Earth" : "antumbra can reach Earth";
      }else{
        stateText="penumbra can reach Earth";
      }
    }
    el("shadowReadout").textContent=stateText;
  }

  function draw(){
    if(!state.data) return;
    const {w,h}=setupCanvas();
    clear(w,h);
    const p=projector(w,h);

    if(state.showAll){
      const list=selectedTrackSet();
      const alpha=state.accumulation==="cycle" ? .095 : state.accumulation==="year" ? .18 : .35;
      list.forEach(track=>drawTrack(track,p,{stroke:"#1387a6",width:.72,alpha}));
    }

    // Selected pass always visible above accumulated paths.
    drawTrack(state.data.tracks[state.selectedTrack],p,{stroke:"#005f78",width:1.7,alpha:.82});

    if(state.showEclipseTracks){
      state.data.eclipseTracks.forEach(et=>drawEclipseTrack(et,p));
    }

    drawReference(p,w,h);
    drawCurrentShadow(p);
  }

  function updateTrackText(){
    if(!state.data) return;
    const tr=state.data.tracks[state.selectedTrack];
    const date=tr.closest.slice(0,10);
    const evs=state.events.events.filter(e=>e.trackId===tr.id);
    el("trackLabel").textContent = evs.length
      ? `${state.selectedTrack+1}/${state.data.tracks.length} · ${date} · ${evs.map(e=>e.type).join(", ")} eclipse`
      : `${state.selectedTrack+1}/${state.data.tracks.length} · ${date} · miss`;
  }

  function updateViewText(){
    el("viewLabel").textContent=fmtKm(state.viewHalf);
    const lens=lensRadius();
    el("lensRadiusLabel").textContent=fmtKm(lens);

    if(state.viewHalf>250000){
      el("scaleNoteTitle").textContent="Lunar scale";
      el("scaleNoteText").textContent="Earth is only ~1/60 of the mean lunar distance in radius.";
    } else if(state.viewHalf>50000){
      el("scaleNoteTitle").textContent="Node-band scale";
      el("scaleNoteText").textContent="The narrow Sun-view band is now much easier to see.";
    } else if(state.viewHalf>18000){
      el("scaleNoteTitle").textContent="Near Earth";
      el("scaleNoteText").textContent="Most shadow axes still pass above or below the planet.";
    } else {
      el("scaleNoteTitle").textContent="Eclipse scale";
      el("scaleNoteText").textContent="The statistical lens is locked to one Earth radius.";
    }
  }

  function updateStats(){
    if(!state.data || !state.events) return;
    const tracks=state.data.tracks;
    const lens=lensRadius();
    const axis=tracks.filter(t=>t.minAxisKm<=lens).length;
    const pen=tracks.filter(t=>t.minPenumbraEdgeKm<=lens).length;
    const eclipses=state.events.events.length;

    el("metricPasses").textContent=tracks.length.toLocaleString();
    el("metricAxis").textContent=axis.toLocaleString();
    el("metricAxisPct").textContent=pct(axis,tracks.length);
    el("metricPen").textContent=pen.toLocaleString();
    el("metricPenPct").textContent=pct(pen,tracks.length);
    el("metricEclipses").textContent=eclipses.toLocaleString();
    el("metricEclipseRate").textContent=`${(eclipses/tracks.length*100).toFixed(1)} eclipses per 100 physical passes`;

    const values=tracks.map(t=>t.minAxisKm);
    MoonShadowStats.histogram(el("histogramCanvas"),values,lens);
    MoonShadowStats.cumulative(el("cumulativeCanvas"),tracks,lens);
    MoonShadowStats.types(el("typeCanvas"),state.events.events);
  }

  function setTrack(i){
    if(!state.data) return;
    stopAnimation();
    state.selectedTrack=clamp(Number(i),0,state.data.tracks.length-1);
    el("trackSlider").value=state.selectedTrack;
    state.animIndex=0;
    updateTrackText();
    draw();
  }

  function play(){
    if(!state.data) return;
    if(state.animating){ stopAnimation(); return; }
    const tr=state.data.tracks[state.selectedTrack];
    state.animating=true;
    el("playButton").textContent="Pause";
    if(state.animIndex>=tr.points.length-1) state.animIndex=0;
    state.animTimer=setInterval(()=>{
      state.animIndex++;
      if(state.animIndex>=tr.points.length){
        stopAnimation();
        state.animIndex=tr.points.length-1;
      }
      draw();
    },65);
  }

  function stopAnimation(){
    if(state.animTimer) clearInterval(state.animTimer);
    state.animTimer=null;
    state.animating=false;
    if(el("playButton")) el("playButton").textContent="Play one pass";
  }

  function installPwa(){
    if(state.deferredInstallPrompt){
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt.userChoice.finally(()=>{
        state.deferredInstallPrompt=null;
        el("installButton").hidden=true;
      });
      return;
    }
    el("iosInstallHint").hidden=false;
  }

  function isStandalone(){
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  async function init(){
    const [trackRes,eventRes]=await Promise.all([
      fetch("data/shadow-tracks.json"),
      fetch("data/eclipse-events.json")
    ]);
    if(!trackRes.ok || !eventRes.ok) throw new Error("Could not load bundled Moon Shadows data.");
    state.data=await trackRes.json();
    state.events=await eventRes.json();

    el("trackSlider").max=state.data.tracks.length-1;
    el("metricPasses").textContent=state.data.tracks.length;
    el("metricEclipses").textContent=state.events.events.length;
    updateTrackText();
    updateViewText();
    updateStats();
    draw();

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("Service worker registration failed",err));
    }

    if(!isStandalone()){
      const ua=navigator.userAgent;
      const apple=/iPhone|iPad|iPod|Macintosh/.test(ua);
      if(apple) el("installButton").hidden=false;
    }
  }

  el("zoomSlider").addEventListener("input",e=>setViewHalf(sliderToView(e.target.value)));
  document.querySelectorAll("[data-zoom]").forEach(btn=>{
    btn.addEventListener("click",()=>setViewHalf(Number(btn.dataset.zoom)));
  });
  el("trackSlider").addEventListener("input",e=>setTrack(e.target.value));
  el("playButton").addEventListener("click",play);
  el("nextButton").addEventListener("click",()=>setTrack((state.selectedTrack+1)%(state.data?.tracks.length||1)));
  el("resetButton").addEventListener("click",()=>{
    state.accumulation="cycle";
    el("accumulationSelect").value="cycle";
    setTrack(0);
    setViewHalf(MAX_VIEW);
  });
  el("accumulationSelect").addEventListener("change",e=>{state.accumulation=e.target.value;draw();});
  [["showAll","showAll"],["showEclipseTracks","showEclipseTracks"],["showPenumbra","showPenumbra"],["showCentral","showCentral"],["showLens","showLens"]]
    .forEach(([id,key])=>el(id).addEventListener("change",e=>{state[key]=e.target.checked;draw();updateStats();}));

  canvas.addEventListener("wheel",e=>{
    e.preventDefault();
    const factor=e.deltaY>0 ? 1.16 : .86;
    setViewHalf(state.viewHalf*factor);
  },{passive:false});

  canvas.addEventListener("touchstart",e=>{
    if(e.touches.length===2){
      state.touchDistance=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
    }
  },{passive:true});
  canvas.addEventListener("touchmove",e=>{
    if(e.touches.length===2 && state.touchDistance){
      e.preventDefault();
      const d=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
      const ratio=state.touchDistance/d;
      state.touchDistance=d;
      setViewHalf(state.viewHalf*ratio);
    }
  },{passive:false});
  canvas.addEventListener("touchend",()=>{state.touchDistance=null;},{passive:true});

  window.addEventListener("resize",()=>{draw();updateStats();});

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    state.deferredInstallPrompt=e;
    if(!isStandalone()) el("installButton").hidden=false;
  });
  window.addEventListener("appinstalled",()=>{el("installButton").hidden=true;});
  el("installButton").addEventListener("click",installPwa);
  el("closeInstallHint").addEventListener("click",()=>{el("iosInstallHint").hidden=true;});

  init().catch(err=>{
    console.error(err);
    el("trackLabel").textContent="Data load failed";
    el("shadowReadout").textContent="See console";
  });
})();
