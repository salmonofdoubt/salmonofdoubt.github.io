(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const ui = {
    clusterTotal: $('clusterTotal'), eventCluster: $('eventCluster'), severity: $('severity'), reach: $('reach'),
    connectivity: $('connectivity'), socialInfluence: $('socialInfluence'), spillover: $('spillover'), calmStrength: $('calmStrength'),
    delay: $('delay'), autoExportEnabled: $('autoExportEnabled'), autoExportThreshold: $('autoExportThreshold'),
    clusterTotalOut: $('clusterTotalOut'), severityOut: $('severityOut'), reachOut: $('reachOut'), connectivityOut: $('connectivityOut'),
    socialInfluenceOut: $('socialInfluenceOut'), spilloverOut: $('spilloverOut'), calmStrengthOut: $('calmStrengthOut'),
    delayOut: $('delayOut'), autoExportThresholdOut: $('autoExportThresholdOut'), autoExportStatus: $('autoExportStatus'),
    eventButton: $('eventButton'), heroEvent: $('heroEvent'), pauseButton: $('pauseButton'), resetButton: $('resetButton'),
    chaosButton: $('chaosButton'), runDot: $('runDot'), stateLabel: $('stateLabel'), stateNote: $('stateNote'), activeMecker: $('activeMecker'),
    activeCalm: $('activeCalm'), activeClusters: $('activeClusters'), annoyanceValue: $('annoyanceValue'), networkCanvas: $('networkCanvas'),
    historyCanvas: $('historyCanvas'), eventFlash: $('eventFlash'), clusterStrip: $('clusterStrip'), exportSource: $('exportSource'),
    exportTarget: $('exportTarget'), exportAmount: $('exportAmount'), exportAmountOut: $('exportAmountOut'), exportButton: $('exportButton'),
    exportStatus: $('exportStatus')
  };

  const TEXT = {
    de: {
      randomCluster: 'Zufälliger Cluster', cluster: 'Cluster', societyReset: 'Gesellschaft zurückgesetzt.',
      manualDefault: 'Manueller Export verschiebt tatsächlich Meckerenergie zwischen Clustern.', exportNeedsTwo: 'Für Export braucht es mindestens zwei Cluster.',
      noExportEnergy: (s) => `Cluster ${s} hat gerade keine exportierbare Meckerenergie.`, tooLittle: (s) => `Cluster ${s} meckert noch zu wenig für einen wirksamen Export.`,
      manualExport: (s,t,e) => `Manueller Meckerexport: Cluster ${s} → ${t} · ${e} Energieeinheiten verschoben.`,
      autoExport: (s,t,e) => `Auto-Export: Grenz-Agent Cluster ${s} → ${t} · ${e} Energieeinheiten.`,
      event: (id,c,n,s) => `Ereignis #${id}: Cluster ${c} · ${n} direkt getroffen · Stärke ${s}`,
      pause: 'Pause', resume: 'Weiter', autoOn: (n) => `aktiv · ${n} Exporte`, autoOff: (n) => `aus · ${n} Exporte`,
      clusterChip: (c,m,a,x) => `Cluster ${c}|${m}|Meckerer · Genervtheit ${a} · Autoexporte ${x}`,
      states: {
        quiet:['Gesellschaftliche Ruhe','Alle Cluster sind unter ihren Meckerschwellen.'],
        wave:['Synchronisierte Meckerwelle','Mehrere Cluster schwingen gemeinsam, obwohl kein globaler Taktgeber existiert.'],
        wildfire:['Inter-Cluster-Flächenbrand','Fast alle Cluster meckern gleichzeitig; lokale Prozesse sind zu einem Gesamtereignis geworden.'],
        exportCascade:['Export-Kaskade','Autonome Grenz-Agenten tragen Meckerenergie diskret in weitere Cluster.'],
        spill:['Cluster-Überschwappen','Meckerenergie passiert Clustergrenzen über die schwachen Brücken.'],
        counter:['Gesellschaftliche Gegenkopplung','Mehrere Cluster meckern, aber Beruhiger reagieren breit genug, um gegenzuhalten.'],
        multiple:['Mehrere Meckerherde','Mehrere Cluster sind aktiv, ohne dass daraus bereits ein Flächenbrand geworden ist.'],
        local:['Lokaler Meckerherd','Das Gemecker ist bislang auf einen Cluster begrenzt.'],
        isolated:['Vereinzeltes Gemecker','Einige Agenten reagieren, aber noch kein Cluster hat sich als stabiler Herd etabliert.']
      }
    },
    en: {
      randomCluster: 'Random cluster', cluster: 'Cluster', societyReset: 'Society reset.',
      manualDefault: 'Manual export actually moves grumble energy between clusters.', exportNeedsTwo: 'Export requires at least two clusters.',
      noExportEnergy: (s) => `Cluster ${s} currently has no exportable grumble energy.`, tooLittle: (s) => `Cluster ${s} is not grumbling enough for an effective export yet.`,
      manualExport: (s,t,e) => `Manual grumble export: Cluster ${s} → ${t} · ${e} energy units moved.`,
      autoExport: (s,t,e) => `Auto-export: boundary agent Cluster ${s} → ${t} · ${e} energy units.`,
      event: (id,c,n,s) => `Event #${id}: Cluster ${c} · ${n} directly hit · strength ${s}`,
      pause: 'Pause', resume: 'Resume', autoOn: (n) => `on · ${n} exports`, autoOff: (n) => `off · ${n} exports`,
      clusterChip: (c,m,a,x) => `Cluster ${c}|${m}|grumblers · annoyance ${a} · auto-exports ${x}`,
      states: {
        quiet:['Societal calm','All clusters are below their grumble thresholds.'],
        wave:['Synchronised grumble wave','Several clusters oscillate together even though no global pacemaker exists.'],
        wildfire:['Inter-cluster wildfire','Almost all clusters are grumbling at once; local processes have become a system-wide event.'],
        exportCascade:['Export cascade','Autonomous boundary agents are carrying discrete grumble energy into additional clusters.'],
        spill:['Cluster spillover','Grumble energy is crossing cluster boundaries through weak bridges.'],
        counter:['Societal counter-feedback','Several clusters are grumbling, but calmers are responding broadly enough to push back.'],
        multiple:['Multiple grumble hotspots','Several clusters are active without yet becoming a system-wide flare-up.'],
        local:['Local grumble hotspot','So far, the grumbling remains confined to one cluster.'],
        isolated:['Isolated grumbling','Some agents are reacting, but no cluster has yet established a stable hotspot.']
      }
    }
  };

  const sim = {
    language: 'de', running: true, agents: [], edges: [], emissionHistory: [], history: [], tickAccumulator: 0,
    sampleAccumulator: 0, lastTime: performance.now(), eventId: 0, recentEventTargets: new Set(), globalSeries: [],
    lastGlobalDeltaSign: 0, signChanges: 0, elapsed: 0, clusterCenters: [], exportPulses: [], crossFlux: 0,
    lastExportAt: -999, autoExportCount: 0, autoExportsByCluster: [], lastAutoExportAt: -999
  };

  const N = 70;
  const TICK = 0.1;

  function txt() { return TEXT[sim.language]; }

  function params() {
    return {
      clusters: Number(ui.clusterTotal.value), severity: Number(ui.severity.value), reach: Number(ui.reach.value) / 100,
      connectivity: Number(ui.connectivity.value), social: Number(ui.socialInfluence.value) / 100,
      spillover: Number(ui.spillover.value) / 100, calm: Number(ui.calmStrength.value) / 100,
      delaySteps: Math.round(Number(ui.delay.value)), exportFraction: Number(ui.exportAmount.value) / 100,
      autoExport: ui.autoExportEnabled.checked, autoThreshold: Number(ui.autoExportThreshold.value)
    };
  }

  function setLanguage(lang) {
    sim.language = lang === 'en' ? 'en' : 'de';
    document.documentElement.lang = sim.language;
    document.querySelectorAll('[data-de][data-en]').forEach(el => { el.textContent = el.dataset[sim.language]; });
    document.querySelectorAll('.lang-button').forEach(btn => {
      const active = btn.dataset.lang === sim.language;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    updateClusterSelectors();
    ui.pauseButton.textContent = sim.running ? txt().pause : txt().resume;
    ui.exportStatus.textContent = txt().manualDefault;
    render();
  }

  function updateOutputs() {
    ui.clusterTotalOut.value = ui.clusterTotal.value;
    ui.severityOut.value = ui.severity.value;
    ui.reachOut.value = `${ui.reach.value}%`;
    ui.connectivityOut.value = ui.connectivity.value;
    ui.socialInfluenceOut.value = ui.socialInfluence.value;
    ui.spilloverOut.value = `${ui.spillover.value}%`;
    ui.calmStrengthOut.value = ui.calmStrength.value;
    ui.delayOut.value = `${(Number(ui.delay.value) / 10).toFixed(1)} s`;
    ui.exportAmountOut.value = `${ui.exportAmount.value}%`;
    ui.autoExportThresholdOut.value = ui.autoExportThreshold.value;
    ui.autoExportStatus.textContent = params().autoExport ? txt().autoOn(sim.autoExportCount) : txt().autoOff(sim.autoExportCount);
  }

  function seededNoise(i, salt = 0) {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function centersFor(k) {
    const layouts = {
      1: [[0.50,0.50]], 2: [[0.29,0.50],[0.71,0.50]],
      3: [[0.50,0.27],[0.27,0.68],[0.73,0.68]],
      4: [[0.28,0.30],[0.72,0.30],[0.28,0.70],[0.72,0.70]],
      5: [[0.50,0.50],[0.22,0.25],[0.78,0.25],[0.22,0.75],[0.78,0.75]]
    };
    return layouts[k].map(([x,y], id) => ({ id, x, y }));
  }

  function buildPopulation() {
    const k = params().clusters;
    sim.clusterCenters = centersFor(k);
    sim.autoExportsByCluster = Array(k).fill(0);
    const perCluster = Array(k).fill(0);
    const radius = k === 1 ? 0.39 : k === 2 ? 0.22 : k === 3 ? 0.17 : k === 4 ? 0.145 : 0.125;

    sim.agents = Array.from({length:N}, (_,i) => {
      const cluster = i % k;
      const localIndex = perCluster[cluster]++;
      const center = sim.clusterCenters[cluster];
      const angle = localIndex * 2.3999632297 + seededNoise(i,3) * 0.5;
      const ring = 0.20 + Math.sqrt(seededNoise(i,7)) * 0.78;
      const isCalm = localIndex % 4 === 0 || seededNoise(i,4) < 0.06;
      return {
        id:i, cluster, type:isCalm ? 'calm' : 'mecker', level:0, stimulus:0, emissionM:0, emissionC:0,
        threshold:isCalm ? 8 + seededNoise(i,9)*15 : 11 + seededNoise(i,11)*20,
        reactivity:0.82 + seededNoise(i,15)*0.42, recovery:0.78 + seededNoise(i,18)*0.44,
        x:clamp(center.x + Math.cos(angle)*ring*radius,0.04,0.96),
        y:clamp(center.y + Math.sin(angle)*ring*radius,0.06,0.94),
        neighbors:[], autoCharge:0, autoCooldown:0
      };
    });
    buildNetwork();
    updateClusterSelectors();
  }

  function distance(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  function addEdge(a,b,cross,edgeKeys) {
    const lo=Math.min(a.id,b.id), hi=Math.max(a.id,b.id), key=`${lo}-${hi}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    a.neighbors.push({id:b.id,cross}); b.neighbors.push({id:a.id,cross});
    sim.edges.push({a:a.id,b:b.id,cross});
    return true;
  }

  function buildNetwork() {
    const desired=params().connectivity, edgeKeys=new Set();
    sim.edges=[]; sim.agents.forEach(a => { a.neighbors=[]; a.autoCharge=0; a.autoCooldown=0; });

    for (const a of sim.agents) {
      const localCount=()=>a.neighbors.filter(n=>!n.cross).length;
      const candidates=sim.agents.filter(b=>b.id!==a.id&&b.cluster===a.cluster)
        .map(b=>({b,d:distance(a,b)*(0.84+seededNoise(a.id*N+b.id,31)*0.34)})).sort((u,v)=>u.d-v.d);
      for (const {b} of candidates) {
        if (localCount()>=desired) break;
        if (b.neighbors.filter(n=>!n.cross).length>=desired+2) continue;
        addEdge(a,b,false,edgeKeys);
      }
    }

    const k=params().clusters;
    if (k>1) {
      const pairs=[];
      if (k===2) pairs.push([0,1]);
      else { for (let c=0;c<k;c++) pairs.push([c,(c+1)%k]); if(k>=4) pairs.push([0,Math.floor(k/2)]); }
      for (const [ca,cb] of pairs) {
        const aa=sim.agents.filter(a=>a.cluster===ca&&a.type==='mecker');
        const bb=sim.agents.filter(a=>a.cluster===cb&&a.type==='mecker');
        const candidates=[];
        for (const a of aa) for (const b of bb) candidates.push({a,b,d:distance(a,b)});
        candidates.sort((x,y)=>x.d-y.d);
        let added=0;
        for (const candidate of candidates) {
          if(addEdge(candidate.a,candidate.b,true,edgeKeys)) added+=1;
          if(added>=2) break;
        }
      }
    }
    sim.emissionHistory=[];
  }

  function updateClusterSelectors() {
    if (!ui.eventCluster || !sim.agents.length) return;
    const k=params().clusters;
    const oldEvent=ui.eventCluster.value;
    const oldSource=ui.exportSource.value;
    const oldTarget=ui.exportTarget.value;
    const options=Array.from({length:k},(_,i)=>`<option value="${i}">${txt().cluster} ${i+1}</option>`).join('');
    ui.eventCluster.innerHTML=`<option value="random">${txt().randomCluster}</option>${options}`;
    ui.exportSource.innerHTML=options; ui.exportTarget.innerHTML=options;
    ui.eventCluster.value=(oldEvent==='random'||Number(oldEvent)<k)?oldEvent:'random';
    if(!ui.eventCluster.value) ui.eventCluster.value='random';
    ui.exportSource.value=Number(oldSource)<k?oldSource:'0';
    ui.exportTarget.value=Number(oldTarget)<k?oldTarget:String(Math.min(1,k-1));
    normalizeExportTarget();
  }

  function normalizeExportTarget() {
    const k=params().clusters;
    ui.exportButton.disabled=k<2;
    if(k<2){ui.exportStatus.textContent=txt().exportNeedsTwo;return;}
    if(ui.exportSource.value===ui.exportTarget.value) ui.exportTarget.value=String((Number(ui.exportSource.value)+1)%k);
  }

  function reset({preserveNetwork=false}={}) {
    sim.agents.forEach(a=>{a.level=0;a.stimulus=0;a.emissionM=0;a.emissionC=0;a.autoCharge=0;a.autoCooldown=0;});
    if(!preserveNetwork) buildNetwork();
    sim.emissionHistory=[]; sim.history=[]; sim.globalSeries=[]; sim.recentEventTargets.clear(); sim.exportPulses=[];
    sim.crossFlux=0; sim.tickAccumulator=0; sim.sampleAccumulator=0; sim.lastGlobalDeltaSign=0; sim.signChanges=0; sim.elapsed=0;
    sim.lastExportAt=-999; sim.lastAutoExportAt=-999; sim.autoExportCount=0; sim.autoExportsByCluster=Array(params().clusters).fill(0);
    ui.eventFlash.textContent=txt().societyReset; ui.exportStatus.textContent=txt().manualDefault;
    normalizeExportTarget(); updateOutputs(); render(); drawAll();
  }

  function triggerEvent() {
    const p=params(); sim.eventId+=1; sim.recentEventTargets.clear();
    const targetCluster=ui.eventCluster.value==='random'?Math.floor(Math.random()*p.clusters):Number(ui.eventCluster.value);
    const candidates=sim.agents.filter(a=>a.type==='mecker'&&a.cluster===targetCluster).map(a=>({a,r:Math.random()})).sort((x,y)=>x.r-y.r);
    const hitCount=Math.max(1,Math.round(candidates.length*p.reach));
    candidates.slice(0,hitCount).forEach(({a})=>{a.stimulus=clamp(a.stimulus+p.severity*(0.78+Math.random()*0.44),0,120);sim.recentEventTargets.add(a.id);});
    ui.eventFlash.textContent=txt().event(sim.eventId,targetCluster+1,hitCount,p.severity);
    ui.eventFlash.classList.remove('bang'); void ui.eventFlash.offsetWidth; ui.eventFlash.classList.add('bang');
  }

  function transferEnergy(sourceAgents,targetAgents,fraction,multiplier=1.18) {
    let transferred=0;
    for(const a of sourceAgents){const available=Math.max(0,a.level-2);const take=available*fraction*0.38;a.level=clamp(a.level-take);a.stimulus=Math.max(0,a.stimulus-take*0.20);transferred+=take;}
    if(transferred<1||!targetAgents.length) return 0;
    const shuffled=targetAgents.map(a=>({a,r:Math.random()})).sort((a,b)=>a.r-b.r);
    const recipients=shuffled.slice(0,Math.max(2,Math.round(targetAgents.length*(0.25+fraction*0.55))));
    const perAgent=transferred*multiplier/recipients.length;
    recipients.forEach(({a})=>{a.stimulus=clamp(a.stimulus+perAgent*(0.8+Math.random()*0.4),0,120);});
    return transferred;
  }

  function exportMecker() {
    const p=params(), source=Number(ui.exportSource.value), target=Number(ui.exportTarget.value);
    if(p.clusters<2||source===target) return;
    const sourceAgents=sim.agents.filter(a=>a.cluster===source&&a.type==='mecker'&&a.level>2);
    const targetAgents=sim.agents.filter(a=>a.cluster===target&&a.type==='mecker');
    if(!sourceAgents.length||!targetAgents.length){ui.exportStatus.textContent=txt().noExportEnergy(source+1);return;}
    const transferred=transferEnergy(sourceAgents,targetAgents,p.exportFraction);
    if(transferred<1){ui.exportStatus.textContent=txt().tooLittle(source+1);return;}
    sim.exportPulses.push({kind:'manual',fromCluster:source,toCluster:target,strength:Math.min(100,transferred*2.2),age:0});
    sim.lastExportAt=sim.elapsed; ui.exportStatus.textContent=txt().manualExport(source+1,target+1,Math.round(transferred));
  }

  function boundaryTargets(agent) {
    return agent.neighbors.filter(link=>link.cross).map(link=>sim.agents[link.id]).filter(Boolean);
  }

  function maybeAutoExport() {
    const p=params();
    if(!p.autoExport||p.clusters<2) return;
    for(const a of sim.agents) {
      if(a.type!=='mecker') continue;
      a.autoCooldown=Math.max(0,a.autoCooldown-TICK);
      const targets=boundaryTargets(a);
      if(!targets.length){a.autoCharge=0;continue;}
      const excess=a.emissionM-p.autoThreshold;
      if(excess<=0){a.autoCharge=Math.max(0,a.autoCharge-0.08);continue;}
      a.autoCharge+=0.015+(excess/100)*0.22;
      if(a.autoCharge<1||a.autoCooldown>0) continue;

      const target=targets[Math.floor(Math.random()*targets.length)];
      const amount=clamp(4+excess*0.12+a.level*0.05,4,16);
      const sourceRelief=amount*0.42;
      a.level=clamp(a.level-sourceRelief); a.stimulus=Math.max(0,a.stimulus-sourceRelief*0.4);
      target.stimulus=clamp(target.stimulus+amount*1.55,0,120);
      a.autoCharge=0; a.autoCooldown=1.2+Math.random()*1.8;
      sim.autoExportCount+=1; sim.autoExportsByCluster[a.cluster]=(sim.autoExportsByCluster[a.cluster]||0)+1;
      sim.lastAutoExportAt=sim.elapsed;
      sim.exportPulses.push({kind:'auto',fromAgent:a.id,toAgent:target.id,strength:amount*4,age:0});
      ui.exportStatus.textContent=txt().autoExport(a.cluster+1,target.cluster+1,Math.round(amount));
    }
  }

  function delayedSnapshot() {
    const index=sim.emissionHistory.length-1-params().delaySteps;
    return index<0?null:sim.emissionHistory[index];
  }

  function tick() {
    const p=params(), delayed=delayedSnapshot(), nextLevels=new Array(N); let crossFlux=0;
    for(const a of sim.agents){
      let incomingM=0,incomingC=0,weighted=0;
      if(delayed&&a.neighbors.length){
        for(const link of a.neighbors){const weight=link.cross?p.spillover:1;if(weight<=0)continue;incomingM+=delayed.m[link.id]*weight;incomingC+=delayed.c[link.id]*weight;weighted+=weight;if(link.cross)crossFlux+=(delayed.m[link.id]+delayed.c[link.id])*weight;}
        const norm=Math.max(1,Math.sqrt(weighted));incomingM/=norm;incomingC/=norm;
      }
      if(a.type==='mecker'){
        const target=clamp(a.stimulus*0.90+incomingM*(0.24+p.social*0.78)-incomingC*(0.30+p.calm*0.86),0,120);
        let level=a.level+(target-a.level)*(0.13*a.reactivity);level-=(0.18+level*0.0028)*a.recovery;nextLevels[a.id]=clamp(level,0,100);a.stimulus*=0.965;
      }else{
        const target=clamp(incomingM*(0.52+p.social*0.28),0,110);let level=a.level+(target-a.level)*(0.16*a.reactivity);level-=(0.22+level*0.0035)*a.recovery;nextLevels[a.id]=clamp(level,0,100);
      }
    }
    sim.agents.forEach(a=>{a.level=nextLevels[a.id];});
    for(const a of sim.agents){if(a.type==='mecker'){a.emissionM=clamp((a.level-a.threshold)*1.90,0,100);a.emissionC=0;}else{a.emissionC=clamp((a.level-a.threshold)*2.10*(0.45+p.calm),0,100);a.emissionM=0;}}
    maybeAutoExport();
    sim.emissionHistory.push({m:sim.agents.map(a=>a.emissionM),c:sim.agents.map(a=>a.emissionC)});if(sim.emissionHistory.length>48)sim.emissionHistory.shift();
    sim.crossFlux=crossFlux/(Math.max(1,sim.edges.filter(e=>e.cross).length)*100);
    const g=getGlobal();sim.globalSeries.push(g.activeMShare*100);if(sim.globalSeries.length>70)sim.globalSeries.shift();
    if(sim.globalSeries.length>2){const n=sim.globalSeries.length,delta=sim.globalSeries[n-1]-sim.globalSeries[n-2],sign=Math.abs(delta)<0.7?0:Math.sign(delta);if(sign&&sim.lastGlobalDeltaSign&&sign!==sim.lastGlobalDeltaSign)sim.signChanges+=1;else sim.signChanges=Math.max(0,sim.signChanges-0.08);if(sign)sim.lastGlobalDeltaSign=sign;}
  }

  function getClusterStats() {
    const k=params().clusters;
    return Array.from({length:k},(_,cluster)=>{
      const agents=sim.agents.filter(a=>a.cluster===cluster),meckers=agents.filter(a=>a.type==='mecker'),calmers=agents.filter(a=>a.type==='calm');
      const activeM=meckers.filter(a=>a.emissionM>5).length,activeC=calmers.filter(a=>a.emissionC>5).length;
      const avgM=mean(meckers.map(a=>a.level)),avgC=mean(calmers.map(a=>a.level));
      return {cluster,activeM,activeC,avgM,avgC,annoyance:clamp(avgM*0.68+avgC*0.18+(activeM/Math.max(1,meckers.length))*30),autoExports:sim.autoExportsByCluster[cluster]||0};
    });
  }

  function getGlobal() {
    const meckers=sim.agents.filter(a=>a.type==='mecker'),calmers=sim.agents.filter(a=>a.type==='calm');
    const activeM=meckers.filter(a=>a.emissionM>5).length,activeC=calmers.filter(a=>a.emissionC>5).length;
    const avgM=mean(meckers.map(a=>a.level)),avgC=mean(calmers.map(a=>a.level));
    const clusters=getClusterStats(),activeClusterCount=clusters.filter(c=>c.activeM>0).length;
    return {activeM,activeC,avgM,avgC,annoyance:clamp(avgM*0.64+avgC*0.22+(activeM/Math.max(1,meckers.length))*30),activeMShare:activeM/Math.max(1,meckers.length),activeCShare:activeC/Math.max(1,calmers.length),clusters,activeClusterCount};
  }

  function classify(g) {
    const s=txt().states,series=sim.globalSeries;
    const amplitude=series.length>10?Math.max(...series.slice(-40))-Math.min(...series.slice(-40)):0;
    const oscillating=sim.signChanges>5.5&&amplitude>24&&g.activeMShare>0.12;
    const recentAuto=sim.elapsed-sim.lastAutoExportAt<2.4;
    if(g.activeM===0&&g.avgM<4)return s.quiet;
    if(oscillating&&g.activeClusterCount>=2)return s.wave;
    if(g.activeClusterCount===params().clusters&&params().clusters>1&&g.activeMShare>0.60)return s.wildfire;
    if(recentAuto&&g.activeClusterCount>=2)return s.exportCascade;
    if(sim.crossFlux>0.12&&g.activeClusterCount>=2)return s.spill;
    if(g.activeClusterCount>=2&&g.activeCShare>=0.42)return s.counter;
    if(g.activeClusterCount>=2)return s.multiple;
    if(g.activeClusterCount===1)return s.local;
    return s.isolated;
  }

  function sampleHistory(){const g=getGlobal();sim.history.push({m:g.activeMShare*100,c:g.activeCShare*100,a:g.annoyance});if(sim.history.length>180)sim.history.shift();}

  function renderClusterStrip(stats){ui.clusterStrip.innerHTML=stats.map(c=>{const [name,value,meta]=txt().clusterChip(c.cluster+1,c.activeM,Math.round(c.annoyance),c.autoExports).split('|');return `<div class="cluster-chip${c.activeM>0?' is-active':''}"><span>${name}</span><strong>${value}</strong><small>${meta}</small></div>`;}).join('');}

  function render(){
    const g=getGlobal(),[label,note]=classify(g);ui.stateLabel.textContent=label;ui.stateNote.textContent=note;ui.activeMecker.textContent=g.activeM;ui.activeCalm.textContent=g.activeC;ui.activeClusters.textContent=`${g.activeClusterCount}/${params().clusters}`;ui.annoyanceValue.textContent=Math.round(g.annoyance);renderClusterStrip(g.clusters);updateOutputs();
  }

  function fitCanvas(canvas){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:rect.width,h:rect.height};}
  function css(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}

  function pointForAgent(a,w,h){const pad=20;return{x:pad+a.x*(w-pad*2),y:pad+a.y*(h-pad*2)};}

  function drawClusterFields(ctx,w,h){const k=params().clusters,stats=getClusterStats(),r=k===1?Math.min(w,h)*.39:k===2?Math.min(w,h)*.245:k===3?Math.min(w,h)*.205:Math.min(w,h)*.17;for(const center of sim.clusterCenters){const stat=stats[center.id],x=center.x*w,y=center.y*h;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=stat.activeM>0?'rgba(255,118,87,.035)':'rgba(214,187,255,.018)';ctx.fill();ctx.strokeStyle=stat.activeM>0?'rgba(255,118,87,.20)':'rgba(214,187,255,.10)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='rgba(245,243,238,.48)';ctx.font='700 10px ui-sans-serif,system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(`C${center.id+1}`,x,y-r+15);}}

  function drawExportPulses(ctx,w,h){
    for(const pulse of sim.exportPulses){pulse.age+=0.018;let from,to;if(pulse.kind==='auto'){from=pointForAgent(sim.agents[pulse.fromAgent],w,h);to=pointForAgent(sim.agents[pulse.toAgent],w,h);}else{from={x:sim.clusterCenters[pulse.fromCluster].x*w,y:sim.clusterCenters[pulse.fromCluster].y*h};to={x:sim.clusterCenters[pulse.toCluster].x*w,y:sim.clusterCenters[pulse.toCluster].y*h};}const t=clamp(pulse.age/1.25,0,1),ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,x=from.x+(to.x-from.x)*ease,y=from.y+(to.y-from.y)*ease;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.strokeStyle=`rgba(214,187,255,${Math.max(0,.28-pulse.age*.12)})`;ctx.lineWidth=pulse.kind==='auto'?1.2:1.8;ctx.stroke();ctx.beginPath();ctx.arc(x,y,3+pulse.strength/38,0,Math.PI*2);ctx.fillStyle=`rgba(214,187,255,${Math.max(0,.95-pulse.age*.48)})`;ctx.fill();}
    sim.exportPulses=sim.exportPulses.filter(p=>p.age<1.6);
  }

  function drawNetwork(){
    const f=fitCanvas(ui.networkCanvas);if(!f)return;const{ctx,w,h}=f;ctx.clearRect(0,0,w,h);drawClusterFields(ctx,w,h);const delayed=delayedSnapshot(),spill=params().spillover;
    for(const edge of sim.edges){const a=sim.agents[edge.a],b=sim.agents[edge.b],pa=pointForAgent(a,w,h),pb=pointForAgent(b,w,h);let m=0,c=0;if(delayed){m=Math.max(delayed.m[a.id],delayed.m[b.id]);c=Math.max(delayed.c[a.id],delayed.c[b.id]);}ctx.save();if(edge.cross)ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);const factor=edge.cross?Math.max(.15,spill):1;if(m>c&&m>6){ctx.strokeStyle=`rgba(255,118,87,${(0.07+Math.min(.38,m/230))*factor})`;ctx.lineWidth=1+m/65;}else if(c>6){ctx.strokeStyle=`rgba(117,212,194,${(0.07+Math.min(.38,c/230))*factor})`;ctx.lineWidth=1+c/65;}else{ctx.strokeStyle=edge.cross?'rgba(214,187,255,.20)':'rgba(255,255,255,.05)';ctx.lineWidth=edge.cross?1.1:0.8;}ctx.stroke();ctx.restore();}
    for(const a of sim.agents){const p=pointForAgent(a,w,h),strength=a.type==='mecker'?a.emissionM:a.emissionC,base=a.type==='mecker'?css('--mecker'):css('--calm'),r=3.8+Math.min(5.1,strength/18);if(strength>4){ctx.beginPath();ctx.arc(p.x,p.y,r+4+strength/22,0,Math.PI*2);ctx.fillStyle=a.type==='mecker'?`rgba(255,118,87,${Math.min(.18,strength/520)})`:`rgba(117,212,194,${Math.min(.18,strength/520)})`;ctx.fill();}ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=strength>2?base:(a.type==='mecker'?'rgba(255,118,87,.30)':'rgba(117,212,194,.30)');ctx.fill();if(sim.recentEventTargets.has(a.id)&&a.stimulus>3){ctx.beginPath();ctx.arc(p.x,p.y,r+3.2,0,Math.PI*2);ctx.strokeStyle=css('--signal');ctx.lineWidth=1.2;ctx.stroke();}}
    drawExportPulses(ctx,w,h);
  }

  function drawHistory(){const f=fitCanvas(ui.historyCanvas);if(!f)return;const{ctx,w,h}=f;ctx.clearRect(0,0,w,h);const data=sim.history,pad={l:25,r:8,t:5,b:12},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;ctx.font='9px ui-sans-serif,system-ui,sans-serif';ctx.textAlign='right';ctx.fillStyle=css('--muted-2');[0,50,100].forEach(v=>{const y=pad.t+ph-(v/100)*ph;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;ctx.stroke();ctx.fillText(String(v),pad.l-5,y+3);});if(data.length<2)return;const line=(key,color)=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineJoin='round';data.forEach((d,i)=>{const x=pad.l+(i/Math.max(1,data.length-1))*pw,y=pad.t+ph-(d[key]/100)*ph;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();};line('m',css('--mecker'));line('c',css('--calm'));line('a',css('--signal'));}
  function drawAll(){drawNetwork();drawHistory();}

  function randomise(){const set=(el,min,max)=>{el.value=String(Math.round(min+Math.random()*(max-min)));};set(ui.clusterTotal,2,5);set(ui.severity,45,100);set(ui.reach,10,70);set(ui.connectivity,3,9);set(ui.socialInfluence,20,100);set(ui.spillover,5,100);set(ui.calmStrength,10,95);set(ui.delay,0,25);set(ui.autoExportThreshold,45,85);ui.autoExportEnabled.checked=true;updateOutputs();buildPopulation();reset({preserveNetwork:true});triggerEvent();}

  function frame(now){const dt=Math.min(.05,(now-sim.lastTime)/1000);sim.lastTime=now;if(sim.running){sim.tickAccumulator+=dt;sim.sampleAccumulator+=dt;sim.elapsed+=dt;while(sim.tickAccumulator>=TICK){tick();sim.tickAccumulator-=TICK;}if(sim.sampleAccumulator>=.2){sampleHistory();sim.sampleAccumulator=0;}}render();drawAll();requestAnimationFrame(frame);}

  document.querySelectorAll('.lang-button').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.lang)));
  [ui.severity,ui.reach,ui.socialInfluence,ui.spillover,ui.calmStrength,ui.delay,ui.exportAmount,ui.autoExportThreshold].forEach(el=>el.addEventListener('input',updateOutputs));
  ui.autoExportEnabled.addEventListener('change',updateOutputs);
  ui.connectivity.addEventListener('input',()=>{updateOutputs();buildNetwork();});
  ui.clusterTotal.addEventListener('input',()=>{updateOutputs();buildPopulation();reset({preserveNetwork:true});});
  ui.exportSource.addEventListener('change',normalizeExportTarget);ui.exportTarget.addEventListener('change',normalizeExportTarget);ui.exportButton.addEventListener('click',exportMecker);
  ui.eventButton.addEventListener('click',triggerEvent);ui.heroEvent.addEventListener('click',()=>{triggerEvent();$('lab').scrollIntoView({behavior:'smooth',block:'start'});});
  ui.resetButton.addEventListener('click',()=>reset());ui.chaosButton.addEventListener('click',randomise);
  ui.pauseButton.addEventListener('click',()=>{sim.running=!sim.running;ui.pauseButton.textContent=sim.running?txt().pause:txt().resume;ui.runDot.classList.toggle('paused',!sim.running);});
  window.addEventListener('resize',drawAll);

  buildPopulation();setLanguage('de');updateOutputs();reset({preserveNetwork:true});requestAnimationFrame(now=>{sim.lastTime=now;requestAnimationFrame(frame);});
})();