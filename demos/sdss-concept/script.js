const NODES = [
  {
    id: 'governance',
    x: 30, y: 34, w: 190, h: 78,
    label: 'Governance context',
    sub: 'WFD • RBMP • Trust',
    detail: {
      title: 'Governance context',
      desc: 'The system begins in governance rather than in detached technical scoring. The proposal is anchored in Irish WFD and RBMP conditions, Trust translation, protected-area constraints, and real catchment governance.',
      bullets: [
        'Frames what the system is allowed to optimise',
        'Carries protected-area and do-no-harm logic',
        'Provides translation to technical and community audiences'
      ]
    }
  },
  {
    id: 'evidence',
    x: 260, y: 34, w: 190, h: 78,
    label: 'Evidence stack',
    sub: 'Official + spatial + derived',
    detail: {
      title: 'Evidence stack',
      desc: 'Official assessment inputs, environmental spatial layers, actionability layers, and derived analytical layers feed the model. This keeps the architecture inspectable and re-runnable.',
      bullets: [
        'Pressure and status layers',
        'Environmental opportunity and constraint layers',
        'Derived masks, indices, and pathway indicators'
      ]
    }
  },
  {
    id: 'rules',
    x: 490, y: 34, w: 190, h: 78,
    label: 'Rule sheet',
    sub: 'Eligibility • exclusion • do-no-harm',
    detail: {
      title: 'Rule sheet',
      desc: 'Rules are externalised rather than buried in code. That matters for challenge, revision, and transfer.',
      bullets: [
        'Formalises measure families and exclusions',
        'Captures thresholds and assumptions',
        'Supports versioning and traceability'
      ]
    }
  },
  {
    id: 'units',
    x: 720, y: 34, w: 220, h: 78,
    label: 'Decision units',
    sub: 'Reach • parcel-adjacent • subcatchment',
    detail: {
      title: 'Decision units',
      desc: 'The method explicitly tests how outputs behave when the spatial management unit changes.',
      bullets: [
        'Local parcel-adjacent logic matters',
        'Reach logic matters',
        'Subcatchment aggregation is tested, not assumed'
      ]
    }
  },
  {
    id: 'engine',
    x: 100, y: 186, w: 210, h: 86,
    label: 'Lexicographic engine',
    sub: 'Nutrients first',
    detail: {
      title: 'Lexicographic engine',
      desc: 'The ranking architecture is hierarchical. Nutrient reduction leads. Biodiversity connectivity, flood attenuation, and sediment reduction refine priorities.',
      bullets: [
        'Avoids flattening goals into one opaque score',
        'Produces low-priority and strategic-priority surfaces',
        'Retains an interpretable rationale for ranking'
      ]
    }
  },
  {
    id: 'portfolio',
    x: 380, y: 186, w: 210, h: 86,
    label: 'Portfolio generator',
    sub: 'Measure families interact',
    detail: {
      title: 'Portfolio generator',
      desc: 'The model outputs coherent measure packages rather than pretending one isolated intervention is always enough.',
      bullets: [
        'Riparian, interception, wetland, floodplain, peat logic',
        'Captures interdependencies among measures',
        'Supports strategic implementation rather than decorative mapping'
      ]
    }
  },
  {
    id: 'field',
    x: 660, y: 186, w: 230, h: 86,
    label: 'Bounded reach audit',
    sub: 'Validation • misclassification • maintainability',
    isPrimary: true,
    detail: {
      title: 'Bounded reach audit',
      desc: 'These doctoral data are bounded and protocol-driven. They exist to test the decision architecture, not to turn the thesis into a broad monitoring campaign.',
      bullets: [
        'Rule validation and misclassification diagnosis',
        'Repeat-audit uncertainty estimates',
        'Maintainability and persistence proxies'
      ]
    }
  },
  {
    id: 'perturb',
    x: 90, y: 348, w: 230, h: 86,
    label: 'Perturbation protocol',
    sub: 'Data • parameter • structural • scale',
    detail: {
      title: 'Perturbation protocol',
      desc: 'The uncertainty ensemble is pre-specified. It tests whether ranking claims survive plausible changes in evidence, thresholds, rule form, and scale.',
      bullets: [
        'Missingness, classification error, vintages, resolution',
        'Thresholds, breakpoints, corridor widths, shortlist size',
        'Alternative rule forms and aggregation scales'
      ]
    }
  },
  {
    id: 'stability',
    x: 380, y: 348, w: 210, h: 86,
    label: 'Stability diagnostics',
    sub: 'Robust • conditional • fragile',
    detail: {
      title: 'Stability diagnostics',
      desc: 'The model computes how often a candidate remains in the top shortlist and uses that to classify decision robustness.',
      bullets: [
        'Robust if it remains shortlisted in at least 80% of runs',
        'Conditional between 40% and 79%',
        'Fragile below 40%'
      ]
    }
  },
  {
    id: 'sequence',
    x: 660, y: 348, w: 230, h: 86,
    label: 'Sequencing logic',
    sub: 'Rank + maintainability + confidence',
    detail: {
      title: 'Sequencing logic',
      desc: 'Early action depends on more than raw rank. Portfolio coherence, stability, evidence quality, practical implementation, and maintainability all matter.',
      bullets: [
        'Apparent fit is not enough',
        'Durable fit governs practical phasing',
        'Poor persistence can downgrade early action'
      ]
    }
  },
  {
    id: 'verify',
    x: 120, y: 520, w: 220, h: 86,
    label: 'Verification interface',
    sub: 'Minimum-viable follow-up',
    detail: {
      title: 'Verification interface',
      desc: 'Each portfolio family gets a minimal follow-up design, with indicators, directional progress, review triggers, and community-facing options.',
      bullets: [
        'Not a full monitoring programme',
        'Can distinguish Q-value from CSSI and SSIS',
        'Supports adaptive review after prioritisation'
      ]
    }
  },
  {
    id: 'repro',
    x: 390, y: 520, w: 220, h: 86,
    label: 'Reproducibility package',
    sub: 'Rule log • decision log • rebuild',
    detail: {
      title: 'Reproducibility package',
      desc: 'The system is designed to be rerun, challenged, and transferred. The package includes manifests, logs, instructions, and atlas-style outputs.',
      bullets: [
        'Data manifest and assumptions register',
        'Parameter log and decision log',
        'Rebuild instructions for reuse elsewhere'
      ]
    }
  },
  {
    id: 'outputs',
    x: 660, y: 520, w: 220, h: 86,
    label: 'Outputs',
    sub: 'Atlas • maps • papers • templates',
    detail: {
      title: 'Outputs',
      desc: 'The doctoral and practical outputs are both explicit: papers, maps, site cards, verification templates, and a transferable decision architecture.',
      bullets: [
        'Priority atlas and stability maps',
        'Scientific papers and thesis chapters',
        'Portfolio-specific verification templates'
      ]
    }
  }
];

