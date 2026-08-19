import { getClassicalRadialProfile } from './classical-profile.js';
import { SHAPE_NAMES, shapeDescription } from './shape-model.js';

const shapeSelect = document.getElementById('shapeSelect');
const radialCanvas = document.getElementById('radialPlot');
const resolutionControl = document.getElementById('probabilityResolution');
const analysisCopy = document.querySelector('.analysis-copy > p');
const chartCaption = document.querySelector('.analysis-chart .chart-heading > span');
const summary = document.getElementById('classicalSummary');
const probeReadout = document.getElementById('probeReadout');

if (shapeSelect && radialCanvas) {
  let observed = null;
  let activeProbe = null;
  let currentProfile = null;

  function interpolate(radii, values, r) {
    if (!radii?.length || !values?.length) return null;
    if (r <= radii[0]) return values[0];
    if (r >= radii[radii.length - 1]) return values[values.length - 1];
    for (let i = 1; i < radii.length; i += 1) {
      if (r <= radii[i]) {
        const span = radii[i] - radii[i - 1] || 1;
        const t = (r - radii[i - 1]) / span;
        return values[i - 1] + (values[i] - values[i - 1]) * t;
      }
    }
    return values[values.length - 1];
  }

  function drawProfile(profile) {
    currentProfile = profile;
    const ctx = radialCanvas.getContext('2d');
    const width = radialCanvas.width;
    const height = radialCanvas.height;
    const left = 48;
    const right = 18;
    const top = 42;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07131d';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,.075)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = top + plotHeight * i / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i += 1) {
      const x = left + plotWidth * i / 4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
    }

    function drawSeries(radii, values, colour, { dashed = false, width = 2.5 } = {}) {
      if (!values?.length) return;
      ctx.save();
      if (dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = left + plotWidth * radii[index];
        const y = top + (1 - value) * plotHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    if (observed?.shape === profile.shape && observed.occupancy?.length) {
      drawSeries(observed.radii, observed.occupancy, '#ffffff', { dashed: true, width: 1.8 });
    }
    drawSeries(profile.radii, profile.occupancy, '#66e4ff');
    drawSeries(profile.radii, profile.shell, '#a391ff', { width: 2 });

    if (profile.guaranteedRadius > 0.02 && profile.guaranteedRadius < 0.995) {
      const x = left + plotWidth * profile.guaranteedRadius;
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(225,242,250,.7)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('always-occupied core ends', Math.min(x + 6, width - 142), top + 14);
    }

    if (activeProbe !== null) {
      const r = Math.max(0, Math.min(1, activeProbe));
      const x = left + plotWidth * r;
      const p = interpolate(profile.radii, profile.occupancy, r) ?? 0;
      ctx.strokeStyle = 'rgba(246,201,107,.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
      ctx.fillStyle = '#f6c96b';
      ctx.beginPath();
      ctx.arc(x, top + (1 - p) * plotHeight, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, 10, 18, 2);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('observed probe', left + 24, 15);
    ctx.fillStyle = '#66e4ff';
    ctx.fillRect(left + 112, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('full p(r)', left + 136, 15);
    ctx.fillStyle = '#a391ff';
    ctx.fillRect(left + 206, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('relative r²p(r)', left + 230, 15);

    ctx.fillStyle = 'rgba(220,238,247,.72)';
    ctx.fillText('1', 28, top + 4);
    ctx.fillText('0.5', 20, top + plotHeight / 2 + 4);
    ctx.fillText('0', 30, height - bottom + 4);
    ctx.fillText('0', left - 3, height - 14);
    ctx.fillText('0.5', left + plotWidth / 2 - 8, height - 14);
    ctx.fillText('1', width - right - 3, height - 14);
    ctx.fillText('r / rmax', width - 62, height - 2);
  }

  function updateText(profile) {
    const p0 = profile.occupancy[0] ?? 0;
    const outer = interpolate(profile.radii, profile.occupancy, 0.9) ?? 0;
    const coreText = profile.guaranteedRadius > 0.001
      ? `always-occupied core to r=${profile.guaranteedRadius.toFixed(3)} rmax`
      : 'no always-occupied central core';

    if (analysisCopy) {
      analysisCopy.innerHTML = `The <strong>solid cyan</strong> curve is the full rotational limit. The <strong>dashed white</strong> curve is what one fixed probe direction has learned from the orientations actually visited so far. As coverage grows, the observed probe should converge toward the rotational limit. Drag the graph to inspect a spherical shell in the 3D view.`;
    }
    if (chartCaption) chartCaption.textContent = 'observed → full rotational limit';
    if (summary) {
      summary.textContent = `${profile.shapeName}: centre p=${p0.toFixed(2)} · ${coreText} · p(0.90 rmax)=${outer.toFixed(2)}.`;
    }
  }

  function render() {
    const level = Number(resolutionControl?.value || 3);
    const profile = getClassicalRadialProfile(shapeSelect.value, level);
    drawProfile(profile);
    updateText(profile);
  }

  function probeFromPointer(event) {
    const rect = radialCanvas.getBoundingClientRect();
    const scaleX = radialCanvas.width / rect.width;
    const x = (event.clientX - rect.left) * scaleX;
    const left = 48;
    const right = 18;
    activeProbe = Math.max(0, Math.min(1, (x - left) / (radialCanvas.width - left - right)));
    const pLimit = currentProfile ? interpolate(currentProfile.radii, currentProfile.occupancy, activeProbe) : null;
    const pObserved = observed?.shape === shapeSelect.value
      ? interpolate(observed.radii, observed.occupancy, activeProbe)
      : null;

    if (probeReadout) {
      probeReadout.textContent = `r=${activeProbe.toFixed(2)} rmax · full p=${(pLimit ?? 0).toFixed(2)}${pObserved === null ? '' : ` · observed p=${pObserved.toFixed(2)}`}`;
    }

    window.dispatchEvent(new CustomEvent('sphere-radius-probe', {
      detail: {
        radius: activeProbe,
        limitProbability: pLimit,
        observedProbability: pObserved,
        shape: shapeSelect.value
      }
    }));
    render();
  }

  radialCanvas.addEventListener('pointerdown', event => {
    radialCanvas.setPointerCapture?.(event.pointerId);
    probeFromPointer(event);
  });
  radialCanvas.addEventListener('pointermove', event => {
    if (event.buttons || event.pointerType === 'touch') probeFromPointer(event);
  });

  shapeSelect.addEventListener('change', () => {
    observed = null;
    activeProbe = null;
    if (probeReadout) probeReadout.textContent = shapeDescription(shapeSelect.value);
    render();
  });
  resolutionControl?.addEventListener('input', render);

  window.addEventListener('sphere-observed-profile', event => {
    observed = event.detail || null;
    render();
  });
  window.addEventListener('resize', render, { passive: true });

  if (probeReadout) probeReadout.textContent = shapeDescription(shapeSelect.value);
  render();
}
