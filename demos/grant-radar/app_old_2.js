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
  modeAllBtn: document.getElementById('mode-all-btn'),
  modeNdrtBtn: document.getElementById('mode-ndrt-btn'),
  modeResearchBtn: document.getElementById('mode-research-btn'),
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
];

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

function makeTag(text, className = '') {
  const span = document.createElement('span');
  span.className = `tag ${className}`.trim();
  span.textContent = titleCaseLabel(text);
  return span;
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

function updateModeUi() {
  const modeMap = {
    all: el.modeAllBtn,
    ndrt: el.modeNdrtBtn,
    research: el.modeResearchBtn,
  };

  Object.entries(modeMap).forEach(([key, button]) => {
    if (!button) return;
    button.classList.toggle('active', key === state.activeMode);
  });

  if (!el.modeNote) return;

  if (state.activeMode === 'ndrt') {
    el.modeNote.textContent = 'River Trust mode highlights practical catchment, restoration, wetland, habitat, and citizen-science routes while keeping the dropdowns broad.';
    return;
  }

  if (state.activeMode === 'research') {
    el.modeNote.textContent = 'Research mode highlights research-facing themes and sets applicant type to Researchers where that filter exists.';
    return;
  }

  el.modeNote.textContent = 'Showing the full catalogue using the standard defaults.';
}

function applyMode(mode) {
  state.activeMode = mode;

  setSearchValue('');
  setDateValue(el.deadlineFrom);
  setDateValue(el.deadlineTo);
  setSelectValue(el.statusSelect, 'all');
  setSelectValue(el.changeSelect, 'all');

  if (mode === 'ndrt') {
    selectPurposes(NDRT_PURPOSES);
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.accessSelect, 'all');
    setSelectValue(el.scaleSelect, 'all');
    setSelectValue(el.changeWindowSelect, '365');
  } else if (mode === 'research') {
    selectPurposes(RESEARCH_PURPOSES);
    setSelectValue(el.applicantSelect, 'researchers');
    setSelectValue(el.accessSelect, 'all');
    setSelectValue(el.scaleSelect, 'all');
    setSelectValue(el.changeWindowSelect, '365');
  } else {
    clearSelectedPurposes();
    setSelectValue(el.applicantSelect, 'all');
    setSelectValue(el.accessSelect, 'all');
    setSelectValue(el.scaleSelect, 'all');
    setSelectValue(el.changeWindowSelect, '30');
  }

  updateModeUi();
  render();
}

function matchesPurpose(item) {
  if (state.selectedPurposes.size === 0) return true;
  const itemPurposes = new Set(item.purposes || []);
  return [...state.selectedPurposes].some((purpose) => itemPurposes.has(purpose));
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
    const haystack = [
      item.title,
      item.summary,
      item.source_name,
      item.programme,
      item.access_route,
      item.scale,
      item.opportunity_type,
      ...(item.purposes || []),
      ...(item.applicant_types || item.audience || []),
      ...(item.keywords || []),
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status !== 'all' && item.status !== status) return false;
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
    const aDeadline = a.deadline_iso ? new Date(a.deadline_iso).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline_iso ? new Date(b.deadline_iso).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return a.title.localeCompare(b.title);
  });
}

function getStatusClass(status = 'neutral') {
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
  el.generatedAt.textContent = fmtDateTime(state.catalog.meta.generated_at);
  el.matchCount.textContent = String(opportunities.length);
  el.sourceCount.textContent = String(state.catalog.sources.length);
  el.changeCount.textContent = String(state.catalog.opportunities.filter((item) => item.change_type && item.change_type !== 'none').length);
}

function renderChanges(opportunities) {
  const changed = opportunities
    .filter((item) => item.change_type && item.change_type !== 'none')
    .sort((a, b) => new Date(b.changed_at || 0) - new Date(a.changed_at || 0))
    .slice(0, 6);

  el.changesFeed.innerHTML = '';
  if (changed.length === 0) {
    el.changesFeed.innerHTML = '<div class="empty-state">No matching recent changes under the current filters.</div>';
    return;
  }

  changed.forEach((item) => {
    const node = templates.change.content.cloneNode(true);
    const badge = node.querySelector('.change-badge');
    badge.textContent = (item.change_type || 'none').replaceAll('_', ' ');
    badge.classList.add(getChangeBadgeClass(item.change_type));
    node.querySelector('.change-date').textContent = fmtDate(item.changed_at);
    node.querySelector('.change-title').textContent = item.title;
    node.querySelector('.change-meta').textContent = `${item.source_name} · ${item.deadline_text || 'Deadline not yet extracted'}`;
    const link = node.querySelector('.change-link');
    link.href = item.url;
    el.changesFeed.appendChild(node);
  });
}

function renderOpportunities(opportunities) {
  el.results.innerHTML = '';
  if (opportunities.length === 0) {
    el.results.innerHTML = '<div class="empty-state">No opportunities match the current filters. Clear the purpose chips or widen the date window.</div>';
    return;
  }

  opportunities.forEach((item) => {
    const node = templates.opportunity.content.cloneNode(true);
    const root = node.querySelector('.opportunity-card');
    const topTags = root.querySelector('.top-tags');
    const purposeTags = root.querySelector('.purpose-tags');
    const statusPill = root.querySelector('.status-pill');

    topTags.appendChild(makeTag(item.source_name));
    if (item.opportunity_type) topTags.appendChild(makeTag(item.opportunity_type));
    if (item.scale) topTags.appendChild(makeTag(item.scale, 'tag-scale'));
    if (item.access_route) topTags.appendChild(makeTag(item.access_route, 'tag-access'));
    if (item.change_type && item.change_type !== 'none') {
      topTags.appendChild(makeTag(item.change_type.replaceAll('_', ' '), getChangeTagClass(item.change_type)));
    }

    statusPill.textContent = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown';
    statusPill.classList.add(getStatusClass(item.status || 'neutral'));

    root.querySelector('.card-title').textContent = item.title;
    root.querySelector('.card-source').textContent = item.programme || item.source_name;
    root.querySelector('.card-summary').textContent = item.summary;
    root.querySelector('.deadline').textContent = item.deadline_text || 'Deadline not yet extracted';
    root.querySelector('.changed').textContent = item.changed_at ? fmtDate(item.changed_at) : '—';
    root.querySelector('.region').textContent = item.region || '—';
    root.querySelector('.applicant').textContent = (item.applicant_types || item.audience || []).map(titleCaseLabel).join(', ') || '—';
    root.querySelector('.access').textContent = titleCaseLabel(item.access_route || '—');
    root.querySelector('.scale').textContent = titleCaseLabel(item.scale || '—');

    (item.purposes || []).forEach((purpose) => purposeTags.appendChild(makeTag(purpose)));

    const openLink = root.querySelector('.open-link');
    openLink.href = item.url;
    openLink.textContent = item.cta_label || 'Open source page';

    el.results.appendChild(node);
  });
}

function renderSources(opportunities) {
  const filteredSourceIds = new Set(opportunities.map((item) => item.source_id));
  const visibleSources = state.catalog.sources.filter((source) => filteredSourceIds.size === 0 || filteredSourceIds.has(source.id));

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
    root.querySelector('.source-op-count').textContent = String(state.catalog.opportunities.filter((item) => item.source_id === source.id).length);
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

  render();
}

init().catch((error) => {
  console.error(error);
  el.results.innerHTML = '<div class="empty-state">Catalogue failed to load. Check that <code>data/catalog.json</code> is present and reachable from this directory.</div>';
});