const EDGES = [
  ['governance', 'evidence'],
  ['evidence', 'rules'],
  ['rules', 'units'],
  ['rules', 'engine'],
  ['units', 'engine'],
  ['engine', 'portfolio'],
  ['field', 'perturb'],
  ['field', 'sequence'],
  ['portfolio', 'perturb'],
  ['engine', 'perturb'],
  ['perturb', 'stability'],
  ['stability', 'sequence'],
  ['sequence', 'verify'],
  ['stability', 'verify'],
  ['verify', 'repro'],
  ['repro', 'outputs'],
  ['sequence', 'outputs'],
  ['field', 'rules']
];

const GANTT_DATA = [
  { label: 'WP1 Evidence architecture & rule formalisation', start: 1, end: 9, cls: 'on' },
  { label: 'WP2 Core GIS build under lexicographic objectives', start: 6, end: 18, cls: 'mid' },
  { label: 'WP3 Portfolio logic & catchment scaling', start: 10, end: 24, cls: 'on' },
  { label: 'WP4 Uncertainty & ranking-stability experiments', start: 12, end: 30, cls: 'mid' },
  { label: 'WP5 Validation, calibration & verification design', start: 18, end: 32, cls: 'on', isPrimary: true },
  { label: 'WP6 Reproducibility, publications & thesis integration', start: 30, end: 48, cls: 'mid' }
];

const SLIDER_IDS = ['nutrientBase', 'secondaryBase', 'portfolioBase', 'maintainabilityBase', 'uncertainty'];

