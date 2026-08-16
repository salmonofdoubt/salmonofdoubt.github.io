(() => {
  "use strict";

  const RE = 6378.137;
  const REAL_INCLINATION = 5.145;
  const MIN_VIEW = 9000;
  const MAX_VIEW = 430000;
  const MEAN_LUNAR = 384400;

  const el = id => document.getElementById(id);
  const canvas = el("shadowCanvas");
  const ctx = canvas.getContext("2d");

  const state = {
    data: null,
    events: null,
    eventsByTrack: new Map(),
    mode: "real",
    viewHalf: MAX_VIEW,
    selectedTrack: 0,
    accumulation: "cycle",
    showAll: true,
    showEclipseTracks: true,
    showPenumbra: true,
    showCentral: true,
    showLens: true,
    verticalExaggeration: 1,
    earthMagnification: 1,
    animating: false,
    animIndex: 0,
    animTimer: null,
    deferredInstallPrompt: null,
    touchDistance: null,
    roulette: { correct: 0, total: 0, revealed: false, guessed: false },
    sandbox: { inclination: REAL_INCLINATION, distance: MEAN_LUNAR, earthScale: 1 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtKm(v) {
    const n = Math.abs(v);
    if (n >= 100000) return `${Math.round(v / 1000).toLocaleString()}k km`;
    if (n >= 10000) return `${Math.round(v / 1000)}k km`;
    return `${Math.round(v).toLocaleString()} km`;
  }
  function pct(n, d) { return d ? `${(n / d * 100).toFixed(1)}% of passes` : "—"; }
  function degSin(v) { return Math.sin(v * Math.PI / 180); }

  function viewToSlider(view) {
    const t = (Math.log(view) - Math.log(MIN_VIEW)) / (Math.log(MAX_VIEW) - Math.log(MIN_VIEW));
    return Math.round(clamp(t, 0, 1) * 1000);
  }
  function sliderToView(v) {
    const t = Number(v) / 1000;
    return Math.exp(Math.log(MIN_VIEW) + t * (Math.log(MAX_VIEW) - Math.log(MIN_VIEW)));
  }

  function currentEarthRadius() {
    return state.mode === "sandbox" ? RE * state.sandbox.earthScale : RE;
  }

  function sandboxFactors() {
    const distanceRatio = state.sandbox.distance / MEAN_LUNAR;
    const denom = Math.max(1e-9, degSin(REAL_INCLINATION));
    const inclinationRatio = degSin(state.sandbox.inclination) / denom;
    return { distanceRatio, inclinationRatio };
  }

  function transformPoint(raw, forDisplay = true) {
    let x = raw[1], y = raw[2], pen = raw[3], central = raw[4], moon = raw[5];
    if (state.mode === "sandbox") {
      const { distanceRatio, inclinationRatio } = sandboxFactors();
      x *= distanceRatio;
      y *= distanceRatio * inclinationRatio;
      pen *= distanceRatio;
      central *= distanceRatio;
      moon *= distanceRatio;
    } else if (forDisplay) {
      y *= state.verticalExaggeration;
    }
    return { x, y, pen, central, moon };
  }

  function setViewHalf(v) {
    state.viewHalf = clamp(v, MIN_VIEW, MAX_VIEW);
    el("zoomSlider").value = viewToSlider(state.viewHalf);
    updateViewText();
    draw();
    updateStats();
  }

  function lensRadius() {
    return clamp(state.viewHalf * 0.08, currentEarthRadius(), 40000);
  }

  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(320, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function projector(w, h) {
    const span = Math.min(w, h) * 0.88;
    const pxPerKm = span / (state.viewHalf * 2);
    const cx = w / 2, cy = h / 2;
    return {
      pxPerKm, cx, cy,
      point(x, y) { return [cx + x * pxPerKm, cy - y * pxPerKm]; },
      radius(km) { return km * pxPerKm; },
      inverse(px, py) { return [(px - cx) / pxPerKm, (cy - py) / pxPerKm]; }
    };
  }

  function clear(w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f9fbfa";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(14,31,38,.035)";
    ctx.lineWidth = 1;
    const step = 34;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  function drawAxes(p, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(8,57,70,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, p.cy); ctx.lineTo(w, p.cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.cx, 0); ctx.lineTo(p.cx, h); ctx.stroke();

    const candidates = [5000, 10000, 25000, 50000, 100000, 200000];
    const tick = candidates.find(v => p.radius(v) >= 52) || candidates[candidates.length - 1];
    ctx.fillStyle = "rgba(8,57,70,.55)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "center";
    for (let x = -Math.floor(state.viewHalf / tick) * tick; x <= state.viewHalf; x += tick) {
      if (x === 0) continue;
      const [px] = p.point(x, 0);
      ctx.beginPath(); ctx.moveTo(px, p.cy - 4); ctx.lineTo(px, p.cy + 4); ctx.stroke();
      if (px > 25 && px < w - 25) ctx.fillText(`${Math.round(x / 1000)}k`, px, p.cy + 16);
    }
    ctx.restore();
  }

  function drawReference(p, w, h) {
    const [cx, cy] = p.point(0, 0);
    const lunarDistance = state.mode === "sandbox" ? state.sandbox.distance : MEAN_LUNAR;

    if (state.viewHalf > 150000) {
      const r = p.radius(lunarDistance);
      if (r < Math.max(w, h) * 1.25) {
        ctx.strokeStyle = "rgba(6,55,70,.15)";
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (state.showLens) {
      const r = p.radius(lensRadius());
      ctx.strokeStyle = "rgba(255,182,76,.68)";
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    const physicalR = currentEarthRadius();
    const displayFactor = state.mode === "sandbox" ? 1 : state.earthMagnification;
    const earthR = Math.max(.9, p.radius(physicalR) * displayFactor);
    ctx.fillStyle = "#2078c8";
    ctx.strokeStyle = "#052f4c";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (earthR > 10) {
      const grad = ctx.createRadialGradient(cx - earthR * .28, cy - earthR * .3, 1, cx, cy, earthR);
      grad.addColorStop(0, "rgba(220,250,255,.88)");
      grad.addColorStop(.18, "rgba(74,160,216,.46)");
      grad.addColorStop(1, "rgba(0,34,70,.16)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, earthR * .94, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#092630";
    ctx.font = "700 11px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(state.mode === "sandbox" && state.sandbox.earthScale !== 1 ? `Earth ×${state.sandbox.earthScale.toFixed(2)}` : "Earth", cx + earthR + 7, cy - 4);
  }

  function drawTrack(track, p, style) {
    const pts = track.points;
    if (!pts || pts.length < 2) return;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    ctx.globalAlpha = style.alpha;
    ctx.beginPath();
    pts.forEach((q, i) => {
      const t = transformPoint(q, true);
      const [x, y] = p.point(t.x, t.y);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function selectedTrackSet() {
    const tracks = state.data.tracks;
    if (state.mode === "roulette") return [tracks[state.selectedTrack]];
    if (state.accumulation === "one") return [tracks[state.selectedTrack]];
    if (state.accumulation === "year") {
      const a = Math.max(0, state.selectedTrack - 6);
      const b = Math.min(tracks.length, state.selectedTrack + 7);
      return tracks.slice(a, b);
    }
    return tracks;
  }

  function drawEclipseTrack(et, p) {
    if (!et.points || et.points.length < 2) return;
    ctx.strokeStyle = "#d06e12";
    ctx.lineWidth = 1.65;
    ctx.globalAlpha = .78;
    ctx.beginPath();
    et.points.forEach((q, i) => {
      const fake = [q[0], q[1], q[2], 0, 0, MEAN_LUNAR];
      const t = transformPoint(fake, true);
      const [x, y] = p.point(t.x, t.y);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function currentRawPoint() {
    const tr = state.data.tracks[state.selectedTrack];
    if (!tr || !tr.points.length) return null;
    const i = clamp(state.animIndex, 0, tr.points.length - 1);
    return tr.points[i];
  }

  function drawCurrentShadow(p) {
    const raw = currentRawPoint();
    if (!raw) return;
    const t = transformPoint(raw, true);
    const [x, y] = p.point(t.x, t.y);

    if (state.showPenumbra) {
      const rx = Math.max(.7, p.radius(Math.abs(t.pen)));
      const ry = state.mode === "real" ? rx * state.verticalExaggeration : rx;
      ctx.fillStyle = "rgba(8,20,28,.055)";
      ctx.strokeStyle = "rgba(8,20,28,.18)";
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (state.showCentral) {
      const centralR = Math.abs(t.central);
      if (p.radius(centralR) > .45) {
        const rx = Math.max(.55, p.radius(centralR));
        const ry = state.mode === "real" ? rx * state.verticalExaggeration : rx;
        ctx.fillStyle = t.central >= 0 ? "rgba(1,4,8,.52)" : "rgba(255,182,76,.22)";
        ctx.strokeStyle = t.central >= 0 ? "rgba(1,4,8,.8)" : "rgba(208,110,18,.8)";
        ctx.lineWidth = .8;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    ctx.fillStyle = "#ff5c55";
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();

    // Readouts use un-exaggerated physical/sandbox coordinates.
    const phys = transformPoint(raw, false);
    const rho = Math.hypot(phys.x, phys.y);
    el("axisReadout").textContent = fmtKm(rho);
    el("moonReadout").textContent = fmtKm(phys.moon);

    const earthR = currentEarthRadius();
    const earthTouch = rho <= earthR + Math.abs(phys.pen);
    let stateText = "misses Earth";
    if (earthTouch) {
      if (Math.abs(phys.central) > 0 && rho <= earthR + Math.abs(phys.central)) {
        stateText = phys.central >= 0 ? "central shadow can reach Earth" : "antumbra can reach Earth";
      } else {
        stateText = "penumbra can reach Earth";
      }
    }
    el("shadowReadout").textContent = stateText;
  }

  function draw() {
    if (!state.data) return;
    const { w, h } = setupCanvas();
    clear(w, h);
    const p = projector(w, h);
    drawAxes(p, w, h);

    if (state.showAll) {
      const list = selectedTrackSet();
      const alpha = state.mode === "roulette" ? .45 : state.accumulation === "cycle" ? .095 : state.accumulation === "year" ? .18 : .35;
      const color = state.mode === "sandbox" ? "#b66c17" : "#1387a6";
      list.forEach(track => drawTrack(track, p, { stroke: color, width: .72, alpha }));
    }

    const selectedColor = state.mode === "sandbox" ? "#8c4d09" : "#005f78";
    drawTrack(state.data.tracks[state.selectedTrack], p, { stroke: selectedColor, width: 1.7, alpha: .86 });

    const canShowActual = state.mode === "real" || (state.mode === "roulette" && state.roulette.revealed);
    if (state.showEclipseTracks && canShowActual) {
      if (state.mode === "roulette") {
        const eventIds = new Set(eventListForTrack(state.data.tracks[state.selectedTrack].id).map(ev => ev.id));
        state.data.eclipseTracks.filter(et => eventIds.has(et.eventId)).forEach(et => drawEclipseTrack(et, p));
      } else {
        state.data.eclipseTracks.forEach(et => drawEclipseTrack(et, p));
      }
    }

    drawReference(p, w, h);
    drawCurrentShadow(p);
  }

  function eventListForTrack(trackId) {
    return state.eventsByTrack.get(trackId) || [];
  }

  function trackHasActualEclipse(trackId) {
    return eventListForTrack(trackId).length > 0;
  }

  function pointDate(raw) {
    const start = Date.parse(state.data.meta.start);
    const dt = new Date(start + raw[0] * 3600000);
    return dt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }

  function updateTrackText() {
    if (!state.data) return;
    const tr = state.data.tracks[state.selectedTrack];
    const date = tr.closest.slice(0, 10);
    const evs = eventListForTrack(tr.id);
    if (state.mode === "roulette" && !state.roulette.revealed) {
      el("trackLabel").textContent = `${state.selectedTrack + 1}/${state.data.tracks.length} · identity hidden`;
    } else {
      el("trackLabel").textContent = evs.length
        ? `${state.selectedTrack + 1}/${state.data.tracks.length} · ${date} · ${evs.map(e => e.type).join(", ")} eclipse`
        : `${state.selectedTrack + 1}/${state.data.tracks.length} · ${date} · miss`;
    }
    el("roulettePass").textContent = `#${state.selectedTrack + 1}`;
  }

  function updateTimeText() {
    if (!state.data) return;
    const raw = currentRawPoint();
    el("timeLabel").textContent = raw ? pointDate(raw) : "—";
    el("passTimeSlider").value = state.animIndex;
  }

  function updateViewText() {
    el("viewLabel").textContent = fmtKm(state.viewHalf);
    el("lensRadiusLabel").textContent = fmtKm(lensRadius());

    if (state.mode === "sandbox") {
      el("scaleNoteTitle").textContent = "What-if geometry";
      el("scaleNoteText").textContent = `${state.sandbox.inclination.toFixed(2)}° tilt · ${fmtKm(state.sandbox.distance)} mean lunar distance.`;
      return;
    }

    if (state.viewHalf > 250000) {
      el("scaleNoteTitle").textContent = "Lunar scale";
      el("scaleNoteText").textContent = "Earth is only ~1/60 of the mean lunar distance in radius.";
    } else if (state.viewHalf > 50000) {
      el("scaleNoteTitle").textContent = "Node-band scale";
      el("scaleNoteText").textContent = "The ± tens-of-thousands-km Sun-view band becomes obvious.";
    } else if (state.viewHalf > 18000) {
      el("scaleNoteTitle").textContent = "Near Earth";
      el("scaleNoteText").textContent = "Most shadow axes still pass above or below the planet.";
    } else {
      el("scaleNoteTitle").textContent = "Eclipse scale";
      el("scaleNoteText").textContent = "The statistical lens is locked to one Earth radius.";
    }
  }

  function syntheticStats() {
    const earthR = currentEarthRadius();
    const results = state.data.tracks.map(track => {
      let minAxis = Infinity;
      let minPenEdge = Infinity;
      track.points.forEach(raw => {
        const t = transformPoint(raw, false);
        const rho = Math.hypot(t.x, t.y);
        minAxis = Math.min(minAxis, rho);
        minPenEdge = Math.min(minPenEdge, rho - Math.abs(t.pen));
      });
      return { minAxisKm: minAxis, minPenumbraEdgeKm: minPenEdge, earthR };
    });
    return results;
  }

  function updateStats() {
    if (!state.data || !state.events) return;
    const tracks = state.mode === "sandbox" ? syntheticStats() : state.data.tracks;
    const lens = lensRadius();
    const axis = tracks.filter(t => t.minAxisKm <= lens).length;
    const pen = tracks.filter(t => t.minPenumbraEdgeKm <= lens).length;
    const eclipses = state.events.events.length;

    el("metricPasses").textContent = tracks.length.toLocaleString();
    el("metricAxis").textContent = axis.toLocaleString();
    el("metricAxisPct").textContent = pct(axis, tracks.length);
    el("metricPen").textContent = pen.toLocaleString();
    el("metricPenPct").textContent = pct(pen, tracks.length);
    el("metricEclipses").textContent = state.mode === "sandbox" ? "reference" : eclipses.toLocaleString();
    el("metricEclipseRate").textContent = state.mode === "sandbox"
      ? "Actual catalogue retained only as a reference"
      : `${(eclipses / tracks.length * 100).toFixed(1)} eclipses per 100 physical passes`;

    const values = tracks.map(t => t.minAxisKm);
    MoonShadowStats.histogram(el("histogramCanvas"), values, lens);
    MoonShadowStats.cumulative(el("cumulativeCanvas"), tracks, lens);
    MoonShadowStats.types(el("typeCanvas"), state.events.events);

    if (state.mode === "sandbox") {
      const earthR = currentEarthRadius();
      const axisEarth = tracks.filter(t => t.minAxisKm <= earthR).length;
      const penEarth = tracks.filter(t => t.minPenumbraEdgeKm <= earthR).length;
      el("sandboxAxisHits").textContent = `${axisEarth}/${tracks.length} (${(axisEarth / tracks.length * 100).toFixed(1)}%)`;
      el("sandboxPenHits").textContent = `${penEarth}/${tracks.length} (${(penEarth / tracks.length * 100).toFixed(1)}%)`;
    }
  }

  function closestPointIndex(track, transformed = false) {
    let best = 0, bestR = Infinity;
    track.points.forEach((raw, i) => {
      let x = raw[1], y = raw[2];
      if (transformed) {
        const t = transformPoint(raw, false); x = t.x; y = t.y;
      }
      const r = Math.hypot(x, y);
      if (r < bestR) { bestR = r; best = i; }
    });
    return best;
  }

  function setTrack(i, opts = {}) {
    if (!state.data) return;
    stopAnimation();
    state.selectedTrack = clamp(Number(i), 0, state.data.tracks.length - 1);
    el("trackSlider").value = state.selectedTrack;
    const track = state.data.tracks[state.selectedTrack];
    el("passTimeSlider").max = Math.max(0, track.points.length - 1);
    state.animIndex = opts.closest ? closestPointIndex(track, state.mode === "sandbox") : 0;
    el("passTimeSlider").value = state.animIndex;
    updateTrackText();
    updateTimeText();
    draw();
  }

  function findNext(predicate) {
    const n = state.data.tracks.length;
    for (let step = 1; step <= n; step++) {
      const i = (state.selectedTrack + step) % n;
      if (predicate(state.data.tracks[i], i)) return i;
    }
    return state.selectedTrack;
  }

  function jumpNextEclipse() {
    const i = findNext(track => trackHasActualEclipse(track.id));
    setTrack(i, { closest: true });
  }

  function jumpNextMiss() {
    const i = findNext(track => !trackHasActualEclipse(track.id));
    setTrack(i, { closest: true });
  }

  function play() {
    if (!state.data) return;
    if (state.animating) { stopAnimation(); return; }
    const tr = state.data.tracks[state.selectedTrack];
    state.animating = true;
    el("playButton").textContent = "Pause";
    el("roulettePlayButton").textContent = "Pause";
    if (state.animIndex >= tr.points.length - 1) state.animIndex = 0;
    state.animTimer = setInterval(() => {
      state.animIndex++;
      if (state.animIndex >= tr.points.length) {
        state.animIndex = tr.points.length - 1;
        stopAnimation();
      }
      updateTimeText();
      draw();
    }, 65);
  }

  function stopAnimation() {
    if (state.animTimer) clearInterval(state.animTimer);
    state.animTimer = null;
    state.animating = false;
    if (el("playButton")) el("playButton").textContent = "Play pass";
    if (el("roulettePlayButton")) el("roulettePlayButton").textContent = "Play it";
  }

  function setMode(mode) {
    state.mode = mode;
    document.body.classList.toggle("sandbox-mode", mode === "sandbox");
    document.querySelectorAll(".mode-tab").forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    el("realControls").hidden = mode !== "real";
    el("rouletteControls").hidden = mode !== "roulette";
    el("sandboxControls").hidden = mode !== "sandbox";

    if (mode === "real") {
      el("controlEyebrow").textContent = "Explorer";
      el("controlTitle").textContent = "Move through scale and time";
      el("visualTitle").textContent = "What the Sun would see";
      el("statsTitle").textContent = "How rare is a hit?";
      el("statsSubtitle").textContent = "The analysis radius follows the zoom. At close range it locks to one Earth radius, so the penumbra statistic approaches the frequency of solar eclipses somewhere on Earth.";
      el("interpretationText").innerHTML = "<strong>Interpretation:</strong> the Moon's orbit is only about 5.145° from the ecliptic, so from the Sun the physical shadow passes occupy a narrow band. Zooming toward the centre reveals why only some new Moons become eclipses.";
    } else if (mode === "roulette") {
      el("controlEyebrow").textContent = "Eclipse roulette";
      el("controlTitle").textContent = "Hit or miss?";
      el("visualTitle").textContent = "Make the call before the reveal";
      el("statsTitle").textContent = "The real distribution";
      el("statsSubtitle").textContent = "Your guesses do not alter the dataset. The statistics remain the real 18.6-year nodal-cycle calculation.";
      state.accumulation = "one";
      state.earthMagnification = 1;
      state.verticalExaggeration = 1;
      setViewHalf(26000);
      newRoulette();
    } else {
      el("controlEyebrow").textContent = "What if?";
      el("controlTitle").textContent = "Change the system";
      el("visualTitle").textContent = "Synthetic sensitivity experiment";
      el("statsTitle").textContent = "How do the hit rates respond?";
      el("statsSubtitle").textContent = "These rates come from transforming the real calculated tracks. They are a teaching sensitivity experiment, not a new ephemeris.";
      el("interpretationText").innerHTML = "<strong>Sandbox:</strong> change inclination, lunar distance, or Earth's target size. The orange paths are transformed from the real ephemeris tracks so cause and effect are visible immediately.";
      state.accumulation = "cycle";
      setViewHalf(MAX_VIEW);
    }
    updateTrackText();
    updateViewText();
    updateStats();
    draw();
  }

  function newRoulette() {
    if (!state.data) return;
    state.roulette.revealed = false;
    state.roulette.guessed = false;
    el("rouletteResult").className = "roulette-result";
    el("rouletteResult").textContent = "Make a prediction. You can zoom before answering.";
    const i = Math.floor(Math.random() * state.data.tracks.length);
    setTrack(i);
    state.animIndex = closestPointIndex(state.data.tracks[i]);
    updateTimeText();
    draw();
  }

  function rouletteGuess(guessHit) {
    if (state.roulette.guessed) return;
    const actual = trackHasActualEclipse(state.data.tracks[state.selectedTrack].id);
    const correct = guessHit === actual;
    state.roulette.total++;
    if (correct) state.roulette.correct++;
    state.roulette.guessed = true;
    state.roulette.revealed = true;
    el("rouletteScore").textContent = `${state.roulette.correct} / ${state.roulette.total}`;
    const evs = eventListForTrack(state.data.tracks[state.selectedTrack].id);
    const detail = actual ? `${evs.map(e => e.type).join(", ")} solar eclipse` : `miss; closest shadow axis ${fmtKm(state.data.tracks[state.selectedTrack].minAxisKm)}`;
    el("rouletteResult").className = `roulette-result ${correct ? "correct" : "wrong"}`;
    el("rouletteResult").textContent = `${correct ? "Correct." : "Not this time."} This pass is a ${detail}.`;
    updateTrackText();
    draw();
  }

  function applySandboxPreset(name) {
    if (name === "real") {
      state.sandbox = { inclination: REAL_INCLINATION, distance: MEAN_LUNAR, earthScale: 1 };
    } else if (name === "flat") {
      state.sandbox.inclination = 0;
    } else if (name === "double") {
      state.sandbox.inclination = 10.29;
    }
    syncSandboxControls();
    updateViewText();
    updateStats();
    draw();
  }

  function syncSandboxControls() {
    el("inclinationSlider").value = state.sandbox.inclination;
    el("distanceSlider").value = state.sandbox.distance;
    el("earthScaleSlider").value = state.sandbox.earthScale;
    el("inclinationLabel").textContent = `${state.sandbox.inclination.toFixed(3)}°`;
    el("distanceLabel").textContent = fmtKm(state.sandbox.distance);
    el("earthScaleLabel").textContent = `${state.sandbox.earthScale.toFixed(2)}×`;
  }

  function runExperiment(name) {
    if (name === "band") {
      setMode("real");
      state.verticalExaggeration = 8;
      state.earthMagnification = 4;
      el("verticalSlider").value = 8;
      el("verticalLabel").textContent = "8×";
      el("earthMagSlider").value = 4;
      el("earthMagLabel").textContent = "4×";
      setViewHalf(MAX_VIEW);
    } else if (name === "eclipse") {
      setMode("real");
      jumpNextEclipse();
      state.animIndex = closestPointIndex(state.data.tracks[state.selectedTrack]);
      updateTimeText();
      setViewHalf(16000);
    } else if (name === "miss") {
      setMode("real");
      jumpNextMiss();
      state.animIndex = closestPointIndex(state.data.tracks[state.selectedTrack]);
      updateTimeText();
      setViewHalf(22000);
    } else if (name === "flat") {
      setMode("sandbox");
      applySandboxPreset("flat");
      setViewHalf(120000);
    }
    document.getElementById("explorer").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetAll() {
    stopAnimation();
    state.verticalExaggeration = 1;
    state.earthMagnification = 1;
    state.accumulation = "cycle";
    state.sandbox = { inclination: REAL_INCLINATION, distance: MEAN_LUNAR, earthScale: 1 };
    el("verticalSlider").value = 1;
    el("verticalLabel").textContent = "1×";
    el("earthMagSlider").value = 1;
    el("earthMagLabel").textContent = "1×";
    el("accumulationSelect").value = "cycle";
    syncSandboxControls();
    setTrack(0);
    setViewHalf(MAX_VIEW);
  }

  function installPwa() {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt.userChoice.finally(() => {
        state.deferredInstallPrompt = null;
        el("installButton").hidden = true;
      });
      return;
    }
    el("iosInstallHint").hidden = false;
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  async function init() {
    const [trackRes, eventRes] = await Promise.all([
      fetch("data/shadow-tracks.json"),
      fetch("data/eclipse-events.json")
    ]);
    if (!trackRes.ok || !eventRes.ok) throw new Error("Could not load bundled Moon Shadows data.");
    state.data = await trackRes.json();
    state.events = await eventRes.json();
    state.events.events.forEach(ev => {
      if (ev.trackId == null) return;
      if (!state.eventsByTrack.has(ev.trackId)) state.eventsByTrack.set(ev.trackId, []);
      state.eventsByTrack.get(ev.trackId).push(ev);
    });

    el("trackSlider").max = state.data.tracks.length - 1;
    el("metricPasses").textContent = state.data.tracks.length;
    el("metricEclipses").textContent = state.events.events.length;
    syncSandboxControls();
    setTrack(0);
    updateViewText();
    updateStats();
    draw();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("Service worker registration failed", err));
    }

    if (!isStandalone()) {
      const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
      if (apple) el("installButton").hidden = false;
    }
  }

  // Main real-system controls.
  el("zoomSlider").addEventListener("input", e => setViewHalf(sliderToView(e.target.value)));
  document.querySelectorAll("[data-zoom]").forEach(btn => btn.addEventListener("click", () => setViewHalf(Number(btn.dataset.zoom))));
  el("verticalSlider").addEventListener("input", e => {
    state.verticalExaggeration = Number(e.target.value);
    el("verticalLabel").textContent = `${state.verticalExaggeration.toFixed(state.verticalExaggeration % 1 ? 2 : 0)}×`;
    draw();
  });
  el("earthMagSlider").addEventListener("input", e => {
    state.earthMagnification = Number(e.target.value);
    el("earthMagLabel").textContent = `${state.earthMagnification.toFixed(state.earthMagnification % 1 ? 1 : 0)}×`;
    draw();
  });
  el("trackSlider").addEventListener("input", e => setTrack(e.target.value));
  el("passTimeSlider").addEventListener("input", e => {
    stopAnimation();
    state.animIndex = Number(e.target.value);
    updateTimeText();
    draw();
  });
  el("playButton").addEventListener("click", play);
  el("closestButton").addEventListener("click", () => {
    state.animIndex = closestPointIndex(state.data.tracks[state.selectedTrack], state.mode === "sandbox");
    updateTimeText(); draw();
  });
  el("randomButton").addEventListener("click", () => setTrack(Math.floor(Math.random() * state.data.tracks.length)));
  el("nextEclipseButton").addEventListener("click", jumpNextEclipse);
  el("nextMissButton").addEventListener("click", jumpNextMiss);
  el("resetButton").addEventListener("click", resetAll);
  el("accumulationSelect").addEventListener("change", e => { state.accumulation = e.target.value; draw(); });
  [["showAll", "showAll"], ["showEclipseTracks", "showEclipseTracks"], ["showPenumbra", "showPenumbra"], ["showCentral", "showCentral"], ["showLens", "showLens"]]
    .forEach(([id, key]) => el(id).addEventListener("change", e => { state[key] = e.target.checked; draw(); updateStats(); }));

  // Mode / guided experiments.
  document.querySelectorAll(".mode-tab").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  document.querySelectorAll("[data-experiment]").forEach(btn => btn.addEventListener("click", () => runExperiment(btn.dataset.experiment)));

  // Roulette.
  el("newRouletteButton").addEventListener("click", newRoulette);
  el("guessHit").addEventListener("click", () => rouletteGuess(true));
  el("guessMiss").addEventListener("click", () => rouletteGuess(false));
  el("rouletteRevealButton").addEventListener("click", () => {
    state.roulette.revealed = true;
    state.animIndex = closestPointIndex(state.data.tracks[state.selectedTrack]);
    updateTrackText(); updateTimeText(); setViewHalf(16000); draw();
  });
  el("roulettePlayButton").addEventListener("click", play);

  // Sandbox.
  el("inclinationSlider").addEventListener("input", e => {
    state.sandbox.inclination = Number(e.target.value);
    syncSandboxControls(); updateViewText(); updateStats(); draw();
  });
  el("distanceSlider").addEventListener("input", e => {
    state.sandbox.distance = Number(e.target.value);
    syncSandboxControls(); updateViewText(); updateStats(); draw();
  });
  el("earthScaleSlider").addEventListener("input", e => {
    state.sandbox.earthScale = Number(e.target.value);
    syncSandboxControls(); updateViewText(); updateStats(); draw();
  });
  document.querySelectorAll("[data-sandbox-preset]").forEach(btn => btn.addEventListener("click", () => applySandboxPreset(btn.dataset.sandboxPreset)));

  // Canvas interaction.
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    setViewHalf(state.viewHalf * (e.deltaY > 0 ? 1.16 : .86));
  }, { passive: false });

  canvas.addEventListener("pointermove", e => {
    if (!state.data) return;
    const rect = canvas.getBoundingClientRect();
    const p = projector(rect.width, rect.height);
    let [x, y] = p.inverse(e.clientX - rect.left, e.clientY - rect.top);
    if (state.mode === "real") y /= state.verticalExaggeration;
    el("cursorReadout").textContent = `${fmtKm(x)}, ${fmtKm(y)} · r=${fmtKm(Math.hypot(x, y))}`;
  });
  canvas.addEventListener("pointerleave", () => { el("cursorReadout").textContent = "move over canvas"; });
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const p = projector(rect.width, rect.height);
    const dx = e.clientX - rect.left - p.cx;
    const dy = e.clientY - rect.top - p.cy;
    const earthPx = Math.max(14, p.radius(currentEarthRadius()) * (state.mode === "real" ? state.earthMagnification : 1));
    if (Math.hypot(dx, dy) <= earthPx + 10) setViewHalf(15000);
  });

  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 2) state.touchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && state.touchDistance) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = state.touchDistance / d;
      state.touchDistance = d;
      setViewHalf(state.viewHalf * ratio);
    }
  }, { passive: false });
  canvas.addEventListener("touchend", () => { state.touchDistance = null; }, { passive: true });

  window.addEventListener("resize", () => { draw(); updateStats(); });

  // PWA install.
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    if (!isStandalone()) el("installButton").hidden = false;
  });
  window.addEventListener("appinstalled", () => { el("installButton").hidden = true; });
  el("installButton").addEventListener("click", installPwa);
  el("closeInstallHint").addEventListener("click", () => { el("iosInstallHint").hidden = true; });

  init().catch(err => {
    console.error(err);
    el("trackLabel").textContent = "Data load failed";
    el("shadowReadout").textContent = "See console";
  });
})();
