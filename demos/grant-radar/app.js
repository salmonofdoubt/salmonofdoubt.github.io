const state = {
  catalog: null,
  selectedPurposes: new Set(),
  purposeChipButtons: new Map(),
  activeMode: 'all',
};

const el = {
  purposeChips: document.getElementById('purpose-chips'),
  clearPurposeBtn: document.getElementById('clear-purpose-btn'),
  results: document.getElementById('results'),
  sources: document.getElementById('sources'),
  changesFeed: document.getElementById('changes-feed'),
  searchInput: document.getElementById('search-input'),
  statusSelect: document.getElementById('status-select'),
  applicantSelect: document.getElementById('applicant-select'),
  accessSelect: document.getElementById('access-select'),
  scaleSelect: document.getElementById('scale-select'),
  changeSelect: document.getElementById('change-select'),
  changeWindowSelect: document.getElementById('change-window-select'),
  deadlineFrom: document.getElementById('deadline-from'),
  deadlineTo: document.getElementById('deadline-to'),
  generatedAt: document.getElementById('generated-at'),
  matchCount: document.getElementById('match-count'),
  sourceCount: document.getElementById('source-count'),
  changeCount: document.getElementById('change-count'),
  shareOpenLink: document.getElementById('share-open-link'),
  copyLinkBtn: document.getElementById('copy-link-btn'),
  nativeShareBtn: document.getElementById('native-share-btn'),
  qrImage: document.getElementById('qr-image'),
  modeIcon: document.getElementById('hero-mode-icon'),
  modeAllBtn: document.getElementById('mode-all-btn'),
  modeNdrtBtn: document.getElementById('mode-ndrt-btn'),
  modeResearchBtn: document.getElementById('mode-research-btn'),
  modeFarmerBtn: document.getElementById('mode-farmer-btn'),
  modeClimateBtn: document.getElementById('mode-climate-btn'),
  modeGeoBtn: document.getElementById('mode-geo-btn'),
  modeNote: document.getElementById('mode-note'),
};

const templates = {
  opportunity: document.getElementById('opportunity-card-template'),
  source: document.getElementById('source-card-template'),
  change: document.getElementById('change-item-template'),
};

const APPLICANT_ORDER = [
  'local groups',
  'farmers',
  'public bodies',
  'researchers',
  'businesses',
  'NGOs',
  'schools',
  'households',
  'experienced researchers',
  'PIs',
  'professors',
  'senior researchers',
  'established researchers',
  'research consortia',
  'research networks',
  'institutes',
  'universities',
  'industry partners',
  'mid-career professionals',
  'sustainability leaders',
];

const SCALE_ORDER = ['local', 'support', 'medium', 'major'];

const ACCESS_ORDER = [
  'direct',
  'advisory support',
  'via advisor',
  'via local authority',
  'via local action group',
  'via project coordinator',
  'consortium',
];

const NDRT_PURPOSES = [
  'water quality',
  'catchment delivery',
  'community nature',
  'restoration',
  'citizen science',
  'habitat restoration',
  'riparian management',
  'wetlands',
  'education',
  'capacity building',
];

const RESEARCH_PURPOSES = [
  'environmental research',
  'biodiversity',
  'ecology',
  'nature-based solutions',
  'water quality',
  'climate adaptation',
  'research training',
];

const FARMER_WQ_PURPOSES = [
  'water quality',
  'catchment delivery',
  'farm nutrient management',
  'sediment control',
  'riparian management',
  'wetlands',
  'habitat restoration',
  'nature-based solutions',
  'peatlands',
];

const CLIMATE_ENTREPRENEUR_PURPOSES = [
  'climate action',
  'climate adaptation',
  'decarbonisation',
  'energy efficiency',
  'community energy',
  'renewable energy',
  'bioeconomy',
  'entrepreneurship',
];

const GEO_PURPOSES = [
  'geoscience',
  'geochemistry',
  'geothermal',
  'hydrogen',
  'subsurface storage',
  'gas analytics',
  'energy systems',
  'environmental research',
  'frontier research',
  'scientific networking',
  'research career',
  'sustainability transitions',
  'wetland interfaces',
];


