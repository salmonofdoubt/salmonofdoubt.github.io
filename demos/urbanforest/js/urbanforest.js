const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.16,
  rootMargin: '0px 0px -40px 0px'
});

revealEls.forEach((el) => observer.observe(el));

const dialog = document.getElementById('lightbox');
const dialogImg = document.getElementById('lightboxImage');
const dialogClose = document.getElementById('lightboxClose');
const galleryImgs = document.querySelectorAll('.gallery-card img');

if (dialog && dialogImg && dialogClose && galleryImgs.length) {
  galleryImgs.forEach((img) => {
    img.addEventListener('click', () => {
      dialogImg.src = img.dataset.full || img.src;
      dialogImg.alt = img.alt;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  });

  const closeLightbox = () => {
    dialog.close();
    dialogImg.src = '';
    document.body.style.overflow = '';
  };

  dialogClose.addEventListener('click', closeLightbox);

  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    const clickedOutside = (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );

    if (clickedOutside) {
      closeLightbox();
    }
  });

  dialog.addEventListener('cancel', () => {
    dialogImg.src = '';
    document.body.style.overflow = '';
  });
}

const carbonTool = (() => {
  const els = {
    area: document.getElementById('ufArea'),
    density: document.getElementById('ufDensity'),
    age: document.getElementById('ufAge'),
    palette: document.getElementById('ufPalette'),
    areaOut: document.getElementById('ufAreaOut'),
    densityOut: document.getElementById('ufDensityOut'),
    ageOut: document.getElementById('ufAgeOut'),
    paletteNote: document.getElementById('ufPaletteNote'),
    unitNote: document.getElementById('ufUnitNote'),
    displayChip: document.getElementById('ufDisplayChip'),
    plants: document.getElementById('ufPlants'),
    currentAnnual: document.getElementById('ufCurrentAnnual'),
    cumulative: document.getElementById('ufCumulative'),
    year20: document.getElementById('ufYear20'),
    currentNote: document.getElementById('ufCurrentNote'),
    cumulativeNote: document.getElementById('ufCumulativeNote'),
    year20Note: document.getElementById('ufYear20Note'),
    chart: document.getElementById('ufChart'),
    toggleButtons: document.querySelectorAll('.chart-toggle-btn'),
    unitButtons: document.querySelectorAll('.mode-toggle-btn'),
    chartTitle: document.getElementById('ufChartTitle'),
    chartDesc: document.getElementById('ufChartDesc')
  };

  if (!els.area || !els.density || !els.age || !els.palette || !els.chart) {
    return null;
  }

  const paletteMap = {
    'implemented': {
      factor: 1.0,
      note: 'A balanced version of the built palette, keeping shrubs prominent while retaining a meaningful tree layer.'
    },
    'shrub-heavy': {
      factor: 0.93,
      note: 'More edge structure and shrub biomass, with slightly lower long-run carbon than a tree-heavier layout.'
    },
    'tree-heavy': {
      factor: 1.10,
      note: 'More medium-stature trees and slightly stronger carbon potential, though not always suitable for very compact sites.'
    }
  };

  const centralAnchors = [
    [0, 0.10],
    [1, 0.35],
    [2, 0.80],
    [3, 1.35],
    [4, 1.95],
    [5, 2.45],
    [6, 2.75],
    [8, 3.05],
    [10, 3.20],
    [15, 3.00],
    [20, 2.80],
    [25, 2.60]
  ];

  let chartView = 'annual';
  let unitView = 'site';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function interpolate(anchors, x) {
    if (x <= anchors[0][0]) return anchors[0][1];
    if (x >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];

    for (let i = 0; i < anchors.length - 1; i += 1) {
      const [x1, y1] = anchors[i];
      const [x2, y2] = anchors[i + 1];
      if (x >= x1 && x <= x2) {
        const t = (x - x1) / (x2 - x1);
        return y1 + (y2 - y1) * t;
      }
    }

    return anchors[anchors.length - 1][1];
  }

  function densityFactor(density) {
    return clamp(1 + (density - 3) * 0.15, 0.70, 1.30);
  }

  function annualRatePerM2(ageYears) {
    return interpolate(centralAnchors, ageYears);
  }

  function displayLabel() {
    return unitView === 'site' ? 'whole-site values' : 'per-m² values';
  }

  function formatMass(kg, perM2 = false) {
    const suffix = perM2 ? ' CO₂e/m²' : ' CO₂e';
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(2)} t${suffix}`;
    }
    return `${Math.round(kg)} kg${suffix}`;
  }

  function formatAnnual(kg, perM2 = false) {
    const suffix = perM2 ? ' CO₂e/m²/yr' : ' CO₂e/yr';
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(2)} t${suffix}`;
    }
    return `${Math.round(kg)} kg${suffix}`;
  }

  function formatPlants(count) {
    return Math.round(count).toLocaleString('en-IE');
  }

  function buildSeries() {
    const area = parseFloat(els.area.value);
    const density = parseFloat(els.density.value);
    const age = parseFloat(els.age.value);
    const palette = paletteMap[els.palette.value] || paletteMap['implemented'];
    const modifier = densityFactor(density) * palette.factor;

    const years = Array.from({ length: 20 }, (_, index) => index + 1);
    const annualSite = years.map((yearOffset) => {
      const standAge = age + yearOffset - 1;
      const centralPerM2 = annualRatePerM2(standAge) * modifier;
      const central = centralPerM2 * area;
      return {
        year: yearOffset,
        standAge,
        low: central * 0.70,
        central,
        high: central * 1.35
      };
    });

    let cumulativeLow = 0;
    let cumulativeCentral = 0;
    let cumulativeHigh = 0;

    const cumulativeSite = annualSite.map((row) => {
      cumulativeLow += row.low;
      cumulativeCentral += row.central;
      cumulativeHigh += row.high;
      return {
        year: row.year,
        standAge: row.standAge,
        low: cumulativeLow,
        central: cumulativeCentral,
        high: cumulativeHigh
      };
    });

    const annualPerM2 = annualSite.map((row) => ({
      year: row.year,
      standAge: row.standAge,
      low: row.low / area,
      central: row.central / area,
      high: row.high / area
    }));

    const cumulativePerM2 = cumulativeSite.map((row) => ({
      year: row.year,
      standAge: row.standAge,
      low: row.low / area,
      central: row.central / area,
      high: row.high / area
    }));

    return {
      area,
      density,
      age,
      modifier,
      palette,
      annualSite,
      cumulativeSite,
      annualPerM2,
      cumulativePerM2
    };
  }

  function getActiveSeries(model) {
    const annual = unitView === 'site' ? model.annualSite : model.annualPerM2;
    const cumulative = unitView === 'site' ? model.cumulativeSite : model.cumulativePerM2;
    return { annual, cumulative };
  }

  function setOutputs(model) {
    const active = getActiveSeries(model);
    const currentRate = active.annual[0].central;
    const plants = model.area * model.density;
    const cumulative20 = active.cumulative[active.cumulative.length - 1];
    const year20 = active.annual[active.annual.length - 1].central;
    const perM2 = unitView === 'per-m2';

    els.areaOut.textContent = `${model.area.toFixed(0)} m²`;
    els.densityOut.textContent = `${model.density.toFixed(1)} plants/m²`;
    els.ageOut.textContent = `${model.age.toFixed(0)} ${Number(model.age) === 1 ? 'year' : 'years'}`;
    els.paletteNote.textContent = model.palette.note;
    els.unitNote.textContent = perM2
      ? 'Per-m² values are shown so you can compare sites of different size directly.'
      : 'Whole-site values are shown for the selected footprint.';
    els.displayChip.textContent = perM2 ? 'Per-m² values' : 'Whole-site values';

    els.plants.textContent = formatPlants(plants);
    els.currentAnnual.textContent = formatAnnual(currentRate, perM2);
    els.cumulative.textContent = `${formatMass(cumulative20.central, perM2)} over 20 years`;
    els.year20.textContent = formatAnnual(year20, perM2);

    els.currentNote.textContent = perM2 ? 'Central scenario, per m²' : 'Central scenario, whole site';
    els.cumulativeNote.textContent = perM2
      ? 'Low to high range shown in chart, per m²'
      : 'Low to high range shown in chart, whole site';
    els.year20Note.textContent = perM2 ? 'Central scenario, per m²' : 'Central scenario, whole site';
  }

  function pathFrom(points, xScale, yScale) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.x)} ${yScale(point.y)}`).join(' ');
  }

  function renderChart(model) {
    const width = 760;
    const height = 360;
    const margin = { top: 28, right: 22, bottom: 48, left: 72 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const active = getActiveSeries(model);
    const source = chartView === 'annual' ? active.annual : active.cumulative;
    const maxY = Math.max(...source.map((row) => row.high)) * 1.08;

    const xScale = (value) => margin.left + ((value - 1) / 19) * innerWidth;
    const yScale = (value) => margin.top + innerHeight - (value / maxY) * innerHeight;

    const upper = source.map((row) => ({ x: row.year, y: row.high }));
    const lower = [...source].reverse().map((row) => ({ x: row.year, y: row.low }));
    const central = source.map((row) => ({ x: row.year, y: row.central }));

    const bandPath = `${pathFrom(upper, xScale, yScale)} ${pathFrom(lower, xScale, yScale).replace(/^M/, 'L')} Z`;
    const linePath = pathFrom(central, xScale, yScale);

    const yTicks = Array.from({ length: 5 }, (_, index) => (maxY / 4) * index);
    const tickFormatter = (value) => (
      value >= 1000 ? `${(value / 1000).toFixed(1)} t` : `${Math.round(value)} kg`
    );

    const grid = yTicks.map((tick) => `
      <line x1="${margin.left}" y1="${yScale(tick)}" x2="${width - margin.right}" y2="${yScale(tick)}"></line>
      <text class="chart-label" x="${margin.left - 10}" y="${yScale(tick) + 4}" text-anchor="end">${tickFormatter(tick)}</text>
    `).join('');

    const xTicks = [1, 5, 10, 15, 20].map((tick) => `
      <text class="chart-label" x="${xScale(tick)}" y="${height - 14}" text-anchor="middle">Y${tick}</text>
    `).join('');

    const unitText = unitView === 'site' ? 'whole site' : 'per m²';
    const titleNote = chartView === 'annual'
      ? `Annual carbon uptake by year · ${unitText}`
      : `Cumulative carbon uptake across the projection · ${unitText}`;

    els.chart.innerHTML = `
      <g class="chart-grid">${grid}</g>
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}"></line>
      <path class="chart-band" d="${bandPath}"></path>
      <path class="chart-line" d="${linePath}"></path>
      ${xTicks}
      <text class="chart-title-note" x="${margin.left}" y="${margin.top - 8}">${titleNote}</text>
      <text class="chart-label" x="${width / 2}" y="${height - 2}" text-anchor="middle">Projection year</text>
    `;

    if (els.chartTitle) {
      els.chartTitle.textContent = `UrbanForest carbon scenario projection showing ${chartView} values for ${unitText}.`;
    }

    if (els.chartDesc) {
      els.chartDesc.textContent = `A chart showing a low-high uncertainty band and a central carbon uptake line for the selected urban-forest scenario, displayed as ${unitText}.`;
    }
  }

  function update() {
    const model = buildSeries();
    setOutputs(model);
    renderChart(model);
  }

  [els.area, els.density, els.age, els.palette].forEach((input) => {
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });

  els.toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      chartView = button.dataset.chartView;
      els.toggleButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      update();
    });
  });

  els.unitButtons.forEach((button) => {
    button.addEventListener('click', () => {
      unitView = button.dataset.unitView;
      els.unitButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      update();
    });
  });

  update();

  return { update };
})();
