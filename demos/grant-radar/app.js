const state = {
  catalog: null,
  selectedPurposes: new Set(),
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
};

const templates = {
  opportunity: document.getElementById('opportunity-card-template'),
  source: document.getElementById('source-card-template'),
  change: document.getElementById('change-item-template'),
};

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

function makeTag(text, className = '') {
  const span = document.createElement('span');
  span.className = `tag ${className}`.trim();
  span.textContent = text;
  return span;
}

function createChip(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip-btn';
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (state.selectedPurposes.has(label)) {
      state.selectedPurposes.delete(label);
      btn.classList.remove('active');
    } else {
      state.selectedPurposes.add(label);
      btn.classList.add('active');
    }
    render();
  });
  return btn;
}

function fillSelect(select, values, placeholder) {
  select.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = placeholder;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderPurposeChips() {
  const purposes = state.catalog.meta.available_purposes || [];
  el.purposeChips.innerHTML = '';
  purposes.forEach((purpose) => el.purposeChips.appendChild(createChip(purpose)));
}

function populateDynamicFilters() {
  const meta = state.catalog.meta || {};
  fillSelect(el.applicantSelect, meta.available_applicant_types || [], 'All applicant types');
  fillSelect(el.accessSelect, meta.available_access_routes || [], 'All access routes');
  fillSelect(el.scaleSelect, meta.available_scales || [], 'All scales');
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
    root.querySelector('.applicant').textContent = (item.applicant_types || item.audience || []).join(', ') || '—';
    root.querySelector('.access').textContent = item.access_route || '—';
    root.querySelector('.scale').textContent = item.scale || '—';

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
    state.selectedPurposes.clear();
    document.querySelectorAll('.chip-btn').forEach((btn) => btn.classList.remove('active'));
    render();
  });

  render();
}

init().catch((error) => {
  console.error(error);
  el.results.innerHTML = '<div class="empty-state">Catalogue failed to load. Check that <code>data/catalog.json</code> is present and reachable from this directory.</div>';
});
