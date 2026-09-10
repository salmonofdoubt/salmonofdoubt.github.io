(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const ui = {
    clusterTotal: $('clusterTotal'), eventCluster: $('eventCluster'), severity: $('severity'), reach: $('reach'),
    connectivity: $('connectivity'), socialInfluence: $('socialInfluence'), spillover: $('spillover'),
    calmStrength: $('calmStrength'), delay: $('delay'), clusterTotalOut: $('clusterTotalOut'), severityOut: $('severityOut'),
    reachOut: $('reachOut'), connectivityOut: $('connectivityOut'), socialInfluenceOut: $('socialInfluenceOut'),
    spilloverOut: $('spilloverOut'), calmStrengthOut: $('calmStrengthOut'), delayOut: $('delayOut'),
    eventButton: $('eventButton'), heroEvent: $('heroEvent'), pauseButton: $('pauseButton'), resetButton: $('resetButton'),
    chaosButton: $('chaosButton'), runDot: $('runDot'), stateLabel: $('stateLabel'), stateNote: $('stateNote'),
    activeMecker: $('activeMecker'), activeCalm: $('activeCalm'), activeClusters: $('activeClusters'), annoyanceValue: $('annoyanceValue'),
    networkCanvas: $('networkCanvas'), historyCanvas: $('historyCanvas'), eventFlash: $('eventFlash'), clusterStrip: $('clusterStrip'),
    exportSource: $('exportSource'), exportTarget: $('exportTarget'), exportAmount: $('exportAmount'), exportAmountOut: $('exportAmountOut'),
    exportButton: $('exportButton'), exportStatus: $('exportStatus')
  };

  const sim = {
    running: true,
    agents: [],
    edges: [],
    emissionHistory: [],
    history: [],
    tickAccumulator: 0,
    sampleAccumulator: 0,
    lastTime: performance.now(),
    eventId: 0,
    recentEventTargets: new Set(),
    globalSeries: [],
    lastGlobalDeltaSign: 0,
    signChanges: 0,
    elapsed: 0,
    clusterCenters: [],
    exportPulses: [],
    crossFlux: 0,
    lastExportAt: -999
  };

  const N = 70;
  const TICK = 0.1;

  function params() {
    return {
      clusters: Number(ui.clusterTotal.value),
      severity: Number(ui.severity.value),
      reach: Number(ui.reach.value) / 100,
      connectivity: Number(ui.connectivity.value),
      social: Number(ui.socialInfluence.value) / 100,
      spillover: Number(ui.spillover.value) / 100,
      calm: Number(ui.calmStrength.value) / 100,
      delaySteps: Math.round(Number(ui.delay.value)),
      exportFraction: Number(ui.exportAmount.value) / 100
    };
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
  }

  function seededNoise(i, salt = 0) {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function centersFor(k) {
    const layouts = {
      1: [[0.5, 0.50]],
      2: [[0.29, 0.50], [0.71, 0.50]],
      3: [[0.50, 0.27], [0.27, 0.68], [0.73, 0.68]],
      4: [[0.28, 0.30], [0.72, 0.30], [0.28, 0.70], [0.72, 0.70]],
      5: [[0.50, 0.50], [0.22, 0.25], [0.78, 0.25], [0.22, 0.75], [0.78, 0.75]]
    };
    return layouts[k].map(([x, y], id) => ({ id, x, y }));
  }

  function buildPopulation() {
    const k = params().clusters;
    sim.clusterCenters = centersFor(k);
    const perCluster = Array(k).fill(0);
    const radius = k === 1 ? 0.39 : k === 2 ? 0.22 : k === 3 ? 0.17 : k === 4 ? 0.145 : 0.125;

    sim.agents = Array.from({ length: N }, (_, i) => {
      const cluster = i % k;
      const localIndex = perCluster[cluster]++;
      const center = sim.clusterCenters[cluster];
      const angle = (localIndex * 2.3999632297) + seededNoise(i, 3) * 0.5;
      const ring = 0.20 + Math.sqrt(seededNoise(i, 7)) * 0.78;
      const isCalm = localIndex % 4 === 0 || seededNoise(i, 4) < 0.06;
      return {
        id: i,
        cluster,
        type: isCalm ? 'calm' : 'mecker',
        level: 0,
        stimulus: 0,
        emissionM: 0,
        emissionC: 0,
        threshold: isCalm ? 8 + seededNoise(i, 9) * 15 : 11 + seededNoise(i, 11) * 20,
        reactivity: 0.82 + seededNoise(i, 15) * 0.42,
        recovery: 0.78 + seededNoise(i, 18) * 0.44,
        x: clamp(center.x + Math.cos(angle) * ring * radius, 0.04, 0.96),
        y: clamp(center.y + Math.sin(angle) * ring * radius, 0.06, 0.94),
        neighbors: []
      };
    });

    buildNetwork();
    updateClusterSelectors();
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function addEdge(a, b, cross, edgeKeys) {
    const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
    const key = `${lo}-${hi}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    a.neighbors.push({ id: b.id, cross });
    b.neighbors.push({ id: a.id, cross });
    sim.edges.push({ a: a.id, b: b.id, cross });
    return true;
  }

  function buildNetwork() {
    const desired = params().connectivity;
    const edgeKeys = new Set();
    sim.edges = [];
    sim.agents.forEach(a => { a.neighbors = []; });

    for (const a of sim.agents) {
      const localNeighbors = () => a.neighbors.filter(n => !n.cross).length;
      const candidates = sim.agents
        .filter(b => b.id !== a.id && b.cluster === a.cluster)
        .map(b => ({ b, d: distance(a, b) * (0.84 + seededNoise(a.id * N + b.id, 31) * 0.34) }))
        .sort((u, v) => u.d - v.d);

      for (const { b } of candidates) {
        if (localNeighbors() >= desired) break;
        if (b.neighbors.filter(n => !n.cross).length >= desired + 2) continue;
        addEdge(a, b, false, edgeKeys);
      }
    }

    const k = params().clusters;
    if (k > 1) {
      const pairs = [];
      if (k === 2) pairs.push([0, 1]);
      else {
        for (let c = 0; c < k; c++) pairs.push([c, (c + 1) % k]);
        if (k >= 4) pairs.push([0, Math.floor(k / 2)]);
      }

      for (const [ca, cb] of pairs) {
        const aAgents = sim.agents.filter(a => a.cluster === ca);
        const bAgents = sim.agents.filter(a => a.cluster === cb);
        const candidates = [];
        for (const a of aAgents) for (const b of bAgents) candidates.push({ a, b, d: distance(a, b) });
        candidates.sort((x, y) => x.d - y.d);
        let added = 0;
        for (const candidate of candidates) {
          if (addEdge(candidate.a, candidate.b, true, edgeKeys)) added += 1;
          if (added >= 2) break;
        }
      }
    }

    sim.emissionHistory = [];
  }

  function updateClusterSelectors() {
    const k = params().clusters;
    const priorEvent = Number(ui.eventCluster.value || 0);
    const priorSource = Number(ui.exportSource.value || 0);
    const priorTarget = Number(ui.exportTarget.value || Math.min(1, k - 1));
    const options = Array.from({ length: k }, (_, i) => `<option value="${i}">Cluster ${i + 1}</option>`).join('');
    ui.eventCluster.innerHTML = `<option value="random">Zufälliger Cluster</option>${options}`;
    ui.exportSource.innerHTML = options;
    ui.exportTarget.innerHTML = options;
    ui.eventCluster.value = priorEvent < k ? String(priorEvent) : 'random';
    ui.exportSource.value = priorSource < k ? String(priorSource) : '0';
    ui.exportTarget.value = priorTarget < k ? String(priorTarget) : String(Math.min(1, k - 1));
    normalizeExportTarget();
  }

  function normalizeExportTarget() {
    const k = params().clusters;
    ui.exportButton.disabled = k < 2;
    if (k < 2) {
      ui.exportStatus.textContent = 'Für Export braucht es mindestens zwei Cluster.';
      return;
    }
    if (ui.exportSource.value === ui.exportTarget.value) {
      ui.exportTarget.value = String((Number(ui.exportSource.value) + 1) % k);
    }
  }

  function reset({ preserveNetwork = false } = {}) {
    sim.agents.forEach(a => {
      a.level = 0; a.stimulus = 0; a.emissionM = 0; a.emissionC = 0;
    });
    if (!preserveNetwork) buildNetwork();
    sim.emissionHistory = [];
    sim.history = [];
    sim.globalSeries = [];
    sim.recentEventTargets.clear();
    sim.exportPulses = [];
    sim.crossFlux = 0;
    sim.tickAccumulator = 0;
    sim.sampleAccumulator = 0;
    sim.lastGlobalDeltaSign = 0;
    sim.signChanges = 0;
    sim.elapsed = 0;
    sim.lastExportAt = -999;
    ui.eventFlash.textContent = 'Gesellschaft zurückgesetzt.';
    ui.exportStatus.textContent = 'Export verschiebt tatsächlich Meckerenergie zwischen Clustern.';
    normalizeExportTarget();
    render();
    drawAll();
  }

  function triggerEvent() {
    const p = params();
    sim.eventId += 1;
    sim.recentEventTargets.clear();
    let targetCluster;
    if (ui.eventCluster.value === 'random') targetCluster = Math.floor(Math.random() * p.clusters);
    else targetCluster = Number(ui.eventCluster.value);

    const candidates = sim.agents
      .filter(a => a.type === 'mecker' && a.cluster === targetCluster)
      .map(a => ({ a, r: Math.random() }))
      .sort((x, y) => x.r - y.r);
    const hitCount = Math.max(1, Math.round(candidates.length * p.reach));

    candidates.slice(0, hitCount).forEach(({ a }) => {
      const individual = 0.78 + Math.random() * 0.44;
      a.stimulus = clamp(a.stimulus + p.severity * individual, 0, 120);
      sim.recentEventTargets.add(a.id);
    });

    ui.eventFlash.textContent = `Ereignis #${sim.eventId}: Cluster ${targetCluster + 1} · ${hitCount} direkt getroffen · Stärke ${p.severity}`;
    ui.eventFlash.classList.remove('bang');
    void ui.eventFlash.offsetWidth;
    ui.eventFlash.classList.add('bang');
  }

  function exportMecker() {
    const p = params();
    const source = Number(ui.exportSource.value);
    const target = Number(ui.exportTarget.value);
    if (p.clusters < 2 || source === target) return;

    const sourceAgents = sim.agents.filter(a => a.cluster === source && a.type === 'mecker' && a.level > 2);
    const targetAgents = sim.agents.filter(a => a.cluster === target && a.type === 'mecker');
    if (!sourceAgents.length || !targetAgents.length) {
      ui.exportStatus.textContent = `Cluster ${source + 1} hat gerade keine exportierbare Meckerenergie.`;
      return;
    }

    let transferred = 0;
    for (const a of sourceAgents) {
      const available = Math.max(0, a.level - 2);
      const take = available * p.exportFraction * 0.38;
      a.level = clamp(a.level - take);
      a.stimulus = Math.max(0, a.stimulus - take * 0.20);
      transferred += take;
    }

    if (transferred < 1) {
      ui.exportStatus.textContent = `Cluster ${source + 1} meckert noch zu wenig für einen wirksamen Export.`;
      return;
    }

    const shuffled = targetAgents.map(a => ({ a, r: Math.random() })).sort((a, b) => a.r - b.r);
    const recipients = shuffled.slice(0, Math.max(2, Math.round(targetAgents.length * (0.25 + p.exportFraction * 0.55))));
    const perAgent = transferred * 1.18 / recipients.length;
    recipients.forEach(({ a }) => { a.stimulus = clamp(a.stimulus + perAgent * (0.8 + Math.random() * 0.4), 0, 120); });

    sim.exportPulses.push({ from: source, to: target, strength: Math.min(100, transferred * 2.2), age: 0 });
    sim.lastExportAt = sim.elapsed;
    ui.exportStatus.textContent = `Meckerexport: Cluster ${source + 1} → ${target + 1} · ${Math.round(transferred)} Energieeinheiten verschoben.`;
  }

  function delayedSnapshot() {
    const steps = params().delaySteps;
    const index = sim.emissionHistory.length - 1 - steps;
    if (index < 0) return null;
    return sim.emissionHistory[index];
  }

  function tick() {
    const p = params();
    const delayed = delayedSnapshot();
    const nextLevels = new Array(N);
    let crossFlux = 0;

    for (const a of sim.agents) {
      let incomingM = 0, incomingC = 0, weightedNeighbors = 0;
      if (delayed && a.neighbors.length) {
        for (const link of a.neighbors) {
          const weight = link.cross ? p.spillover : 1;
          if (weight <= 0) continue;
          incomingM += delayed.m[link.id] * weight;
          incomingC += delayed.c[link.id] * weight;
          weightedNeighbors += weight;
          if (link.cross) crossFlux += delayed.m[link.id] * weight * 0.004;
        }
        const networkScale = Math.sqrt(Math.max(1, weightedNeighbors));
        incomingM /= networkScale;
        incomingC /= networkScale;
      }

      if (a.type === 'mecker') {
        const eventDrive = a.stimulus * 0.90;
        const socialDrive = incomingM * (0.25 + p.social * 0.75);
        const calming = incomingC * (0.28 + p.calm * 0.82);
        const target = clamp(eventDrive + socialDrive - calming, 0, 120);
        const response = 0.13 * a.reactivity;
        let level = a.level + (target - a.level) * response;
        level -= (0.18 + level * 0.0028) * a.recovery;
        nextLevels[a.id] = clamp(level, 0, 100);
        a.stimulus *= 0.965;
      } else {
        const socialLoad = incomingM * (0.55 + p.social * 0.25);
        const target = clamp(socialLoad, 0, 110);
        const response = 0.16 * a.reactivity;
        let level = a.level + (target - a.level) * response;
        level -= (0.22 + level * 0.0035) * a.recovery;
        nextLevels[a.id] = clamp(level, 0, 100);
      }
    }

    sim.agents.forEach(a => { a.level = nextLevels[a.id]; });

    for (const a of sim.agents) {
      if (a.type === 'mecker') {
        a.emissionM = clamp((a.level - a.threshold) * 1.90, 0, 100);
        a.emissionC = 0;
      } else {
        a.emissionC = clamp((a.level - a.threshold) * 2.10 * (0.45 + p.calm), 0, 100);
        a.emissionM = 0;
      }
    }

    sim.emissionHistory.push({
      m: sim.agents.map(a => a.emissionM),
      c: sim.agents.map(a => a.emissionC)
    });
    if (sim.emissionHistory.length > 42) sim.emissionHistory.shift();

    sim.crossFlux = sim.crossFlux * 0.78 + crossFlux * 0.22;
    sim.exportPulses.forEach(pulse => { pulse.age += TICK; });
    sim.exportPulses = sim.exportPulses.filter(pulse => pulse.age < 2.4);

    const global = getGlobal();
    sim.globalSeries.push(global.activeMShare * 100);
    if (sim.globalSeries.length > 70) sim.globalSeries.shift();
    if (sim.globalSeries.length > 2) {
      const n = sim.globalSeries.length;
      const delta = sim.globalSeries[n - 1] - sim.globalSeries[n - 2];
      const sign = Math.abs(delta) < 0.7 ? 0 : Math.sign(delta);
      if (sign && sim.lastGlobalDeltaSign && sign !== sim.lastGlobalDeltaSign) sim.signChanges += 1;
      else sim.signChanges = Math.max(0, sim.signChanges - 0.08);
      if (sign) sim.lastGlobalDeltaSign = sign;
    }
  }

  function getClusterStats() {
    const k = params().clusters;
    return Array.from({ length: k }, (_, cluster) => {
      const agents = sim.agents.filter(a => a.cluster === cluster);
      const meckers = agents.filter(a => a.type === 'mecker');
      const calmers = agents.filter(a => a.type === 'calm');
      const activeM = meckers.filter(a => a.emissionM > 5).length;
      const activeC = calmers.filter(a => a.emissionC > 5).length;
      const avgM = mean(meckers.map(a => a.level));
      const annoyance = clamp(avgM * 0.72 + (activeM / Math.max(1, meckers.length)) * 32);
      return {
        cluster, activeM, activeC, avgM, annoyance,
        mShare: activeM / Math.max(1, meckers.length),
        cShare: activeC / Math.max(1, calmers.length)
      };
    });
  }

  function getGlobal() {
    const meckers = sim.agents.filter(a => a.type === 'mecker');
    const calmers = sim.agents.filter(a => a.type === 'calm');
    const activeM = meckers.filter(a => a.emissionM > 5).length;
    const activeC = calmers.filter(a => a.emissionC > 5).length;
    const avgM = mean(meckers.map(a => a.level));
    const avgC = mean(calmers.map(a => a.level));
    const clusters = getClusterStats();
    const activeClusterCount = clusters.filter(c => c.activeM > 0).length;
    const annoyance = clamp(avgM * 0.64 + avgC * 0.22 + (activeM / meckers.length) * 30 + Math.min(12, sim.crossFlux));
    return {
      activeM, activeC, avgM, avgC, annoyance, clusters, activeClusterCount,
      activeMShare: activeM / meckers.length,
      activeCShare: activeC / calmers.length
    };
  }

  function classify(g) {
    const series = sim.globalSeries;
    const amplitude = series.length > 10 ? Math.max(...series.slice(-40)) - Math.min(...series.slice(-40)) : 0;
    const oscillating = sim.signChanges > 5.5 && amplitude > 24 && g.activeMShare > 0.12;
    const allClustersHot = g.clusters.length > 1 && g.clusters.every(c => c.mShare > 0.28);
    const exportFresh = sim.elapsed - sim.lastExportAt < 2.2;

    if (g.activeM === 0 && g.avgM < 4) return ['Gesellschaftliche Ruhe', 'Alle Cluster sind unter ihren Meckerschwellen.'];
    if (oscillating && g.activeClusterCount > 1) return ['Synchronisierte Meckerwelle', 'Mehrere Cluster schwingen kollektiv, obwohl kein Agent einen globalen Takt vorgibt.'];
    if (allClustersHot && g.activeMShare > 0.55) return ['Inter-Cluster-Flächenbrand', 'Lokale Meckerherde haben die Clustergrenzen weitgehend überwunden.'];
    if (exportFresh && g.activeClusterCount > 1) return ['Meckerexport', 'Gezielt verschobene Meckerenergie aktiviert jetzt mehr als einen Cluster.'];
    if (g.activeClusterCount >= 2 && sim.crossFlux > 2.5) return ['Überschwappen', 'Meckerenergie passiert die dünnen Brücken zwischen den Clustern.'];
    if (g.activeClusterCount >= 2 && g.activeMShare > 0.25) return ['Mehrere Meckerherde', 'Getrennte Cluster meckern gleichzeitig und können sich gegenseitig verstärken.'];
    if (g.activeMShare > 0.72 && g.activeCShare < 0.45) return ['Mecker-Kaskade', 'Lokale Ansteckung hat sich innerhalb des aktiven Clusters stark ausgebreitet.'];
    if (g.activeMShare > 0.42 && g.activeCShare >= 0.45) return ['Gesellschaftliche Gegenkopplung', 'Meckern ist verbreitet, aber viele Beruhiger antworten gleichzeitig.'];
    if (g.activeClusterCount === 1 && g.activeMShare > 0.12) return ['Lokaler Meckerherd', 'Das Gemecker ist bisher auf einen Cluster begrenzt.'];
    return ['Vereinzeltes Gemecker', 'Einige Agenten reagieren, ohne dass ein kollektives Muster dominiert.'];
  }

  function sampleHistory() {
    const g = getGlobal();
    sim.history.push({ m: g.activeMShare * 100, c: g.activeCShare * 100, a: g.annoyance, clusters: g.activeClusterCount });
    if (sim.history.length > 180) sim.history.shift();
  }

  function renderClusterStrip(stats) {
    ui.clusterStrip.innerHTML = stats.map(c => {
      const activeClass = c.activeM > 0 ? ' is-active' : '';
      return `<div class="cluster-chip${activeClass}"><span>Cluster ${c.cluster + 1}</span><strong>${c.activeM}</strong><small>Meckerer · Genervtheit ${Math.round(c.annoyance)}</small></div>`;
    }).join('');
  }

  function render() {
    const g = getGlobal();
    const [label, note] = classify(g);
    ui.stateLabel.textContent = label;
    ui.stateNote.textContent = note;
    ui.activeMecker.textContent = g.activeM;
    ui.activeCalm.textContent = g.activeC;
    ui.activeClusters.textContent = `${g.activeClusterCount}/${params().clusters}`;
    ui.annoyanceValue.textContent = Math.round(g.annoyance);
    renderClusterStrip(g.clusters);
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function drawClusterFields(ctx, w, h) {
    const k = params().clusters;
    const stats = getClusterStats();
    const radius = k === 1 ? Math.min(w, h) * 0.39 : k === 2 ? Math.min(w, h) * 0.245 : k === 3 ? Math.min(w, h) * 0.205 : Math.min(w, h) * 0.17;
    for (const center of sim.clusterCenters) {
      const stat = stats[center.id];
      const x = center.x * w, y = center.y * h;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = stat.activeM ? `rgba(255,118,87,${0.018 + stat.mShare * 0.075})` : 'rgba(255,255,255,.012)';
      ctx.fill();
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = stat.activeM ? 'rgba(255,118,87,.20)' : 'rgba(255,255,255,.075)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = stat.activeM ? 'rgba(255,190,173,.72)' : 'rgba(170,174,187,.55)';
      ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`CLUSTER ${center.id + 1}`, x, Math.max(14, y - radius + 14));
    }
  }

  function drawExportPulses(ctx, w, h) {
    for (const pulse of sim.exportPulses) {
      const a = sim.clusterCenters[pulse.from], b = sim.clusterCenters[pulse.to];
      if (!a || !b) continue;
      const x1 = a.x * w, y1 = a.y * h, x2 = b.x * w, y2 = b.y * h;
      const t = clamp(pulse.age / 1.45, 0, 1);
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - Math.min(65, Math.hypot(x2 - x1, y2 - y1) * 0.18);
      const q = (u, p0, p1, p2) => (1-u)*(1-u)*p0 + 2*(1-u)*u*p1 + u*u*p2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.strokeStyle = `rgba(214,187,255,${Math.max(0, .55 - pulse.age * .20)})`;
      ctx.lineWidth = 1.5 + pulse.strength / 35;
      ctx.setLineDash([7, 6]); ctx.stroke(); ctx.setLineDash([]);
      const px = q(t, x1, cx,x2), py = q(t, y1,cy,y2);
      ctx.beginPath(); ctx.arc(px, py, 4 + pulse.strength / 30, 0, Math.PI*2);
      ctx.fillStyle = `rgba(214,187,255,${Math.max(0, .9 - pulse.age * .35)})`; ctx.fill();
    }
  }

  function drawNetwork() {
    const fitted = fitCanvas(ui.networkCanvas); if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    drawClusterFields(ctx, w, h);
    const pad = 20;
    const pos = (a) => ({ x: pad + a.x * (w - pad * 2), y: pad + a.y * (h - pad * 2) });
    const delayed = delayedSnapshot();
    const spill = params().spillover;

    for (const edge of sim.edges) {
      const a = sim.agents[edge.a], b = sim.agents[edge.b];
      const pa = pos(a), pb = pos(b);
      let m = 0, c = 0;
      if (delayed) {
        m = Math.max(delayed.m[a.id], delayed.m[b.id]) * (edge.cross ? spill : 1);
        c = Math.max(delayed.c[a.id], delayed.c[b.id]) * (edge.cross ? spill : 1);
      }
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      if (edge.cross) ctx.setLineDash([3, 6]);
      if (m > c && m > 6) { ctx.strokeStyle = `rgba(255,118,87,${0.08 + Math.min(.48, m / 190)})`; ctx.lineWidth = 1.2 + m / 48; }
      else if (c > 6) { ctx.strokeStyle = `rgba(117,212,194,${0.08 + Math.min(.45, c / 200)})`; ctx.lineWidth = 1.2 + c / 52; }
      else { ctx.strokeStyle = edge.cross ? 'rgba(214,187,255,.12)' : 'rgba(255,255,255,.05)'; ctx.lineWidth = edge.cross ? 1.1 : 1; }
      ctx.stroke(); ctx.setLineDash([]);
    }

    drawExportPulses(ctx, w, h);

    for (const a of sim.agents) {
      const p = pos(a);
      const strength = a.type === 'mecker' ? a.emissionM : a.emissionC;
      const base = a.type === 'mecker' ? css('--mecker') : css('--calm');
      const r = 3.6 + Math.min(5.2, strength / 18);
      if (strength > 4) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 4.5 + strength / 22, 0, Math.PI * 2);
        ctx.fillStyle = a.type === 'mecker' ? `rgba(255,118,87,${Math.min(.18, strength / 520)})` : `rgba(117,212,194,${Math.min(.18, strength / 520)})`;
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = strength > 2 ? base : (a.type === 'mecker' ? 'rgba(255,118,87,.28)' : 'rgba(117,212,194,.28)');
      ctx.fill();
      if (sim.recentEventTargets.has(a.id) && a.stimulus > 3) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.3; ctx.stroke();
      }
    }
  }

  function drawHistory() {
    const fitted = fitCanvas(ui.historyCanvas); if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const data = sim.history;
    const pad = { l: 25, r: 8, t: 5, b: 12 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = css('--muted-2');
    [0, 50, 100].forEach(v => {
      const y = pad.t + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillText(String(v), pad.l - 5, y + 3);
    });
    if (data.length < 2) return;
    const line = (key, color) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
      data.forEach((d, i) => {
        const x = pad.l + (i / Math.max(1, data.length - 1)) * pw;
        const y = pad.t + ph - (d[key] / 100) * ph;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    line('m', css('--mecker')); line('c', css('--calm')); line('a', css('--signal'));
  }

  function drawAll() { drawNetwork(); drawHistory(); }

  function randomise() {
    const set = (el, min, max) => { el.value = String(Math.round(min + Math.random() * (max - min))); };
    set(ui.clusterTotal, 2, 5); set(ui.severity, 45, 100); set(ui.reach, 10, 65); set(ui.connectivity, 3, 9);
    set(ui.socialInfluence, 20, 100); set(ui.spillover, 5, 100); set(ui.calmStrength, 10, 95); set(ui.delay, 0, 25);
    updateOutputs(); buildPopulation(); reset({ preserveNetwork: true }); triggerEvent();
  }

  function frame(now) {
    const dt = Math.min(.05, (now - sim.lastTime) / 1000);
    sim.lastTime = now;
    if (sim.running) {
      sim.tickAccumulator += dt; sim.sampleAccumulator += dt; sim.elapsed += dt;
      while (sim.tickAccumulator >= TICK) { tick(); sim.tickAccumulator -= TICK; }
      if (sim.sampleAccumulator >= 0.2) { sampleHistory(); sim.sampleAccumulator = 0; }
    }
    render(); drawAll(); requestAnimationFrame(frame);
  }

  [ui.severity, ui.reach, ui.socialInfluence, ui.calmStrength, ui.delay, ui.exportAmount].forEach(el => el.addEventListener('input', updateOutputs));
  ui.connectivity.addEventListener('input', () => { updateOutputs(); buildNetwork(); });
  ui.spillover.addEventListener('input', updateOutputs);
  ui.clusterTotal.addEventListener('input', () => { updateOutputs(); buildPopulation(); reset({ preserveNetwork: true }); });
  ui.exportSource.addEventListener('change', normalizeExportTarget);
  ui.exportTarget.addEventListener('change', normalizeExportTarget);
  ui.exportButton.addEventListener('click', exportMecker);
  ui.eventButton.addEventListener('click', triggerEvent);
  ui.heroEvent.addEventListener('click', () => { triggerEvent(); $('lab').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  ui.resetButton.addEventListener('click', () => reset());
  ui.chaosButton.addEventListener('click', randomise);
  ui.pauseButton.addEventListener('click', () => {
    sim.running = !sim.running;
    ui.pauseButton.textContent = sim.running ? 'Pause' : 'Weiter';
    ui.runDot.classList.toggle('paused', !sim.running);
  });
  window.addEventListener('resize', drawAll);

  updateOutputs();
  buildPopulation();
  reset({ preserveNetwork: true });
  requestAnimationFrame((now) => { sim.lastTime = now; requestAnimationFrame(frame); });
})();