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
    lastFrame: performance.now(),
    params: {},
    objects: [],
    trails: []
  };

  const experiments = {
    pendulum: {
      title: "Pendulum wave",
      noteTitle: "Pendulum wave principle",
      noteBody:
        "The pendulum wave uses calibrated lengths. Each pendulum completes a different integer number of oscillations within the same cycle window, so the array repeatedly slips out of phase and re-aligns.",
      correction:
        "In an ideal simple pendulum, the period is controlled mainly by length, not bob mass: T ≈ 2π√(L/g).",
      defaults: {
        count: 18,
        baseSwings: 51,
        cycle: 60,
        angle: 16,
        damping: 3,
        speed: 100
      },
      controls: [
        ["count", "Number of pendulums", 6, 40, 18, 1, ""],
        ["baseSwings", "Slowest swings per cycle", 20, 90, 51, 1, ""],
        ["cycle", "Cycle window", 20, 120, 60, 1, " s"],
        ["angle", "Release angle", 2, 28, 16, 1, "°"],
        ["damping", "Damping", 0, 40, 3, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    },

    spring: {
      title: "Spring–mass array",
      noteTitle: "Spring–mass oscillator principle",
      noteBody:
        "The spring–mass array uses vertical oscillators. Each hanging mass has a different spring constant, so the masses move up and down at different frequencies.",
      correction:
        "For a spring–mass oscillator, angular frequency is ω = √(k/m). Stronger springs oscillate faster; heavier masses oscillate more slowly.",
      defaults: {
        count: 18,
        baseK: 8,
        stepK: 0.6,
        mass: 1.4,
        amplitude: 34,
        damping: 10,
        speed: 100
      },
      controls: [
        ["count", "Number of oscillators", 4, 32, 18, 1, ""],
        ["baseK", "Base spring constant", 2, 20, 8, 0.5, ""],
        ["stepK", "Spring increment", 0.1, 2, 0.6, 0.1, ""],
        ["mass", "Mass", 0.5, 4, 1.4, 0.1, ""],
        ["amplitude", "Initial displacement", 8, 80, 34, 1, " px"],
        ["damping", "Damping", 0, 120, 10, 1, ""],
        ["speed", "Speed", 10, 300, 100, 5, ""]
      ]
    }
  };

  function fail(message) {
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 500;
    ctx.fillStyle = "#12070a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fecdd3";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Simulation error:", 24, 38);
    ctx.fillText(String(message), 24, 66);
    console.error(message);
  }

  function getNumber(key) {
    return Number(state.params[key]);
  }

  function formatValue(key, value, unit) {
    if (key === "speed") return `${(Number(value) / 100).toFixed(2)}×`;
    if (key === "damping") return (Number(value) / 1000).toFixed(3);
    if (!Number.isInteger(Number(value))) return `${Number(value).toFixed(1)}${unit}`;
    return `${value}${unit}`;
  }

  function setDefaults() {
    state.params = { ...experiments[state.experiment].defaults };
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
        draw();
      });

      card.appendChild(title);
      card.appendChild(input);
      card.appendChild(output);
      ui.controls.appendChild(card);
    });
  }

  function buildObjects() {
    if (state.experiment === "pendulum") {
      const count = getNumber("count");
      const baseSwings = getNumber("baseSwings");
      const cycle = getNumber("cycle");

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
          visualMass: 1 + (i % 5) * 0.25,
          colour: colours[i % colours.length]
        };
      });
    }

    if (state.experiment === "spring") {
      const count = getNumber("count");
      const baseK = getNumber("baseK");
      const stepK = getNumber("stepK");
      const mass = getNumber("mass");

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
    if (!experiments[name]) return;

    state.experiment = name;
    state.time = 0;
    state.trails = [];

    setDefaults();
    renderControls();
    buildObjects();
    updateText();

    ui.tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.experiment === name);
    });

    draw();
  }

  function updateText() {
    const ex = experiments[state.experiment];

    ui.experimentReadout.textContent = ex.title;
    ui.timeReadout.textContent = `${state.time.toFixed(2)} s`;
    ui.noteTitle.textContent = ex.noteTitle;
    ui.noteBody.textContent = ex.noteBody;
    ui.correctionBody.textContent = ex.correction;

    if (state.experiment === "pendulum") {
      ui.systemReadout.textContent = `${getNumber("count")} pendulums`;
      ui.parameterReadout.textContent = `cycle ${getNumber("cycle")} s`;
    }

    if (state.experiment === "spring") {
      const maxK = getNumber("baseK") + (getNumber("count") - 1) * getNumber("stepK");
      ui.systemReadout.textContent = `${getNumber("count")} oscillators`;
      ui.parameterReadout.textContent = `k ${getNumber("baseK").toFixed(1)} → ${maxK.toFixed(1)}`;
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { w: cssW, h: cssH };
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

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    for (let x = left; x <= right; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPendulums(w, h) {
    const railY = Math.max(46, h * 0.1);
    const n = state.objects.length;
    const left = w * 0.1;
    const right = w * 0.9;
    const lengths = state.objects.map((p) => p.lengthMetres);
    const minL = Math.min(...lengths);
    const maxL = Math.max(...lengths);
    const rangeL = Math.max(0.0001, maxL - minL);
    const minPx = h * 0.34;
    const maxPx = h * 0.7;
    const angle = getNumber("angle") * Math.PI / 180;
    const damping = getNumber("damping") / 1000;

    drawRail(w, railY);

    const currentTrail = [];

    state.objects.forEach((p, i) => {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const pivotX = left + f * (right - left);
      const lengthPx = minPx + ((p.lengthMetres - minL) / rangeL) * (maxPx - minPx);
      const theta = angle * Math.exp((-damping * state.time) / Math.sqrt(p.visualMass)) * Math.cos(p.omega * state.time);
      const bobX = pivotX + Math.sin(theta) * lengthPx * 0.74;
      const bobY = railY + Math.cos(theta) * lengthPx;
      const radius = 8 + p.visualMass * 3;

      currentTrail.push({ x: bobX, y: bobY, colour: p.colour });

      ctx.strokeStyle = "rgba(238,245,255,0.54)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(pivotX, railY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.beginPath();
      ctx.arc(pivotX, railY, 3.4, 0, TAU);
      ctx.fill();

      const glow = ctx.createRadialGradient(bobX, bobY, 1, bobX, bobY, radius * 3);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.38, p.colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bobX, bobY, radius * 3, 0, TAU);
      ctx.fill();

      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(bobX, bobY, radius, 0, TAU);
      ctx.fill();

      if (n <= 24) {
        ctx.fillStyle = "rgba(238,244,255,0.62)";
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(p.swings), pivotX, railY + 22);
      }
    });

    drawTrails(currentTrail);
  }

  function drawSpring(x, y0, y1) {
    const coils = 8;
    const steps = coils * 2;
    const head = 10;
    const tail = 10;
    const usable = Math.max(5, y1 - y0 - head - tail);
    const stepY = usable / steps;

    ctx.save();
    ctx.strokeStyle = "rgba(238,245,255,0.78)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
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
    ctx.restore();
  }

  function drawSprings(w, h) {
    const railY = Math.max(54, h * 0.12);
    const n = state.objects.length;
    const left = w * 0.08;
    const right = w * 0.92;
    const baseY = h * 0.52;
    const spacing = n > 1 ? (right - left) / (n - 1) : 0;
    const amplitude = getNumber("amplitude");
    const damping = getNumber("damping") / 1000;

    drawRail(w, railY);

    const currentTrail = [];

    state.objects.forEach((osc, i) => {
      const x = n === 1 ? w / 2 : left + i * spacing;
      const displacement = amplitude * Math.exp(-damping * state.time) * Math.cos(osc.omega * state.time);
      const y = baseY + displacement;
      const blockW = Math.min(40, Math.max(16, spacing * 0.55 || 28));
      const blockH = Math.max(18, blockW * 0.66);

      currentTrail.push({ x, y: y + blockH / 2, colour: osc.colour });

      drawSpring(x, railY, y);

      ctx.fillStyle = osc.colour;
      ctx.fillRect(x - blockW / 2, y, blockW, blockH);

      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.beginPath();
      ctx.arc(x, railY, 3, 0, TAU);
      ctx.fill();

      if (n <= 20) {
        ctx.fillStyle = "rgba(238,244,255,0.62)";
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`k=${osc.k.toFixed(1)}`, x, railY + 24);
      }
    });

    drawTrails(currentTrail);
  }

  function drawTrails(points) {
    state.trails.push(points);
    if (state.trails.length > 48) state.trails.shift();

    ctx.save();

    state.trails.forEach((frame, frameIndex) => {
      const alpha = frameIndex / state.trails.length * 0.18;

      frame.forEach((p) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, TAU);
        ctx.fill();
      });
    });

    ctx.restore();
  }

  function draw() {
    const { w, h } = resizeCanvas();

    clear(w, h);

    if (state.experiment === "pendulum") drawPendulums(w, h);
    if (state.experiment === "spring") drawSprings(w, h);

    updateText();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    if (state.running) {
      state.time += dt * (getNumber("speed") / 100);
    }

    draw();
    requestAnimationFrame(frame);
  }

  try {
    if (!canvas || !ctx) throw new Error("Canvas not found.");
    if (!ui.controls) throw new Error("Controls container not found.");

    ui.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchExperiment(tab.dataset.experiment));
    });

    ui.playPause.addEventListener("click", () => {
      state.running = !state.running;
      ui.playPause.textContent = state.running ? "Pause" : "Play";
    });

    ui.reset.addEventListener("click", () => {
      state.time = 0;
      state.trails = [];
      buildObjects();
      draw();
    });

    window.addEventListener("resize", () => {
      state.trails = [];
      draw();
    }, { passive: true });

    switchExperiment("pendulum");
    requestAnimationFrame(frame);
  } catch (error) {
    fail(error);
  }
})();