const svg = document.getElementById('uml-svg');
const detailPanel = document.getElementById('detail-panel');
const tooltip = document.getElementById('tooltip');

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function drawDiagram() {
  const defs = createSvgElement('defs');
  const marker = createSvgElement('marker', {
    id: 'arrow',
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '8',
    markerHeight: '8',
    orient: 'auto-start-reverse'
  });

  const arrowPath = createSvgElement('path', {
    d: 'M 0 0 L 10 5 L 0 10 z',
    fill: 'rgba(160, 220, 195, 0.7)'
  });

  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const nodeById = Object.fromEntries(NODES.map(node => [node.id, node]));

  EDGES.forEach(([fromId, toId]) => {
    const from = nodeById[fromId];
    const to = nodeById[toId];

    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;

    const edgePath = createSvgElement('path', {
      d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
      class: 'edge'
    });

    svg.appendChild(edgePath);
  });

  NODES.forEach(node => {
    const group = createSvgElement('g', { class: 'node' });
    group.dataset.node = node.id;

    const rect = createSvgElement('rect', {
      x: node.x,
      y: node.y,
      width: node.w,
      height: node.h
    });

    if (node.isPrimary) {
      rect.setAttribute('stroke', '#5dbbe5');
      rect.setAttribute('stroke-dasharray', '4');
      rect.setAttribute('stroke-width', '2');
    }

    const title = createSvgElement('text', {
      x: node.x + 16,
      y: node.y + 30
    });
    title.textContent = node.label;

    const sub = createSvgElement('text', {
      x: node.x + 16,
      y: node.y + 54,
      class: 'sub'
    });
    sub.textContent = node.sub;

    group.appendChild(rect);
    group.appendChild(title);
    group.appendChild(sub);

    group.addEventListener('mouseenter', () => activateNode(node.id));
    group.addEventListener('click', () => activateNode(node.id));

    svg.appendChild(group);
  });
}

