(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hypot = Math.hypot;
  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatPct(v) { return `${Math.round(clamp(v, 0, 1) * 100)}%`; }
  function fmt(v, digits = 3) {
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) > 0 && Math.abs(v) < 0.001) return v.toExponential(2);
    return v.toFixed(digits);
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(260, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  // ---------- tabs ----------
  const tabs = [...document.querySelectorAll(".lab-tab")];
  const panels = [...document.querySelectorAll(".lab-panel")];
  let activeTab = "order";

  function activateTab(name) {
    activeTab = name;
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    requestAnimationFrame(() => resizeAllVisible());
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

  // ---------- boids ----------
  class BoidLab {
    constructor(canvas, kind) {
      this.canvas = canvas;
      this.kind = kind;
      this.ctx = canvas.getContext("2d");
      this.w = 800;
      this.h = 500;
      this.seed = kind === "order" ? 8675309 : 424242;
      this.rand = mulberry32(this.seed);
      this.boids = [];
      this.running = true;
      this.params = {};
      this.trails = kind === "complexity";
      this.predator = null;
      this.disturbanceUntil = 0;
      this.metricsClock = 0;
      this.lastMetrics = null;
      this.lastDisturbance = null;
      this.applyPreset(kind === "order" ? "order" : "emergent", true);
    }

    resize() {
      const { ctx, w, h } = fitCanvas(this.canvas);
      const oldW = this.w || w, oldH = this.h || h;
      this.ctx = ctx;
      this.w = w; this.h = h;
      if (this.boids.length && oldW && oldH && (oldW !== w || oldH !== h)) {
        for (const b of this.boids) {
          b.x = b.x / oldW * w;
          b.y = b.y / oldH * h;
          b.trail = [];
        }
      }
    }

    applyPreset(name, reseed = false) {
      const presets = {
        order: { sep: 1.15, ali: 1.75, coh: 0.95, noise: 0.025, perception: 86, speed: 2.25, force: 0.055, count: 85 },
        emergent: { sep: 1.35, ali: 1.05, coh: 0.92, noise: 0.085, perception: 72, speed: 2.45, force: 0.065, count: 110 },
        split: { sep: 1.6, ali: 0.82, coh: 1.18, noise: 0.105, perception: 58, speed: 2.55, force: 0.072, count: 118 },
        edge: { sep: 1.25, ali: 0.62, coh: 0.72, noise: 0.21, perception: 52, speed: 2.7, force: 0.082, count: 120 }
      };
      this.presetName = name;
      this.params = { ...presets[name] };
      if (reseed || !this.boids.length || this.boids.length !== this.params.count) this.newFlock();
      this.syncControls();
      this.updateInterpretation();
    }

    newFlock() {
      this.seed = (this.seed + 2654435761) >>> 0;
      this.rand = mulberry32(this.seed);
      this.boids = [];
      const cx = this.w * 0.5, cy = this.h * 0.5;
      for (let i = 0; i < (this.params.count || 90); i++) {
        const angle = this.rand() * TAU;
        const radius = (0.08 + this.rand() * 0.28) * Math.min(this.w, this.h);
        const heading = this.kind === "order" ? (this.rand() - 0.5) * 0.65 : this.rand() * TAU;
        this.boids.push({
          x: (cx + Math.cos(angle) * radius + this.w) % this.w,
          y: (cy + Math.sin(angle) * radius + this.h) % this.h,
          vx: Math.cos(heading) * this.params.speed,
          vy: Math.sin(heading) * this.params.speed,
          trail: []
        });
      }
      this.lastDisturbance = null;
    }

    syncControls() {
      const prefix = this.kind === "order" ? "order" : "complexity";
      const map = [
        ["Sep", "sep", 2], ["Ali", "ali", 2], ["Coh", "coh", 2], ["Noise", "noise", 2], ["Perception", "perception", 0]
      ];
      for (const [idSuffix, key, digits] of map) {
        const input = $(`${prefix}${idSuffix}`);
        const out = $(`${prefix}${idSuffix}Out`);
        if (input) input.value = this.params[key];
        if (out) out.value = Number(this.params[key]).toFixed(digits);
      }
      const state = $(`${prefix}StateLabel`);
      if (state) state.textContent = this.kind === "order" ? "coherent regime" : `${this.presetName.replace("-", " ")} regime`;
    }

    bindControls() {
      const prefix = this.kind === "order" ? "order" : "complexity";
      const map = [["Sep","sep",2],["Ali","ali",2],["Coh","coh",2],["Noise","noise",2],["Perception","perception",0]];
      for (const [idSuffix, key, digits] of map) {
        const input = $(`${prefix}${idSuffix}`);
        const out = $(`${prefix}${idSuffix}Out`);
        input.addEventListener("input", () => {
          this.params[key] = Number(input.value);
          out.value = Number(input.value).toFixed(digits);
          this.presetName = "custom";
          this.updateInterpretation();
        });
      }
    }

    toggle() {
      this.running = !this.running;
      const btn = $(`${this.kind === "order" ? "order" : "complexity"}Toggle`);
      btn.textContent = this.running ? "Pause" : "Play";
      const runLabel = $(this.kind === "order" ? "orderRunLabel" : "complexityRunLabel");
      if (runLabel) runLabel.textContent = this.running ? "running" : "paused";
    }

    gust() {
      const theta = this.rand() * TAU;
      const gx = Math.cos(theta) * 4.8, gy = Math.sin(theta) * 4.8;
      for (const b of this.boids) {
        b.vx += gx + (this.rand() - 0.5) * 3.2;
        b.vy += gy + (this.rand() - 0.5) * 3.2;
      }
      this.lastDisturbance = { type: "gust", at: performance.now(), before: this.computeMetrics() };
      this.updateInterpretation("A gust has displaced headings. Watch whether alignment recovers under the unchanged local rules.");
    }

    scatter() {
      for (const b of this.boids) {
        const a = this.rand() * TAU;
        const impulse = 3 + this.rand() * 4;
        b.vx += Math.cos(a) * impulse;
        b.vy += Math.sin(a) * impulse;
        b.x = this.rand() * this.w;
        b.y = this.rand() * this.h;
        b.trail = [];
      }
      this.lastDisturbance = { type: "scatter", at: performance.now(), before: this.computeMetrics() };
      this.updateInterpretation("The flock was scattered without changing the rules. Any re-formation is emergent, not centrally commanded.");
    }

    predatorPulse() {
      const fromLeft = this.rand() > 0.5;
      this.predator = {
        x: fromLeft ? -30 : this.w + 30,
        y: this.h * (0.25 + this.rand() * 0.5),
        vx: fromLeft ? 4.5 : -4.5,
        until: performance.now() + 4200
      };
      this.lastDisturbance = { type: "predator", at: performance.now(), before: this.computeMetrics() };
      this.updateInterpretation("A moving disturbance has entered the flock. Splitting, evasion and re-aggregation are consequences of local responses.");
    }

    wrappedDelta(a, b, span) {
      let d = b - a;
      if (d > span / 2) d -= span;
      if (d < -span / 2) d += span;
      return d;
    }

    steerToward(dx, dy, desiredSpeed, vx, vy, maxForce) {
      const mag = hypot(dx, dy);
      if (mag < 1e-9) return [0, 0];
      const tx = dx / mag * desiredSpeed - vx;
      const ty = dy / mag * desiredSpeed - vy;
      const tm = hypot(tx, ty);
      if (tm <= maxForce || tm < 1e-9) return [tx, ty];
      return [tx / tm * maxForce, ty / tm * maxForce];
    }

    update(dt) {
      if (!this.running) return;
      const p = this.params;
      const n = this.boids.length;
      const next = new Array(n);
      const perception2 = p.perception * p.perception;
      const separationRadius = p.perception * 0.43;
      const sep2 = separationRadius * separationRadius;
      const maxForce = p.force;
      const noiseScale = p.noise * 0.055;

      if (this.predator) {
        this.predator.x += this.predator.vx * dt * 60;
        if (performance.now() > this.predator.until) this.predator = null;
      }

      for (let i = 0; i < n; i++) {
        const b = this.boids[i];
        let alignX = 0, alignY = 0, cohX = 0, cohY = 0, sepX = 0, sepY = 0;
        let count = 0, sepCount = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const o = this.boids[j];
          const dx = this.wrappedDelta(b.x, o.x, this.w);
          const dy = this.wrappedDelta(b.y, o.y, this.h);
          const d2 = dx * dx + dy * dy;
          if (d2 < perception2) {
            count++;
            alignX += o.vx; alignY += o.vy;
            cohX += dx; cohY += dy;
            if (d2 < sep2 && d2 > 0.0001) {
              const inv = 1 / d2;
              sepX -= dx * inv; sepY -= dy * inv;
              sepCount++;
            }
          }
        }

        let ax = 0, ay = 0;
        if (count) {
          let sx, sy;
          [sx, sy] = this.steerToward(alignX / count, alignY / count, p.speed, b.vx, b.vy, maxForce);
          ax += sx * p.ali; ay += sy * p.ali;
          [sx, sy] = this.steerToward(cohX / count, cohY / count, p.speed, b.vx, b.vy, maxForce);
          ax += sx * p.coh; ay += sy * p.coh;
        }
        if (sepCount) {
          let sx, sy;
          [sx, sy] = this.steerToward(sepX / sepCount, sepY / sepCount, p.speed, b.vx, b.vy, maxForce * 1.2);
          ax += sx * p.sep; ay += sy * p.sep;
        }

        if (this.predator) {
          const dx = this.wrappedDelta(this.predator.x, b.x, this.w);
          const dy = this.wrappedDelta(this.predator.y, b.y, this.h);
          const d = hypot(dx, dy);
          if (d < 150 && d > 0.001) {
            const strength = (1 - d / 150) * 0.38;
            ax += dx / d * strength;
            ay += dy / d * strength;
          }
        }

        const aNoise = this.rand() * TAU;
        ax += Math.cos(aNoise) * noiseScale;
        ay += Math.sin(aNoise) * noiseScale;

        let vx = b.vx + ax * dt * 60;
        let vy = b.vy + ay * dt * 60;
        let speed = hypot(vx, vy);
        const maxSpeed = p.speed * 1.45;
        const minSpeed = p.speed * 0.58;
        if (speed > maxSpeed) { vx = vx / speed * maxSpeed; vy = vy / speed * maxSpeed; speed = maxSpeed; }
        if (speed < minSpeed && speed > 1e-9) { vx = vx / speed * minSpeed; vy = vy / speed * minSpeed; }
        let x = (b.x + vx * dt * 60 + this.w) % this.w;
        let y = (b.y + vy * dt * 60 + this.h) % this.h;
        const trail = b.trail;
        if (this.trails && this.kind === "complexity") {
          trail.push([x, y]);
          if (trail.length > 18) trail.shift();
        } else if (trail.length) trail.length = 0;
        next[i] = { x, y, vx, vy, trail };
      }
      this.boids = next;
    }

    computeMetrics() {
      const n = this.boids.length;
      if (!n) return { polar: 0, clusters: 0, neighbours: 0, spread: 0 };
      let ux = 0, uy = 0;
      for (const b of this.boids) {
        const m = hypot(b.vx, b.vy) || 1;
        ux += b.vx / m; uy += b.vy / m;
      }
      const polar = hypot(ux, uy) / n;

      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
      const r2 = (this.params.perception * 0.78) ** 2;
      let links = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = this.wrappedDelta(this.boids[i].x, this.boids[j].x, this.w);
          const dy = this.wrappedDelta(this.boids[i].y, this.boids[j].y, this.h);
          if (dx * dx + dy * dy < r2) { union(i, j); links++; }
        }
      }
      const roots = new Set(parent.map((_, i) => find(i)));
      const clusters = roots.size;
      const neighbours = (2 * links) / n;
      let cx = 0, cy = 0;
      for (const b of this.boids) { cx += b.x; cy += b.y; }
      cx /= n; cy /= n;
      let spread = 0;
      for (const b of this.boids) spread += hypot(b.x - cx, b.y - cy);
      spread = (spread / n) / (0.5 * hypot(this.w, this.h));
      return { polar, clusters, neighbours, spread: clamp(spread, 0, 1.4) };
    }

    updateMetricUI(now) {
      if (now - this.metricsClock < 250) return;
      this.metricsClock = now;
      const m = this.computeMetrics();
      this.lastMetrics = m;
      const prefix = this.kind === "order" ? "order" : "complexity";
      $(`${prefix}Polar`).textContent = formatPct(m.polar);
      $(`${prefix}Clusters`).textContent = String(m.clusters);
      $(`${prefix}Neighbours`).textContent = m.neighbours.toFixed(1);
      $(`${prefix}Spread`).textContent = formatPct(Math.min(m.spread, 1));

      if (this.lastDisturbance && now - this.lastDisturbance.at > 800) {
        if (this.kind === "order" && m.polar > 0.82) {
          const seconds = ((now - this.lastDisturbance.at) / 1000).toFixed(1);
          this.updateInterpretation(`The disturbance decayed: alignment has returned above 82% after about ${seconds} s. That is a practical signature of a robust ordered regime in this model.`);
          this.lastDisturbance = null;
        } else if (this.kind === "complexity" && now - this.lastDisturbance.at > 3500) {
          this.updateInterpretation(`After disturbance the flock now has ${m.clusters} connected cluster${m.clusters === 1 ? "" : "s"}, ${m.neighbours.toFixed(1)} mean neighbours and ${Math.round(m.polar * 100)}% directional alignment. The reorganised pattern emerged from local interactions.`);
          this.lastDisturbance = null;
        }
      }
    }

    updateInterpretation(text) {
      const el = $(this.kind === "order" ? "orderInterpretation" : "complexityInterpretation");
      if (text) { el.textContent = text; return; }
      if (this.kind === "order") {
        el.textContent = "This preset favours a high-polarisation flock. Reduce alignment or increase noise to push it away from order.";
      } else {
        el.textContent = "No flock-level choreography is encoded. Splitting, merging and coordinated turns arise from repeated neighbour-to-neighbour interactions.";
      }
    }

    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#07111e"); grad.addColorStop(1, "#090b16");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#86a7d9";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 55) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 55) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();

      if (this.trails && this.kind === "complexity") {
        ctx.save(); ctx.strokeStyle = "rgba(94,234,212,.16)"; ctx.lineWidth = 1;
        for (const b of this.boids) {
          if (b.trail.length < 2) continue;
          ctx.beginPath(); ctx.moveTo(b.trail[0][0], b.trail[0][1]);
          for (let k = 1; k < b.trail.length; k++) {
            const a = b.trail[k - 1], c = b.trail[k];
            if (Math.abs(c[0] - a[0]) > w / 2 || Math.abs(c[1] - a[1]) > h / 2) { ctx.moveTo(c[0], c[1]); }
            else ctx.lineTo(c[0], c[1]);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const b of this.boids) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 3.4); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -3.4); ctx.closePath();
        ctx.fillStyle = this.kind === "order" ? "#8ee9ff" : "#72f0ce";
        ctx.globalAlpha = 0.92; ctx.fill(); ctx.restore();
      }

      if (this.predator) {
        ctx.save(); ctx.translate(this.predator.x, this.predator.y);
        ctx.strokeStyle = "#f59e0b"; ctx.fillStyle = "rgba(245,158,11,.18)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.moveTo(7,-7); ctx.lineTo(-7,7); ctx.stroke();
        ctx.restore();
      }
    }
  }

  const orderLab = new BoidLab($("orderCanvas"), "order");
  const complexityLab = new BoidLab($("complexityCanvas"), "complexity");
  orderLab.bindControls(); complexityLab.bindControls();

  $("orderToggle").addEventListener("click", () => orderLab.toggle());
  $("orderDisturb").addEventListener("click", () => orderLab.gust());
  $("orderPreset").addEventListener("click", () => orderLab.applyPreset("order", false));
  $("orderNew").addEventListener("click", () => orderLab.newFlock());
  $("complexityToggle").addEventListener("click", () => complexityLab.toggle());
  $("complexityDisturb").addEventListener("click", () => complexityLab.predatorPulse());
  $("complexityScatter").addEventListener("click", () => complexityLab.scatter());
  $("complexityNew").addEventListener("click", () => complexityLab.newFlock());
  $("complexityTrails").addEventListener("change", (e) => { complexityLab.trails = e.target.checked; });
  document.querySelectorAll("[data-complexity-preset]").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll("[data-complexity-preset]").forEach(b => b.classList.toggle("active", b === btn));
    complexityLab.applyPreset(btn.dataset.complexityPreset, true);
  }));

  // ---------- logistic map ----------
  const chaos = {
    r: 3.9, x0: 0.213, epsExp: -8, shown: 80, animateTo: 80, animating: false,
    dataA: [], dataB: [], sep: [], bifCache: null
  };

  function logisticSeries(r, x0, n = 120) {
    const arr = [x0];
    let x = x0;
    for (let i = 1; i < n; i++) { x = r * x * (1 - x); arr.push(x); }
    return arr;
  }

  function lyapunov(r, x0, transient = 300, sample = 1200) {
    let x = x0;
    for (let i = 0; i < transient; i++) x = r * x * (1 - x);
    let sum = 0, count = 0;
    for (let i = 0; i < sample; i++) {
      const deriv = Math.abs(r * (1 - 2 * x));
      if (deriv > 1e-14) { sum += Math.log(deriv); count++; }
      x = r * x * (1 - x);
    }
    return count ? sum / count : -Infinity;
  }

  function refreshChaosData() {
    const eps = 10 ** chaos.epsExp;
    chaos.dataA = logisticSeries(chaos.r, chaos.x0, 120);
    chaos.dataB = logisticSeries(chaos.r, clamp(chaos.x0 + eps, 1e-12, 1 - 1e-12), 120);
    chaos.sep = chaos.dataA.map((x, i) => Math.abs(x - chaos.dataB[i]));
    const lambda = lyapunov(chaos.r, chaos.x0);
    $("chaosLambda").textContent = Number.isFinite(lambda) ? lambda.toFixed(3) : "−∞";
    const last = chaos.sep[Math.min(chaos.shown - 1, chaos.sep.length - 1)] || 0;
    $("chaosSeparation").textContent = last < 0.001 ? last.toExponential(2) : last.toFixed(3);
    $("chaosSteps").textContent = String(chaos.shown);
    const regime = lambda > 0.02 ? "positive λ: sensitive regime" : lambda < -0.02 ? "negative λ: convergent / periodic regime" : "λ near zero: transition-like regime";
    $("chaosRegime").textContent = regime;
    $("chaosInterpretation").textContent = lambda > 0.02
      ? `For this orbit the finite-time Lyapunov estimate is positive (${lambda.toFixed(3)}). Nearby deterministic trajectories tend to separate exponentially before saturation.`
      : lambda < -0.02
        ? `For this orbit the finite-time Lyapunov estimate is negative (${lambda.toFixed(3)}). Nearby trajectories tend to contract rather than sustain sensitive divergence.`
        : `The finite-time Lyapunov estimate is close to zero (${lambda.toFixed(3)}), consistent with behaviour near a transition or neutral cycle. Longer analysis may be needed.`;
    drawChaos(); drawBifurcation();
  }

  function drawAxes(ctx, w, h, margins, yLabel) {
    const { l, r, t, b } = margins;
    ctx.strokeStyle = "rgba(168,180,207,.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(l, h - b); ctx.lineTo(w - r, h - b); ctx.stroke();
    ctx.fillStyle = "rgba(168,180,207,.85)"; ctx.font = "11px system-ui";
    ctx.fillText("0", 7, h - b + 4); ctx.fillText(yLabel, 8, t + 10);
  }

  function drawChaos() {
    const canvas = $("chaosCanvas");
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = "#060a12"; ctx.fillRect(0, 0, w, h);
    const split = h * 0.62;
    const m1 = { l: 42, r: 18, t: 18, b: h - split + 24 };
    drawAxes(ctx, w, h, m1, "xₙ");
    const maxN = Math.max(2, chaos.shown);
    const xPix = (i) => m1.l + i / (maxN - 1) * (w - m1.l - m1.r);
    const yPix = (v) => 18 + (1 - v) * (split - 42);
    const drawLine = (data, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.beginPath();
      for (let i = 0; i < maxN; i++) { const x = xPix(i), y = yPix(data[i]); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }
      ctx.stroke();
    };
    drawLine(chaos.dataA, "#5eead4"); drawLine(chaos.dataB, "#f59e0b");
    ctx.fillStyle = "rgba(168,180,207,.72)"; ctx.font = "11px system-ui"; ctx.fillText(`n = ${maxN - 1}`, w - 68, split - 8);

    const top = split + 20, bottom = h - 30, left = 42, right = 18;
    ctx.strokeStyle = "rgba(168,180,207,.35)"; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(w-right,bottom); ctx.stroke();
    const minLog = -14, maxLog = 0;
    const yLog = (sep) => top + (maxLog - clamp(Math.log10(Math.max(sep, 1e-14)), minLog, maxLog)) / (maxLog - minLog) * (bottom - top);
    ctx.strokeStyle = "#c084fc"; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < maxN; i++) { const x=xPix(i), y=yLog(chaos.sep[i]); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); } ctx.stroke();
    ctx.fillStyle = "rgba(168,180,207,.8)"; ctx.fillText("log₁₀ |Δx|", 6, top + 10); ctx.fillText("−14", 10, bottom); ctx.fillText("0", 25, top + 4);
  }

  function drawBifurcation() {
    const canvas = $("bifurcationCanvas");
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = "#060a12"; ctx.fillRect(0, 0, w, h);
    const image = ctx.createImageData(Math.round(w), Math.round(h));
    const data = image.data;
    const stepsX = Math.max(300, Math.floor(w));
    for (let px = 0; px < stepsX; px++) {
      const r = 2.5 + 1.5 * px / (stepsX - 1);
      let x = 0.5;
      for (let i=0;i<500;i++) x = r*x*(1-x);
      for (let i=0;i<85;i++) {
        x = r*x*(1-x);
        const xx = Math.floor(px / stepsX * w);
        const yy = Math.floor((1-x) * (h-1));
        const idx = (yy * Math.round(w) + clamp(xx,0,Math.round(w)-1)) * 4;
        data[idx] = 94; data[idx+1] = 234; data[idx+2] = 212; data[idx+3] = Math.min(255, data[idx+3] + 70);
      }
    }
    ctx.putImageData(image,0,0);
    const markerX = (chaos.r - 2.5) / 1.5 * w;
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(markerX,0); ctx.lineTo(markerX,h); ctx.stroke();
    ctx.fillStyle = "rgba(237,243,255,.78)"; ctx.font="11px system-ui"; ctx.fillText("r = 2.5",6,h-7); ctx.fillText("r = 4.0",w-46,h-7);
  }

  const chaosPresets = { stable:{r:2.9,x:.213}, periodic:{r:3.2,x:.213}, edge:{r:3.569,x:.213}, chaotic:{r:3.9,x:.213} };
  function setChaosPreset(name) {
    const p = chaosPresets[name]; chaos.r=p.r; chaos.x0=p.x; chaos.shown=80; chaos.epsExp=-8;
    $("chaosR").value=chaos.r; $("chaosX").value=chaos.x0; $("chaosEps").value=chaos.epsExp;
    document.querySelectorAll("[data-chaos-preset]").forEach(b=>b.classList.toggle("active",b.dataset.chaosPreset===name));
    syncChaosOutputs(); refreshChaosData();
  }
  function syncChaosOutputs(){ $("chaosROut").value=Number(chaos.r).toFixed(3); $("chaosXOut").value=Number(chaos.x0).toFixed(3); $("chaosEpsOut").value=chaos.epsExp; }
  $("chaosR").addEventListener("input",e=>{chaos.r=Number(e.target.value);chaos.shown=80;syncChaosOutputs();refreshChaosData();});
  $("chaosX").addEventListener("input",e=>{chaos.x0=Number(e.target.value);chaos.shown=80;syncChaosOutputs();refreshChaosData();});
  $("chaosEps").addEventListener("input",e=>{chaos.epsExp=Number(e.target.value);chaos.shown=80;syncChaosOutputs();refreshChaosData();});
  document.querySelectorAll("[data-chaos-preset]").forEach(btn=>btn.addEventListener("click",()=>setChaosPreset(btn.dataset.chaosPreset)));
  $("chaosRun").addEventListener("click",()=>{chaos.shown=2;chaos.animating=true;refreshChaosData();});
  $("chaosKick").addEventListener("click",()=>{chaos.r=clamp(chaos.r+0.001,2.5,4);$("chaosR").value=chaos.r;syncChaosOutputs();refreshChaosData();});
  $("chaosReset").addEventListener("click",()=>setChaosPreset("chaotic"));

  // ---------- Sierpinski chaos game ----------
  const sier = { running:true, ratio:.5, speed:100, count:0, seed:123456, rand:null, point:{x:.37,y:.41}, points:[], disturbed:false };
  sier.rand = mulberry32(sier.seed);
  function resetSier(newSeed=false){
    if(newSeed){sier.seed=(sier.seed+0x9e3779b9)>>>0;sier.rand=mulberry32(sier.seed);} else sier.rand=mulberry32(sier.seed);
    sier.point={x:.2+sier.rand()*.6,y:.2+sier.rand()*.6}; sier.points=[]; sier.count=0; sier.disturbed=false; drawSier(); updateSierUI();
  }
  function sierVertices(){return [[.5,.06],[.07,.93],[.93,.93]];}
  function sierStep(){
    const verts=sierVertices(); const k=Math.floor(sier.rand()*3); const v=verts[k];
    sier.point={x:sier.point.x+(v[0]-sier.point.x)*sier.ratio,y:sier.point.y+(v[1]-sier.point.y)*sier.ratio};
    sier.points.push([sier.point.x,sier.point.y,k]); sier.count++; if(sier.points.length>35000)sier.points.splice(0,5000);
  }
  function drawSier(){
    const canvas=$("sierCanvas"); const {ctx,w,h}=fitCanvas(canvas); ctx.fillStyle="#060a12";ctx.fillRect(0,0,w,h);
    const verts=sierVertices();
    ctx.strokeStyle="rgba(168,180,207,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(verts[0][0]*w,verts[0][1]*h);ctx.lineTo(verts[1][0]*w,verts[1][1]*h);ctx.lineTo(verts[2][0]*w,verts[2][1]*h);ctx.closePath();ctx.stroke();
    const colors=["#5eead4","#6ea8ff","#c084fc"];
    for(const p of sier.points){ctx.fillStyle=colors[p[2]];ctx.globalAlpha=.72;ctx.fillRect(p[0]*w,p[1]*h,1.2,1.2);}ctx.globalAlpha=1;
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(sier.point.x*w,sier.point.y*h,3,0,TAU);ctx.fill();
  }
  function updateSierUI(){
    $("sierCount").textContent=sier.count.toLocaleString(); $("sierRatioOut").value=sier.ratio.toFixed(2);$("sierSpeedOut").value=sier.speed;$("sierClassic").textContent=Math.abs(sier.ratio-.5)<1e-9?"yes":"no";
    $("sierInterpretation").textContent=Math.abs(sier.ratio-.5)<1e-9
      ? "At ratio ½ the invariant set is the classic Sierpiński triangle. A jump changes the transient point, but repeated application of the same rule returns the sequence to the same attractor."
      : `At ratio ${sier.ratio.toFixed(2)} you are changing the contraction rule. The result is still an iterated geometric process, but it is not the classic Sierpiński triangle.`;
  }
  $("sierToggle").addEventListener("click",()=>{sier.running=!sier.running;$("sierToggle").textContent=sier.running?"Pause":"Play";$("sierRunLabel").textContent=sier.running?"running":"paused";});
  $("sierJump").addEventListener("click",()=>{sier.point={x:.08+sier.rand()*.84,y:.08+sier.rand()*.84};sier.disturbed=true;$("sierInterpretation").textContent="The current point was moved abruptly. Keep the rule unchanged and watch subsequent points fall back onto the same attracting set.";});
  $("sierReset").addEventListener("click",()=>resetSier(false)); $("sierNewSeed").addEventListener("click",()=>resetSier(true));
  $("sierRatio").value=sier.ratio;$("sierSpeed").value=sier.speed;
  $("sierRatio").addEventListener("input",e=>{sier.ratio=Number(e.target.value);resetSier(false);updateSierUI();});
  $("sierSpeed").addEventListener("input",e=>{sier.speed=Number(e.target.value);updateSierUI();});

  // ---------- Newton basin ----------
  const roots=[[1,0],[-.5,Math.sqrt(3)/2],[-.5,-Math.sqrt(3)/2]];
  const rootNames=["root 1","root 2","root 3"];
  const newton={cx:0,cy:0,scale:2.35,maxIter:32,selected:null,perturbed:null,renderPending:false};
  function complexNewton(x,y,maxIter){
    for(let i=0;i<maxIter;i++){
      const r2=x*x+y*y; if(r2<1e-14)return{root:-1,iter:i,x,y};
      // z_new = (2/3)z + 1/(3 z^2)
      const den=3*r2*r2; const invRe=(x*x-y*y)/den; const invIm=(-2*x*y)/den;
      x=(2/3)*x+invRe; y=(2/3)*y+invIm;
      for(let k=0;k<3;k++){const dx=x-roots[k][0],dy=y-roots[k][1];if(dx*dx+dy*dy<1e-10)return{root:k,iter:i+1,x,y};}
    }
    let best=-1,bd=Infinity;for(let k=0;k<3;k++){const dx=x-roots[k][0],dy=y-roots[k][1],d=dx*dx+dy*dy;if(d<bd){bd=d;best=k;}}
    return{root:best,iter:maxIter,x,y};
  }
  function canvasToComplex(px,py,w,h){const half=newton.scale;const aspect=w/h;return[newton.cx+(px/w-.5)*2*half*aspect,newton.cy+(py/h-.5)*2*half];}
  function complexToCanvas(x,y,w,h){const half=newton.scale,aspect=w/h;return[((x-newton.cx)/(2*half*aspect)+.5)*w,((y-newton.cy)/(2*half)+.5)*h];}
  function renderNewton(){
    const canvas=$("newtonCanvas");const{ctx,w,h}=fitCanvas(canvas);const W=Math.round(w),H=Math.round(h);const image=ctx.createImageData(W,H);const data=image.data;const colors=[[65,214,184],[88,140,255],[190,94,238]];
    for(let py=0;py<H;py++){
      for(let px=0;px<W;px++){
        const [x,y]=canvasToComplex(px+.5,py+.5,W,H);const res=complexNewton(x,y,newton.maxIter);const idx=(py*W+px)*4;const c=res.root>=0?colors[res.root]:[18,22,32];const shade=.38+.62*(1-res.iter/newton.maxIter);
        data[idx]=Math.round(c[0]*shade);data[idx+1]=Math.round(c[1]*shade);data[idx+2]=Math.round(c[2]*shade);data[idx+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
    function mark(point,color,label){if(!point)return;const [px,py]=complexToCanvas(point.x,point.y,w,h);ctx.strokeStyle=color;ctx.fillStyle="#07101c";ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,6,0,TAU);ctx.fill();ctx.stroke();ctx.font="11px system-ui";ctx.fillStyle=color;ctx.fillText(label,px+9,py-8);}
    mark(newton.selected,"#fff","start");mark(newton.perturbed,"#f59e0b","perturbed");
    $("newtonZoomLabel").textContent=`zoom ×${(2.35/newton.scale).toFixed(1)}`;
  }
  function scheduleNewton(){if(newton.renderPending)return;newton.renderPending=true;requestAnimationFrame(()=>{newton.renderPending=false;renderNewton();});}
  function setNewtonSelected(x,y,perturb=false){
    const res=complexNewton(x,y,newton.maxIter);const point={x,y,root:res.root};
    if(perturb)newton.perturbed=point;else{newton.selected=point;newton.perturbed=null;}
    $("newtonRoot").textContent=newton.selected&&newton.selected.root>=0?rootNames[newton.selected.root]:"none";
    $("newtonRoot2").textContent=newton.perturbed&&newton.perturbed.root>=0?rootNames[newton.perturbed.root]:"—";
    if(newton.selected&&newton.perturbed){const d=hypot(newton.perturbed.x-newton.selected.x,newton.perturbed.y-newton.selected.y);$("newtonDelta").textContent=d.toExponential(2);const changed=newton.selected.root!==newton.perturbed.root;$("newtonBoundary").textContent=changed?"outcome switched":"same outcome";$("newtonInterpretation").textContent=changed?`A displacement of ${d.toExponential(2)} changed the final root. This point lies in an outcome-sensitive neighbourhood of the basin boundary.`:`This perturbation remained in the same basin. Move closer to the intricate boundary or use “Find sensitive edge”.`;}
    else{$("newtonDelta").textContent="—";$("newtonBoundary").textContent="selected";}
    scheduleNewton();
  }
  $("newtonCanvas").addEventListener("click",e=>{const rect=e.currentTarget.getBoundingClientRect();const [x,y]=canvasToComplex(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height);setNewtonSelected(x,y,false);});
  $("newtonFind").addEventListener("click",()=>{
    const rand=mulberry32((Date.now()&0xffffffff)>>>0);let found=null;
    for(let t=0;t<45000&&!found;t++){
      const x=newton.cx+(rand()-.5)*2*newton.scale;const y=newton.cy+(rand()-.5)*2*newton.scale;const r=complexNewton(x,y,newton.maxIter).root;const eps=newton.scale*1e-4;const dirs=[[eps,0],[-eps,0],[0,eps],[0,-eps]];
      for(const d of dirs){const r2=complexNewton(x+d[0],y+d[1],newton.maxIter).root;if(r>=0&&r2>=0&&r!==r2){found={x,y,dx:d[0],dy:d[1]};break;}}
    }
    if(found){setNewtonSelected(found.x,found.y,false);setNewtonSelected(found.x+found.dx,found.y+found.dy,true);$("newtonInterpretation").textContent="A sensitive pair was found automatically. Their initial positions are extremely close but they converge to different roots.";}
  });
  $("newtonPerturb").addEventListener("click",()=>{if(!newton.selected){$("newtonFind").click();return;}const eps=newton.scale*1e-4;const candidates=[[eps,0],[-eps,0],[0,eps],[0,-eps],[eps,eps],[-eps,eps]];let best=null;for(const d of candidates){const r=complexNewton(newton.selected.x+d[0],newton.selected.y+d[1],newton.maxIter).root;best={x:newton.selected.x+d[0],y:newton.selected.y+d[1],root:r};if(r!==newton.selected.root)break;}setNewtonSelected(best.x,best.y,true);});
  $("newtonZoomIn").addEventListener("click",()=>{if(newton.selected){newton.cx=newton.selected.x;newton.cy=newton.selected.y;}newton.scale=Math.max(.015,newton.scale*.48);scheduleNewton();});
  $("newtonReset").addEventListener("click",()=>{newton.cx=0;newton.cy=0;newton.scale=2.35;newton.selected=null;newton.perturbed=null;$("newtonRoot").textContent="—";$("newtonRoot2").textContent="—";$("newtonDelta").textContent="—";$("newtonBoundary").textContent="unselected";$("newtonInterpretation").textContent="The coloured regions are basins of attraction. The fractal structure is in their repeatedly folded boundaries, not merely in the fact that the picture looks intricate.";scheduleNewton();});
  $("newtonIterations").value=newton.maxIter;$("newtonIterationsOut").value=newton.maxIter;
  $("newtonIterations").addEventListener("input",e=>{newton.maxIter=Number(e.target.value);$("newtonIterationsOut").value=newton.maxIter;scheduleNewton();});
  $("newtonCanvas").addEventListener("wheel",e=>{e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();const [beforeX,beforeY]=canvasToComplex(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height);const factor=e.deltaY<0?.82:1.22;newton.scale=clamp(newton.scale*factor,.008,6);const [afterX,afterY]=canvasToComplex(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height);newton.cx+=beforeX-afterX;newton.cy+=beforeY-afterY;scheduleNewton();},{passive:false});

  // fractal subtabs
  document.querySelectorAll("[data-fractal-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    const name=btn.dataset.fractalTab;document.querySelectorAll("[data-fractal-tab]").forEach(b=>b.classList.toggle("active",b===btn));
    document.querySelectorAll("[data-fractal-panel]").forEach(p=>{const active=p.dataset.fractalPanel===name;p.classList.toggle("active",active);p.hidden=!active;});
    requestAnimationFrame(()=>{if(name==="newton")scheduleNewton();else drawSier();});
  }));

  // ---------- global animation ----------
  let last=performance.now();
  function frame(now){
    const dt=Math.min(.035,(now-last)/1000||.016);last=now;
    if(activeTab==="order"){orderLab.update(dt);orderLab.draw();orderLab.updateMetricUI(now);}
    if(activeTab==="complexity"){complexityLab.update(dt);complexityLab.draw();complexityLab.updateMetricUI(now);}
    if(activeTab==="chaos"&&chaos.animating){if(chaos.shown<80){chaos.shown++;refreshChaosData();}else chaos.animating=false;}
    if(activeTab==="fractals"&&!$("fractal-sierpinski").hidden&&sier.running){for(let i=0;i<sier.speed;i++)sierStep();drawSier();if(now%250<20)updateSierUI();}
    requestAnimationFrame(frame);
  }

  function resizeAllVisible(){
    orderLab.resize();complexityLab.resize();
    if(activeTab==="order")orderLab.draw();if(activeTab==="complexity")complexityLab.draw();
    if(activeTab==="chaos"){drawChaos();drawBifurcation();}
    if(activeTab==="fractals"){if(!$("fractal-sierpinski").hidden)drawSier();else scheduleNewton();}
  }
  let resizeTimer=null;window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resizeAllVisible,120);});

  $("resetEverything").addEventListener("click",()=>{
    orderLab.applyPreset("order",true);orderLab.running=true;$("orderToggle").textContent="Pause";
    complexityLab.applyPreset("emergent",true);complexityLab.running=true;$("complexityToggle").textContent="Pause";
    document.querySelectorAll("[data-complexity-preset]").forEach(b=>b.classList.toggle("active",b.dataset.complexityPreset==="emergent"));
    setChaosPreset("chaotic");sier.ratio=.5;sier.speed=100;$("sierRatio").value=.5;$("sierSpeed").value=100;resetSier(false);$("newtonReset").click();activateTab("order");
  });

  // initial values and render
  orderLab.resize();complexityLab.resize();orderLab.syncControls();complexityLab.syncControls();
  setChaosPreset("chaotic");resetSier(false);scheduleNewton();
  requestAnimationFrame(frame);
})();
