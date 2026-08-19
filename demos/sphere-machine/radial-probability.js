import { getClassicalRadialProfile } from './classical-profile.js';

const shapeSelect = document.getElementById('shapeSelect');
const radialCanvas = document.getElementById('radialPlot');
const resolutionControl = document.getElementById('probabilityResolution');
const analysisCopy = document.querySelector('.analysis-copy > p');
const chartCaption = document.querySelector('.analysis-chart .chart-heading > span');

if (shapeSelect && radialCanvas) {
  function drawProfile(profile) {
    const ctx = radialCanvas.getContext('2d');
    const width = radialCanvas.width;
    const height = radialCanvas.height;
    const left = 46;
    const right = 18;
    const top = 30;
    const bottom = 38;
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

    function drawSeries(values, colour) {
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = left + plotWidth * profile.radii[index];
        const y = top + (1 - value) * plotHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    drawSeries(profile.occupancy, '#66e4ff');
    drawSeries(profile.shell, '#a391ff');

    if (profile.guaranteedRadius > 0.02 && profile.guaranteedRadius < 0.995) {
      const x = left + plotWidth * profile.guaranteedRadius;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(225,242,250,.78)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('p = 1 core', Math.min(x + 6, width - 72), top + 14);
    }

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220,238,247,.72)';
    ctx.fillText('1', 28, top + 4);
    ctx.fillText('0.5', 20, top + plotHeight / 2 + 4);
    ctx.fillText('0', 30, height - bottom + 4);
    ctx.fillText('0', left - 3, height - 14);
    ctx.fillText('0.5', left + plotWidth / 2 - 8, height - 14);
    ctx.fillText('1', width - right - 3, height - 14);
    ctx.fillText('r / rmax', width - 62, height - 2);

    ctx.fillStyle = '#66e4ff';
    ctx.fillRect(left, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText(`${profile.shapeName} occupancy p(r)`, left + 24, 16);
    ctx.fillStyle = '#a391ff';
    ctx.fillRect(left + 205, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('relative r²p(r)', left + 229, 16);
  }

  function updateCopy(profile) {
    if (analysisCopy) {
      const centre = profile.occupancy[0] ?? 0;
      const centreSentence = centre > 0.999
        ? 'Its centre is occupied in every orientation: p(0) = 1.'
        : centre < 0.001
          ? 'Its centre is empty in every orientation: p(0) = 0.'
          : `Its centre occupancy is p(0) = ${centre.toFixed(2)}.`;

      analysisCopy.innerHTML =
        `The cyan curve is the <strong>full rotational average for the selected ${profile.shapeName.toLowerCase()}</strong>. At each radius, ${profile.directionCount.toLocaleString()} evenly distributed directions are tested. ${centreSentence} The violet curve is the corresponding shell weighting <em>r</em>²p(<em>r</em>), normalised for comparison.`;
    }
    if (chartCaption) {
      chartCaption.textContent = `${profile.shapeName} · cyan occupancy p(r) · violet r²p(r)`;
    }
  }

  function renderDeterministicProfile() {
    const level = Number(resolutionControl?.value || 3);
    const profile = getClassicalRadialProfile(shapeSelect.value, level);
    drawProfile(profile);
    updateCopy(profile);
  }

  function scheduleRender() {
    requestAnimationFrame(renderDeterministicProfile);
  }

  shapeSelect.addEventListener('change', scheduleRender);
  resolutionControl?.addEventListener('input', scheduleRender);
  window.addEventListener('resize', scheduleRender, { passive: true });
  scheduleRender();
}