const MODE_ICON_SVGS = {
  all: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-all" role="img" focusable="false" aria-label="All opportunities radar">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="96" class="mode-symbol-ring" />
      <circle cx="160" cy="160" r="62" class="mode-symbol-ring" />
      <path d="M160 160 L278 88 A130 130 0 0 1 284 166 Z" class="mode-symbol-sweep" />
      <line x1="30" y1="160" x2="290" y2="160" class="mode-symbol-axis" />
      <line x1="160" y1="30" x2="160" y2="290" class="mode-symbol-axis" />
      <path d="M160 160 C122 118, 78 98, 55 70" class="mode-symbol-stem" />
      <path d="M160 160 C188 120, 234 101, 267 76" class="mode-symbol-stem" />
      <path d="M142 124 C112 90, 70 91, 52 68 C76 60, 120 64, 142 124 Z" class="mode-symbol-leaf" />
      <path d="M180 118 C215 86, 258 84, 276 64 C248 58, 203 64, 180 118 Z" class="mode-symbol-leaf mode-symbol-leaf-alt" />
      <circle cx="203" cy="118" r="6" class="mode-symbol-blip" />
      <circle cx="102" cy="206" r="5" class="mode-symbol-blip-soft" />
      <circle cx="226" cy="202" r="4" class="mode-symbol-blip-soft" />
      <circle cx="160" cy="160" r="12" class="mode-symbol-centre" />
    </svg>
  `,

  ndrt: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-river" role="img" focusable="false" aria-label="River Trust mode">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="92" class="mode-symbol-ring" />
      <circle cx="160" cy="160" r="56" class="mode-symbol-ring" />
      <path d="M62 116 C92 86, 125 146, 158 116 S224 86, 258 116" class="mode-symbol-line mode-symbol-line-main" />
      <path d="M58 160 C94 124, 124 196, 160 160 S226 124, 262 160" class="mode-symbol-line" />
      <path d="M62 204 C94 174, 126 232, 160 204 S226 174, 258 204" class="mode-symbol-line mode-symbol-line-soft" />
      <circle cx="160" cy="160" r="9" class="mode-symbol-centre" />
    </svg>
  `,

  farmer: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-farmer" role="img" focusable="false" aria-label="Farming and water quality mode">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="88" class="mode-symbol-ring" />
      <path d="M150 230 C102 174, 112 94, 172 70 C174 142, 170 198, 150 230 Z" class="mode-symbol-leaf-large" />
      <path d="M171 230 C220 174, 208 96, 151 70 C148 144, 151 199, 171 230 Z" class="mode-symbol-leaf-large mode-symbol-leaf-alt" />
      <path d="M160 92 V242" class="mode-symbol-line mode-symbol-line-main" />
      <path d="M230 72 C230 108, 198 126, 198 158 A32 32 0 0 0 262 158 C262 126, 230 108, 230 72 Z" class="mode-symbol-droplet" />
      <circle cx="160" cy="160" r="9" class="mode-symbol-centre" />
    </svg>
  `,

  climate: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-climate" role="img" focusable="false" aria-label="Climate Entrepreneur mode">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="88" class="mode-symbol-ring" />
      <path d="M160 54 L180 126 L246 150 L184 182 L160 252 L136 182 L74 150 L140 126 Z" class="mode-symbol-spark" />
      <path d="M160 96 C132 124, 130 170, 160 202 C190 170, 188 124, 160 96 Z" class="mode-symbol-seed" />
      <circle cx="160" cy="160" r="10" class="mode-symbol-centre" />
    </svg>
  `,

  research: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-research" role="img" focusable="false" aria-label="Research mode">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="92" class="mode-symbol-ring" />
      <line x1="102" y1="92" x2="160" y2="160" class="mode-symbol-line" />
      <line x1="224" y1="88" x2="160" y2="160" class="mode-symbol-line" />
      <line x1="94" y1="222" x2="160" y2="160" class="mode-symbol-line" />
      <line x1="232" y1="218" x2="160" y2="160" class="mode-symbol-line" />
      <line x1="102" y1="92" x2="224" y2="88" class="mode-symbol-line mode-symbol-line-soft" />
      <line x1="94" y1="222" x2="232" y2="218" class="mode-symbol-line mode-symbol-line-soft" />
      <circle cx="160" cy="160" r="17" class="mode-symbol-node-main" />
      <circle cx="102" cy="92" r="13" class="mode-symbol-node" />
      <circle cx="224" cy="88" r="13" class="mode-symbol-node" />
      <circle cx="94" cy="222" r="13" class="mode-symbol-node" />
      <circle cx="232" cy="218" r="13" class="mode-symbol-node" />
    </svg>
  `,

  geo: `
    <svg viewBox="0 0 320 320" class="mode-symbol mode-symbol-geo" role="img" focusable="false" aria-label="Geo Earth Systems mode">
      <circle cx="160" cy="160" r="130" class="mode-symbol-disc" />
      <circle cx="160" cy="160" r="130" class="mode-symbol-ring mode-symbol-ring-strong" />
      <circle cx="160" cy="160" r="92" class="mode-symbol-ring" />
      <path d="M58 114 C92 88, 116 82, 160 98 C204 82, 230 88, 262 114" class="mode-symbol-contour mode-symbol-contour-top" />
      <path d="M50 152 C92 124, 124 118, 160 134 C196 118, 230 124, 270 152" class="mode-symbol-contour" />
      <path d="M58 190 C96 168, 124 164, 160 178 C196 164, 224 168, 262 190" class="mode-symbol-contour mode-symbol-contour-soft" />
      <path d="M78 228 H242" class="mode-symbol-line mode-symbol-line-main" />
      <path d="M116 228 V252 M160 228 V262 M204 228 V252" class="mode-symbol-line" />
      <circle cx="160" cy="160" r="9" class="mode-symbol-centre" />
    </svg>
  `,
};

function renderModeIcon() {
  if (!el.modeIcon) return;

  const mode = state.activeMode || 'all';
  const icon = MODE_ICON_SVGS[mode] || MODE_ICON_SVGS.all;

  el.modeIcon.setAttribute('data-mode-icon', mode);
  el.modeIcon.innerHTML = icon;
}


const PROGRAMME_KIND_VALUES = new Set([
  'announcement_or_results',
  'one_off_call',
  'recurring_programme',
  'rolling_support',
]);

const PROGRAMME_STATE_VALUES = new Set(['archived', 'closed', 'open', 'upcoming']);

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const daysBetween = (a, b) => Math.floor((a - b) / (1000 * 60 * 60 * 24));

function titleCaseLabel(value) {
  if (!value) return value;
  if (value === 'NGOs') return value;
  return value
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function ordered(values, preferred) {
  const order = new Map(preferred.map((value, index) => [value, index]));
  return [...values].sort((a, b) => {
    const rankA = order.has(a) ? order.get(a) : 999;
    const rankB = order.has(b) ? order.get(b) : 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

function effectivePublicVisibility(item) {
  if (item.public_visible_state) return item.public_visible_state;
  if (item.public_visibility === 'public_visible') return 'public_visible';
  return 'discovery_only';
}

function effectiveProgrammeKind(item) {
  if (PROGRAMME_KIND_VALUES.has(item.programme_kind)) return item.programme_kind;

  if (item.recurrence_type === 'recurring') return 'recurring_programme';
  if (item.recurrence_type === 'rolling') return 'rolling_support';
  if (item.recurrence_type === 'one_off') return 'one_off_call';

  const haystack = [
    item.title,
    item.opportunity_type,
    item.summary,
    item.programme,
    item.source_name,
  ]
    .join(' ')
    .toLowerCase();

  if (
    haystack.includes('announce') ||
    haystack.includes('results') ||
    haystack.includes('awarded') ||
    haystack.includes('press release')
  ) {
    return 'announcement_or_results';
  }

  if (
    haystack.includes('support') ||
    haystack.includes('advisory') ||
    haystack.includes('hub')
  ) {
    return 'rolling_support';
  }

  return 'one_off_call';
}

function effectiveProgrammeState(item) {
  if (PROGRAMME_STATE_VALUES.has(item.programme_state)) return item.programme_state;

  const kind = effectiveProgrammeKind(item);

  if (item.current_availability === 'open_now') return 'open';
  if (item.status === 'upcoming') return 'upcoming';

  if (item.current_availability === 'closed_for_now') return 'closed';

  if (item.current_availability === 'closed') {
    return kind === 'one_off_call' || kind === 'announcement_or_results' ? 'archived' : 'closed';
  }

  if (item.public_visibility === 'archived') return 'archived';
  if (item.status === 'open') return 'open';
  if (item.status === 'closed') return kind === 'one_off_call' ? 'archived' : 'closed';

  return 'closed';
}

function programmeStateLabel(value) {
  if (value === 'open') return 'Open';
  if (value === 'upcoming') return 'Upcoming';
  if (value === 'closed') return 'Closed';
  if (value === 'archived') return 'Archived';
  return 'Unknown';
}

function programmeStateTagClass(value) {
  if (value === 'open') return 'tone-green';
  if (value === 'upcoming') return 'tone-amber';
  if (value === 'closed') return 'tone-amber';
  if (value === 'archived') return 'tone-red';
  return 'tone-neutral';
}

function programmeKindLabel(value) {
  if (value === 'recurring_programme') return 'Recurring programme';
  if (value === 'rolling_support') return 'Rolling support';
  if (value === 'one_off_call') return 'One-off call';
  if (value === 'announcement_or_results') return 'Announcement/results';
  return 'Unknown type';
}

function formatDeadlineText(item) {
  if (item.deadline_text) return item.deadline_text;

  const stateValue = effectiveProgrammeState(item);

  if (stateValue === 'open') return 'Currently open';
  if (stateValue === 'upcoming') {
    return item.expected_next_window
      ? `Expected opening: ${item.expected_next_window}`
      : 'Upcoming';
  }
  if (stateValue === 'closed') {
    return item.expected_next_window
      ? `Expected next window: ${item.expected_next_window}`
      : 'Currently closed';
  }
  if (stateValue === 'archived') return 'Archived or closed call';

  return 'Deadline not yet extracted';
}

function makeTag(text, className = '') {
  const span = document.createElement('span');
  span.className = `tag ${className}`.trim();
  span.textContent = titleCaseLabel(text);
  return span;
}

function compactList(values, fallback = '—', limit = 2) {
  const clean = [...new Set((values || []).filter(Boolean).map((value) => titleCaseLabel(String(value))))];

  if (clean.length === 0) return fallback;
  if (clean.length <= limit) return clean.join(', ');

  return `${clean.slice(0, limit).join(', ')} +${clean.length - limit}`;
}

function cleanCardSummary(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();

  const hardStops = [
    /\bA notice about cookies\b/i,
    /\bThis website uses cookies\b/i,
    /\bWe use cookies\b/i,
    /\bCookie settings\b/i,
    /\bAccept all cookies\b/i,
    /\bManage cookie preferences\b/i,
    /\bSkip to main content\b/i,
    /\bSearch Submit Search\b/i,
  ];

  hardStops.forEach((pattern) => {
    const match = text.search(pattern);
    if (match > 80) {
      text = text.slice(0, match).trim();
    } else if (match >= 0) {
      text = text.replace(pattern, '').trim();
    }
  });

  text = text
    .replace(/\bA notice about cookies\b.*$/i, '')
    .replace(/\bThis website uses cookies\b.*$/i, '')
    .replace(/\bMore details available in.*$/i, '')
    .replace(/\bYou are here:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2) {
    text = sentences.slice(0, 2).join(' ').trim();
  }

  if (text.length > 360) {
    text = text.slice(0, 357).trimEnd() + '…';
  }

  return text || 'Summary not yet extracted cleanly. Open the source page for details.';
}

function fitValueForMode(item) {
  const relevance = item.mode_relevance || {};
  const labelMap = {
    ndrt: 'NDRT',
    research: 'Research',
    farmer: 'Farmer',
    climate: 'Climate',
    geo: 'Geo',
  };
  const valueMap = {
    include: 'yes',
    maybe: 'maybe',
    exclude: 'no',
  };

  if (state.activeMode === 'climate') {
    const value = isClimateEntrepreneurFit(item) ? 'include' : 'exclude';
    return `Climate: ${valueMap[value] || value}`;
  }

  if (state.activeMode !== 'all') {
    const value = relevance[state.activeMode] || 'exclude';
    return `${labelMap[state.activeMode] || state.activeMode}: ${valueMap[value] || value}`;
  }

  const preferred = ['ndrt', 'research', 'farmer', 'climate', 'geo'];
  const best = preferred.find((key) => relevance[key] === 'include')
    || preferred.find((key) => relevance[key] === 'maybe')
    || preferred.find((key) => relevance[key] === 'exclude');

  if (!best) return '—';

  return `${labelMap[best]}: ${valueMap[relevance[best]] || relevance[best]}`;
}

function syncPurposeChipStates() {
  state.purposeChipButtons.forEach((button, label) => {
    button.classList.toggle('active', state.selectedPurposes.has(label));
  });
}

function clearSelectedPurposes() {
  state.selectedPurposes.clear();
  syncPurposeChipStates();
}

function selectPurposes(purposes) {
  state.selectedPurposes.clear();
  purposes.forEach((purpose) => {
    if (state.purposeChipButtons.has(purpose)) {
      state.selectedPurposes.add(purpose);
    }
  });
  syncPurposeChipStates();
}

function createChip(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip-btn';
  btn.textContent = label;

  if (state.selectedPurposes.has(label)) {
    btn.classList.add('active');
  }

  btn.addEventListener('click', () => {
    if (state.selectedPurposes.has(label)) {
      state.selectedPurposes.delete(label);
    } else {
      state.selectedPurposes.add(label);
    }
    syncPurposeChipStates();
    render();
  });

  state.purposeChipButtons.set(label, btn);
  return btn;
}

function fillSelect(select, values, placeholder, preferred = []) {
  select.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = placeholder;
  select.appendChild(allOption);

  ordered(values, preferred).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = titleCaseLabel(value);
    select.appendChild(option);
  });
}

function renderPurposeChips() {
  const purposes = state.catalog.meta.available_purposes || [];
  el.purposeChips.innerHTML = '';
  state.purposeChipButtons.clear();
  purposes.forEach((purpose) => el.purposeChips.appendChild(createChip(purpose)));
  syncPurposeChipStates();
}

function populateDynamicFilters() {
  const meta = state.catalog.meta || {};
  fillSelect(el.applicantSelect, meta.available_applicant_types || [], 'All applicant types', APPLICANT_ORDER);
  fillSelect(el.accessSelect, meta.available_access_routes || [], 'All access routes', ACCESS_ORDER);
  fillSelect(el.scaleSelect, meta.available_scales || [], 'All scales', SCALE_ORDER);
}

function setSelectValue(select, value) {
  if (!select) return;
  const hasOption = [...select.options].some((option) => option.value === value);
  select.value = hasOption ? value : 'all';
}

function setDateValue(input, value = '') {
  if (input) {
    input.value = value;
  }
}

function setSearchValue(value = '') {
  if (el.searchInput) {
    el.searchInput.value = value;
  }
}

function resetVisibleFilters() {
  setSearchValue('');
  setDateValue(el.deadlineFrom);
  setDateValue(el.deadlineTo);
  setSelectValue(el.statusSelect, 'all');
  setSelectValue(el.changeSelect, 'all');
  setSelectValue(el.accessSelect, 'all');
  setSelectValue(el.scaleSelect, 'all');
}

function updateModeUi() {
  renderModeIcon();
  const modeMap = {
    all: el.modeAllBtn,
    ndrt: el.modeNdrtBtn,
    research: el.modeResearchBtn,
    farmer: el.modeFarmerBtn,
    climate: el.modeClimateBtn,
    geo: el.modeGeoBtn,
  };

  Object.entries(modeMap).forEach(([key, button]) => {
    if (!button) return;
    button.classList.toggle('active', key === state.activeMode);
  });

  if (!el.modeNote) return;

  if (state.activeMode === 'ndrt') {
    el.modeNote.textContent = 'River Trust mode now shows only opportunities explicitly curated as actionable for NDRT-style community, catchment, restoration, monitoring, habitat, wetland, or outreach delivery.';
    return;
  }

  if (state.activeMode === 'research') {
    el.modeNote.textContent = 'Research mode now shows opportunities explicitly curated for researchers, postgraduate routes, universities, institutes, or research consortia.';
    return;
  }

  if (state.activeMode === 'farmer') {
    el.modeNote.textContent = 'Farmer / water quality mode now shows opportunities explicitly curated for farmers and practical on-farm water-protection routes.';
    return;
  }

  if (state.activeMode === 'climate') {
    el.modeNote.textContent = 'Climate Entrepreneur mode shows opportunities with enterprise, innovation, pilot, climate, energy, circular economy, bioeconomy, sustainability, or solution-development relevance.';
    return;
  }

  if (state.activeMode === 'geo') {
    el.modeNote.textContent = 'Geo / Earth Systems mode shows sources imported from Geo Radar: geoscience, geochemistry, hydrogen, geothermal, subsurface storage, GFZ/Potsdam, DFG/ERC/Horizon, and Earth-systems research routes.';
    return;
  }

  el.modeNote.textContent = 'Showing the full catalogue using the standard defaults. All opportunities mode now means exactly that: no hidden mode filtering.';
}

function applyMode(mode) {
  state.activeMode = mode;

  resetVisibleFilters();

  if (mode === 'ndrt') {
    selectPurposes(NDRT_PURPOSES);
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.changeWindowSelect, '365');
  } else if (mode === 'research') {
    selectPurposes(RESEARCH_PURPOSES);
    setSelectValue(el.applicantSelect, 'researchers');
    setSelectValue(el.changeWindowSelect, '365');
  } else if (mode === 'farmer') {
    selectPurposes(FARMER_WQ_PURPOSES);
    setSelectValue(el.applicantSelect, 'farmers');
    setSelectValue(el.changeWindowSelect, '365');
  } else if (mode === 'climate') {
    selectPurposes(CLIMATE_ENTREPRENEUR_PURPOSES);
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.changeWindowSelect, '365');
  } else if (mode === 'geo') {
    selectPurposes(GEO_PURPOSES);
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.changeWindowSelect, '365');
  } else {
    clearSelectedPurposes();
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.changeWindowSelect, 'all');
  }

  updateModeUi();
  render();
}

function matchesPurpose(item) {
  if (state.selectedPurposes.size === 0) return true;
  const itemPurposes = new Set(item.purposes || []);
  return [...state.selectedPurposes].some((purpose) => itemPurposes.has(purpose));
}

function isClimateEntrepreneurFit(item) {
  const haystack = [
    item.id,
    item.source_id,
    item.title,
    item.summary,
    item.source_name,
    item.programme,
    item.access_route,
    item.scale,
    item.opportunity_type,
    item.expected_next_window,
    ...(item.purposes || []),
    ...(item.applicant_types || item.audience || []),
    ...(item.keywords || []),
  ].join(' ').toLowerCase();

  const enterpriseTerms = [
    'enterprise',
    'entrepreneur',
    'business',
    'businesses',
    'startup',
    'start-up',
    'sme',
    'micro-enterprise',
    'micro enterprise',
    'social enterprise',
    'commercialisation',
    'commercialization',
    'greenplus',
    'green plus',
    'innovation voucher',
    'innovation',
    'pilot',
    'prototype',
    'demonstration',
    'rd&d',
    'research development and demonstration',
    'accelerator',
    'incubator',
    'feasibility',
    'market',
    'product',
    'service',
  ];

  const climateTerms = [
    'climate',
    'adaptation',
    'decarbonisation',
    'decarbonization',
    'energy',
    'renewable',
    'sustainable',
    'sustainability',
    'circular',
    'bioeconomy',
    'efficiency',
    'transition',
    'carbon',
    'emissions',
    'green',
  ];

  const hardExcludeTerms = [
    'scholar',
    'scholars',
    'scholarship',
    'postgraduate',
    'phd',
    'doctoral',
    'student maintenance',
    'fellowship',
    'postdoctoral',
    'alumni',
    'pure research',
    'heritage',
    'geoheritage',
    'geoscience',
    'faq',
    'related news',
    'related publications',
    'county geological heritage audit',
    'completed audits',
  ];

  const hasEnterprise = enterpriseTerms.some((term) => haystack.includes(term));
  const hasClimate = climateTerms.some((term) => haystack.includes(term));
  const hardExcluded = hardExcludeTerms.some((term) => haystack.includes(term));

  if (hardExcluded) return false;

  // Climate Entrepreneur mode should require both:
  // 1. climate / energy / sustainability relevance
  // 2. enterprise / innovation / pilot / business / demonstrator relevance
  return hasClimate && hasEnterprise;
}

function matchesActiveMode(item) {
  if (state.activeMode === 'all') return true;

  if (state.activeMode === 'climate') {
    const relevance = item.mode_relevance?.climate;
    if (relevance === 'include') return true;
    if (relevance === 'exclude') return false;
    return isClimateEntrepreneurFit(item);
  }

  const relevance = item.mode_relevance?.[state.activeMode] || 'exclude';
  return relevance === 'include';
}

function getFilteredOpportunities() {
  const query = el.searchInput.value.trim().toLowerCase();
  const status = el.statusSelect.value;
  const applicantType = el.applicantSelect.value;
  const accessRoute = el.accessSelect.value;
  const scale = el.scaleSelect.value;
  const changeType = el.changeSelect.value;
  const changeWindow = el.changeWindowSelect.value;
  const deadlineFrom = el.deadlineFrom.value ? new Date(`${el.deadlineFrom.value}T00:00:00Z`) : null;
  const deadlineTo = el.deadlineTo.value ? new Date(`${el.deadlineTo.value}T23:59:59Z`) : null;
  const now = new Date();

  return state.catalog.opportunities.filter((item) => {
    if (effectivePublicVisibility(item) !== 'public_visible') return false;
    if (!matchesActiveMode(item)) return false;

    const programmeState = effectiveProgrammeState(item);
    const programmeKind = effectiveProgrammeKind(item);

    const haystack = [
      item.id,
      item.source_id,
      item.title,
      item.summary,
      item.source_name,
      item.programme,
      item.access_route,
      item.scale,
      item.opportunity_type,
      programmeKind,
      programmeState,
      item.expected_next_window,
      ...(item.purposes || []),
      ...(item.applicant_types || item.audience || []),
      ...(item.keywords || []),
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status !== 'all' && programmeState !== status) return false;
    if (applicantType !== 'all' && !(item.applicant_types || item.audience || []).includes(applicantType)) return false;
    if (accessRoute !== 'all' && (item.access_route || '—') !== accessRoute) return false;
    if (scale !== 'all' && (item.scale || '—') !== scale) return false;
    if (changeType !== 'all' && (item.change_type || 'none') !== changeType) return false;
    if (!matchesPurpose(item)) return false;

    if (changeWindow !== 'all') {
      if (!item.changed_at) return false;
      const diff = daysBetween(now, new Date(item.changed_at));
      if (diff > Number(changeWindow)) return false;
    }

    if (deadlineFrom || deadlineTo) {
      if (!item.deadline_iso) return false;
      const deadline = new Date(item.deadline_iso);
      if (deadlineFrom && deadline < deadlineFrom) return false;
      if (deadlineTo && deadline > deadlineTo) return false;
    }

    return true;
  }).sort((a, b) => {
    const rank = { open: 1, upcoming: 2, closed: 3, archived: 4 };
    const aState = effectiveProgrammeState(a);
    const bState = effectiveProgrammeState(b);

    if (aState !== bState) {
      return (rank[aState] || 99) - (rank[bState] || 99);
    }

    const aDeadline = a.deadline_iso ? new Date(a.deadline_iso).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline_iso ? new Date(b.deadline_iso).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return a.title.localeCompare(b.title);
  });
}

function getStatusClass(status = 'neutral') {
  if (status === 'archived') return 'status-closed';
  return `status-${status}`;
}

function getChangeBadgeClass(changeType = 'none') {
  if (changeType === 'new') return 'badge-new';
  if (changeType === 'deadline_updated' || changeType === 'status_changed') return `badge-${changeType}`;
  if (changeType === 'awarded') return 'badge-awarded';
  return 'badge-none';
}

function getChangeTagClass(changeType = 'none') {
  if (changeType === 'new') return 'tone-green';
  if (changeType === 'deadline_updated' || changeType === 'status_changed') return `tag-change-${changeType} tone-amber`;
  if (changeType === 'awarded') return 'tag-change-awarded tone-red';
  return 'tone-neutral';
}

function renderSummary(opportunities) {
  const publicItems = state.catalog.opportunities.filter((item) => effectivePublicVisibility(item) === 'public_visible');

  el.generatedAt.textContent = fmtDateTime(state.catalog.meta.generated_at);
  el.matchCount.textContent = String(opportunities.length);

  // This is labelled "Tracked sources", so count configured catalogue sources,
  // not only sources that currently produced a public opportunity card.
  el.sourceCount.textContent = String((state.catalog.sources || []).length);

  el.changeCount.textContent = String(publicItems.filter((item) => item.change_type && item.change_type !== 'none').length);
}

function renderChanges(opportunities) {
  const changed = opportunities
    .filter((item) => item.change_type && item.change_type !== 'none')
    .sort((a, b) => new Date(b.changed_at || 0) - new Date(a.changed_at || 0))
    .slice(0, 6);

  el.changesFeed.innerHTML = '';
  if (changed.length === 0) {
    el.changesFeed.innerHTML = '<div class="empty-state">No matching recent public changes under the current filters.</div>';
    return;
  }

  changed.forEach((item) => {
    const node = templates.change.content.cloneNode(true);
    const badge = node.querySelector('.change-badge');
    badge.textContent = (item.change_type || 'none').replaceAll('_', ' ');
    badge.classList.add(getChangeBadgeClass(item.change_type));
    node.querySelector('.change-date').textContent = fmtDate(item.changed_at);
    node.querySelector('.change-title').textContent = item.title;
    node.querySelector('.change-meta').textContent = `${item.source_name} · ${formatDeadlineText(item)}`;
    const link = node.querySelector('.change-link');
    link.href = item.url;
    el.changesFeed.appendChild(node);
  });
}

function renderOpportunities(opportunities) {
  el.results.innerHTML = '';
  if (opportunities.length === 0) {
    el.results.innerHTML = '<div class="empty-state">No public opportunities match the current filters. Clear the purpose chips or widen the date window.</div>';
    return;
  }

  opportunities.forEach((item) => {
    const node = templates.opportunity.content.cloneNode(true);
    const root = node.querySelector('.opportunity-card');
    const topTags = root.querySelector('.top-tags');
    const purposeTags = root.querySelector('.purpose-tags');
    const statusPill = root.querySelector('.status-pill');

    const programmeState = effectiveProgrammeState(item);
    const programmeKind = effectiveProgrammeKind(item);

    if (item.source_name) {
      topTags.appendChild(makeTag(item.source_name));
    }

    if (item.change_type && item.change_type !== 'none') {
      topTags.appendChild(makeTag(item.change_type.replaceAll('_', ' '), getChangeTagClass(item.change_type)));
    }

    statusPill.textContent = programmeStateLabel(programmeState);
    statusPill.classList.add(getStatusClass(programmeState));

    root.querySelector('.card-title').textContent = item.title;
    root.querySelector('.card-source').textContent = item.programme || item.source_name;
    root.querySelector('.card-summary').textContent = cleanCardSummary(item.summary);
    root.querySelector('.deadline').textContent = formatDeadlineText(item);
    root.querySelector('.changed').textContent = item.changed_at ? fmtDate(item.changed_at) : fmtDate(item.last_verified_at);
    root.querySelector('.region').textContent = item.region || '—';

    root.querySelector('.readout-who').textContent = compactList(item.applicant_types || item.audience || [], 'Not specified', 2);
    root.querySelector('.readout-route').textContent = titleCaseLabel(item.access_route || 'Direct / check source');
    root.querySelector('.readout-scale').textContent = titleCaseLabel(item.scale || 'Not specified');
    root.querySelector('.readout-use').textContent = compactList(item.purposes || [], item.opportunity_type || 'General', 2);
    root.querySelector('.readout-fit').textContent = fitValueForMode(item);

    if (purposeTags) {
      purposeTags.remove();
    }

    const openLink = root.querySelector('.open-link');
    openLink.href = item.url;
    openLink.textContent = item.cta_label || 'Open source page';

    el.results.appendChild(node);
  });
}

function renderSources(opportunities) {
  const filteredSourceIds = new Set(opportunities.map((item) => item.source_id));
  const publicSourceCounts = new Map();

  state.catalog.opportunities
    .filter((item) => effectivePublicVisibility(item) === 'public_visible')
    .forEach((item) => {
      publicSourceCounts.set(item.source_id, (publicSourceCounts.get(item.source_id) || 0) + 1);
    });

  const visibleSources = state.catalog.sources.filter((source) => {
    const publicCount = publicSourceCounts.get(source.id) || 0;
    if (publicCount === 0) return false;
    if (filteredSourceIds.size === 0) return true;
    return filteredSourceIds.has(source.id);
  });

  el.sources.innerHTML = '';
  visibleSources.forEach((source) => {
    const node = templates.source.content.cloneNode(true);
    const root = node.querySelector('.source-card');
    const tagWrap = root.querySelector('.source-purpose-tags');
    (source.purposes || []).forEach((purpose) => tagWrap.appendChild(makeTag(purpose)));
    root.querySelector('.source-name').textContent = source.name;
    root.querySelector('.source-note').textContent = source.note;
    root.querySelector('.source-scope').textContent = source.scope || '—';
    root.querySelector('.source-checked').textContent = fmtDateTime(source.last_checked);
    root.querySelector('.source-method').textContent = source.discovery_method || 'configured extraction';
    root.querySelector('.source-op-count').textContent = String(publicSourceCounts.get(source.id) || 0);
    root.querySelector('.source-link').href = source.url;
    el.sources.appendChild(node);
  });
}

function getShareUrl() {
  return window.location.href;
}

function updateSharePanel() {
  const shareUrl = getShareUrl();
  const shareTitle = 'Grant Radar';
  const shareText = 'Track grants and funding calls in nature, ecology, environment, energy, and community action.';

  if (el.shareOpenLink) {
    el.shareOpenLink.href = shareUrl;
  }

  if (el.qrImage) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
    el.qrImage.src = qrUrl;
  }

  if (el.nativeShareBtn) {
    if (!navigator.share) {
      el.nativeShareBtn.classList.add('hidden');
    } else {
      el.nativeShareBtn.classList.remove('hidden');
      el.nativeShareBtn.addEventListener('click', async () => {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        } catch (error) {
          if (error && error.name !== 'AbortError') {
            console.error(error);
          }
        }
      }, { once: true });
    }
  }

  if (el.copyLinkBtn) {
    el.copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const original = el.copyLinkBtn.textContent;
        el.copyLinkBtn.textContent = '✓ Copied';
        window.setTimeout(() => {
          el.copyLinkBtn.textContent = original;
        }, 1800);
      } catch (error) {
        console.error(error);
      }
    });
  }
}

function render() {
  const filtered = getFilteredOpportunities();
  renderSummary(filtered);
  renderChanges(filtered);
  renderOpportunities(filtered);
  renderSources(filtered);
}

async function init() {
  const response = await fetch('./data/catalog.json', { cache: 'no-store' });
  state.catalog = await response.json();

  renderPurposeChips();
  populateDynamicFilters();
  updateSharePanel();
  updateModeUi();

  [
    el.searchInput,
    el.statusSelect,
    el.applicantSelect,
    el.accessSelect,
    el.scaleSelect,
    el.changeSelect,
    el.changeWindowSelect,
    el.deadlineFrom,
    el.deadlineTo,
  ].forEach((node) => node.addEventListener('input', render));

  el.clearPurposeBtn.addEventListener('click', () => {
    clearSelectedPurposes();
    render();
  });

  if (el.modeAllBtn) {
    el.modeAllBtn.addEventListener('click', () => applyMode('all'));
  }

  if (el.modeNdrtBtn) {
    el.modeNdrtBtn.addEventListener('click', () => applyMode('ndrt'));
  }

  if (el.modeResearchBtn) {
    el.modeResearchBtn.addEventListener('click', () => applyMode('research'));
  }

  if (el.modeFarmerBtn) {
    el.modeFarmerBtn.addEventListener('click', () => applyMode('farmer'));
  }

  if (el.modeClimateBtn) {
    el.modeClimateBtn.addEventListener('click', () => applyMode('climate'));
  }

  if (el.modeGeoBtn) {
    el.modeGeoBtn.addEventListener('click', () => applyMode('geo'));
  }

  render();
}

init().catch((error) => {
  console.error(error);
  el.results.innerHTML = '<div class="empty-state">Catalogue failed to load. Check that <code>data/catalog.json</code> is present and reachable from this directory.</div>';
});