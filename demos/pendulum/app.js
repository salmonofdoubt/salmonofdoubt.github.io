(() => {
  "use strict";

  const G = 9.80665;
  const TAU = Math.PI * 2;
  const BASES = ["A", "C", "G", "T"];

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const ui = {
    controls: document.getElementById("controls"),
    cards: Array.from(document.querySelectorAll(".card")),
    playPause: document.getElementById("playPause"),
    reset: document.getElementById("reset"),
    kick: document.getElementById("kick"),
    trailToggle: document.getElementById("trailToggle"),
    glowToggle: document.getElementById("glowToggle"),
    labelToggle: document.getElementById("labelToggle"),
    slowToggle: document.getElementById("slowToggle"),
    statusLine: document.getElementById("statusLine"),
    experimentReadout: document.getElementById("experimentReadout"),
    timeReadout: document.getElementById("timeReadout"),
    systemReadout: document.getElementById("systemReadout"),
    orderReadout: document.getElementById("orderReadout"),
    noteTitle: document.getElementById("noteTitle"),
    noteBody: document.getElementById("noteBody"),
    seeingBody: document.getElementById("seeingBody"),
    debugText: document.getElementById("debugText")
  };

  const colours = ["#ff6b6b", "#ffa94d", "#ffd43b", "#94d82d", "#38d9a9", "#22d3ee", "#4dabf7", "#748ffc", "#b197fc", "#f783ac"];

  const experiments = {
    pendulum: {
      title: "Pendulum wave",
      defaults: { count: 28, baseSwings: 51, cycle: 60, angle: 16, damping: 2, speed: 100 },
      note: "A pendulum wave is built from calibrated periods. Each bob completes a different integer number of swings in the same cycle window.",
      seeing: "The wave is not separately programmed. It emerges from phase relations: small timing differences become visible bands, braids, and re-alignment.",
      controls: [
        ["count", "Number of pendulums", 8, 64, 28, 1, ""],
        ["baseSwings", "Slowest swings per cycle", 20, 90, 51, 1, ""],
        ["cycle", "Cycle window", 20, 120, 60, 1, " s"],
        ["angle", "Release angle", 2, 28, 16, 1, "°"],
        ["damping", "Damping", 0, 40, 2, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },
    spring: {
      title: "Spring mass array",
      defaults: { count: 42, baseK: 8, stepK: 0.32, mass: 1.4, amplitude: 34, damping: 8, speed: 100 },
      note: "A spring mass oscillator follows angular frequency ω = √(k/m). Small differences in spring stiffness create visible frequency differences.",
      seeing: "The masses begin together, then local timing differences create travelling motion across the array.",
      controls: [
        ["count", "Number of oscillators", 8, 96, 42, 1, ""],
        ["baseK", "Base spring constant", 2, 20, 8, 0.5, ""],
        ["stepK", "Spring increment", 0.05, 1.2, 0.32, 0.05, ""],
        ["mass", "Mass", 0.5, 4, 1.4, 0.1, ""],
        ["amplitude", "Initial displacement", 8, 80, 34, 1, " px"],
        ["damping", "Damping", 0, 120, 8, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },
    phase: {
      title: "Coupled phase field",
      defaults: { count: 260, coupling: 85, disorder: 42, radius: 5, speed: 100 },
      note: "Each point is an oscillator that responds only to neighbours. Coupling lets local phase adjustment become global synchrony.",
      seeing: "No central conductor is present. Order forms from neighbour-to-neighbour interaction.",
      controls: [
        ["count", "Oscillators", 48, 520, 260, 4, ""],
        ["coupling", "Coupling strength", 0, 180, 85, 1, ""],
        ["disorder", "Frequency disorder", 0, 120, 42, 1, ""],
        ["radius", "Interaction radius", 1, 12, 5, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },
    dna: {
      title: "DNA evolution",
      defaults: { population: 420, genomeLength: 18, mutation: 18, selection: 55, recombination: 70, environment: 8, speed: 100 },
      note: "A toy genetic algorithm. Individuals carry DNA-like genomes made from A, C, G, and T. Mutation creates variation, recombination mixes inherited sequences, and selection shifts the population.",
      seeing: "The heatmap starts noisy. Over generations, matching positions become dominant while diversity falls or rises with environmental drift.",
      controls: [
        ["population", "Population", 80, 900, 420, 10, ""],
        ["genomeLength", "Genome length", 8, 32, 18, 1, " bases"],
        ["mutation", "Mutation rate", 0, 80, 18, 1, ""],
        ["selection", "Selection pressure", 0, 100, 55, 1, ""],
        ["recombination", "Recombination", 0, 100, 70, 1, ""],
        ["environment", "Environment drift", 0, 80, 8, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },
    fastlight: {
      title: "Fast-light pulse",
      defaults: { count: 240, group: 180, width: 34, reshaping: 55, absorption: 38, speed: 100 },
      note: "The peak of a pulse can appear to move faster than c in a dispersive medium. This does not mean energy or information travels faster than light.",
      seeing: "Cyan is the apparent group peak. Gold is the causal front. The peak can move ahead, but no new signal, energy, or information crosses the causal front.",
      controls: [
        ["count", "Trace samples", 80, 420, 240, 10, ""],
        ["group", "Apparent group velocity", 100, 320, 180, 5, "% c"],
        ["width", "Pulse width", 14, 78, 34, 1, " px"],
        ["reshaping", "Pulse reshaping", 0, 100, 55, 1, ""],
        ["absorption", "Medium absorption", 0, 100, 38, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },
    double: {
      title: "Double pendulum array",
      defaults: { count: 24, energy: 78, spread: 16, damping: 2, lengthRatio: 100, speed: 100 },
      note: "A double pendulum is deterministic but highly sensitive to initial conditions. In an array, small differences become rapidly different paths.",
      seeing: "This is deterministic chaos: no random forcing after release, just nonlinear dynamics amplifying small differences.",
      controls: [
        ["count", "Number of double pendulums", 6, 48, 24, 1, ""],
        ["energy", "Initial energy", 20, 120, 78, 1, ""],
        ["spread", "Initial spread", 0, 45, 16, 1, "°"],
        ["damping", "Damping", 0, 30, 2, 1, ""],
        ["lengthRatio", "Lower arm length", 60, 140, 100, 5, "%"],
        ["speed", "Speed", 10, 220, 100, 5, ""]
      ]
    }
  };

  const state = {
    experiment: "pendulum",
    running: true,
    time: 0,
    last: performance.now(),
    params: {},
    objects: [],
    trails: [],
    generation: 0,
    targetGenome: [],
    dnaStats: { best: 0, average: 0, diversity: 0 },
    dnaHistory: []
  };

  function n(key) { return Number(state.params[key]); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomGenome(len) { return Array.from({ length: len }, () => choice(BASES)); }

  function formatValue(key, value, unit) {
    if (key === "speed") return `${(Number(value) / 100).toFixed(2)}×`;
    if (key === "damping") return (Number(value) / 1000).toFixed(3);
    if (key === "mutation") return `${(Number(value) / 10).toFixed(1)}%`;
    if (!Number.isInteger(Number(value))) return `${Number(value).toFixed(2)}${unit}`;
    return `${value}${unit}`;
  }

  function renderControls() {
    ui.controls.innerHTML = "";
    experiments[state.experiment].controls.forEach(([key, label, min, max, start, step, unit]) => {
      const card = document.createElement("label");
      card.className = "control";
      const title = document.createElement("span");
      title.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = state.params[key] ?? start;
      const output = document.createElement("output");
      output.textContent = formatValue(key, input.value, unit);
      input.addEventListener("input", () => {
        state.params[key] = Number(input.value);
        output.textContent = formatValue(key, input.value, unit);
        buildObjects();
        clearTrails();
        draw();
      });
      card.append(title, input, output);
      ui.controls.appendChild(card);
    });
  }

  function switchExperiment(name) {
    state.experiment = name;
    state.params = { ...experiments[name].defaults };
    state.time = 0;
    state.generation = 0;
    state.dnaStats = { best: 0, average: 0, diversity: 0 };
    state.dnaHistory = [];
    clearTrails();
    renderControls();
    buildObjects();
    updateText();
    ui.cards.forEach(card => card.classList.toggle("active", card.dataset.experiment === name));
    draw();
  }

  function buildObjects() {
    if (state.experiment === "pendulum") buildPendulums();
    if (state.experiment === "spring") buildSprings();
    if (state.experiment === "phase") buildPhase();
    if (state.experiment === "dna") buildDNA();
    if (state.experiment === "fastlight") buildFastLight();
    if (state.experiment === "double") buildDouble();
  }

  function buildPendulums() {
    const count = n("count"), base = n("baseSwings"), cycle = n("cycle");
    state.objects = Array.from({ length: count }, (_, i) => {
      const swings = base + i;
      const period = cycle / swings;
      const lengthMetres = G * Math.pow(period / TAU, 2);
      return { i, swings, period, lengthMetres, omega: TAU / period, visualMass: 1 + (i % 5) * 0.25, colour: colours[i % colours.length] };
    });
  }

  function buildSprings() {
    const count = n("count"), baseK = n("baseK"), stepK = n("stepK"), mass = n("mass");
    state.objects = Array.from({ length: count }, (_, i) => {
      const k = baseK + i * stepK;
      return { i, k, omega: Math.sqrt(k / mass), colour: colours[i % colours.length] };
    });
  }

  function buildPhase() {
    const count = n("count"), disorder = n("disorder") / 100;
    state.objects = Array.from({ length: count }, (_, i) => {
      const golden = 2.3999632297;
      const r = Math.sqrt((i + 0.5) / count);
      const a = i * golden;
      return { i, x: Math.cos(a) * r, y: Math.sin(a) * r, phase: Math.random() * TAU, natural: 0.8 + Math.sin(i * 9.81) * disorder, colour: colours[i % colours.length] };
    });
  }

  function buildFastLight() {
    const count = n("count");
    state.objects = Array.from({ length: count }, (_, i) => ({ i, x: count <= 1 ? 0 : i / (count - 1) }));
  }

  function buildDouble() {
    const count = n("count"), energy = n("energy") / 100, spread = n("spread") * Math.PI / 180, ratio = n("lengthRatio") / 100;
    state.objects = Array.from({ length: count }, (_, i) => {
      const f = count <= 1 ? 0.5 : i / (count - 1);
      const phase = (f - 0.5) * spread;
      return {
        i,
        theta1: Math.PI * (0.52 + 0.18 * energy) + phase,
        theta2: Math.PI * (0.46 + 0.12 * energy) - phase * 0.75,
        omega1: 0.05 * Math.sin(i * 1.7),
        omega2: 0.05 * Math.cos(i * 1.3),
        l2: ratio,
        colour: colours[i % colours.length]
      };
    });
  }

  function buildDNA() {
    const population = n("population"), length = n("genomeLength");
    state.generation = 0;
    state.targetGenome = randomGenome(length);
    state.dnaHistory = [];
    state.objects = Array.from({ length: population }, (_, i) => ({ i, genome: randomGenome(length), fitness: 0 }));
    evaluateDNA();
    recordDNAHistory();
  }

  function evaluateDNA() {
    if (state.experiment !== "dna") return;
    const length = state.targetGenome.length || 1;
    let total = 0, best = 0;
    state.objects.forEach(o => {
      let matches = 0;
      for (let i = 0; i < length; i++) if (o.genome[i] === state.targetGenome[i]) matches++;
      o.fitness = matches / length;
      total += o.fitness;
      best = Math.max(best, o.fitness);
    });
    state.dnaStats.best = best;
    state.dnaStats.average = total / Math.max(1, state.objects.length);
    state.dnaStats.diversity = estimateDiversity();
  }

  function estimateDiversity() {
    const count = state.objects.length, length = state.targetGenome.length || 1, samples = Math.min(120, count);
    let total = 0;
    for (let s = 0; s < samples; s++) {
      const a = choice(state.objects).genome, b = choice(state.objects).genome;
      let diff = 0;
      for (let i = 0; i < length; i++) if (a[i] !== b[i]) diff++;
      total += diff / length;
    }
    return total / Math.max(1, samples);
  }

  function recordDNAHistory() {
    state.dnaHistory.push({ generation: state.generation, best: state.dnaStats.best, average: state.dnaStats.average, diversity: state.dnaStats.diversity });
    if (state.dnaHistory.length > 180) state.dnaHistory.shift();
  }

  function mutateGenome(genome, rate) {
    return genome.map(base => {
      if (Math.random() > rate) return base;
      let next = choice(BASES);
      while (next === base) next = choice(BASES);
      return next;
    });
  }

  function crossover(a, b, rate) {
    if (Math.random() > rate) return a.slice();
    const cut = 1 + Math.floor(Math.random() * Math.max(1, a.length - 1));
    return a.slice(0, cut).concat(b.slice(cut));
  }

  function pickParent() {
    const tournament = 2 + Math.round((n("selection") / 100) * 7);
    let best = choice(state.objects);
    for (let i = 1; i < tournament; i++) {
      const candidate = choice(state.objects);
      if (candidate.fitness > best.fitness) best = candidate;
    }
    return best;
  }

  function evolveDNA(steps) {
    const mutationRate = n("mutation") / 1000, recombinationRate = n("recombination") / 100, environmentRate = n("environment") / 1000, population = n("population");
    for (let step = 0; step < steps; step++) {
      evaluateDNA();
      if (Math.random() < environmentRate) {
        const idx = Math.floor(Math.random() * state.targetGenome.length);
        let next = choice(BASES);
        while (next === state.targetGenome[idx]) next = choice(BASES);
        state.targetGenome[idx] = next;
      }
      const sorted = state.objects.slice().sort((a, b) => b.fitness - a.fitness);
      const elites = Math.max(2, Math.round(population * 0.035));
      const nextPop = sorted.slice(0, elites).map((o, i) => ({ i, genome: o.genome.slice(), fitness: o.fitness }));
      while (nextPop.length < population) {
        const p1 = pickParent(), p2 = pickParent();
        nextPop.push({ i: nextPop.length, genome: mutateGenome(crossover(p1.genome, p2.genome, recombinationRate), mutationRate), fitness: 0 });
      }
      state.objects = nextPop;
      state.generation++;
      evaluateDNA();
      recordDNAHistory();
    }
  }

  function updatePhase(dt) {
    const coupling = n("coupling") / 100, radius = n("radius");
    const next = state.objects.map((o, i) => {
      let pull = 0, neighbours = 0;
      state.objects.forEach((other, j) => {
        if (i === j) return;
        const dx = other.x - o.x, dy = other.y - o.y;
        if (dx * dx + dy * dy < 0.25 * (radius / 4)) {
          pull += Math.sin(other.phase - o.phase);
          neighbours++;
        }
      });
      return o.phase + dt * (o.natural + coupling * (neighbours ? pull / neighbours : 0) * 2.4);
    });
    next.forEach((phase, i) => state.objects[i].phase = ((phase % TAU) + TAU) % TAU);
  }

  function stepDouble(dt) {
    const damping = n("damping") / 1000, h = dt / 5;
    for (let s = 0; s < 5; s++) {
      state.objects.forEach(p => {
        const m1 = 1, m2 = 1, l1 = 1, l2 = p.l2, g = 9.80665;
        const t1 = p.theta1, t2 = p.theta2, w1 = p.omega1, w2 = p.omega2, d = t1 - t2;
        const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
        const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
        const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
        p.omega1 = (p.omega1 + a1 * h) * (1 - damping);
        p.omega2 = (p.omega2 + a2 * h) * (1 - damping);
        p.theta1 += p.omega1 * h;
        p.theta2 += p.omega2 * h;
      });
    }
  }

  function phaseOrder() {
    if (state.experiment !== "phase" || !state.objects.length) return 0;
    let sx = 0, sy = 0;
    state.objects.forEach(o => { sx += Math.cos(o.phase); sy += Math.sin(o.phase); });
    return Math.sqrt(sx * sx + sy * sy) / state.objects.length;
  }

  function clearTrails() { state.trails = []; }

  function updateText() {
    const ex = experiments[state.experiment];
    ui.experimentReadout.textContent = ex.title;
    ui.timeReadout.textContent = `${state.time.toFixed(2)} s`;
    ui.noteTitle.textContent = `${ex.title} principle`;
    ui.noteBody.textContent = ex.note;
    ui.seeingBody.textContent = ex.seeing;
    if (state.experiment === "pendulum") { ui.systemReadout.textContent = `${n("count")} pendulums`; ui.orderReadout.textContent = `cycle ${n("cycle")} s`; }
    if (state.experiment === "spring") { ui.systemReadout.textContent = `${n("count")} oscillators`; ui.orderReadout.textContent = `k ${n("baseK").toFixed(1)} to ${(n("baseK") + (n("count") - 1) * n("stepK")).toFixed(1)}`; }
    if (state.experiment === "phase") { ui.systemReadout.textContent = `${n("count")} phases`; ui.orderReadout.textContent = `order ${phaseOrder().toFixed(2)}`; }
    if (state.experiment === "dna") { ui.systemReadout.textContent = `gen ${state.generation} · ${n("population")} genomes`; ui.orderReadout.textContent = `best ${(state.dnaStats.best * 100).toFixed(0)}% · avg ${(state.dnaStats.average * 100).toFixed(0)}%`; }
    if (state.experiment === "fastlight") { ui.systemReadout.textContent = `peak ${(n("group") / 100).toFixed(2)}c · front ≤ c`; ui.orderReadout.textContent = "no superluminal energy"; }
    if (state.experiment === "double") { ui.systemReadout.textContent = `${n("count")} double pendulums`; ui.orderReadout.textContent = "sensitive dependence"; }
  }

  function canvasSize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  function clear(w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0b111a"); bg.addColorStop(0.5, "#05080c"); bg.addColorStop(1, "#020407");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
    const spacing = Math.max(28, Math.min(w, h) / 14);
    for (let x = -spacing; x < w + spacing; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h * 0.16, h); ctx.stroke(); }
    ctx.restore();
  }

  function drawRail(w, y) {
    const left = w * 0.06, right = w * 0.94;
    const rail = ctx.createLinearGradient(left, y, right, y);
    rail.addColorStop(0, "rgba(248,208,106,0.55)");
    rail.addColorStop(0.5, "rgba(255,255,255,0.42)");
    rail.addColorStop(1, "rgba(103,232,249,0.45)");
    ctx.lineCap = "round"; ctx.lineWidth = 7; ctx.strokeStyle = rail;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }

  function glowCircle(x, y, r, colour) {
    if (ui.glowToggle.checked) {
      const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3.2);
      g.addColorStop(0, "rgba(255,255,255,0.92)"); g.addColorStop(0.36, colour); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawTrails(points) {
    if (!ui.trailToggle.checked) return;
    state.trails.push(points);
    if (state.trails.length > 62) state.trails.shift();
    ctx.save();
    state.trails.forEach((frame, i) => {
      ctx.globalAlpha = i / state.trails.length * 0.20;
      frame.forEach(p => { ctx.fillStyle = p.colour; ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 2.2, 0, TAU); ctx.fill(); });
    });
    ctx.restore();
  }

  function drawPendulums(w, h) {
    const railY = Math.max(46, h * 0.1), count = state.objects.length, left = w * 0.08, right = w * 0.92;
    const lengths = state.objects.map(p => p.lengthMetres), minL = Math.min(...lengths), maxL = Math.max(...lengths);
    const minPx = h * 0.30, maxPx = h * 0.70, angle = n("angle") * Math.PI / 180, damping = n("damping") / 1000, points = [];
    drawRail(w, railY);
    state.objects.forEach((p, i) => {
      const f = count === 1 ? 0.5 : i / (count - 1), pivotX = left + f * (right - left), len = minPx + ((p.lengthMetres - minL) / Math.max(0.0001, maxL - minL)) * (maxPx - minPx);
      const theta = angle * Math.exp((-damping * state.time) / Math.sqrt(p.visualMass)) * Math.cos(p.omega * state.time);
      const bobX = pivotX + Math.sin(theta) * len * 0.74, bobY = railY + Math.cos(theta) * len, radius = 6.5 + p.visualMass * 2.7;
      points.push({ x: bobX, y: bobY, colour: p.colour, r: 1.8 });
      ctx.strokeStyle = "rgba(238,245,255,0.46)"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(pivotX, railY); ctx.lineTo(bobX, bobY); ctx.stroke();
      glowCircle(bobX, bobY, radius, p.colour);
      if (ui.labelToggle.checked && count <= 36) { ctx.fillStyle = "rgba(238,244,255,0.68)"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(p.swings), pivotX, railY + 22); }
    });
    drawTrails(points);
  }

  function drawSprings(w, h) {
    const railY = Math.max(54, h * 0.12), count = state.objects.length, left = w * 0.06, right = w * 0.94, baseY = h * 0.52;
    const spacing = count > 1 ? (right - left) / (count - 1) : 0, amp = n("amplitude"), damping = n("damping") / 1000, points = [];
    drawRail(w, railY);
    state.objects.forEach((osc, i) => {
      const x = count === 1 ? w / 2 : left + i * spacing, y = baseY + amp * Math.exp(-damping * state.time) * Math.cos(osc.omega * state.time);
      const bw = Math.min(24, Math.max(8, spacing * 0.52 || 18)), bh = Math.max(12, bw * 0.7);
      points.push({ x, y: y + bh / 2, colour: osc.colour, r: 1.8 });
      ctx.strokeStyle = "rgba(238,245,255,0.76)"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x, railY); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = osc.colour; ctx.fillRect(x - bw / 2, y, bw, bh);
    });
    drawTrails(points);
  }

  function drawPhase(w, h) {
    const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.38, order = phaseOrder(), points = [];
    state.objects.forEach(o => {
      const x = cx + o.x * scale, y = cy + o.y * scale, colour = `hsl(${Math.round(185 + (((o.phase % TAU) + TAU) / TAU) * 255)}, 92%, 64%)`, r = 2.6 + order * 4.5;
      points.push({ x, y, colour, r: 1.7 });
      ctx.strokeStyle = colour; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(o.phase) * (6 + order * 12), y + Math.sin(o.phase) * (6 + order * 12)); ctx.stroke();
      glowCircle(x, y, r, colour);
    });
    drawTrails(points);
  }

  function baseColour(base) { return base === "A" ? "#67e8f9" : base === "C" ? "#a3e635" : base === "G" ? "#f8d06a" : "#f472b6"; }
  function drawGenomeStrip(genome, x, y, width, height) { const step = width / genome.length; genome.forEach((b, i) => { ctx.fillStyle = baseColour(b); ctx.fillRect(x + i * step, y, Math.max(1, step - 1), height); }); }

  function drawDNA(w, h) {
    const pad = Math.max(18, w * 0.025), leftW = Math.min(430, w * 0.38), rightX = pad + leftW + 14, rightW = w - rightX - pad;
    const best = state.objects.reduce((a, b) => a.fitness > b.fitness ? a : b, state.objects[0]);
    ctx.fillStyle = "rgba(238,244,255,0.88)"; ctx.font = "850 13px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("target genome", pad, 28); drawGenomeStrip(state.targetGenome, pad, 38, leftW - 28, 13);
    ctx.fillText("best genome", pad, 78); if (best) drawGenomeStrip(best.genome, pad, 88, leftW - 28, 13);
    ctx.fillText(`generation ${state.generation} · best ${(state.dnaStats.best * 100).toFixed(0)}% · average ${(state.dnaStats.average * 100).toFixed(0)}% · diversity ${(state.dnaStats.diversity * 100).toFixed(0)}%`, pad, 132);
    function graph(key, y, colour, label) {
      ctx.fillStyle = "rgba(169,184,204,0.9)"; ctx.fillText(label, pad, y - 8);
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.strokeRect(pad, y, leftW - 28, 58);
      ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.beginPath();
      state.dnaHistory.forEach((p, i) => { const x = pad + (i / Math.max(1, state.dnaHistory.length - 1)) * (leftW - 28); const py = y + 58 - p[key] * 58; if (i === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py); });
      ctx.stroke();
    }
    graph("best", 170, "#67e8f9", "best fitness"); graph("average", 250, "#a3e635", "average fitness"); graph("diversity", 330, "#f8d06a", "diversity");
    const sorted = state.objects.slice().sort((a, b) => b.fitness - a.fitness), genomeLen = state.targetGenome.length, rows = Math.min(sorted.length, Math.floor((h - 60) / 4)), rowH = (h - 80) / Math.max(1, rows), baseW = rightW / genomeLen;
    ctx.fillStyle = "rgba(169,184,204,0.9)"; ctx.fillText("population genomes sorted by fitness", rightX, 28);
    for (let r = 0; r < rows; r++) {
      const o = sorted[Math.floor((r / Math.max(1, rows - 1)) * (sorted.length - 1))], y = 46 + r * rowH;
      o.genome.forEach((b, i) => { ctx.fillStyle = b === state.targetGenome[i] ? baseColour(b) : "rgba(255,255,255,0.13)"; ctx.fillRect(rightX + i * baseW, y, Math.max(1, baseW - 1), Math.max(1, rowH - 0.5)); });
    }
  }

  function drawFastLight(w, h) {
    const pad = Math.max(28, w * 0.04), top = Math.max(34, h * 0.07), dh = h * 0.44, bottom = top + dh, x0 = pad, x1 = w - pad;
    const vg = n("group") / 100, progress = (state.time * 0.13) % 1, front = progress, peak = Math.min(1, progress * vg), frontX = x0 + (x1 - x0) * front, peakX = x0 + (x1 - x0) * peak, timeY = top + dh * progress, gy = top + dh / Math.max(1, vg);
    ctx.fillStyle = "rgba(103,232,249,0.08)"; ctx.fillRect(x0 + (x1-x0)*0.38, top, (x1-x0)*0.38, dh);
    ctx.strokeStyle = "rgba(248,208,106,0.95)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x1, bottom); ctx.stroke();
    ctx.strokeStyle = "rgba(103,232,249,0.95)"; ctx.setLineDash([10,8]); ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x1, gy); ctx.stroke(); ctx.setLineDash([]);
    glowCircle(frontX, timeY, 7, "#f8d06a"); glowCircle(peakX, timeY, 7, "#67e8f9");
    ctx.fillStyle = "rgba(238,244,255,0.86)"; ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("No new information, causal front, or energy transport crosses faster than c.", w/2, bottom + 36);
    const trackY = bottom + 105, amp = Math.max(42, h * 0.08), sigma = n("width") / (x1 - x0), reshaping = n("reshaping") / 100, absorption = n("absorption") / 100;
    ctx.beginPath(); state.objects.forEach((s, i) => { const xNorm = s.x, x = x0 + (x1 - x0) * xNorm; const e = Math.exp(-Math.pow((xNorm - peak) / Math.max(0.025, sigma), 2) / 2); const gate = 1 / (1 + Math.exp((xNorm - front) * 55)); const y = trackY - e * (0.25 + 0.75 * reshaping) * (1 - absorption * 0.55) * Math.sin((xNorm - peak) * 95 - state.time * 7) * amp * gate; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = "rgba(103,232,249,0.95)"; ctx.lineWidth = 2.2; ctx.stroke();
  }

  function drawDouble(w, h) {
    const count = state.objects.length, railY = Math.max(54, h * 0.12), left = w * 0.06, right = w * 0.94, span = right - left, len = Math.min(h * 0.21, span / Math.max(8, count) * 2.8), points = [];
    drawRail(w, railY);
    state.objects.forEach((p, i) => {
      const f = count <= 1 ? 0.5 : i / (count - 1), pivotX = left + span * f, x1 = pivotX + Math.sin(p.theta1) * len, y1 = railY + Math.cos(p.theta1) * len, x2 = x1 + Math.sin(p.theta2) * len * p.l2, y2 = y1 + Math.cos(p.theta2) * len * p.l2;
      points.push({ x: x2, y: y2, colour: p.colour, r: 1.8 });
      ctx.strokeStyle = "rgba(238,245,255,0.46)"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(pivotX, railY); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      glowCircle(x1, y1, 4.2, "rgba(238,244,255,0.86)"); glowCircle(x2, y2, 5.8, p.colour);
      if (ui.labelToggle.checked && count <= 30) { ctx.fillStyle = "rgba(238,244,255,0.64)"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(i + 1), pivotX, railY + 21); }
    });
    drawTrails(points);
  }

  function draw() {
    const { w, h, dpr } = canvasSize();
    clear(w, h);
    if (state.experiment === "pendulum") drawPendulums(w, h);
    if (state.experiment === "spring") drawSprings(w, h);
    if (state.experiment === "phase") drawPhase(w, h);
    if (state.experiment === "dna") drawDNA(w, h);
    if (state.experiment === "fastlight") drawFastLight(w, h);
    if (state.experiment === "double") drawDouble(w, h);
    updateText();
    ui.statusLine.textContent = state.running ? "Running" : "Paused";
    ui.debugText.textContent = [`experiment: ${state.experiment}`, `objects: ${state.objects.length}`, `time: ${state.time.toFixed(3)} s`, `generation: ${state.generation}`, `order: ${phaseOrder().toFixed(3)}`, `canvas: ${w} × ${h}`, `dpr: ${dpr}`].join("\n");
  }

  function frame(now) {
    const rawDt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (state.running) {
      const dt = rawDt * (n("speed") / 100) * (ui.slowToggle.checked ? 0.25 : 1);
      state.time += dt;
      if (state.experiment === "phase") updatePhase(dt);
      if (state.experiment === "dna") evolveDNA(Math.max(1, Math.floor(dt * 11)));
      if (state.experiment === "double") stepDouble(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  function kickSystem() {
    if (state.experiment === "phase") state.objects.forEach(o => o.phase = Math.random() * TAU);
    else if (state.experiment === "dna") { state.targetGenome = randomGenome(n("genomeLength")); state.objects.forEach(o => o.genome = mutateGenome(o.genome, 0.25)); evaluateDNA(); }
    else { state.time = 0; buildObjects(); }
    clearTrails(); draw();
  }

  ui.cards.forEach(card => card.addEventListener("click", () => switchExperiment(card.dataset.experiment)));
  ui.playPause.addEventListener("click", () => { state.running = !state.running; ui.playPause.textContent = state.running ? "Pause" : "Play"; });
  ui.reset.addEventListener("click", () => switchExperiment(state.experiment));
  ui.kick.addEventListener("click", kickSystem);
  [ui.trailToggle, ui.glowToggle, ui.labelToggle, ui.slowToggle].forEach(input => input.addEventListener("change", () => { clearTrails(); draw(); }));
  window.addEventListener("resize", () => { clearTrails(); draw(); }, { passive: true });

  switchExperiment("pendulum");
  requestAnimationFrame(frame);
})();