function activateNode(id) {
  document.querySelectorAll('.node').forEach(nodeEl => {
    nodeEl.classList.toggle('active', nodeEl.dataset.node === id);
  });

  const node = NODES.find(item => item.id === id);
  if (!node) return;

  detailPanel.innerHTML = `
    <h3>${node.detail.title}</h3>
    <p>${node.detail.desc}</p>
    <ul>${node.detail.bullets.map(item => `<li>${item}</li>`).join('')}</ul>
  `;
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn === button);
      });

      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${target}`);
      });
    });
  });
}

function setupTooltips() {
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

  const showTooltip = (element, event = null) => {
    const title = element.getAttribute('data-tip-title') || 'Detail';
    const text = element.getAttribute('data-tip') || '';

    tooltip.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
    tooltip.style.opacity = '1';

    if (isMobile()) {
      tooltip.style.left = '12px';
      tooltip.style.right = '12px';
      tooltip.style.top = 'auto';
      tooltip.style.bottom = '12px';
    } else if (event) {
      tooltip.style.left = `${event.clientX + 16}px`;
      tooltip.style.top = `${event.clientY + 16}px`;
      tooltip.style.right = 'auto';
      tooltip.style.bottom = 'auto';
    }
  };

  const hideTooltip = () => {
    tooltip.style.opacity = '0';
  };

  document.querySelectorAll('[data-tip], [data-tip-title]').forEach((element) => {
    element.addEventListener('mouseenter', (event) => showTooltip(element, event));
    element.addEventListener('mousemove', (event) => {
      if (!isMobile()) {
        showTooltip(element, event);
      }
    });
    element.addEventListener('mouseleave', hideTooltip);

    element.addEventListener('focus', () => showTooltip(element));
    element.addEventListener('blur', hideTooltip);

    element.addEventListener('click', (event) => {
      event.stopPropagation();
      showTooltip(element, event);
    });
  });

  document.addEventListener('click', hideTooltip);

  window.addEventListener('resize', () => {
    hideTooltip();
  });
}

function randn() {
  let u = 0;
  let v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function runSimulation() {
  const nutrientBase = Number(document.getElementById('nutrientBase').value);
  const secondaryBase = Number(document.getElementById('secondaryBase').value);
  const portfolioBase = Number(document.getElementById('portfolioBase').value);
  const maintainabilityBase = Number(document.getElementById('maintainabilityBase').value);
  const uncertainty = Number(document.getElementById('uncertainty').value);

  document.getElementById('nutrientBaseVal').textContent = nutrientBase.toFixed(2);
  document.getElementById('secondaryBaseVal').textContent = secondaryBase.toFixed(2);
  document.getElementById('portfolioBaseVal').textContent = portfolioBase.toFixed(2);
  document.getElementById('maintainabilityBaseVal').textContent = maintainabilityBase.toFixed(2);
  document.getElementById('uncertaintyVal').textContent = uncertainty.toFixed(2);

  const runs = 1200;
  let shortlisted = 0;
  let phaseReady = 0;
  let meanPhaseScore = 0;

  for (let i = 0; i < runs; i += 1) {
    const nutrient = clamp01(nutrientBase + randn() * (0.10 + uncertainty * 0.18));
    const secondary = clamp01(secondaryBase + randn() * (0.08 + uncertainty * 0.16));
    const portfolio = clamp01(portfolioBase + randn() * (0.06 + uncertainty * 0.10));
    const maintainability = clamp01(maintainabilityBase + randn() * (0.06 + uncertainty * 0.12));

    const structuralPenalty = Math.max(0, uncertainty * (Math.random() * 0.16));
    const scalePenalty = Math.max(0, uncertainty * (Math.random() * 0.12));

    const lexicographicScore =
      (nutrient * 100) +
      (secondary * 12) +
      (portfolio * 8) -
      (structuralPenalty * 15) -
      (scalePenalty * 10);

    const isShortlisted = nutrient >= 0.58 && lexicographicScore >= 68;
    if (isShortlisted) shortlisted += 1;

    const phaseScore =
      (lexicographicScore / 120) * 0.58 +
      maintainability * 0.24 +
      portfolio * 0.18;

    meanPhaseScore += phaseScore;

    if (isShortlisted && phaseScore >= 0.63) {
      phaseReady += 1;
    }
  }

  const persistPct = Math.round((shortlisted / runs) * 100);
  const phasePct = Math.round((phaseReady / runs) * 100);
  const meanPhase = meanPhaseScore / runs;

  let stabilityClass = 'Fragile';
  let statusColor = '#ff5f5f';

  if (persistPct >= 80) {
    stabilityClass = 'Robust';
    statusColor = '#00ff88';
  } else if (persistPct >= 40) {
    stabilityClass = 'Conditional';
    statusColor = '#ff9f00';
  }

  let phaseText = 'Deferred';
  if (persistPct >= 80 && meanPhase >= 0.63) {
    phaseText = 'Early action';
  } else if (persistPct >= 40) {
    phaseText = 'Targeted verification';
  } else {
    phaseText = 'Do not claim early confidence';
  }

  const narrative =
    persistPct >= 80
      ? 'The candidate survives most perturbation runs. The main question becomes whether maintainability and portfolio coherence are strong enough to justify early sequencing.'
      : persistPct >= 40
        ? 'The candidate remains plausible but unstable enough that targeted verification or conservative deployment is wiser than confident early rollout.'
        : 'The candidate drops out too often under plausible perturbations. It may still be interesting, but not as an early-action claim.';

  const persistValueEl = document.getElementById('persistValue');
  const phaseValueEl = document.getElementById('phaseValue');
  const stabilityValueEl = document.getElementById('stabilityValue');
  const statusBar = document.getElementById('statusBar');
  const simNarrative = document.getElementById('simNarrative');

  persistValueEl.textContent = `${persistPct}%`;
  persistValueEl.style.color = statusColor;

  phaseValueEl.textContent = phaseText;
  phaseValueEl.style.color = statusColor;

  stabilityValueEl.textContent = stabilityClass;
  stabilityValueEl.style.color = statusColor;

  simNarrative.textContent = `${narrative} Phase-readiness in this sandbox is ${phasePct}%.`;
  statusBar.style.width = `${persistPct}%`;
  statusBar.style.background = statusColor;
}

function buildGantt() {
  const table = document.getElementById('ganttTable');
  if (!table) return;

  const thead = document.createElement('thead');

  const headerRow1 = document.createElement('tr');
  const corner = document.createElement('th');
  corner.textContent = 'Work package';
  headerRow1.appendChild(corner);

  ['Year 1', 'Year 2', 'Year 3', 'Year 4'].forEach(year => {
    const th = document.createElement('th');
    th.colSpan = 12;
    th.textContent = year;
    headerRow1.appendChild(th);
  });

  const headerRow2 = document.createElement('tr');
  const monthsLabel = document.createElement('th');
  monthsLabel.textContent = 'Months';
  headerRow2.appendChild(monthsLabel);

  for (let month = 1; month <= 48; month += 1) {
    const th = document.createElement('th');
    th.textContent = month;
    headerRow2.appendChild(th);
  }

  thead.appendChild(headerRow1);
  thead.appendChild(headerRow2);

  const tbody = document.createElement('tbody');

  GANTT_DATA.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isPrimary) {
      tr.classList.add('primary-wp');
    }

    const label = document.createElement('td');
    label.innerHTML = row.label + (row.isPrimary ? ' <br><small style="color:#5dbbe5; font-weight:700">VALIDATION / CALIBRATION</small>' : '');
    tr.appendChild(label);

    for (let month = 1; month <= 48; month += 1) {
      const td = document.createElement('td');
      if (month >= row.start && month <= row.end) {
        td.className = row.cls;
        td.textContent = '●';
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
}

function initSimulation() {
  SLIDER_IDS.forEach(id => {
    const slider = document.getElementById(id);
    slider.addEventListener('input', runSimulation);
  });
  runSimulation();
}

function init() {
  drawDiagram();
  activateNode('engine');
  setupTabs();
  setupTooltips();
  initSimulation();
  buildGantt();
}

init();
