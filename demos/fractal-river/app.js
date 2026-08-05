(() => {
  "use strict";

  const canvas = document.getElementById("fractalCanvas");
  const shell = document.getElementById("canvasShell");
  const ctx = canvas.getContext("2d", { alpha: false });

  const renderStatus = document.getElementById("renderStatus");
  const canvasCoordinate = document.getElementById("canvasCoordinate");
  const fractalSubheading = document.getElementById("fractalSubheading");
  const visualSummary = document.getElementById("visualSummary");
  const edgeCallout = document.getElementById("edgeCallout");

  const iterationRange = document.getElementById("iterationRange");
  const iterationValue = document.getElementById("iterationValue");
  const emphasiseBoundary = document.getElementById("emphasiseBoundary");
  const showRoutes = document.getElementById("showRoutes");

  const mapFrame = document.getElementById("mapFrame");
  const openMapLink = document.getElementById("openMapLink");
  const reachName = document.getElementById("reachName");
  const reachDescription = document.getElementById("reachDescription");

  const selectedOutcome = document.getElementById("selectedOutcome");
  const selectedOutcomeText = document.getElementById("selectedOutcomeText");
  const selectedCoordinate = document.getElementById("selectedCoordinate");
  const selectedAttractor = document.getElementById("selectedAttractor");
  const selectedIterations = document.getElementById("selectedIterations");

  const boundaryAssessment = document.getElementById("boundaryAssessment");
  const boundaryAssessmentText = document.getElementById("boundaryAssessmentText");
  const boundaryMetric = document.getElementById("boundaryMetric");
  const boundaryMeterFill = document.getElementById("boundaryMeterFill");

  const currentOutcome = document.getElementById("currentOutcome");
  const currentOutcomeText = document.getElementById("currentOutcomeText");
  const stateCoordinate = document.getElementById("stateCoordinate");
  const stateIterations = document.getElementById("stateIterations");
  const lastAction = document.getElementById("lastAction");

  const guideResult = document.getElementById("guideResult");
  const guidePlaceholder = guideResult.querySelector(".guide-result-placeholder");
  const guideContent = guideResult.querySelector(".guide-result-content");
  const pairAOutcome = document.getElementById("pairAOutcome");
  const pairBOutcome = document.getElementById("pairBOutcome");
  const pairDifferenceText = document.getElementById("pairDifferenceText");
  const showPairButton = document.getElementById("showPairButton");
  const zoomDeeperButton = document.getElementById("zoomDeeperButton");
  const canvasHint = document.getElementById("canvasHint");
  const riverActionResult = document.getElementById("riverActionResult");
  const riverBeforeOutcome = document.getElementById("riverBeforeOutcome");
  const riverAfterOutcome = document.getElementById("riverAfterOutcome");

  const legendA = document.getElementById("legendA");
  const legendB = document.getElementById("legendB");
  const legendC = document.getElementById("legendC");

  const ROOTS = [
    {
      x: 1,
      y: 0,
      mathName: "Teal outcome",
      riverName: "Recovery outcome",
      colour: [57, 221, 214]
    },
    {
      x: -0.5,
      y: Math.sqrt(3) / 2,
      mathName: "Gold outcome",
      riverName: "Fragile outcome",
      colour: [255, 183, 77]
    },
    {
      x: -0.5,
      y: -Math.sqrt(3) / 2,
      mathName: "Magenta outcome",
      riverName: "Degraded outcome",
      colour: [238, 86, 167]
    }
  ];

  const REACHES = {
    "upper-nanny": {
      name: "Upper Nanny",
      description: "An upper-catchment context near Duleek, paired with an illustrative position close to a mathematical outcome boundary.",
      query: "River Nanny Duleek Ireland",
      point: { x: 0.042325, y: -0.523328 },
      storm: { x: -0.024, y: -0.012 },
      intervention: { x: 0.034, y: 0.018 }
    },
    "middle-nanny": {
      name: "Middle Nanny",
      description: "A middle-catchment context near Bellewstown, linked to another boundary-sensitive position in the abstract outcome map.",
      query: "River Nanny Bellewstown Ireland",
      point: { x: 0.395567, y: 0.588881 },
      storm: { x: 0.016, y: -0.014 },
      intervention: { x: -0.018, y: 0.026 }
    },
    "lower-nanny": {
      name: "Lower Nanny",
      description: "A lower-catchment context near Julianstown, used only to anchor the mathematical demonstration geographically.",
      query: "River Nanny Julianstown Ireland",
      point: { x: -0.788787, y: -0.076456 },
      storm: { x: -0.022, y: -0.012 },
      intervention: { x: 0.031, y: 0.018 }
    },
    "delvin": {
      name: "Delvin",
      description: "A River Delvin context near Gormanston, paired with a fine-scale mathematical region where neighbouring starts can reach different outcomes.",
      query: "River Delvin Gormanston Ireland",
      point: { x: -0.00631, y: -0.199337 },
      storm: { x: 0.018, y: 0.028 },
      intervention: { x: -0.022, y: 0.014 }
    }
  };

  const state = {
    mode: "learn",
    centerX: 0,
    centerY: 0,
    span: 3.4,
    maxIter: Number(iterationRange.value),
    emphasise: emphasiseBoundary.checked,
    showRoutes: showRoutes.checked,
    selectedPoint: null,
    pair: null,
    edgePoint: null,
    reachKey: "lower-nanny",
    reachPoint: { ...REACHES["lower-nanny"].point },
    reachBasePoint: { ...REACHES["lower-nanny"].point },
    previousReachPoint: null,
    previousReachRoot: null,
    baseImage: null,
    renderToken: 0,
    lastPointer: { x: 0, y: 0 }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function format(value, digits = 3) {
    const rounded = Number(value).toFixed(digits);
    return rounded === "-0.000" ? "0.000" : rounded;
  }

  function formatDistance(value) {
    if (value < 0.001) return value.toExponential(2);
    if (value < 0.1) return value.toFixed(5);
    return value.toFixed(3);
  }

  function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function rootName(rootIndex, mode = state.mode) {
    if (rootIndex < 0 || !ROOTS[rootIndex]) return "Unresolved";
    return mode === "river" ? ROOTS[rootIndex].riverName : ROOTS[rootIndex].mathName;
  }

  function rootCssColour(rootIndex, alpha = 1) {
    if (rootIndex < 0 || !ROOTS[rootIndex]) return `rgba(255,255,255,${alpha})`;
    const [r, g, b] = ROOTS[rootIndex].colour;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mapQueryUrl(query, embed = false) {
    const encoded = encodeURIComponent(query);
    return embed
      ? `https://www.google.com/maps?q=${encoded}&output=embed`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  }

  function classifyPoint(x, y, maxIter = state.maxIter, includeOrbit = false) {
    const orbit = includeOrbit ? [{ x, y }] : null;
    let zx = x;
    let zy = y;
    const tolerance2 = 1e-12;

    for (let iteration = 0; iteration < maxIter; iteration += 1) {
      const zx2 = zx * zx;
      const zy2 = zy * zy;
      const fx = zx * zx2 - 3 * zx * zy2 - 1;
      const fy = 3 * zx2 * zy - zy * zy2;
      const fpx = 3 * (zx2 - zy2);
      const fpy = 6 * zx * zy;
      const denominator = fpx * fpx + fpy * fpy;

      if (denominator < 1e-20 || !Number.isFinite(denominator)) {
        return { root: -1, iterations: iteration, x: zx, y: zy, orbit };
      }

      const divisionX = (fx * fpx + fy * fpy) / denominator;
      const divisionY = (fy * fpx - fx * fpy) / denominator;
      zx -= divisionX;
      zy -= divisionY;

      if (includeOrbit) orbit.push({ x: zx, y: zy });

      for (let rootIndex = 0; rootIndex < ROOTS.length; rootIndex += 1) {
        const dx = zx - ROOTS[rootIndex].x;
        const dy = zy - ROOTS[rootIndex].y;
        if (dx * dx + dy * dy < tolerance2) {
          return { root: rootIndex, iterations: iteration + 1, x: zx, y: zy, orbit };
        }
      }
    }

    return { root: -1, iterations: maxIter, x: zx, y: zy, orbit };
  }

  function colourFor(result) {
    if (result.root < 0) return [8, 12, 24];

    const base = ROOTS[result.root].colour;
    const depth = clamp(result.iterations / state.maxIter, 0, 1);
    const factor = state.emphasise
      ? 0.24 + 0.76 * Math.pow(depth, 0.48)
      : 0.38 + 0.62 * Math.pow(1 - depth, 0.55);

    return base.map(channel => Math.round(clamp(channel * factor, 0, 255)));
  }

  function pixelToPoint(px, py) {
    return {
      x: state.centerX + ((px / canvas.width) - 0.5) * state.span,
      y: state.centerY + (0.5 - (py / canvas.height)) * state.span
    };
  }

  function pointToPixel(point) {
    return {
      x: ((point.x - state.centerX) / state.span + 0.5) * canvas.width,
      y: (0.5 - (point.y - state.centerY) / state.span) * canvas.height
    };
  }

  function resizeCanvas() {
    const cssSize = Math.max(320, Math.floor(shell.clientWidth));
    const target = Math.min(560, Math.max(360, cssSize));

    if (canvas.width !== target || canvas.height !== target) {
      canvas.width = target;
      canvas.height = target;
      state.baseImage = null;
      renderFractal();
    } else {
      drawOverlay();
    }
  }

  function setRenderStatus(text, busy = false) {
    renderStatus.textContent = text;
    renderStatus.classList.toggle("is-busy", busy);
  }

  function renderFractal() {
    const token = ++state.renderToken;
    const width = canvas.width;
    const height = canvas.height;
    const image = ctx.createImageData(width, height);
    const data = image.data;
    let row = 0;
    const rowsPerFrame = width > 650 ? 8 : 12;

    setRenderStatus("Calculating a stable view…", true);

    function renderChunk() {
      if (token !== state.renderToken) return;

      const endRow = Math.min(height, row + rowsPerFrame);
      for (; row < endRow; row += 1) {
        for (let column = 0; column < width; column += 1) {
          const point = pixelToPoint(column, row);
          const result = classifyPoint(point.x, point.y);
          const colour = colourFor(result);
          const index = (row * width + column) * 4;
          data[index] = colour[0];
          data[index + 1] = colour[1];
          data[index + 2] = colour[2];
          data[index + 3] = 255;
        }
      }

      if (row < height) {
        setRenderStatus(`Calculating ${Math.round((row / height) * 100)}%`, true);
        requestAnimationFrame(renderChunk);
        return;
      }

      if (token !== state.renderToken) return;
      state.baseImage = image;
      ctx.putImageData(image, 0, 0);
      setRenderStatus(`Ready · view width ${format(state.span, state.span < 0.01 ? 6 : 3)}`);
      drawOverlay(false);
      assessBoundary();
    }

    requestAnimationFrame(renderChunk);
  }

  function drawCircle(point, radius, fill, stroke, lineWidth = 2) {
    const pixel = pointToPixel(point);
    if (pixel.x < -30 || pixel.x > canvas.width + 30 || pixel.y < -30 || pixel.y > canvas.height + 30) return;

    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawCanvasLabel(point, text, dx, dy) {
    const pixel = pointToPixel(point);
    const fontSize = Math.max(12, Math.round(canvas.width * 0.021));
    ctx.font = `800 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(text);
    const paddingX = Math.round(fontSize * 0.55);
    const height = Math.round(fontSize * 1.7);
    let x = pixel.x + dx;
    let y = pixel.y + dy;
    x = clamp(x, 8, canvas.width - metrics.width - paddingX * 2 - 8);
    y = clamp(y, height + 8, canvas.height - 8);

    ctx.fillStyle = "rgba(7,11,20,0.76)";
    ctx.beginPath();
    ctx.roundRect(x, y - height, metrics.width + paddingX * 2, height, height / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + paddingX, y - height / 2);
  }

  function drawNamedMarker(point, letter, rootIndex) {
    const pixel = pointToPixel(point);
    const radius = Math.max(8, canvas.width * 0.015);
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = rootCssColour(rootIndex, 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.fill();
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    ctx.strokeStyle = "rgba(7,11,20,0.92)";
    ctx.stroke();
    ctx.fillStyle = "#07101c";
    ctx.font = `950 ${Math.max(12, Math.round(radius * 1.25))}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, pixel.x, pixel.y + 0.5);
    ctx.textAlign = "start";
  }

  function drawOrbit(point, rootIndex) {
    const result = classifyPoint(point.x, point.y, state.maxIter, true);
    const orbit = result.orbit || [];
    if (orbit.length < 2) return;

    ctx.save();
    ctx.setLineDash([Math.max(3, canvas.width * 0.006), Math.max(4, canvas.width * 0.008)]);
    ctx.beginPath();
    orbit.slice(0, 18).forEach((orbitPoint, index) => {
      const pixel = pointToPixel(orbitPoint);
      if (index === 0) ctx.moveTo(pixel.x, pixel.y);
      else ctx.lineTo(pixel.x, pixel.y);
    });
    ctx.strokeStyle = rootCssColour(rootIndex, 0.55);
    ctx.lineWidth = Math.max(1.2, canvas.width * 0.0022);
    ctx.stroke();
    ctx.restore();
  }

  function positionEdgeCallout() {
    if (!state.edgePoint) {
      edgeCallout.hidden = true;
      return;
    }

    const pixel = pointToPixel(state.edgePoint);
    if (pixel.x < 0 || pixel.x > canvas.width || pixel.y < 0 || pixel.y > canvas.height) {
      edgeCallout.hidden = true;
      return;
    }

    const x = (pixel.x / canvas.width) * shell.clientWidth;
    const y = (pixel.y / canvas.height) * shell.clientHeight;
    const calloutWidth = shell.clientWidth < 500 ? 165 : 220;
    const left = x > shell.clientWidth * 0.62 ? x - calloutWidth - 18 : x + 18;
    const top = clamp(y - 24, 12, shell.clientHeight - 76);

    edgeCallout.style.left = `${clamp(left, 10, shell.clientWidth - calloutWidth - 10)}px`;
    edgeCallout.style.top = `${top}px`;
    edgeCallout.style.transform = "none";
    edgeCallout.hidden = false;
  }

  function drawMovementArrow(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return;
    const from = pointToPixel(fromPoint);
    const to = pointToPixel(toPoint);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 3) return;

    const angle = Math.atan2(dy, dx);
    const head = Math.max(8, canvas.width * 0.014);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    ctx.setLineDash([Math.max(4, canvas.width * 0.007), Math.max(4, canvas.width * 0.008)]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawOverlay(restoreBase = true) {
    if (restoreBase && state.baseImage) ctx.putImageData(state.baseImage, 0, 0);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ROOTS.forEach(root => {
      drawCircle(root, Math.max(4, canvas.width * 0.008), "rgba(255,255,255,0.92)", "rgba(7,11,20,0.9)", 2);
    });

    if (state.span > 1.55) {
      drawCanvasLabel(ROOTS[0], rootName(0), -canvas.width * 0.20, -canvas.height * 0.02);
      drawCanvasLabel(ROOTS[1], rootName(1), canvas.width * 0.025, canvas.height * 0.09);
      drawCanvasLabel(ROOTS[2], rootName(2), canvas.width * 0.025, -canvas.height * 0.055);
    }

    if (state.pair) {
      if (state.showRoutes) {
        drawOrbit(state.pair.a, state.pair.rootA);
        drawOrbit(state.pair.b, state.pair.rootB);
      }
      drawNamedMarker(state.pair.a, "A", state.pair.rootA);
      drawNamedMarker(state.pair.b, "B", state.pair.rootB);
    } else if (state.mode === "river") {
      const result = classifyPoint(state.reachPoint.x, state.reachPoint.y);
      if (state.previousReachPoint) {
        drawCircle(
          state.previousReachPoint,
          Math.max(6, canvas.width * 0.010),
          "rgba(7,11,20,0.18)",
          "rgba(255,255,255,0.52)",
          Math.max(1.5, canvas.width * 0.0025)
        );
        drawMovementArrow(state.previousReachPoint, state.reachPoint);
      }
      if (state.showRoutes) drawOrbit(state.reachPoint, result.root);
      drawCircle(
        state.reachPoint,
        Math.max(10, canvas.width * 0.016),
        rootCssColour(result.root, 0.32),
        "rgba(255,255,255,0.98)",
        Math.max(3, canvas.width * 0.0045)
      );
    }

    if (state.selectedPoint && !state.pair && state.mode !== "river") {
      const result = classifyPoint(state.selectedPoint.x, state.selectedPoint.y);
      if (state.showRoutes) drawOrbit(state.selectedPoint, result.root);
      drawCircle(
        state.selectedPoint,
        Math.max(5, canvas.width * 0.009),
        "rgba(255,255,255,0.97)",
        "rgba(7,11,20,0.95)",
        2
      );
    }

    ctx.restore();
    positionEdgeCallout();
  }

  function selectedCopy(result) {
    if (result.root < 0) {
      return {
        title: "No final outcome within the current limit",
        text: "Increase the detail level if you want the calculation to continue for longer."
      };
    }

    if (state.mode === "river") {
      const riverText = [
        "In the river analogy, this colour represents a self-reinforcing recovery trajectory. It is not an assessment of the selected reach.",
        "In the river analogy, this colour represents a fragile or oscillatory condition. It is not an assessment of the selected reach.",
        "In the river analogy, this colour represents a persistent degraded condition. It is not an assessment of the selected reach."
      ];
      return { title: ROOTS[result.root].riverName, text: riverText[result.root] };
    }

    return {
      title: ROOTS[result.root].mathName,
      text: `This starting condition settles into ${ROOTS[result.root].mathName} after ${result.iterations} calculation steps.`
    };
  }

  function updateSelectedOutcome(point = state.selectedPoint) {
    if (!point) {
      selectedOutcome.textContent = "Click anywhere in the coloured field";
      selectedOutcomeText.textContent = "The selected point will be classified by the final outcome it reaches.";
      selectedCoordinate.textContent = "–";
      selectedAttractor.textContent = "–";
      selectedIterations.textContent = "–";
      return;
    }

    const result = classifyPoint(point.x, point.y, state.maxIter, state.showRoutes);
    const copy = selectedCopy(result);
    selectedOutcome.textContent = copy.title;
    selectedOutcomeText.textContent = copy.text;
    selectedCoordinate.textContent = `${format(point.x, 6)}, ${format(point.y, 6)}`;
    selectedAttractor.textContent = rootName(result.root);
    selectedIterations.textContent = String(result.iterations);
  }

  function updateReachOutcome(actionText, previousRoot = null, previousPoint = null) {
    const result = classifyPoint(state.reachPoint.x, state.reachPoint.y);
    const copy = selectedCopy(result);
    currentOutcome.textContent = copy.title;
    currentOutcomeText.textContent = copy.text;
    stateCoordinate.textContent = `${format(state.reachPoint.x, 6)}, ${format(state.reachPoint.y, 6)}`;
    stateIterations.textContent = result.root < 0 ? `>${state.maxIter}` : String(result.iterations);

    const changed = previousRoot !== null && previousRoot !== result.root;
    if (actionText) {
      lastAction.textContent = changed ? `${actionText}; final outcome changed` : actionText;
    }

    riverBeforeOutcome.textContent = previousRoot === null
      ? "Before: not yet moved"
      : `Before: ${rootName(previousRoot, "river")}`;
    riverAfterOutcome.textContent = `Now: ${rootName(result.root, "river")}`;

    if (previousRoot !== null) {
      riverActionResult.className = `river-action-result ${changed ? "is-change" : "is-same"}`;
      riverActionResult.textContent = changed
        ? `${actionText}. The marker crossed into another colour, so the illustrative final outcome changed.`
        : `${actionText}. The marker remained in the same colour, so the illustrative final outcome stayed the same.`;
    }

    state.previousReachPoint = previousPoint ? { ...previousPoint } : null;
    state.previousReachRoot = previousRoot;

    if (state.mode === "river") {
      state.selectedPoint = { ...state.reachPoint };
      updateSelectedOutcome(state.selectedPoint);
    }

    drawOverlay();
    assessBoundary();
  }

  function sampleLocalDiversity(point, radius, samples = 40) {
    const outcomes = new Set();
    let slow = 0;

    for (let index = 0; index < samples; index += 1) {
      const angle = (Math.PI * 2 * index) / samples;
      const wobble = 0.3 + 0.7 * ((index % 9) / 8);
      const test = {
        x: point.x + Math.cos(angle) * radius * wobble,
        y: point.y + Math.sin(angle) * radius * wobble
      };
      const result = classifyPoint(test.x, test.y);
      if (result.root >= 0) outcomes.add(result.root);
      if (result.iterations > state.maxIter * 0.55) slow += 1;
    }

    return {
      distinct: outcomes.size,
      slowFraction: slow / samples,
      score: clamp(((outcomes.size - 1) / 2) * 0.76 + (slow / samples) * 0.24, 0, 1)
    };
  }

  function assessBoundary() {
    let target = null;
    let radius = state.span * 0.0065;

    if (state.pair) {
      target = midpoint(state.pair.a, state.pair.b);
      radius = Math.max(distanceBetween(state.pair.a, state.pair.b) * 3, state.span * 0.004);
    } else if (state.selectedPoint) {
      target = state.selectedPoint;
    } else if (state.mode === "river") {
      target = state.reachPoint;
    }

    if (!target) {
      boundaryAssessment.textContent = "Select or find an edge";
      boundaryAssessmentText.textContent = "The demo samples a small neighbourhood to see whether nearby starting conditions share one outcome or split between several.";
      boundaryMetric.textContent = "No local sample yet.";
      boundaryMeterFill.style.width = "0%";
      return;
    }

    const diversity = sampleLocalDiversity(target, radius);
    boundaryMeterFill.style.width = `${Math.round(diversity.score * 100)}%`;

    if (diversity.distinct >= 3) {
      boundaryAssessment.textContent = "All three outcomes occur nearby";
      boundaryAssessmentText.textContent = "A very small neighbourhood contains starting conditions leading to all three outcomes. This is a highly entangled part of the boundary.";
    } else if (diversity.distinct === 2) {
      boundaryAssessment.textContent = "Two different futures meet here";
      boundaryAssessmentText.textContent = "Nearby starting conditions divide between two outcomes. Zoom again: a fractal edge keeps revealing further interwoven structure.";
    } else {
      boundaryAssessment.textContent = "One outcome dominates at this scale";
      boundaryAssessmentText.textContent = "Nearby starting conditions currently share one outcome. Move toward the fine coloured lace or use Find a sensitive edge.";
    }

    boundaryMetric.textContent = `${diversity.distinct} nearby outcome class${diversity.distinct === 1 ? "" : "es"}; ${Math.round(diversity.slowFraction * 100)}% of samples took a long route.`;
  }

  function findBoundarySeed(target) {
    const grid = 96;
    let best = null;
    let bestScore = Infinity;
    let previousRow = new Array(grid).fill(null);

    for (let row = 0; row < grid; row += 1) {
      let previous = null;
      const currentRow = new Array(grid);

      for (let column = 0; column < grid; column += 1) {
        const point = {
          x: state.centerX + ((column / (grid - 1)) - 0.5) * state.span,
          y: state.centerY + (0.5 - (row / (grid - 1))) * state.span
        };
        const result = classifyPoint(point.x, point.y);
        const current = { point, root: result.root };
        currentRow[column] = current;

        const candidates = [];
        if (previous && previous.root >= 0 && current.root >= 0 && previous.root !== current.root) {
          candidates.push([previous, current]);
        }
        const above = previousRow[column];
        if (above && above.root >= 0 && current.root >= 0 && above.root !== current.root) {
          candidates.push([above, current]);
        }

        candidates.forEach(([a, b]) => {
          const middle = midpoint(a.point, b.point);
          const distanceScore = (middle.x - target.x) ** 2 + (middle.y - target.y) ** 2;
          if (distanceScore < bestScore) {
            bestScore = distanceScore;
            best = { a: a.point, b: b.point, rootA: a.root, rootB: b.root };
          }
        });

        previous = current;
      }

      previousRow = currentRow;
    }

    return best;
  }

  function refineDifferentPair(seed, passes = 9) {
    let a = { ...seed.a };
    let b = { ...seed.b };
    let rootA = classifyPoint(a.x, a.y).root;
    let rootB = classifyPoint(b.x, b.y).root;

    if (rootA < 0 || rootB < 0 || rootA === rootB) return null;

    for (let pass = 0; pass < passes; pass += 1) {
      const middle = midpoint(a, b);
      const middleRoot = classifyPoint(middle.x, middle.y).root;

      if (middleRoot < 0) {
        b = middle;
        continue;
      }

      if (middleRoot === rootA) {
        a = middle;
      } else {
        b = middle;
        rootB = middleRoot;
      }
    }

    rootA = classifyPoint(a.x, a.y).root;
    rootB = classifyPoint(b.x, b.y).root;
    if (rootA < 0 || rootB < 0 || rootA === rootB) return null;

    return { a, b, rootA, rootB };
  }

  function updateGuideResult(pair) {
    const separation = distanceBetween(pair.a, pair.b);
    const originalPercent = (separation / 3.4) * 100;
    pairAOutcome.textContent = rootName(pair.rootA, "learn");
    pairBOutcome.textContent = rootName(pair.rootB, "learn");

    const pairABox = guideResult.querySelector(".pair-a");
    const pairBBox = guideResult.querySelector(".pair-b");
    pairABox.style.setProperty("--pair-colour", rootCssColour(pair.rootA));
    pairBBox.style.setProperty("--pair-colour", rootCssColour(pair.rootB));

    pairDifferenceText.textContent = `The two starts are only ${formatDistance(separation)} units apart (${originalPercent.toFixed(4)}% of the original field), but one finishes in the ${rootName(pair.rootA, "learn").toLowerCase()} and the other in the ${rootName(pair.rootB, "learn").toLowerCase()}. That sensitivity is the point of the experiment.`;
    guidePlaceholder.hidden = true;
    guideContent.hidden = false;
    showPairButton.textContent = "Find another nearby pair";
    zoomDeeperButton.disabled = false;
  }

  function runPairExperiment(deeper = false) {
    if (state.mode !== "learn") setMode("learn");

    if (deeper && state.pair) {
      const centre = midpoint(state.pair.a, state.pair.b);
      state.centerX = centre.x;
      state.centerY = centre.y;
      state.span = clamp(state.span * 0.28, 0.00003, 12);
    }

    let target = state.pair ? midpoint(state.pair.a, state.pair.b) : { x: state.centerX, y: state.centerY };
    let seed = findBoundarySeed(target);

    if (!seed) {
      state.centerX = 0;
      state.centerY = 0;
      state.span = 3.4;
      target = { x: 0, y: 0 };
      seed = findBoundarySeed(target);
    }

    if (!seed) {
      visualSummary.textContent = "No boundary pair was found in this view. Reset the view and try again.";
      return;
    }

    const pair = refineDifferentPair(seed);
    if (!pair) {
      visualSummary.textContent = "The boundary was located, but a stable nearby pair could not be refined. Try again.";
      return;
    }

    const centre = midpoint(pair.a, pair.b);
    const separation = distanceBetween(pair.a, pair.b);
    state.pair = pair;
    state.edgePoint = centre;
    state.selectedPoint = { ...pair.a };
    state.centerX = centre.x;
    state.centerY = centre.y;
    state.span = clamp(separation * 34, 0.00003, 3.4);

    updateGuideResult(pair);
    updateSelectedOutcome(pair.a);
    visualSummary.textContent = "A and B are almost neighbours, but they sit on opposite sides of a recursively intricate outcome boundary.";
    renderFractal();
  }

  function findSensitiveEdge() {
    if (state.mode === "learn") {
      runPairExperiment(false);
      return;
    }

    const target = state.selectedPoint || state.reachPoint;
    const seed = findBoundarySeed(target);
    const pair = seed ? refineDifferentPair(seed) : null;
    if (!pair) return;

    const centre = midpoint(pair.a, pair.b);
    const separation = distanceBetween(pair.a, pair.b);
    state.pair = null;
    state.selectedPoint = centre;
    state.reachPoint = { ...centre };
    state.previousReachPoint = null;
    state.previousReachRoot = null;
    state.edgePoint = centre;
    state.centerX = centre.x;
    state.centerY = centre.y;
    state.span = clamp(Math.max(separation * 48, 0.14), 0.08, 3.4);
    visualSummary.textContent = "The white ring is now placed on a sensitive edge. Apply a storm or intervention and watch whether it enters another colour.";
    riverActionResult.className = "river-action-result";
    riverActionResult.textContent = "Point placed near a sensitive edge. Now apply a storm or intervention.";
    updateReachOutcome("Point placed near a sensitive edge");
    renderFractal();
  }

  function updateModeLabels() {
    const riverMode = state.mode === "river";
    legendA.textContent = riverMode ? ROOTS[0].riverName : ROOTS[0].mathName;
    legendB.textContent = riverMode ? ROOTS[1].riverName : ROOTS[1].mathName;
    legendC.textContent = riverMode ? ROOTS[2].riverName : ROOTS[2].mathName;

    fractalSubheading.textContent = riverMode
      ? "Click anywhere to place the river-state marker. Storm and intervention buttons move it across this abstract outcome map."
      : "Each colour is a different final outcome. The intricate edge between the colours is the fractal boundary.";
    canvasHint.textContent = riverMode
      ? "Click to place the state marker · then apply storm or intervention"
      : "Click to inspect · double-click or scroll to zoom";
  }

  function setMode(mode) {
    if (!['learn', 'river'].includes(mode)) return;
    state.mode = mode;
    document.body.dataset.demoMode = mode;

    const learnButton = document.getElementById("learnModeButton");
    const riverButton = document.getElementById("riverModeButton");
    const learnActive = mode === "learn";
    learnButton.classList.toggle("is-active", learnActive);
    riverButton.classList.toggle("is-active", !learnActive);
    learnButton.setAttribute("aria-pressed", String(learnActive));
    riverButton.setAttribute("aria-pressed", String(!learnActive));

    state.centerX = 0;
    state.centerY = 0;
    state.span = 3.4;
    state.pair = null;
    state.edgePoint = null;
    state.previousReachPoint = null;
    state.previousReachRoot = null;
    edgeCallout.hidden = true;

    if (learnActive) {
      state.selectedPoint = null;
      visualSummary.textContent = "Large solid regions are comparatively predictable. The thin multicoloured structures are sensitive boundaries.";
      updateSelectedOutcome(null);
      assessBoundary();
    } else {
      state.selectedPoint = { ...state.reachPoint };
      visualSummary.textContent = "The white ring is the starting condition. Click elsewhere or use the edge button, then perturb it.";
      riverActionResult.className = "river-action-result";
      riverActionResult.textContent = "Step 1: click in the coloured field or place the point near a sensitive edge.";
      updateReachOutcome("Initial illustrative position");
    }

    updateModeLabels();
    renderFractal();
  }

  function updateReachDom(key) {
    const reach = REACHES[key];
    mapFrame.src = mapQueryUrl(reach.query, true);
    openMapLink.href = mapQueryUrl(reach.query, false);
    reachName.textContent = reach.name;
    reachDescription.textContent = reach.description;

    document.querySelectorAll(".reach-button").forEach(button => {
      button.classList.toggle("is-active", button.dataset.reach === key);
    });
  }

  function setReach(key) {
    const reach = REACHES[key];
    if (!reach) return;

    state.reachKey = key;
    state.reachPoint = { ...reach.point };
    state.reachBasePoint = { ...reach.point };
    state.previousReachPoint = null;
    state.previousReachRoot = null;
    state.selectedPoint = { ...reach.point };
    state.pair = null;
    state.edgePoint = null;
    updateReachDom(key);
    riverActionResult.className = "river-action-result";
    riverActionResult.textContent = "Reach selected. Now click in the coloured field or place the point near a sensitive edge.";
    updateReachOutcome("Initial illustrative position");
    drawOverlay();
  }

  function perturbReach(vector, actionText) {
    const previousPoint = { ...state.reachPoint };
    const previousRoot = classifyPoint(previousPoint.x, previousPoint.y).root;
    state.reachPoint = {
      x: previousPoint.x + vector.x,
      y: previousPoint.y + vector.y
    };
    state.selectedPoint = { ...state.reachPoint };
    state.pair = null;
    state.edgePoint = null;
    updateReachOutcome(actionText, previousRoot, previousPoint);
  }

  function resetReach() {
    const reach = REACHES[state.reachKey];
    state.reachPoint = { ...reach.point };
    state.reachBasePoint = { ...reach.point };
    state.previousReachPoint = null;
    state.previousReachRoot = null;
    state.selectedPoint = { ...reach.point };
    state.pair = null;
    state.edgePoint = null;
    riverActionResult.className = "river-action-result";
    riverActionResult.textContent = "Reset. Click in the coloured field or place the point near a sensitive edge.";
    updateReachOutcome("Reset to the illustrative starting condition");
  }

  function resetView() {
    state.centerX = 0;
    state.centerY = 0;
    state.span = 3.4;
    state.pair = null;
    state.edgePoint = null;
    edgeCallout.hidden = true;

    if (state.mode === "learn") {
      state.selectedPoint = null;
      guidePlaceholder.hidden = false;
      guideContent.hidden = true;
      showPairButton.textContent = "Show me";
      zoomDeeperButton.disabled = true;
      visualSummary.textContent = "Large solid regions are comparatively predictable. The thin multicoloured structures are sensitive boundaries.";
      updateSelectedOutcome(null);
    } else {
      state.previousReachPoint = null;
      state.previousReachRoot = null;
      state.selectedPoint = { ...state.reachPoint };
      visualSummary.textContent = "The white ring is the starting condition. Click elsewhere or use the edge button, then perturb it.";
      riverActionResult.className = "river-action-result";
      riverActionResult.textContent = "View reset. The state point itself has not moved.";
      updateSelectedOutcome(state.selectedPoint);
    }

    renderFractal();
  }

  function zoomAt(point, factor) {
    state.centerX = point.x;
    state.centerY = point.y;
    state.span = clamp(state.span * factor, 0.00003, 12);
    renderFractal();
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return pixelToPoint(
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY
    );
  }

  canvas.addEventListener("pointermove", event => {
    const point = eventPoint(event);
    state.lastPointer = point;
    canvasCoordinate.textContent = `x ${format(point.x, 5)} · y ${format(point.y, 5)}`;
  });

  canvas.addEventListener("click", event => {
    state.pair = null;
    state.edgePoint = null;
    edgeCallout.hidden = true;
    const point = eventPoint(event);

    if (state.mode === "river") {
      state.reachPoint = { ...point };
      state.previousReachPoint = null;
      state.previousReachRoot = null;
      state.selectedPoint = { ...point };
      riverActionResult.className = "river-action-result";
      riverActionResult.textContent = "Starting point placed. Now apply a storm or intervention.";
      updateReachOutcome("Starting point placed manually");
      return;
    }

    state.selectedPoint = point;
    updateSelectedOutcome(state.selectedPoint);
    assessBoundary();
    drawOverlay();
  });

  canvas.addEventListener("dblclick", event => {
    event.preventDefault();
    const point = eventPoint(event);
    state.pair = null;
    state.edgePoint = point;
    state.selectedPoint = point;
    if (state.mode === "river") {
      state.reachPoint = { ...point };
      state.previousReachPoint = null;
      state.previousReachRoot = null;
    }
    zoomAt(point, 0.42);
  });

  let wheelTimer = null;
  let pendingWheel = null;
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    pendingWheel = {
      point: eventPoint(event),
      factor: event.deltaY > 0 ? 1.28 : 0.78
    };
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => {
      if (!pendingWheel) return;
      zoomAt(pendingWheel.point, pendingWheel.factor);
      pendingWheel = null;
    }, 90);
  }, { passive: false });

  document.getElementById("learnModeButton").addEventListener("click", () => setMode("learn"));
  document.getElementById("riverModeButton").addEventListener("click", () => setMode("river"));
  showPairButton.addEventListener("click", () => runPairExperiment(false));
  zoomDeeperButton.addEventListener("click", () => runPairExperiment(true));
  document.getElementById("sensitiveEdgeButton").addEventListener("click", findSensitiveEdge);
  document.getElementById("edgeStartButton").addEventListener("click", findSensitiveEdge);
  document.getElementById("resetViewButton").addEventListener("click", resetView);

  document.getElementById("zoomInButton").addEventListener("click", () => {
    zoomAt(state.selectedPoint || state.edgePoint || { x: state.centerX, y: state.centerY }, 0.5);
  });

  document.getElementById("zoomOutButton").addEventListener("click", () => {
    zoomAt({ x: state.centerX, y: state.centerY }, 2);
  });

  document.querySelectorAll(".reach-button").forEach(button => {
    button.addEventListener("click", () => setReach(button.dataset.reach));
  });

  document.getElementById("stormButton").addEventListener("click", () => {
    perturbReach(REACHES[state.reachKey].storm, "Small storm pulse applied");
  });

  document.getElementById("interventionButton").addEventListener("click", () => {
    perturbReach(REACHES[state.reachKey].intervention, "Illustrative intervention applied");
  });

  document.getElementById("resetReachButton").addEventListener("click", resetReach);

  iterationRange.addEventListener("input", () => {
    state.maxIter = Number(iterationRange.value);
    iterationValue.textContent = String(state.maxIter);
  });

  iterationRange.addEventListener("change", () => {
    updateSelectedOutcome(state.selectedPoint);
    if (state.mode === "river") updateReachOutcome();
    renderFractal();
  });

  emphasiseBoundary.addEventListener("change", () => {
    state.emphasise = emphasiseBoundary.checked;
    renderFractal();
  });

  showRoutes.addEventListener("change", () => {
    state.showRoutes = showRoutes.checked;
    updateSelectedOutcome(state.selectedPoint);
    drawOverlay();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeCanvas, 120);
  });

  updateReachDom(state.reachKey);
  updateModeLabels();
  updateReachOutcome("Initial illustrative position");
  resizeCanvas();
})();
