(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
  const mean = (arr) => arr.length ? arr.reduce((sum, n) => sum + n, 0) / arr.length : 0;
  const rand = (min, max) => min + Math.random() * (max - min);

  const ui = {
    clusterTotal: $('clusterTotal'), eventCluster: $('eventCluster'), severity: $('severity'), reach: $('reach'),
    connectivity: $('connectivity'), socialInfluence: $('socialInfluence'), spillover: $('spillover'), calmStrength: $('calmStrength'),
    delay: $('delay'), autoExportEnabled: $('autoExportEnabled'), autoExportThreshold: $('autoExportThreshold'),
    clusterTotalOut: $('clusterTotalOut'), severityOut: $('severityOut'), reachOut: $('reachOut'), connectivityOut: $('connectivityOut'),
    socialInfluenceOut: $('socialInfluenceOut'), spilloverOut: $('spilloverOut'), calmStrengthOut: $('calmStrengthOut'),
    delayOut: $('delayOut'), autoExportThresholdOut: $('autoExportThresholdOut'), autoExportStatus: $('autoExportStatus'),
    eventButton: $('eventButton'), heroEvent: $('heroEvent'), pauseButton: $('pauseButton'), resetButton: $('resetButton'),
    chaosButton: $('chaosButton'), runDot: $('runDot'), stateLabel: $('stateLabel'), stateNote: $('stateNote'),
    activeMecker: $('activeMecker'), activeCalm: $('activeCalm'), activeClusters: $('activeClusters'), annoyanceValue: $('annoyanceValue'),
    networkCanvas: $('networkCanvas'), historyCanvas: $('historyCanvas'), eventFlash: $('eventFlash'), clusterStrip: $('clusterStrip'),
    exportSource: $('exportSource'), exportTarget: $('exportTarget'), exportAmount: $('exportAmount'), exportAmountOut: $('exportAmountOut'),
    exportButton: $('exportButton'), exportStatus: $('exportStatus')
  };

  const TEXT = {
    de: {
      randomCluster: 'Zufälliger Cluster', cluster: 'Cluster', reset: 'Gesellschaft zurückgesetzt.',
      manualDefault: 'Manueller Export verschiebt Meckerenergie zwischen Clustern.', needsTwo: 'Für Export braucht es mindestens zwei Cluster.',
      noEnergy: (c) => `Cluster ${c} hat gerade keine exportierbare Meckerenergie.`,
      manual: (a, b, e) => `Manueller Meckerexport: Cluster ${a} → ${b} · ${e} Energieeinheiten.`,
      auto: (a, b, e) => `Auto-Export: Grenz-Agent Cluster ${a} → ${b} · ${e} Energieeinheiten.`,
      event: (id, c, n, s) => `Ereignis #${id}: Cluster ${c} · ${n} direkt getroffen · Stärke ${s}`,
      pause: 'Pause', resume: 'Weiter', autoOn: (n) => `aktiv · ${n} Exporte`, autoOff: (n) => `aus · ${n} Exporte`,
      chip: (c, m, a, x) => `Cluster ${c}|${m}|Meckerer · Genervtheit ${a} · Autoexporte ${x}`,
      states: {
        quiet: ['Gesellschaftliche Ruhe', 'Alle Cluster sind unter ihren Meckerschwellen.'],
        wave: ['Synchronisierte Meckerwelle', 'Mehrere Cluster schwingen gemeinsam, obwohl kein globaler Taktgeber existiert.'],
        wildfire: ['Inter-Cluster-Flächenbrand', 'Fast alle Cluster meckern gleichzeitig; lokale Prozesse sind zu einem Gesamtereignis geworden.'],
        cascade: ['Export-Kaskade', 'Autonom exportiertes Gemecker hat in einem weiteren Cluster einen eigenständigen Meckerherd gezündet.'],
        spill: ['Cluster-Überschwappen', 'Meckerenergie überschreitet die Clustergrenze und aktiviert dort weitere Agenten.'],
        counter: ['Gesellschaftliche Gegenkopplung', 'Mehrere Cluster meckern, aber Beruhiger reagieren breit genug, um gegenzuhalten.'],
        multiple: ['Mehrere Meckerherde', 'Mehrere Cluster sind gleichzeitig aktiv, ohne dass daraus schon ein Flächenbrand geworden ist.'],
        local: ['Lokaler Meckerherd', 'Das Gemecker ist bislang auf einen Cluster begrenzt.'],
        isolated: ['Vereinzeltes Gemecker', 'Einige Agenten reagieren, aber noch kein Cluster hat sich als stabiler Herd etabliert.']
      }
    },
    en: {
      randomCluster: 'Random cluster', cluster: 'Cluster', reset: 'Society reset.',
      manualDefault: 'Manual export moves grumble energy between clusters.', needsTwo: 'Export requires at least two clusters.',
      noEnergy: (c) => `Cluster ${c} currently has no exportable grumble energy.`,
      manual: (a, b, e) => `Manual grumble export: Cluster ${a} → ${b} · ${e} energy units.`,
      auto: (a, b, e) => `Auto-export: boundary agent Cluster ${a} → ${b} · ${e} energy units.`,
      event: (id, c, n, s) => `Event #${id}: Cluster ${c} · ${n} directly hit · strength ${s}`,
      pause: 'Pause', resume: 'Resume', autoOn: (n) => `on · ${n} exports`, autoOff: (n) => `off · ${n} exports`,
      chip: (c, m, a, x) => `Cluster ${c}|${m}|grumblers · annoyance ${a} · auto-exports ${x}`,
      states: {
        quiet: ['Societal calm', 'All clusters are below their grumble thresholds.'],
        wave: ['Synchronised grumble wave', 'Several clusters oscillate together even though no global pacemaker exists.'],
        wildfire: ['Inter-cluster wildfire', 'Almost all clusters are grumbling at once; local processes have become a system-wide event.'],
        cascade: ['Export cascade', 'Autonomously exported grumbling has ignited a self-sustaining hotspot in another cluster.'],
        spill: ['Cluster spillover', 'Grumble energy has crossed a cluster boundary and activated additional agents there.'],
        counter: ['Societal counter-feedback', 'Several clusters are grumbling, but calmers are responding broadly enough to push back.'],
        multiple: ['Multiple grumble hotspots', 'Several clusters are active without yet becoming a system-wide flare-up.'],
        local: ['Local grumble hotspot', 'So far, the grumbling remains confined to one cluster.'],
        isolated: ['Isolated grumbling', 'Some agents are reacting, but no cluster has yet established a stable hotspot.']
      }
    }
  };

  const sim = {
    language: 'de', running: true, agents: [], edges: [], centers: [], emissions: [], history: [],
    recentHits: new Set(), exportPulses: [], elapsed: 0, tickAcc: 0, sampleAcc: 0, lastTime: performance.now(),
    eventId: 0, autoExportCount: 0, autoByCluster: [], lastAutoExport: null, crossFlux: 0,
    globalSeries: [], lastDeltaSign: 0, signChanges: 0
  };

  const N = 70;
  const TICK = 0.1;
  const ACTIVE_LEVEL = 18;

  const text = () => TEXT[sim.language];
  const params = () => ({
    clusters: Number(ui.clusterTotal.value), severity: Number(ui.severity.value), reach: Number(ui.reach.value) / 100,
    connectivity: Number(ui.connectivity.value), social: Number(ui.socialInfluence.value) / 100,
    spillover: Number(ui.spillover.value) / 100, calm: Number(ui.calmStrength.value) / 100,
    delaySteps: Math.round(Number(ui.delay.value)), exportFraction: Number(ui.exportAmount.value) / 100,
    autoExport: ui.autoExportEnabled.checked, autoThreshold: Number(ui.autoExportThreshold.value)
  });

  function setLanguage(lang) {
    sim.language = lang === 'en' ? 'en' : 'de';
    document.documentElement.lang = sim.language;
    document.querySelectorAll('[data-de][data-en]').forEach((el) => { el.textContent = el.dataset[sim.language]; });
    document.querySelectorAll('.lang-button').forEach((button) => {
      const active = button.dataset.lang === sim.language;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateSelectors();
    ui.pauseButton.textContent = sim.running ? text().pause : text().resume;
    ui.exportStatus.textContent = text().manualDefault;
    updateOutputs();
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
    ui.autoExportStatus.textContent = params().autoExport ? text().autoOn(sim.autoExportCount) : text().autoOff(sim.autoExportCount);
  }

  function seededNoise(i, salt = 0) {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function centersFor(k) {
    const layouts = {
      1: [[0.50, 0.50]],
      2: [[0.28, 0.50], [0.72, 0.50]],
      3: [[0.50, 0.25], [0.26, 0.70], [0.74, 0.70]],
      4: [[0.27, 0.29], [0.73, 0.29], [0.27, 0.71], [0.73, 0.71]],
      5: [[0.50, 0.50], [0.20, 0.24], [0.80, 0.24], [0.20, 0.76], [0.80, 0.76]]
    };
    return layouts[k].map(([x, y], id) => ({ id, x, y }));
  }

  function buildPopulation() {
    const k = params().clusters;
    sim.centers = centersFor(k);
    sim.autoByCluster = Array(k).fill(0);
    const counts = Array(k).fill(0);
    const radius = k === 1 ? 0.38 : k === 2 ? 0.21 : k === 3 ? 0.16 : k === 4 ? 0.14 : 0.115;

    sim.agents = Array.from({ length: N }, (_, id) => {
      const cluster = id % k;
      const localIndex = counts[cluster]++;
      const center = sim.centers[cluster];
      const angle = localIndex * 2.3999632297 + seededNoise(id, 3) * 0.5;
      const ring = 0.18 + Math.sqrt(seededNoise(id, 7)) * 0.80;
      const type = localIndex % 4 === 0 || seededNoise(id, 4) < 0.05 ? 'calm' : 'mecker';
      return {
        id, cluster, type, level: 0, stimulus: 0, emissionM: 0, emissionC: 0,
        threshold: type === 'calm' ? rand(10, 24) : rand(12, 28),
        reactivity: rand(0.86, 1.18), recovery: rand(0.86, 1.14),
        x: clamp(center.x + Math.cos(angle) * ring * radius, 0.035, 0.965),
        y: clamp(center.y + Math.sin(angle) * ring * radius, 0.055, 0.945),
        neighbors: [], autoCharge: 0, autoCooldown: 0
      };
    });

    buildNetwork();
    updateSelectors();
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function addEdge(a, b, cross, keys) {
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (keys.has(key)) return false;
    keys.add(key);
    a.neighbors.push({ id: b.id, cross });
    b.neighbors.push({ id: a.id, cross });
    sim.edges.push({ a: a.id, b: b.id, cross });
    return true;
  }

  function buildNetwork() {
    const desired = params().connectivity;
    const keys = new Set();
    sim.edges = [];
    sim.agents.forEach((a) => { a.neighbors = []; a.autoCharge = 0; a.autoCooldown = 0; });

    for (const a of sim.agents) {
      const candidates = sim.agents
        .filter((b) => b.id !== a.id && b.cluster === a.cluster)
        .map((b) => ({ b, d: distance(a, b) * rand(0.9, 1.1) }))
        .sort((x, y) => x.d - y.d);
      for (const { b } of candidates) {
        const localA = a.neighbors.filter((n) => !n.cross).length;
        const localB = b.neighbors.filter((n) => !n.cross).length;
        if (localA >= desired) break;
        if (localB >= desired + 2) continue;
        addEdge(a, b, false, keys);
      }
    }

    const k = params().clusters;
    if (k > 1) {
      const pairs = [];
      if (k === 2) pairs.push([0, 1]);
      else {
        for (let c = 0; c < k; c += 1) pairs.push([c, (c + 1) % k]);
        if (k >= 4) pairs.push([0, Math.floor(k / 2)]);
      }

      for (const [ca, cb] of pairs) {
        const aa = sim.agents.filter((a) => a.cluster === ca && a.type === 'mecker');
        const bb = sim.agents.filter((a) => a.cluster === cb && a.type === 'mecker');
        const candidates = [];
        aa.forEach((a) => bb.forEach((b) => candidates.push({ a, b, d: distance(a, b) })));
        candidates.sort((x, y) => x.d - y.d);
        let added = 0;
        for (const candidate of candidates) {
          if (addEdge(candidate.a, candidate.b, true, keys)) added += 1;
          if (added >= 3) break;
        }
      }
    }

    sim.emissions = [];
  }

  function updateSelectors() {
    if (!sim.agents.length) return;
    const k = params().clusters;
    const oldEvent = ui.eventCluster.value;
    const oldSource = ui.exportSource.value;
    const oldTarget = ui.exportTarget.value;
    const options = Array.from({ length: k }, (_, i) => `<option value="${i}">${text().cluster} ${i + 1}</option>`).join('');
    ui.eventCluster.innerHTML = `<option value="random">${text().randomCluster}</option>${options}`;
    ui.exportSource.innerHTML = options;
    ui.exportTarget.innerHTML = options;
    ui.eventCluster.value = oldEvent === 'random' || Number(oldEvent) < k ? oldEvent : 'random';
    if (!ui.eventCluster.value) ui.eventCluster.value = 'random';
    ui.exportSource.value = Number(oldSource) < k ? oldSource : '0';
    ui.exportTarget.value = Number(oldTarget) < k ? oldTarget : String(Math.min(1, k - 1));
    normalizeExportTarget();
  }

  function normalizeExportTarget() {
    const k = params().clusters;
    ui.exportButton.disabled = k < 2;
    if (k < 2) {
      ui.exportStatus.textContent = text().needsTwo;
      return;
    }
    if (ui.exportSource.value === ui.exportTarget.value) {
      ui.exportTarget.value = String((Number(ui.exportSource.value) + 1) % k);
    }
  }

  function reset({ preserveNetwork = false } = {}) {
    sim.agents.forEach((a) => {
      a.level = 0; a.stimulus = 0; a.emissionM = 0; a.emissionC = 0; a.autoCharge = 0; a.autoCooldown = 0;
    });
    if (!preserveNetwork) buildNetwork();
    sim.emissions = []; sim.history = []; sim.recentHits.clear(); sim.exportPulses = [];
    sim.elapsed = 0; sim.tickAcc = 0; sim.sampleAcc = 0; sim.eventId = 0; sim.autoExportCount = 0;
    sim.autoByCluster = Array(params().clusters).fill(0); sim.lastAutoExport = null; sim.crossFlux = 0;
    sim.globalSeries = []; sim.lastDeltaSign = 0; sim.signChanges = 0;
    ui.eventFlash.textContent = text().reset;
    ui.exportStatus.textContent = params().clusters < 2 ? text().needsTwo : text().manualDefault;
    updateOutputs(); render(); drawAll();
  }

  function triggerEvent() {
    const p = params();
    const cluster = ui.eventCluster.value === 'random' ? Math.floor(Math.random() * p.clusters) : Number(ui.eventCluster.value);
    const candidates = sim.agents.filter((a) => a.cluster === cluster && a.type === 'mecker').sort(() => Math.random() - 0.5);
    const count = Math.max(1, Math.round(candidates.length * p.reach));
    sim.recentHits.clear();
    candidates.slice(0, count).forEach((a) => {
      a.stimulus = clamp(a.stimulus + p.severity * rand(0.82, 1.18), 0, 120);
      sim.recentHits.add(a.id);
    });
    sim.eventId += 1;
    ui.eventFlash.textContent = text().event(sim.eventId, cluster + 1, count, p.severity);
    ui.eventFlash.classList.remove('bang'); void ui.eventFlash.offsetWidth; ui.eventFlash.classList.add('bang');
  }

  function localMeckerNeighbors(agent) {
    return agent.neighbors
      .filter((link) => !link.cross)
      .map((link) => sim.agents[link.id])
      .filter((other) => other.type === 'mecker');
  }

  function seedClusterFromBoundary(source, target, energy, kind = 'auto') {
    const recipients = [target, ...localMeckerNeighbors(target)]
      .filter((a, i, arr) => a && arr.findIndex((x) => x.id === a.id) === i)
      .slice(0, 5);
    const weights = recipients.map((_, i) => i === 0 ? 1.0 : 0.62);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    recipients.forEach((recipient, i) => {
      const share = energy * weights[i] / weightSum;
      recipient.stimulus = clamp(recipient.stimulus + share * 2.0, 0, 120);
      recipient.level = clamp(recipient.level + share * 0.35, 0, 100);
    });
    sim.exportPulses.push({ kind, fromAgent: source.id, toAgent: target.id, strength: Math.min(100, energy * 2.6), age: 0 });
  }

  function manualExport() {
    const p = params();
    const sourceCluster = Number(ui.exportSource.value);
    const targetCluster = Number(ui.exportTarget.value);
    if (p.clusters < 2 || sourceCluster === targetCluster) return;

    const sources = sim.agents.filter((a) => a.cluster === sourceCluster && a.type === 'mecker' && a.level > ACTIVE_LEVEL);
    if (!sources.length) {
      ui.exportStatus.textContent = text().noEnergy(sourceCluster + 1);
      return;
    }
    const targets = sim.agents.filter((a) => a.cluster === targetCluster && a.type === 'mecker');
    const sourceEnergy = mean(sources.map((a) => a.level)) * sources.length * p.exportFraction * 0.10;
    const energy = clamp(sourceEnergy, 12, 42);
    const source = sources.sort((a, b) => b.level - a.level)[0];
    const target = targets[Math.floor(Math.random() * targets.length)];
    seedClusterFromBoundary(source, target, energy, 'manual');
    sources.forEach((a) => { a.level = clamp(a.level - energy * 0.10); });
    ui.exportStatus.textContent = text().manual(sourceCluster + 1, targetCluster + 1, Math.round(energy));
  }

  function delayedSnapshot() {
    const index = sim.emissions.length - 1 - params().delaySteps;
    return index >= 0 ? sim.emissions[index] : null;
  }

  function boundaryTargets(agent) {
    return agent.neighbors.filter((n) => n.cross).map((n) => sim.agents[n.id]).filter(Boolean);
  }

  function maybeAutoExport() {
    const p = params();
    if (!p.autoExport || p.clusters < 2) return;

    for (const source of sim.agents) {
      if (source.type !== 'mecker') continue;
      source.autoCooldown = Math.max(0, source.autoCooldown - TICK);
      const targets = boundaryTargets(source);
      if (!targets.length) { source.autoCharge = 0; continue; }

      const pressure = Math.max(source.level, source.emissionM);
      const excess = pressure - p.autoThreshold;
      if (excess <= 0) {
        source.autoCharge = Math.max(0, source.autoCharge - 0.10);
        continue;
      }

      source.autoCharge += 0.08 + (excess / 100) * 0.42;
      if (source.autoCharge < 1 || source.autoCooldown > 0) continue;

      const clusterStats = getClusterStats();
      const target = targets.slice().sort((a, b) => clusterStats[a.cluster].annoyance - clusterStats[b.cluster].annoyance)[0];
      const energy = clamp(12 + excess * 0.34 + source.level * 0.12, 14, 38);
      seedClusterFromBoundary(source, target, energy, 'auto');

      const relief = energy * 0.22;
      source.level = clamp(source.level - relief);
      source.stimulus = Math.max(0, source.stimulus - relief * 0.35);
      source.autoCharge = 0;
      source.autoCooldown = rand(0.9, 1.8);

      sim.autoExportCount += 1;
      sim.autoByCluster[source.cluster] = (sim.autoByCluster[source.cluster] || 0) + 1;
      sim.lastAutoExport = { from: source.cluster, to: target.cluster, time: sim.elapsed };
      ui.exportStatus.textContent = text().auto(source.cluster + 1, target.cluster + 1, Math.round(energy));
    }
  }

  function tick() {
    const p = params();
    const delayed = delayedSnapshot();
    const next = new Array(N);
    let flux = 0;

    for (const a of sim.agents) {
      let localM = 0, localC = 0, localN = 0, crossM = 0, crossC = 0, crossN = 0;
      if (delayed) {
        for (const link of a.neighbors) {
          if (link.cross) {
            crossM += delayed.m[link.id]; crossC += delayed.c[link.id]; crossN += 1;
            flux += delayed.m[link.id] / 100;
          } else {
            localM += delayed.m[link.id]; localC += delayed.c[link.id]; localN += 1;
          }
        }
      }
      localM = localN ? localM / localN : 0;
      localC = localN ? localC / localN : 0;
      crossM = crossN ? crossM / crossN : 0;
      crossC = crossN ? crossC / crossN : 0;

      const meckerSignal = localM * 0.72 + crossM * p.spillover * 1.25;
      const calmSignal = localC * 0.74 + crossC * p.spillover * 0.90;

      a.stimulus *= 0.91;
      if (a.type === 'mecker') {
        const own = a.stimulus * 0.20;
        const social = Math.max(0, meckerSignal - 5) * p.social * 0.18 * a.reactivity;
        const calming = calmSignal * p.calm * 0.18;
        const decay = 1.15 + a.level * 0.025;
        next[a.id] = clamp(a.level + own + social - calming - decay);
      } else {
        const demand = Math.max(0, meckerSignal - a.threshold) * (0.18 + p.calm * 0.16) * a.reactivity;
        const decay = 1.35 + a.level * 0.035 * a.recovery;
        next[a.id] = clamp(a.level + demand - decay);
      }
    }

    sim.agents.forEach((a) => { a.level = next[a.id]; });
    sim.agents.forEach((a) => {
      if (a.type === 'mecker') a.emissionM = a.level > a.threshold ? clamp((a.level - a.threshold) * 1.45) : 0;
      else a.emissionC = a.level > a.threshold ? clamp((a.level - a.threshold) * 1.35) : 0;
      if (a.type === 'mecker') a.emissionC = 0; else a.emissionM = 0;
    });

    sim.emissions.push({ m: sim.agents.map((a) => a.emissionM), c: sim.agents.map((a) => a.emissionC) });
    const maxHistory = 50;
    if (sim.emissions.length > maxHistory) sim.emissions.shift();
    sim.crossFlux = flux / Math.max(1, sim.edges.filter((e) => e.cross).length);
    maybeAutoExport();
    trackOscillation();
  }

  function getClusterStats() {
    return Array.from({ length: params().clusters }, (_, cluster) => {
      const agents = sim.agents.filter((a) => a.cluster === cluster);
      const meckers = agents.filter((a) => a.type === 'mecker');
      const calmers = agents.filter((a) => a.type === 'calm');
      const activeM = meckers.filter((a) => a.level >= ACTIVE_LEVEL).length;
      const activeC = calmers.filter((a) => a.level >= ACTIVE_LEVEL).length;
      const avgM = mean(meckers.map((a) => a.level));
      const avgC = mean(calmers.map((a) => a.level));
      return {
        cluster, activeM, activeC, meckerTotal: meckers.length, calmTotal: calmers.length, avgM, avgC,
        annoyance: clamp(avgM * 0.72 + (activeM / Math.max(1, meckers.length)) * 35)
      };
    });
  }

  function getGlobal() {
    const meckers = sim.agents.filter((a) => a.type === 'mecker');
    const calmers = sim.agents.filter((a) => a.type === 'calm');
    const activeM = meckers.filter((a) => a.level >= ACTIVE_LEVEL).length;
    const activeC = calmers.filter((a) => a.level >= ACTIVE_LEVEL).length;
    const avgM = mean(meckers.map((a) => a.level));
    const avgC = mean(calmers.map((a) => a.level));
    const clusters = getClusterStats();
    const activeClusterCount = clusters.filter((c) => c.activeM >= Math.max(2, Math.ceil(c.meckerTotal * 0.12))).length;
    return {
      activeM, activeC, avgM, avgC, clusters, activeClusterCount,
      activeMShare: activeM / Math.max(1, meckers.length), activeCShare: activeC / Math.max(1, calmers.length),
      annoyance: clamp(avgM * 0.64 + avgC * 0.18 + activeM / Math.max(1, meckers.length) * 32)
    };
  }

  function trackOscillation() {
    const g = getGlobal();
    sim.globalSeries.push(g.annoyance);
    if (sim.globalSeries.length > 80) sim.globalSeries.shift();
    if (sim.globalSeries.length < 3) return;
    const n = sim.globalSeries.length;
    const delta = sim.globalSeries[n - 1] - sim.globalSeries[n - 2];
    const sign = Math.abs(delta) > 0.8 ? Math.sign(delta) : 0;
    if (sign && sim.lastDeltaSign && sign !== sim.lastDeltaSign) sim.signChanges += 1;
    else sim.signChanges = Math.max(0, sim.signChanges - 0.06);
    if (sign) sim.lastDeltaSign = sign;
  }

  function classify(g) {
    const states = text().states;
    const amplitude = sim.globalSeries.length > 12 ? Math.max(...sim.globalSeries.slice(-40)) - Math.min(...sim.globalSeries.slice(-40)) : 0;
    const oscillating = sim.signChanges > 5 && amplitude > 22 && g.activeMShare > 0.12;
    const allActive = params().clusters > 1 && g.activeClusterCount === params().clusters;

    let exportIgnited = false;
    if (sim.lastAutoExport && sim.elapsed - sim.lastAutoExport.time < 5) {
      const target = g.clusters[sim.lastAutoExport.to];
      const threshold = Math.max(3, Math.ceil(target.meckerTotal * 0.20));
      exportIgnited = target.activeM >= threshold && target.annoyance >= 28;
    }

    if (g.activeM === 0 && g.avgM < 4) return states.quiet;
    if (oscillating && g.activeClusterCount >= 2) return states.wave;
    if (allActive && g.activeMShare > 0.58) return states.wildfire;
    if (exportIgnited) return states.cascade;
    if (sim.crossFlux > 0.20 && g.activeClusterCount >= 2) return states.spill;
    if (g.activeClusterCount >= 2 && g.activeCShare >= 0.40) return states.counter;
    if (g.activeClusterCount >= 2) return states.multiple;
    if (g.activeClusterCount === 1) return states.local;
    return states.isolated;
  }

  function sampleHistory() {
    const g = getGlobal();
    sim.history.push({ m: g.activeMShare * 100, c: g.activeCShare * 100, a: g.annoyance });
    if (sim.history.length > 180) sim.history.shift();
  }

  function renderClusterStrip(stats) {
    ui.clusterStrip.innerHTML = stats.map((c) => {
      const [name, value, detail] = text().chip(c.cluster + 1, c.activeM, Math.round(c.annoyance), sim.autoByCluster[c.cluster] || 0).split('|');
      return `<div class="cluster-chip${c.activeM ? ' is-active' : ''}"><span>${name}</span><strong>${value}</strong><small>${detail}</small></div>`;
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
    updateOutputs();
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function point(a, w, h) { const pad = 18; return { x: pad + a.x * (w - pad * 2), y: pad + a.y * (h - pad * 2) }; }

  function drawClusterFields(ctx, w, h) {
    const stats = getClusterStats();
    const k = params().clusters;
    const r = k === 1 ? Math.min(w, h) * 0.39 : k === 2 ? Math.min(w, h) * 0.245 : k === 3 ? Math.min(w, h) * 0.205 : Math.min(w, h) * 0.17;
    sim.centers.forEach((center) => {
      const stat = stats[center.id];
      const x = center.x * w, y = center.y * h;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = stat.activeM ? 'rgba(255,118,87,.035)' : 'rgba(214,187,255,.018)'; ctx.fill();
      ctx.strokeStyle = stat.activeM ? 'rgba(255,118,87,.20)' : 'rgba(214,187,255,.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(245,243,238,.48)'; ctx.font = '700 10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`C${center.id + 1}`, x, y - r + 15);
    });
  }

  function drawPulses(ctx, w, h) {
    sim.exportPulses.forEach((pulse) => {
      pulse.age += 0.018;
      const from = point(sim.agents[pulse.fromAgent], w, h), to = point(sim.agents[pulse.toAgent], w, h);
      const t = clamp(pulse.age / 1.2, 0, 1);
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = `rgba(214,187,255,${Math.max(0, 0.34 - pulse.age * 0.16)})`; ctx.lineWidth = pulse.kind === 'auto' ? 2 : 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3 + pulse.strength / 40, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(214,187,255,${Math.max(0, 0.95 - pulse.age * 0.5)})`; ctx.fill();
    });
    sim.exportPulses = sim.exportPulses.filter((p) => p.age < 1.7);
  }

  function drawNetwork() {
    const fitted = fitCanvas(ui.networkCanvas); if (!fitted) return;
    const { ctx, w, h } = fitted;
    ctx.clearRect(0, 0, w, h); drawClusterFields(ctx, w, h);
    const delayed = delayedSnapshot();

    sim.edges.forEach((edge) => {
      const a = sim.agents[edge.a], b = sim.agents[edge.b], pa = point(a, w, h), pb = point(b, w, h);
      const m = delayed ? Math.max(delayed.m[a.id], delayed.m[b.id]) : 0;
      const c = delayed ? Math.max(delayed.c[a.id], delayed.c[b.id]) : 0;
      ctx.save(); if (edge.cross) ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      if (m > c && m > 5) { ctx.strokeStyle = `rgba(255,118,87,${edge.cross ? 0.35 : 0.18})`; ctx.lineWidth = edge.cross ? 1.8 : 1.0 + m / 80; }
      else if (c > 5) { ctx.strokeStyle = `rgba(117,212,194,${edge.cross ? 0.28 : 0.16})`; ctx.lineWidth = 1.0; }
      else { ctx.strokeStyle = edge.cross ? 'rgba(214,187,255,.22)' : 'rgba(255,255,255,.05)'; ctx.lineWidth = edge.cross ? 1.1 : 0.8; }
      ctx.stroke(); ctx.restore();
    });

    sim.agents.forEach((a) => {
      const p = point(a, w, h), strength = a.type === 'mecker' ? a.emissionM : a.emissionC;
      const base = a.type === 'mecker' ? css('--mecker') : css('--calm');
      const r = 3.8 + Math.min(5.2, strength / 18);
      if (strength > 4) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 4 + strength / 22, 0, Math.PI * 2); ctx.fillStyle = a.type === 'mecker' ? 'rgba(255,118,87,.11)' : 'rgba(117,212,194,.11)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = strength > 2 ? base : (a.type === 'mecker' ? 'rgba(255,118,87,.30)' : 'rgba(117,212,194,.30)'); ctx.fill();
      if (sim.recentHits.has(a.id) && a.stimulus > 3) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.2, 0, Math.PI * 2); ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.2; ctx.stroke(); }
    });
    drawPulses(ctx, w, h);
  }

  function drawHistory() {
    const fitted = fitCanvas(ui.historyCanvas); if (!fitted) return;
    const { ctx, w, h } = fitted, data = sim.history;
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 25, r: 8, t: 5, b: 12 }, pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.font = '9px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = css('--muted-2');
    [0, 50, 100].forEach((v) => { const y = pad.t + ph - v / 100 * ph; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.stroke(); ctx.fillText(String(v), pad.l - 5, y + 3); });
    if (data.length < 2) return;
    const line = (key, color) => { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; data.forEach((d, i) => { const x = pad.l + i / Math.max(1, data.length - 1) * pw, y = pad.t + ph - d[key] / 100 * ph; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); };
    line('m', css('--mecker')); line('c', css('--calm')); line('a', css('--signal'));
  }

  function drawAll() { drawNetwork(); drawHistory(); }

  function randomise() {
    const set = (el, min, max) => { el.value = String(Math.round(rand(min, max))); };
    set(ui.clusterTotal, 2, 5); set(ui.severity, 50, 100); set(ui.reach, 15, 70); set(ui.connectivity, 3, 9);
    set(ui.socialInfluence, 35, 100); set(ui.spillover, 10, 100); set(ui.calmStrength, 10, 90); set(ui.delay, 0, 25); set(ui.autoExportThreshold, 40, 80);
    ui.autoExportEnabled.checked = true;
    updateOutputs(); buildPopulation(); reset({ preserveNetwork: true }); triggerEvent();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - sim.lastTime) / 1000); sim.lastTime = now;
    if (sim.running) {
      sim.tickAcc += dt; sim.sampleAcc += dt; sim.elapsed += dt;
      while (sim.tickAcc >= TICK) { tick(); sim.tickAcc -= TICK; }
      if (sim.sampleAcc >= 0.2) { sampleHistory(); sim.sampleAcc = 0; }
    }
    render(); drawAll(); requestAnimationFrame(frame);
  }

  document.querySelectorAll('.lang-button').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
  [ui.severity, ui.reach, ui.socialInfluence, ui.spillover, ui.calmStrength, ui.delay, ui.exportAmount, ui.autoExportThreshold].forEach((el) => el.addEventListener('input', updateOutputs));
  ui.autoExportEnabled.addEventListener('change', updateOutputs);
  ui.connectivity.addEventListener('input', () => { updateOutputs(); buildNetwork(); });
  ui.clusterTotal.addEventListener('input', () => { updateOutputs(); buildPopulation(); reset({ preserveNetwork: true }); });
  ui.exportSource.addEventListener('change', normalizeExportTarget);
  ui.exportTarget.addEventListener('change', normalizeExportTarget);
  ui.exportButton.addEventListener('click', manualExport);
  ui.eventButton.addEventListener('click', triggerEvent);
  ui.heroEvent.addEventListener('click', () => { triggerEvent(); $('lab').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  ui.resetButton.addEventListener('click', () => reset());
  ui.chaosButton.addEventListener('click', randomise);
  ui.pauseButton.addEventListener('click', () => { sim.running = !sim.running; ui.pauseButton.textContent = sim.running ? text().pause : text().resume; ui.runDot.classList.toggle('paused', !sim.running); });
  window.addEventListener('resize', drawAll);

  buildPopulation(); setLanguage('de'); updateOutputs(); reset({ preserveNetwork: true });
  requestAnimationFrame((now) => { sim.lastTime = now; requestAnimationFrame(frame); });
})();
