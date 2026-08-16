window.MoonShadowStats = (() => {
  const earthRadius = 6378.137;

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function frame(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#07111a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(148,163,184,.18)";
    ctx.strokeRect(.5, .5, w - 1, h - 1);
  }

  function label(ctx, text, x, y, align = "left", color = "#9bb4b3") {
    ctx.fillStyle = color;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function histogram(canvas, values, lensRadius) {
    const {ctx,w,h} = setupCanvas(canvas);
    frame(ctx,w,h);
    const pad = {l:42,r:16,t:20,b:34};
    const maxX = Math.max(40000, Math.ceil(Math.max(...values) / 5000) * 5000);
    const bins = 24;
    const counts = Array(bins).fill(0);
    values.forEach(v => {
      const i = Math.min(bins - 1, Math.floor(v / maxX * bins));
      counts[i] += 1;
    });
    const maxC = Math.max(...counts,1);
    const pw = w-pad.l-pad.r, ph=h-pad.t-pad.b;

    ctx.fillStyle = "rgba(24,198,216,.28)";
    counts.forEach((c,i) => {
      const x = pad.l + i * pw/bins + 1;
      const bw = pw/bins - 2;
      const bh = c/maxC * ph;
      ctx.fillRect(x, pad.t+ph-bh, bw, bh);
    });

    const xEarth = pad.l + earthRadius/maxX*pw;
    ctx.strokeStyle = "#ffb64c";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(xEarth,pad.t); ctx.lineTo(xEarth,pad.t+ph); ctx.stroke();
    label(ctx,"1 Earth radius",xEarth+4,pad.t+12,"left","#ffcb7a");

    const xLens = pad.l + Math.min(lensRadius,maxX)/maxX*pw;
    ctx.strokeStyle = "#75e7f0";
    ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(xLens,pad.t); ctx.lineTo(xLens,pad.t+ph); ctx.stroke();
    ctx.setLineDash([]);

    label(ctx,"0",pad.l,pad.t+ph+20,"center");
    label(ctx,`${Math.round(maxX/1000)}k km`,pad.l+pw,pad.t+ph+20,"center");
    label(ctx,"number of passes",pad.l-8,pad.t+10,"right");
  }

  function cumulative(canvas, tracks, lensRadius) {
    const {ctx,w,h} = setupCanvas(canvas);
    frame(ctx,w,h);
    const pad={l:46,r:16,t:20,b:34};
    const pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    const maxR=45000;
    const steps=120;
    const axis=[], pen=[];
    for(let i=0;i<=steps;i++){
      const r=maxR*i/steps;
      axis.push([r, tracks.filter(t=>t.minAxisKm<=r).length/tracks.length]);
      pen.push([r, tracks.filter(t=>t.minPenumbraEdgeKm<=r).length/tracks.length]);
    }
    function draw(series,color){
      ctx.strokeStyle=color; ctx.lineWidth=2;
      ctx.beginPath();
      series.forEach(([r,p],i)=>{
        const x=pad.l+r/maxR*pw, y=pad.t+ph-p*ph;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      });
      ctx.stroke();
    }
    draw(axis,"#18c6d8");
    draw(pen,"#ffb64c");

    const xLens=pad.l+Math.min(lensRadius,maxR)/maxR*pw;
    ctx.strokeStyle="#edfafa"; ctx.lineWidth=1; ctx.setLineDash([4,5]);
    ctx.beginPath();ctx.moveTo(xLens,pad.t);ctx.lineTo(xLens,pad.t+ph);ctx.stroke();
    ctx.setLineDash([]);

    label(ctx,"0",pad.l,pad.t+ph+20,"center");
    label(ctx,"45,000 km",pad.l+pw,pad.t+ph+20,"center");
    label(ctx,"100%",pad.l-8,pad.t+4,"right");
    label(ctx,"0%",pad.l-8,pad.t+ph+4,"right");
    label(ctx,"axis",pad.l+8,pad.t+14,"left","#75e7f0");
    label(ctx,"penumbra edge",pad.l+54,pad.t+14,"left","#ffcb7a");
  }

  function types(canvas, events) {
    const {ctx,w,h}=setupCanvas(canvas);
    frame(ctx,w,h);
    const order=["Partial","Annular","Total","Hybrid"];
    const counts=Object.fromEntries(order.map(k=>[k,0]));
    events.forEach(e=>{ counts[e.type]=(counts[e.type]||0)+1; });
    const maxC=Math.max(...Object.values(counts),1);
    const pad={l:34,r:16,t:20,b:44};
    const pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    const colors=["#8ea9b5","#ffb64c","#18c6d8","#d98eff"];
    order.forEach((k,i)=>{
      const slot=pw/order.length;
      const bw=Math.min(58,slot*.55);
      const bh=counts[k]/maxC*ph;
      const x=pad.l+slot*i+slot/2-bw/2;
      ctx.fillStyle=colors[i];
      ctx.fillRect(x,pad.t+ph-bh,bw,bh);
      label(ctx,String(counts[k]),x+bw/2,pad.t+ph-bh-7,"center","#edfafa");
      label(ctx,k,x+bw/2,pad.t+ph+20,"center");
    });
  }

  return { histogram, cumulative, types };
})();
