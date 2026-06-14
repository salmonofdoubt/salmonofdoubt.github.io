(() => {
  "use strict";

  const G = 9.80665;
  const TAU = Math.PI * 2;
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const ui = {
    controls: document.getElementById("controls"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    playPause: document.getElementById("playPause"),
    reset: document.getElementById("reset"),
    experimentReadout: document.getElementById("experimentReadout"),
    timeReadout: document.getElementById("timeReadout"),
    systemReadout: document.getElementById("systemReadout"),
    parameterReadout: document.getElementById("parameterReadout"),
    noteTitle: document.getElementById("noteTitle"),
    noteBody: document.getElementById("noteBody"),
    correctionBody: document.getElementById("correctionBody")
  };

  const colours = [
    "#ff6b6b", "#ffa94d", "#ffd43b", "#94d82d", "#38d9a9",
    "#22d3ee", "#4dabf7", "#748ffc", "#b197fc", "#f783ac"
  ];

  const state = {
    experiment: "pendulum",
    running: true,
    time: 0,
    last: performance.now(),
    values: {},
    objects: []
  };

  const experiments = {
    pendulum: {
      title: "Pendulum wave",
      noteTitle: "Pendulum wave principle",
      noteBody: "Each pendulum has a calibrated length so it completes a different integer number of swings within the same cycle window. The array slips out of phase, forms wave-like braids, and partially re-aligns.",
      correction: "In an ideal simple pendulum, the period is controlled mainly by length, not bob mass: T ≈ 2π√(L/g).",
      controls: [
        ["count", "Number of pendulums", 6, 40, 18, 1, ""],
        ["baseSwings", "Slowest swings per cycle", 20, 90, 51, 1, ""],
        ["cycle", "Cycle window", 20, 120, 60, 1, " s"],
        ["angle", "Release angle", 2, 28, 16, 1, "°"],
        ["damping", "Damping", 0, 40, 3, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, "%"]
      ]
    },
    spring: {
      title: "Spring–mass array",
      noteTitle: "Spring–mass oscillator principle",
      noteBody: "Each hanging mass moves vertically on a spring. The angular frequency is ω = √(k/m), so stronger springs oscillate faster and heavier masses oscillate more slowly.",
      correction: "This is not a pendulum. The restoring force comes from spring extension. Different spring constants create the phase drift.",
      controls: [
        ["count", "Number of oscillators", 4, 32, 18, 1, ""],
        ["baseK", "Base spring constant", 2, 20, 8, 0.5, ""],
        ["stepK", "Spring increment", 0.1, 2, 0.6, 0.1, ""],
        ["mass", "Mass", 0.5, 4, 1.4, 0.1, ""],
        ["amplitude", "Initial displacement", 8, 80, 34, 1, " px"],
        ["damping", "Damping", 0, 120, 10, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, "%"]
      ]
    }
  };

  function setDefaults() {
    state.values = {};
    for (const c of experiments[state.experiment].controls) {
      state.values[c[0]] = c[4];
    }
  }

  function value(key) {
    return Number(state.values[key]);
  }

  function displayValue(key, raw, suffix) {
    if (key === "speed") return `${(Number(raw) / 100).toFixed(2)}×`;
    if (key === "damping") return (Number(raw) / 1000).toFixed(3);
    if (!Number.isInteger(Number(raw))) return `${Number(raw).toFixed(1)}${suffix}`;
    return `${raw}${suffix}`;
  }

  function renderControls() {
    ui.controls.innerHTML = "";

    for (const [key, label, min, max, start, step, suffix] of experiments[state.experiment].controls) {
      const card = document.createElement("label");
      card.className = "control";

      const text = document.createElement("span");
      text.textContent = label;

      const input = document.createElement("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = state.values[key] ?? start;

      const output = document.createElement("output");
      output.textContent = displayValue(key, input.value, suffix);

      input.addEventListener("input", () => {
        state.values[key] = Number(input.value);
        output.textContent = displayValue(key, input.value, suffix);
        buildObjects();
        updateText();
      });

      card.appendChild(text);
      card.appendChild(input);
      card.appendChild(output);
      ui.controls.appendChild(card);
    }
  }

  function buildObjects() {
    if (state.experiment === "pendulum") {
      const count = value("count");
      const baseSwings = value("baseSwings");
      const cycle = value("cycle");

      state.objects = Array.from({ length: count }, (_, i) => {
        const swings = baseSwings + i;
        const period = cycle / swings;
        const lengthMetres = G * Math.pow(period / TAU, 2);

        return {
          i,
          swings,
          period,
          lengthMetres,
          omega: TAU / period,
          massVisual: 1 + (i % 5) * 0.25,
          colour: colours[i % colours.length]
        };
      });
    } else {
      const count = value("count");
      const baseK = value("baseK");
      const stepK = value("stepK");
      const mass = value("mass");

      state.objects = Array.from({ length: count }, (_, i) => {
        const k = baseK + i * stepK;
        return {
          i,
          k,
          omega: Math.sqrt(k / mass),
          colour: colours[i % colours.length]
        };
      });
    }
  }

  function switchExperiment(name) {
    state.experiment = name;
    state.time = 0;
    setDefaults();
    renderControls();
    buildObjects();
    updateText();

    ui.tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.experiment === name);
    });
  }

  function updateText() {
    const ex = experiments[state.experiment];

    ui.experimentReadout.textContent = ex.title;
    ui.timeReadout.textContent = `${state.time.toFixed(2)} s`;
    ui.noteTitle.textContent = ex.noteTitle;
    ui.noteBody.textContent = ex.noteBody;
    ui.correctionBody.textContent = ex.correction;

    if (state.experiment === "pendulum") {
      ui.systemReadout.textContent = `${value("count")} pendulums`;
      ui.parameterReadout.textContent = `cycle ${value("cycle")} s`;
    } else {
      const maxK = value("baseK") + (value("count") - 1) * value("stepK");
      ui.systemReadout.textContent = `${value("count")} oscillators`;
      ui.parameterReadout.textContent = `k ${value("baseK").toFixed(1)} → ${maxK.toFixed(1)}`;
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear(w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a1018");
    bg.addColorStop(0.5, "#05080c");
    bg.addColorStop(1, "#020407");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawRail(w, y) {
    const left = w * 0.06;
    const right = w * 0.94;

    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(180,220,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    for (let x = left; x <= right; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }
  }

  function drawPendulums(w, h) {
    const railY = Math.max(45, h * 0.1);
    const n = state.objects.length;
    const left = w * 0.1;
    const right = w * 0.9;
    const lengths = state.objects.map((p) => p.lengthMetres);
    const minL = Math.min(...lengths);
    const maxL = Math.max(...lengths);
    const range = Math.max(0.0001, maxL - minL);
    const minPx = h * 0.34;
    const maxPx = h * 0.7;
    const angle0 = value("angle") * Math.PI / 180;
    const damping = value("damping") / 1000;

    drawRail(w, railY);

    for (let i = 0; i < n; i++) {
      const p = state.objects[i];
      const f = n === 1 ? 0.5 : i / (n - 1);
      const pivotX = left + f * (right - left);
      const lengthPx = minPx + ((p.lengthMetres - minL) / range) * (maxPx - minPx);
      const theta = angle0 * Math.exp((-damping * state.time) / Math.sqrt(p.massVisual)) * Math.cos(p.omega * state.time);
      const bobX = pivotX + Math.sin(theta) * lengthPx * 0.72;
      const bobY = railY + Math.cos(theta) * lengthPx;
      const radius = 8 + p.massVisual * 3;

      ctx.strokeStyle = "rgba(238,245,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pivotX, railY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(pivotX, railY, 3, 0, TAU);
      ctx.fill();

      const glow = ctx.createRadialGradient(bobX, bobY, 1, bobX, bobY, radius * 3);
      glow.addColorStop(0, "rgba(255,255,255,0.9)");
      glow.addColorStop(0.35, p.colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bobX, bobY, radius * 3, 0, TAU);
      ctx.fill();

      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(bobX, bobY, radius, 0, TAU);
      ctx.fill();
    }
  }

  function drawSpring(x, y0, y1) {
    const coils = 8;
    const steps = coils * 2;
    const head = 10;
    const tail = 10;
    const usable = Math.max(5, y1 - y0 - head - tail);
    const stepY = usable / steps;

    ctx.strokeStyle = "rgba(238,245,255,0.75)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + head);

    for (let i = 0; i <= steps; i++) {
      const y = y0 + head + i * stepY;
      const dx = i === steps ? 0 : (i % 2 === 0 ? -8 : 8);
      ctx.lineTo(x + dx, y);
    }

    ctx.lineTo(x, y1);
    ctx.stroke();
  }

  function drawSprings(w, h) {
    const railY = Math.max(55, h * 0.12);
    const n = state.objects.length;
    const left = w * 0.08;
    const right = w * 0.92;
    const baseY = h * 0.52;
    const spacing = n > 1 ? (right - left) / (n - 1) : 0;
    const amplitude = value("amplitude");
    const damping = value("damping") / 1000;

    drawRail(w, railY);

    for (let i = 0; i < n; i++) {
      const osc = state.objects[i];
      const x = n === 1 ? w / 2 : left + i * spacing;
      const displacement = amplitude * Math.exp(-damping * state.time) * Math.cos(osc.omega * state.time);
      const y = baseY + displacement;
      const blockW = Math.min(40, Math.max(18, spacing * 0.55 || 28));
      const blockH = Math.max(18, blockW * 0.65);

      drawSpring(x, railY, y);

      ctx.fillStyle = osc.colour;
      ctx.fillRect(x - blockW / 2, y, blockW, blockH);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, railY, 3, 0, TAU);
      ctx.fill();
    }
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    clear(w, h);

    if (state.experiment === "pendulum") drawPendulums(w, h);
    if (state.experiment === "spring") drawSprings(w, h);

    updateText();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    if (state.running) {
      state.time += dt * (value("speed") / 100);
    }

    draw();
    requestAnimationFrame(frame);
  }

  ui.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchExperiment(tab.dataset.experiment));
  });

  ui.playPause.addEventListener("click", () => {
    state.running = !state.running;
    ui.playPause.textContent = state.running ? "Pause" : "Play";
  });

  ui.reset.addEventListener("click", () => {
    state.time = 0;
    buildObjects();
    updateText();
  });

  window.addEventListener("resize", () => {
    resize();
    draw();
  }, { passive: true });

  resize();
  switchExperiment("pendulum");
  requestAnimationFrame(frame);
})();
