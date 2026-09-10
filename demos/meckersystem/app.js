(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const ui = {
    severity: $('severity'), reach: $('reach'), connectivity: $('connectivity'), socialInfluence: $('socialInfluence'),
    calmStrength: $('calmStrength'), delay: $('delay'), severityOut: $('severityOut'), reachOut: $('reachOut'),
    connectivityOut: $('connectivityOut'), socialInfluenceOut: $('socialInfluenceOut'), calmStrengthOut: $('calmStrengthOut'),
    delayOut: $('delayOut'), eventButton: $('eventButton'), heroEvent: $('heroEvent'), pauseButton: $('pauseButton'),
    resetButton: $('resetButton'), chaosButton: $('chaosButton'), runDot: $('runDot'), stateLabel: $('stateLabel'),
    stateNote: $('stateNote'), activeMecker: $('activeMecker'), activeCalm: $('activeCalm'), clusterCount: $('clusterCount'),
    annoyanceValue: $('annoyanceValue'), networkCanvas: $('networkCanvas'), historyCanvas: $('historyCanvas'), eventFlash: $('eventFlash')
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
    elapsed: 0
  };

  const N = 58;
  const CALM_SHARE = 0.31;
  const TICK = 0.1;

  function params() {
    return {
      severity: Number(ui.severity.value),
      reach: Number(ui.reach.value) / 100,
      connectivity: Number(ui.connectivity.value),
      social: Number(ui.socialInfluence.value) / 100,
      calm: Number(ui.calmStrength.value) / 100,
      delaySteps: Math.round(Number(ui.delay.value))
    };
  }

  function updateOutputs() {
    ui.severityOut.value = ui.severity.value;
    ui.reachOut.value = `${ui.reach.value}%`;
    ui.connectivityOut.value = ui.connectivity.value;
    ui.socialInfluenceOut.value = ui.socialInfluence.value;
    ui.calmStrengthOut.value = ui.calmStrength.value;
    ui.delayOut.value = `${(Number(ui.delay.value) / 10).toFixed(1)} s`;
  }

  function seededNoise(i, salt = 0) {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildPopulation() {
    sim.agents = Array.from({ length: N }, (_, i) => {
      const isCalm = seededNoise(i, 4) < CALM_SHARE;
      const angle = (i / N) * Math.PI * 2 + seededNoise(i, 3) * 0.42;
      const ring = 0.26 + seededNoise(i, 7) * 0.66;
      return {
        id: i,
        type: isCalm ? 'calm' : 'mecker',
        level: 0,
        stimulus: 0,
        emissionM: 0,
        emissionC: 0,
        threshold: isCalm ? 8 + seededNoise(i, 9) * 14 : 11 + seededNoise(i, 11) * 19,
        reactivity: 0.82 + seededNoise(i, 15) * 0.42,
        recovery: 0.78 + seededNoise(i, 18) * 0.44,
        x: 0.5 + Math.cos(angle) * ring * 0.46,
        y: 0.5 + Math.sin(angle) * ring * 0.43,
        neighbors: []
      };
    });
    buildNetwork();
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function buildNetwork() {
    const desired = params().connectivity;
    const edgeKeys = new Set();
    sim.agents.forEach(a => { a.neighbors = []; });

    for (const a of sim.agents) {
      const candidates = sim.agents
        .filter(b => b.id !== a.id)
        .map(b => ({ b, d: distance(a, b) * (0.84 + seededNoise(a.id * N + b.id, 31) * 0.34) }))
        .sort((u, v) => u.d - v.d);

      for (const { b } of candidates) {
        if (a.neighbors.length >= desired) break;
        if (b.neighbors.length >= desired + 2) continue;
        const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
        const key = `${lo}-${hi}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        a.neighbors.push(b.id);
        b.neighbors.push(a.id);
      }
    }

    sim.edges = [...edgeKeys].map(key => key.split('-').map(Number));
    sim.emissionHistory = [];
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
    sim.tickAccumulator = 0;
    sim.sampleAccumulator = 0;
    sim.lastGlobalDeltaSign = 0;
    sim.signChanges = 0;
    sim.elapsed = 0;
    ui.eventFlash.textContent = 'Gesellschaft zurückgesetzt.';
    render();
    drawAll();
  }

  function triggerEvent() {
    const p = params();
    sim.eventId += 1;
    sim.recentEventTargets.clear();

    const candidates = sim.agents
      .filter(a => a.type === 'mecker')
      .map(a => ({ a, r: Math.random() }))
      .sort((x, y) => x.r - y.r);
    const hitCount = Math.max(1, Math.round(candidates.length * p.reach));

    candidates.slice(0, hitCount).forEach(({ a }) => {
      const individual = 0.78 + Math.random() * 0.44;
      a.stimulus = clamp(a.stimulus + p.severity * individual, 0, 120);
      sim.recentEventTargets.add(a.id);
    });

    ui.eventFlash.textContent = `Ereignis #${sim.eventId}: ${hitCount} MeckerSysteme direkt getroffen · Stärke ${p.severity}`;
    ui.eventFlash.classList.remove('bang');
    void ui.eventFlash.offsetWidth;
    ui.eventFlash.classList.add('bang');
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

    for (const a of sim.agents) {
      let incomingM = 0, incomingC = 0;
      if (delayed && a.neighbors.length) {
        for (const n of a.neighbors) {
          incomingM += delayed.m[n];
          incomingC += delayed.c[n];
        }
        const networkScale = Math.sqrt(a.neighbors.length);
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
        const effectiveThreshold = a.threshold;
        a.emissionC = clamp((a.level - effectiveThreshold) * 2.10 * (0.45 + p.calm), 0, 100);
        a.emissionM = 0;
      }
    }

    sim.emissionHistory.push({
      m: sim.agents.map(a => a.emissionM),
      c: sim.agents.map(a => a.emissionC)
    });
    if (sim.emissionHistory.length > 42) sim.emissionHistory.shift();

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

  function getClusters() {
    const active = new Set(sim.agents.filter(a => a.type === 'mecker' && a.emissionM > 5).map(a => a.id));
    let clusters = 0;
    const visited = new Set();
    for (const id of active) {
      if (visited.has(id)) continue;
      clusters += 1;
      const stack = [id]; visited.add(id);
      while (stack.length) {
        const cur = stack.pop();
        for (const n of sim.agents[cur].neighbors) {
          if (active.has(n) && !visited.has(n)) { visited.add(n); stack.push(n); }
        }
      }
    }
    return clusters;
  }

  function getGlobal() {
    const meckers = sim.agents.filter(a => a.type === 'mecker');
    const calmers = sim.agents.filter(a => a.type === 'calm');
    const activeM = meckers.filter(a => a.emissionM > 5).length;
    const activeC = calmers.filter(a => a.emissionC > 5).length;
    const avgM = mean(meckers.map(a => a.level));
    const avgC = mean(calmers.map(a => a.level));
    const annoyance = clamp(avgM * 0.64 + avgC * 0.22 + (activeM / meckers.length) * 30);
    return {
      activeM, activeC, avgM, avgC, annoyance,
      activeMShare: activeM / meckers.length,
      activeCShare: activeC / calmers.length,
      clusters: getClusters()
    };
  }

  function classify(g) {
    const series = sim.globalSeries;
    const amplitude = series.length > 10 ? Math.max(...series.slice(-40)) - Math.min(...series.slice(-40)) : 0;
    const oscillating = sim.signChanges > 5.5 && amplitude > 24 && g.activeMShare > 0.12;

    if (g.activeM === 0 && g.avgM < 4) return ['Gesellschaftliche Ruhe', 'Lokale Zustände sind abgeklungen; es gibt kein aktives Mecker-Cluster.'];
    if (oscillating) return ['Synchronisierte Meckerwelle', 'Die Population schwingt kollektiv, obwohl kein Agent einen globalen Takt vorgibt.'];
    if (g.activeMShare > 0.72 && g.activeCShare < 0.45) return ['Mecker-Kaskade', 'Lokale Ansteckung hat sich zu einem populationsweiten Ereignis ausgebreitet.'];
    if (g.activeMShare > 0.5 && g.activeCShare >= 0.45) return ['Gesellschaftliche Gegenkopplung', 'Meckern ist weit verbreitet, aber viele Beruhiger antworten gleichzeitig.'];
    if (g.clusters >= 3 && g.activeMShare > 0.22) return ['Clusterbildung', 'Mehrere getrennte Meckerherde bestehen gleichzeitig im Netzwerk.'];
    if (g.activeMShare > 0.14) return ['Lokale Ausbreitung', 'Ein Teil des Netzwerks meckert; ob daraus eine Kaskade wird, entscheidet die Kopplung.'];
    return ['Vereinzeltes Gemecker', 'Einzelne Agenten reagieren, ohne dass ein starkes Makromuster entstanden ist.'];
  }

  function sampleHistory() {
    const g = getGlobal();
    sim.history.push({ m: g.activeMShare * 100, c: g.activeCShare * 100, a: g.annoyance });
    if (sim.history.length > 180) sim.history.shift();
  }

  function render() {
    const g = getGlobal();
    const [label, note] = classify(g);
    ui.stateLabel.textContent = label;
    ui.stateNote.textContent = note;
    ui.activeMecker.textContent = g.activeM;
    ui.activeCalm.textContent = g.activeC;
    ui.clusterCount.textContent = g.clusters;
    ui.annoyanceValue.textContent = Math.round(g.annoyance);
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

  function drawNetwork() {
    const fitted = fitCanvas(ui.networkCanvas); if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h);
    const pad = 26;
    const pos = (a) => ({ x: pad + a.x * (w - pad * 2), y: pad + a.y * (h - pad * 2) });
    const delayed = delayedSnapshot();

    for (const [aId, bId] of sim.edges) {
      const a = sim.agents[aId], b = sim.agents[bId];
      const pa = pos(a), pb = pos(b);
      let m = 0, c = 0;
      if (delayed) {
        m = Math.max(delayed.m[aId], delayed.m[bId]);
        c = Math.max(delayed.c[aId], delayed.c[bId]);
      }
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      if (m > c && m > 6) { ctx.strokeStyle = `rgba(255,118,87,${0.08 + Math.min(.42, m / 210)})`; ctx.lineWidth = 1.2 + m / 55; }
      else if (c > 6) { ctx.strokeStyle = `rgba(117,212,194,${0.08 + Math.min(.42, c / 210)})`; ctx.lineWidth = 1.2 + c / 55; }
      else { ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; }
      ctx.stroke();
    }

    for (const a of sim.agents) {
      const p = pos(a);
      const strength = a.type === 'mecker' ? a.emissionM : a.emissionC;
      const base = a.type === 'mecker' ? css('--mecker') : css('--calm');
      const r = 4.1 + Math.min(5.5, strength / 17);

      if (strength > 4) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 + strength / 20, 0, Math.PI * 2);
        ctx.fillStyle = a.type === 'mecker' ? `rgba(255,118,87,${Math.min(.18, strength / 520)})` : `rgba(117,212,194,${Math.min(.18, strength / 520)})`;
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = strength > 2 ? base : (a.type === 'mecker' ? 'rgba(255,118,87,.28)' : 'rgba(117,212,194,.28)');
      ctx.fill();

      if (sim.recentEventTargets.has(a.id) && a.stimulus > 3) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.3, 0, Math.PI * 2);
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
    set(ui.severity, 45, 100); set(ui.reach, 10, 65); set(ui.connectivity, 3, 11);
    set(ui.socialInfluence, 20, 100); set(ui.calmStrength, 10, 95); set(ui.delay, 0, 25);
    updateOutputs(); reset(); triggerEvent();
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

  [ui.severity, ui.reach, ui.socialInfluence, ui.calmStrength, ui.delay].forEach(el => el.addEventListener('input', updateOutputs));
  ui.connectivity.addEventListener('input', () => { updateOutputs(); buildNetwork(); });
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
