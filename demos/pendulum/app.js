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
      seeing: "Watch for diagonal bands, travelling waves, and re-alignment. The wave is not separately programmed; it emerges from phase relations.",
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
      seeing: "The masses begin together, then local timing differences create a travelling pattern across the array.",
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
      defaults: { count: 260, coupling: 85, disorder: 42, radius: 5, speed: 100, topology: "field" },
      note: "Each point is an oscillator with its own phase. It responds only to neighbours. With enough coupling, clusters and synchrony emerge.",
      seeing: "No central conductor is present. Local phase adjustment creates waves, rotating clusters, and synchrony.",
      controls: [
        ["count", "Oscillators", 48, 520, 260, 4, ""],
        ["coupling", "Coupling strength", 0, 180, 85, 1, ""],
        ["disorder", "Frequency disorder", 0, 120, 42, 1, ""],
        ["radius", "Interaction radius", 1, 12, 5, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""],
        ["topology", "Topology", "select", [["ring", "Ring"], ["field", "Field"], ["lattice", "Lattice"]]]
      ]
    },

    dna: {
      title: "DNA evolution",
      defaults: { population: 420, genomeLength: 18, mutation: 18, selection: 55, recombination: 70, environment: 8, speed: 100 },
      note: "A toy genetic algorithm. Individuals carry DNA-like genomes made from A, C, G, and T. Mutation creates variation, recombination mixes inherited sequences, and selection shifts the population.",
      seeing: "Look for noisy variation becoming higher fitness. Environmental drift changes the target, forcing the population to keep adapting.",
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
      seeing: "The cyan line marks the apparent group-velocity peak. The gold line marks the causal front. The peak can move ahead, but no new signal, energy, or information crosses the causal front.",
      controls: [
        ["count", "Trace samples", 80, 420, 240, 10, ""],
        ["group", "Apparent group velocity", 100, 320, 180, 5, "% c"],
        ["width", "Pulse width", 14, 78, 34, 1, " px"],
        ["reshaping", "Pulse reshaping", 0, 100, 55, 1, ""],
        ["absorption", "Medium absorption", 0, 100, 38, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
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
    dnaStats: { best: 0, average: 0, diversity: 0 }
  };

  function n(key) { return Number(state.params[key]); }
  function choice(items) { return items[Math.floor(Math.random() * items.length)]; }
  function randomGenome(length) { return Array.from({ length }, () => choice(BASES)); }

  function formatValue(key, value, unit) {
    if (key === "speed") return `${(Number(value) / 100).toFixed(2)}×`;
    if (key === "damping") return (Number(value) / 1000).toFixed(3);
    if (key === "mutation") return `${(Number(value) / 10).toFixed(1)}%`;
    if (!Number.isInteger(Number(value))) return `${Number(value).toFixed(2)}${unit}`;
    return `${value}${unit}`;
  }

  function renderControls() {
    const ex = experiments[state.experiment];
    ui.controls.innerHTML = "";

    ex.controls.forEach((control) => {
      const [key, label] = control;
      const card = document.createElement("label");
      card.className = "control";

      const title = document.createElement("span");
      title.textContent = label;
      card.appendChild(title);

      let input;
      const output = document.createElement("output");

      if (control[2] === "select") {
        input = document.createElement("select");
        control[3].forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          input.appendChild(option);
        });
        input.value = state.params[key];
        output.textContent = input.options[input.selectedIndex].textContent;
      } else {
        const [, , min, max, start, step, unit] = control;
        input = document.createElement("input");
        input.type = "range";
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = state.params[key] ?? start;
        output.textContent = formatValue(key, input.value, unit);
      }

      input.addEventListener("input", () => {
        state.params[key] = input.tagName === "SELECT" ? input.value : Number(input.value);
        output.textContent = input.tagName === "SELECT"
          ? input.options[input.selectedIndex].textContent
          : formatValue(key, input.value, control[6] || "");

        buildObjects();
        clearTrails();
        draw();
      });

      card.appendChild(input);
      card.appendChild(output);
      ui.controls.appendChild(card);
    });
  }

  function switchExperiment(name) {
    state.experiment = name;
    state.params = { ...experiments[name].defaults };
    state.time = 0;
    state.generation = 0;
    state.dnaStats = { best: 0, average: 0, diversity: 0 };
    clearTrails();
    renderControls();
    buildObjects();
    updateText();

    ui.cards.forEach((card) => {
      card.classList.toggle("active", card.dataset.experiment === name);
    });

    draw();
  }

  function buildObjects() {
    if (state.experiment === "pendulum") buildPendulums();
    if (state.experiment === "spring") buildSprings();
    if (state.experiment === "phase") buildPhaseField();
    if (state.experiment === "dna") buildDNA();
    if (state.experiment === "fastlight") buildFastLight();
  }

  function buildPendulums() {
    const count = n("count");
    const baseSwings = n("baseSwings");
    const cycle = n("cycle");

    state.objects = Array.from({ length: count }, (_, i) => {
      const swings = baseSwings + i;
      const period = cycle / swings;
      const lengthMetres = G * Math.pow(period / TAU, 2);
      return { i, swings, period, lengthMetres, omega: TAU / period, visualMass: 1 + (i % 5) * 0.25, colour: colours[i % colours.length] };
    });
  }

  function buildSprings() {
    const count = n("count");
    const baseK = n("baseK");
    const stepK = n("stepK");
    const mass = n("mass");

    state.objects = Array.from({ length: count }, (_, i) => {
      const k = baseK + i * stepK;
      return { i, k, omega: Math.sqrt(k / mass), colour: colours[i % colours.length] };
    });
  }

  function buildFastLight() {
    const count = n("count");
    state.objects = Array.from({ length: count }, (_, i) => ({ i, x: count <= 1 ? 0 : i / (count - 1) }));
  }

  function buildPhaseField() {
    const count = n("count");
    const disorder = n("disorder") / 100;
    const topology = state.params.topology;

    state.objects = Array.from({ length: count }, (_, i) => {
      const golden = 2.399963229728653;
      const r = Math.sqrt((i + 0.5) / count);
      const a = i * golden;
      let x = Math.cos(a) * r;
      let y = Math.sin(a) * r;

      if (topology === "ring") {
        x = Math.cos(i / count * TAU);
        y = Math.sin(i / count * TAU);
      }

      if (topology === "lattice") {
        const cols = Math.ceil(Math.sqrt(count));
        const row = Math.floor(i / cols);
        const col = i % cols;
        x = cols <= 1 ? 0 : (col / (cols - 1)) * 2 - 1;
        y = cols <= 1 ? 0 : (row / (cols - 1)) * 2 - 1;
      }

      const phase = Math.random() * TAU;
      const natural = 0.8 + (Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 3.17) * 0.5) * disorder;
      return { i, x, y, phase, natural, colour: colours[i % colours.length] };
    });
  }

  function buildDNA() {
    const population = n("population");
    const genomeLength = n("genomeLength");

    state.generation = 0;
    state.targetGenome = randomGenome(genomeLength);

    state.objects = Array.from({ length: population }, (_, i) => ({
      i,
      genome: randomGenome(genomeLength),
      fitness: 0,
      age: 0
    }));

    evaluateDNA();
  }

  function evaluateDNA() {
    if (state.experiment !== "dna") return;

    const length = state.targetGenome.length || 1;
    let total = 0;
    let best = 0;

    state.objects.forEach((o) => {
      let matches = 0;
      for (let i = 0; i < length; i += 1) {
        if (o.genome[i] === state.targetGenome[i]) matches += 1;
      }
      o.fitness = matches / length;
      total += o.fitness;
      best = Math.max(best, o.fitness);
    });

    state.dnaStats.best = best;
    state.dnaStats.average = total / Math.max(1, state.objects.length);
    state.dnaStats.diversity = estimateDiversity();
  }

  function estimateDiversity() {
    const count = state.objects.length;
    const length = state.targetGenome.length || 1;
    if (count < 2) return 0;

    let total = 0;
    const samples = Math.min(140, count);

    for (let s = 0; s < samples; s += 1) {
      const a = state.objects[Math.floor(Math.random() * count)].genome;
      const b = state.objects[Math.floor(Math.random() * count)].genome;
      let diff = 0;
      for (let i = 0; i < length; i += 1) {
        if (a[i] !== b[i]) diff += 1;
      }
      total += diff / length;
    }

    return total / samples;
  }

  function mutateGenome(genome, mutationRate) {
    return genome.map((base) => {
      if (Math.random() > mutationRate) return base;
      let next = choice(BASES);
      while (next === base) next = choice(BASES);
      return next;
    });
  }

  function crossover(a, b, recombinationRate) {
    if (Math.random() > recombinationRate) return a.slice();
    const cut = 1 + Math.floor(Math.random() * Math.max(1, a.length - 1));
    return a.slice(0, cut).concat(b.slice(cut));
  }

  function pickParent() {
    const pressure = n("selection") / 100;
    const tournament = 2 + Math.round(pressure * 7);
    let best = choice(state.objects);

    for (let i = 1; i < tournament; i += 1) {
      const candidate = choice(state.objects);
      if (candidate.fitness > best.fitness) best = candidate;
    }

    return best;
  }

  function evolveDNA(steps) {
    if (state.experiment !== "dna") return;

    const mutationRate = n("mutation") / 1000;
    const recombinationRate = n("recombination") / 100;
    const environmentRate = n("environment") / 1000;
    const population = n("population");

    for (let step = 0; step < steps; step += 1) {
      evaluateDNA();

      if (Math.random() < environmentRate) {
        const idx = Math.floor(Math.random() * state.targetGenome.length);
        let next = choice(BASES);
        while (next === state.targetGenome[idx]) next = choice(BASES);
        state.targetGenome[idx] = next;
      }

      const sorted = state.objects.slice().sort((a, b) => b.fitness - a.fitness);
      const eliteCount = Math.max(2, Math.round(population * 0.035));

      const nextPopulation = sorted.slice(0, eliteCount).map((o, i) => ({
        i,
        genome: o.genome.slice(),
        fitness: o.fitness,
        age: o.age + 1
      }));

      while (nextPopulation.length < population) {
        const p1 = pickParent();
        const p2 = pickParent();
        nextPopulation.push({
          i: nextPopulation.length,
          genome: mutateGenome(crossover(p1.genome, p2.genome, recombinationRate), mutationRate),
          fitness: 0,
          age: 0
        });
      }

      state.objects = nextPopulation;
      state.generation += 1;
    }

    evaluateDNA();
  }

  function clearTrails() {
    state.trails = [];
  }

  function kickSystem() {
    if (state.experiment === "phase") {
      state.objects.forEach((o) => { o.phase = Math.random() * TAU; });
    } else if (state.experiment === "dna") {
      state.targetGenome = randomGenome(n("genomeLength"));
      state.objects.forEach((o) => { o.genome = mutateGenome(o.genome, 0.25); });
      evaluateDNA();
    } else {
      state.time = 0;
      buildObjects();
    }

    clearTrails();
    draw();
  }

  function updateText() {
    const ex = experiments[state.experiment];

    ui.experimentReadout.textContent = ex.title;
    ui.timeReadout.textContent = `${state.time.toFixed(2)} s`;
    ui.noteTitle.textContent = `${ex.title} principle`;
    ui.noteBody.textContent = ex.note;
    ui.seeingBody.textContent = ex.seeing;

    if (state.experiment === "pendulum") {
      ui.systemReadout.textContent = `${n("count")} pendulums`;
      ui.orderReadout.textContent = `cycle ${n("cycle")} s`;
    } else if (state.experiment === "spring") {
      const maxK = n("baseK") + (n("count") - 1) * n("stepK");
      ui.systemReadout.textContent = `${n("count")} oscillators`;
      ui.orderReadout.textContent = `k ${n("baseK").toFixed(1)} to ${maxK.toFixed(1)}`;
    } else if (state.experiment === "phase") {
      ui.systemReadout.textContent = `${n("count")} phases`;
      ui.orderReadout.textContent = `order ${phaseOrder().toFixed(2)}`;
    } else if (state.experiment === "dna") {
      ui.systemReadout.textContent = `gen ${state.generation} · ${n("population")} genomes`;
      ui.orderReadout.textContent = `best ${(state.dnaStats.best * 100).toFixed(0)}% · avg ${(state.dnaStats.average * 100).toFixed(0)}%`;
    } else if (state.experiment === "fastlight") {
      ui.systemReadout.textContent = `peak ${(n("group") / 100).toFixed(2)}c · front ≤ c`;
      ui.orderReadout.textContent = "no superluminal energy";
    }
  }

  function canvasSize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  function clear(w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0b111a");
    bg.addColorStop(0.5, "#05080c");
    bg.addColorStop(1, "#020407");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    const spacing = Math.max(28, Math.min(w, h) / 14);
    for (let x = -spacing; x < w + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.16, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRail(w, y) {
    const left = w * 0.06;
    const right = w * 0.94;
    const rail = ctx.createLinearGradient(left, y, right, y);
    rail.addColorStop(0, "rgba(248,208,106,0.55)");
    rail.addColorStop(0.5, "rgba(255,255,255,0.42)");
    rail.addColorStop(1, "rgba(103,232,249,0.45)");

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = rail;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();
  }

  function glowCircle(x, y, r, colour) {
    if (ui.glowToggle.checked) {
      const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3.2);
      g.addColorStop(0, "rgba(255,255,255,0.92)");
      g.addColorStop(0.36, colour);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function drawTrails(points) {
    if (!ui.trailToggle.checked) return;

    state.trails.push(points);
    if (state.trails.length > 62) state.trails.shift();

    ctx.save();
    state.trails.forEach((frame, frameIndex) => {
      const alpha = frameIndex / state.trails.length * 0.20;
      frame.forEach((p) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r || 2.2, 0, TAU);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawPendulums(w, h) {
    const railY = Math.max(46, h * 0.1);
    const count = state.objects.length;
    const left = w * 0.08;
    const right = w * 0.92;
    const lengths = state.objects.map((p) => p.lengthMetres);
    const minL = Math.min(...lengths);
    const maxL = Math.max(...lengths);
    const rangeL = Math.max(0.0001, maxL - minL);
    const minPx = h * 0.30;
    const maxPx = h * 0.70;
    const angle = n("angle") * Math.PI / 180;
    const damping = n("damping") / 1000;
    const points = [];

    drawRail(w, railY);

    state.objects.forEach((p, i) => {
      const f = count === 1 ? 0.5 : i / (count - 1);
      const pivotX = left + f * (right - left);
      const lengthPx = minPx + ((p.lengthMetres - minL) / rangeL) * (maxPx - minPx);
      const theta = angle * Math.exp((-damping * state.time) / Math.sqrt(p.visualMass)) * Math.cos(p.omega * state.time);
      const bobX = pivotX + Math.sin(theta) * lengthPx * 0.74;
      const bobY = railY + Math.cos(theta) * lengthPx;
      const radius = 6.5 + p.visualMass * 2.7;

      points.push({ x: bobX, y: bobY, colour: p.colour, r: 1.8 });

      ctx.strokeStyle = "rgba(238,245,255,0.46)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(pivotX, railY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.beginPath();
      ctx.arc(pivotX, railY, 2.8, 0, TAU);
      ctx.fill();

      glowCircle(bobX, bobY, radius, p.colour);
    });

    drawTrails(points);
  }

  function drawSpring(x, y0, y1) {
    const coils = 8;
    const steps = coils * 2;
    const head = 10;
    const tail = 10;
    const usable = Math.max(5, y1 - y0 - head - tail);
    const stepY = usable / steps;

    ctx.save();
    ctx.strokeStyle = "rgba(238,245,255,0.76)";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + head);

    for (let i = 0; i <= steps; i += 1) {
      const y = y0 + head + i * stepY;
      const dx = i === steps ? 0 : (i % 2 === 0 ? -7 : 7);
      ctx.lineTo(x + dx, y);
    }

    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.restore();
  }

  function drawSprings(w, h) {
    const railY = Math.max(54, h * 0.12);
    const count = state.objects.length;
    const left = w * 0.06;
    const right = w * 0.94;
    const baseY = h * 0.52;
    const spacing = count > 1 ? (right - left) / (count - 1) : 0;
    const amplitude = n("amplitude");
    const damping = n("damping") / 1000;
    const points = [];

    drawRail(w, railY);

    state.objects.forEach((osc, i) => {
      const x = count === 1 ? w / 2 : left + i * spacing;
      const displacement = amplitude * Math.exp(-damping * state.time) * Math.cos(osc.omega * state.time);
      const y = baseY + displacement;
      const blockW = Math.min(24, Math.max(8, spacing * 0.52 || 18));
      const blockH = Math.max(12, blockW * 0.7);

      points.push({ x, y: y + blockH / 2, colour: osc.colour, r: 1.8 });
      drawSpring(x, railY, y);

      ctx.fillStyle = osc.colour;
      ctx.fillRect(x - blockW / 2, y, blockW, blockH);
    });

    drawTrails(points);
  }

  function updatePhaseField(dt) {
    const count = state.objects.length;
    const coupling = n("coupling") / 100;
    const radius = n("radius");
    const topology = state.params.topology;

    const next = state.objects.map((o, i) => {
      let pull = 0;
      let neighbours = 0;

      if (topology === "ring") {
        for (let offset = -radius; offset <= radius; offset += 1) {
          if (offset === 0) continue;
          const j = (i + offset + count) % count;
          pull += Math.sin(state.objects[j].phase - o.phase);
          neighbours += 1;
        }
      } else {
        state.objects.forEach((other, j) => {
          if (i === j) return;
          const dx = other.x - o.x;
          const dy = other.y - o.y;
          const d2 = dx * dx + dy * dy;
          const threshold = topology === "lattice" ? 0.16 : 0.25;
          if (d2 < threshold * (radius / 4)) {
            pull += Math.sin(other.phase - o.phase);
            neighbours += 1;
          }
        });
      }

      const localPull = neighbours > 0 ? pull / neighbours : 0;
      return o.phase + dt * (o.natural + coupling * localPull * 2.4);
    });

    next.forEach((phase, i) => {
      state.objects[i].phase = ((phase % TAU) + TAU) % TAU;
    });
  }

  function phaseOrder() {
    if (state.experiment !== "phase" || state.objects.length === 0) return 0;
    let sx = 0;
    let sy = 0;
    state.objects.forEach((o) => {
      sx += Math.cos(o.phase);
      sy += Math.sin(o.phase);
    });
    return Math.sqrt(sx * sx + sy * sy) / state.objects.length;
  }

  function phaseColour(phase) {
    const t = ((phase % TAU) + TAU) / TAU;
    return `hsl(${Math.round(185 + t * 255)}, 92%, 64%)`;
  }

  function drawPhaseField(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.38;
    const points = [];
    const order = phaseOrder();

    state.objects.forEach((o) => {
      const x = cx + o.x * scale;
      const y = cy + o.y * scale;
      const colour = phaseColour(o.phase);
      const r = 2.6 + order * 4.5;
      points.push({ x, y, colour, r: 1.7 });

      const arm = 6 + order * 12;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(o.phase) * arm, y + Math.sin(o.phase) * arm);
      ctx.stroke();

      glowCircle(x, y, r, colour);
    });

    drawTrails(points);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, scale + 20, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(238,244,255,0.78)";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`global order: ${order.toFixed(2)}`, cx, cy + scale + 46);
    ctx.restore();
  }

  function baseColour(base) {
    if (base === "A") return "#67e8f9";
    if (base === "C") return "#a3e635";
    if (base === "G") return "#f8d06a";
    return "#f472b6";
  }

  function fitnessColour(fitness) {
    const hue = 205 - fitness * 135;
    const light = 42 + fitness * 22;
    return `hsl(${hue}, 88%, ${light}%)`;
  }

  function drawGenomeStrip(genome, x, y, width, height) {
    const step = width / genome.length;
    genome.forEach((base, i) => {
      ctx.fillStyle = baseColour(base);
      ctx.fillRect(x + i * step, y, Math.max(1, step - 1), height);
    });
  }

  function drawDNA(w, h) {
    const pad = Math.max(20, w * 0.035);
    const top = Math.max(58, h * 0.12);
    const gridTop = top + 58;
    const cols = Math.ceil(Math.sqrt(state.objects.length * (w / Math.max(1, h))));
    const rows = Math.ceil(state.objects.length / cols);
    const cellW = (w - pad * 2) / cols;
    const cellH = (h - gridTop - 34) / rows;
    const r = Math.max(1.7, Math.min(cellW, cellH) * 0.34);
    const points = [];

    ctx.fillStyle = "rgba(238,244,255,0.84)";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`target DNA · ${state.targetGenome.join("")}`, pad, 20);
    drawGenomeStrip(state.targetGenome, pad, 34, Math.min(w - pad * 2, 520), 14);

    const best = state.objects.reduce((a, b) => (a.fitness > b.fitness ? a : b), state.objects[0]);

    ctx.fillStyle = "rgba(169,184,204,0.95)";
    ctx.fillText(
      `generation ${state.generation} · best ${(state.dnaStats.best * 100).toFixed(0)}% · average ${(state.dnaStats.average * 100).toFixed(0)}% · diversity ${(state.dnaStats.diversity * 100).toFixed(0)}%`,
      pad,
      top + 20
    );

    if (best) drawGenomeStrip(best.genome, pad, top + 32, Math.min(w - pad * 2, 520), 12);

    state.objects.forEach((o, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + cellW * col + cellW / 2;
      const y = gridTop + cellH * row + cellH / 2;
      const colour = fitnessColour(o.fitness);
      points.push({ x, y, colour, r: 1.3 });

      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    });

    drawTrails(points);
  }

  function drawFastLight(w, h) {
    const pad = Math.max(28, w * 0.04);
    const top = Math.max(34, h * 0.07);
    const diagramH = h * 0.44;
    const diagramBottom = top + diagramH;
    const x0 = pad;
    const x1 = w - pad;
    const vg = n("group") / 100;
    const progress = (state.time * 0.13) % 1;
    const frontProgress = progress;
    const peakProgress = Math.min(1, progress * vg);
    const frontX = x0 + (x1 - x0) * frontProgress;
    const peakX = x0 + (x1 - x0) * peakProgress;
    const timeY = top + diagramH * progress;
    const groupArrivalY = top + diagramH / Math.max(1, vg);
    const reshaping = n("reshaping") / 100;
    const absorption = n("absorption") / 100;
    const pulseWidth = n("width");

    const mediumA = x0 + (x1 - x0) * 0.38;
    const mediumB = x0 + (x1 - x0) * 0.76;
    ctx.fillStyle = "rgba(103,232,249,0.08)";
    ctx.fillRect(mediumA, top, mediumB - mediumA, diagramH);

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, diagramBottom);
    ctx.lineTo(x1, diagramBottom);
    ctx.stroke();

    ctx.fillStyle = "rgba(244,114,182,0.075)";
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, groupArrivalY);
    ctx.lineTo(x1, diagramBottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(248,208,106,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, diagramBottom);
    ctx.stroke();

    ctx.strokeStyle = "rgba(103,232,249,0.95)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, groupArrivalY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, timeY);
    ctx.lineTo(x1, timeY);
    ctx.stroke();

    glowCircle(frontX, timeY, 7, "#f8d06a");
    glowCircle(peakX, timeY, 7, "#67e8f9");

    ctx.fillStyle = "rgba(248,208,106,0.92)";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("causal front / energy ≤ c", Math.min(frontX + 10, x1 - 160), timeY - 12);

    ctx.fillStyle = "rgba(103,232,249,0.92)";
    ctx.textAlign = "right";
    ctx.fillText(`apparent peak vg = ${vg.toFixed(2)}c`, Math.max(peakX - 10, x0 + 190), timeY + 20);

    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(x0, diagramBottom + 12, x1 - x0, 38);
    ctx.fillStyle = "rgba(238,244,255,0.84)";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No new information, causal front, or energy transport crosses faster than c.", w / 2, diagramBottom + 36);

    const trackY = diagramBottom + 106;
    const amp = Math.max(42, h * 0.08);
    const sigma = pulseWidth / (x1 - x0);
    const points = [];

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, trackY);
    ctx.lineTo(x1, trackY);
    ctx.stroke();

    ctx.beginPath();
    state.objects.forEach((sample, i) => {
      const xNorm = sample.x;
      const x = x0 + (x1 - x0) * xNorm;
      const leadingTail = Math.exp(-Math.pow((xNorm - peakProgress) / Math.max(0.025, sigma), 2) / 2);
      const causalGate = 1 / (1 + Math.exp((xNorm - frontProgress) * 55));
      const carrier = Math.sin((xNorm - peakProgress) * 95 - state.time * 7);
      const mediumLoss = 1 - absorption * 0.55;
      const reshaped = leadingTail * (0.25 + 0.75 * reshaping) * mediumLoss;
      const y = trackY - reshaped * carrier * amp * causalGate;
      points.push({ x, y, colour: "#67e8f9", r: 1.5 });
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "rgba(103,232,249,0.95)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    drawTrails(points);

    ctx.fillStyle = "rgba(169,184,204,0.92)";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("reshaped pulse envelope", x0, trackY + amp + 26);
    ctx.textAlign = "right";
    ctx.fillText("cyan peak can move faster than c; gold front cannot", x1, trackY + amp + 26);
  }

  function draw() {
    const { w, h, dpr } = canvasSize();
    clear(w, h);

    if (state.experiment === "pendulum") drawPendulums(w, h);
    if (state.experiment === "spring") drawSprings(w, h);
    if (state.experiment === "phase") drawPhaseField(w, h);
    if (state.experiment === "dna") drawDNA(w, h);
    if (state.experiment === "fastlight") drawFastLight(w, h);

    updateText();

    ui.statusLine.textContent = state.running ? "Running" : "Paused";
    ui.debugText.textContent = [
      `experiment: ${state.experiment}`,
      `objects: ${state.objects.length}`,
      `time: ${state.time.toFixed(3)} s`,
      `generation: ${state.generation}`,
      `order: ${phaseOrder().toFixed(3)}`,
      `bestFitness: ${state.dnaStats.best.toFixed(3)}`,
      `averageFitness: ${state.dnaStats.average.toFixed(3)}`,
      `diversity: ${state.dnaStats.diversity.toFixed(3)}`,
      `canvas: ${w} × ${h}`,
      `dpr: ${dpr}`
    ].join("\n");
  }

  function frame(now) {
    const rawDt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    if (state.running) {
      const dt = rawDt * (n("speed") / 100) * (ui.slowToggle.checked ? 0.25 : 1);
      state.time += dt;

      if (state.experiment === "phase") updatePhaseField(dt);
      if (state.experiment === "dna") evolveDNA(Math.max(1, Math.floor(dt * 11)));
    }

    draw();
    requestAnimationFrame(frame);
  }

  ui.cards.forEach((card) => {
    card.addEventListener("click", () => switchExperiment(card.dataset.experiment));
  });

  ui.playPause.addEventListener("click", () => {
    state.running = !state.running;
    ui.playPause.textContent = state.running ? "Pause" : "Play";
  });

  ui.reset.addEventListener("click", () => switchExperiment(state.experiment));
  ui.kick.addEventListener("click", kickSystem);

  [ui.trailToggle, ui.glowToggle, ui.labelToggle, ui.slowToggle].forEach((input) => {
    input.addEventListener("change", () => {
      clearTrails();
      draw();
    });
  });

  window.addEventListener("resize", () => {
    clearTrails();
    draw();
  }, { passive: true });

  switchExperiment("pendulum");
  requestAnimationFrame(frame);
})();
