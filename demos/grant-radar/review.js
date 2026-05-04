const state = { payload: null };

const el = {
  summaryGrid: document.getElementById('summary-grid'),
  cards: document.getElementById('cards'),
  search: document.getElementById('search'),
  view: document.getElementById('view'),
  modeFilter: document.getElementById('mode-filter'),
};

const MODE_LABELS = {
  ndrt: 'River Trust',
  farmer: 'Farming',
  climate: 'Climate',
  research: 'Research',
  geo: 'Geo',
};

const MODE_ORDER = ['ndrt', 'farmer', 'climate', 'research', 'geo'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function summaryBox(label, value) {
  return `
    <div class="summary-box">
      <div class="summary-label">${escapeHtml(label)}</div>
      <div class="summary-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function normalizeStatus(item) {
  const status = String(item.status || '').trim();

  if (status === 'approved' || status === 'cl_drafted') return 'pending_review';

  if (
    status === 'pending_review' ||
    status === 'suppressed_existing' ||
    status === 'suppressed_non_actionable' ||
    status === 'suppressed_generic_page' ||
    status === 'suppressed_stale' ||
    status === 'suppressed_fetch_error' ||
    status === 'promoted' ||
    status === 'rejected'
  ) {
    return status;
  }

  return 'pending_review';
}

function statusLabel(status) {
  if (status === 'pending_review') return 'Needs decision';
  if (status === 'suppressed_existing') return 'Already covered';
  if (status === 'suppressed_non_actionable') return 'Non-actionable';
  if (status === 'suppressed_generic_page') return 'Generic page';
  if (status === 'suppressed_stale') return 'Stale';
  if (status === 'suppressed_fetch_error') return 'Fetch failed';
  if (status === 'promoted') return 'Promoted';
  if (status === 'rejected') return 'Rejected';
  return 'Needs decision';
}

function statusClass(status) {
  if (status === 'pending_review') return 'badge-pending';
  if (status === 'suppressed_existing') return 'badge-existing';
  if (
    status === 'suppressed_non_actionable' ||
    status === 'suppressed_generic_page' ||
    status === 'suppressed_stale' ||
    status === 'suppressed_fetch_error'
  ) return 'badge-suppressed';
  if (status === 'promoted') return 'badge-promoted';
  if (status === 'rejected') return 'badge-rejected';
  return 'badge-pending';
}

function cleanSnippet(value) {
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

  if (text.length > 420) text = text.slice(0, 417).trimEnd() + '…';
  return text || 'No snippet available.';
}

function displaySnippet(item) {
  return cleanSnippet(item.snippet);
}

function shortWhy(item) {
  const reasons = asArray(item.promotion_reasons).filter(Boolean);
  const flags = asArray(item.reason_flags).filter(Boolean);

  if (reasons.length > 0) return reasons.slice(0, 3).join(', ');
  if (flags.length > 0) return flags.slice(0, 3).join(', ');
  return 'No concise reason text available.';
}

function normalizeModeFit(value) {
  const fit = String(value || '').trim().toLowerCase();
  if (fit === 'include' || fit === 'maybe' || fit === 'exclude') return fit;
  return 'unknown';
}

function modeFitValue(item, mode) {
  const relevance = item.mode_relevance || {};
  return normalizeModeFit(relevance[mode]);
}

function candidateHasAnyModeData(item) {
  const relevance = item.mode_relevance || {};
  return MODE_ORDER.some((mode) => normalizeModeFit(relevance[mode]) !== 'unknown');
}

function modeFitSummary(item) {
  const relevance = item.mode_relevance || {};
  const parts = [];

  MODE_ORDER.forEach((mode) => {
    const fit = normalizeModeFit(relevance[mode]);
    if (fit === 'include' || fit === 'maybe') parts.push({ mode, fit });
  });

  return parts;
}

function candidateHasPositiveModeFit(item) {
  return modeFitSummary(item).length > 0;
}

function candidateHasExplicitNoPositiveFit(item) {
  return candidateHasAnyModeData(item) && !candidateHasPositiveModeFit(item);
}


function hasTextAny(item, terms) {
  const haystack = [
    item.title,
    item.url,
    item.domain,
    item.source_hint,
    item.source_id_hint,
    item.detected_from,
    item.snippet,
    item.candidate_type,
    item.deadline_hint,
    item.triage_class,
    item.triage_reason,
    ...asArray(item.suggested_purposes),
    ...asArray(item.promotion_reasons),
  ].join(' ').toLowerCase();

  return terms.some((term) => haystack.includes(term));
}


function looksLikeAdminOrArchive(item) {
  return hasTextAny(item, [
    'terms and conditions',
    'standard terms',
    'acknowledging our funding',
    'appeals process',
    'funded projects',
    'featured projects',
    'successful projects',
    'awardees',
    'case study',
    'privacy',
    'cookie',
    'contact',
    'about us',
    'related news',
    'related publications',
  ]);
}


function candidateText(item) {
  return [
    item.title,
    item.url,
    item.domain,
    item.source_hint,
    item.source_id_hint,
    item.detected_from,
    item.snippet,
    item.candidate_type,
    item.deadline_hint,
    item.triage_class,
    item.triage_reason,
    ...asArray(item.suggested_purposes),
    ...asArray(item.promotion_reasons),
  ].join(' ').toLowerCase();
}

function textHasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function titleLooksGeneric(item) {
  const title = String(item.title || '').trim().toLowerCase();

  return [
    'funding',
    'funding and grants',
    'grants',
    'grant funding',
    'horizon europe',
    'projects',
    'funding opportunities',
    'research',
  ].includes(title);
}

function looksLikeNoise(item) {
  const text = candidateText(item);

  return textHasAny(text, [
    'terms and conditions',
    'standard terms',
    'acknowledging our funding',
    'appeals process',
    'funded projects',
    'featured projects',
    'successful projects',
    'awardees',
    'case study',
    'related news',
    'related publications',
    'privacy',
    'cookie',
    'contact',
    'about us',
  ]);
}

function looksOffScope(item) {
  const text = candidateText(item);

  return textHasAny(text, [
    'civil security',
    'culture, creativity and inclusive society',
    'promotion of agricultural products',
    'coal and steel',
    'reforming and enhancing the european r&i system',
    'widening participation and spreading excellence',
  ]);
}


function isRealOpportunity(item) {
  const status = normalizeStatus(item);
  if (status !== 'pending_review') return false;

  if (candidateHasExplicitNoPositiveFit(item)) return false;
  if (titleLooksGeneric(item)) return false;
  if (looksLikeNoise(item)) return false;
  if (looksOffScope(item)) return false;

  const triage = String(item.triage_class || '').toLowerCase();

  if (triage === 'direct_apply' || triage === 'programme_watch') {
    return true;
  }

  const type = String(item.candidate_type || '').toLowerCase();
  const confidence = Number(item.confidence || 0);
  const title = String(item.title || '').toLowerCase();
  const url = String(item.url || '').toLowerCase();
  const deadline = String(item.deadline_hint || '').toLowerCase();

  const usefulType = [
    'funding_call',
    'recurring_programme',
    'rolling_support',
    'scholarship',
  ].includes(type);

  const strongApplySignal =
    Boolean(deadline) ||
    /joint transnational call|call for proposals|call for applications|funding call|research call|grant scheme|networking awards|supplemental grant|research grants|scientific networks|marie sk|erc advanced grant|life calls/i.test(title) ||
    /\/funding\/[^/]+|\/grants?\/[^/]+|\/call|\/calls|\/programme|\/programmes|\/scheme|\/fellowship|\/research-grants|\/scientific-networks|\/advanced-grants|\/life-calls/i.test(url);

  return usefulType && strongApplySignal && confidence >= 0.65 && candidateHasPositiveModeFit(item);
}


function candidateMatchesMode(item, selectedMode) {
  if (!selectedMode || selectedMode === 'all') return true;
  if (selectedMode === 'unclassified') return !candidateHasAnyModeData(item);
  const fit = modeFitValue(item, selectedMode);
  return fit === 'include' || fit === 'maybe';
}

function modeBadgeClass(fit) {
  if (fit === 'include') return 'mode-include';
  if (fit === 'maybe') return 'mode-maybe';
  if (fit === 'exclude') return 'mode-exclude';
  return 'mode-unknown';
}

function modeFitSearchText(item) {
  const relevance = item.mode_relevance || {};
  return MODE_ORDER.map((mode) => {
    const fit = normalizeModeFit(relevance[mode]);
    return `${mode} ${MODE_LABELS[mode]} ${fit}`;
  }).join(' ');
}

function modeFitDetailText(item) {
  const relevance = item.mode_relevance || {};
  return MODE_ORDER.map((mode) => {
    const fit = normalizeModeFit(relevance[mode]);
    return `${MODE_LABELS[mode]}: ${fit}`;
  }).join(' | ');
}

function renderModeFitBadges(item) {
  const positive = modeFitSummary(item);

  if (positive.length === 0) {
    if (!candidateHasAnyModeData(item)) {
      return `
        <div class="mode-fit-block">
          <div class="mode-fit-caption">Potential fit</div>
          <div class="mode-fit-row">
            <span class="mode-badge mode-unknown">Unclassified</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="mode-fit-block">
        <div class="mode-fit-caption">Potential fit</div>
        <div class="mode-fit-row">
          <span class="mode-badge mode-exclude">No positive mode fit</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="mode-fit-block">
      <div class="mode-fit-caption">Potential fit</div>
      <div class="mode-fit-row">
        ${positive.map(({ mode, fit }) => `
          <span class="mode-badge ${modeBadgeClass(fit)}">
            ${escapeHtml(MODE_LABELS[mode])}: ${escapeHtml(fit)}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function confidenceValue(item) {
  const raw = Number(item.confidence);
  return Number.isFinite(raw) ? raw : null;
}

function confidenceClass(value) {
  if (value === null) return 'confidence-low';
  if (value >= 0.85) return 'confidence-high';
  if (value >= 0.65) return 'confidence-medium';
  return 'confidence-low';
}

function renderConfidenceBadge(item) {
  const value = confidenceValue(item);
  if (value === null) {
    return '<span class="confidence-badge confidence-low">Confidence: unknown</span>';
  }
  return `<span class="confidence-badge ${confidenceClass(value)}">Confidence: ${value.toFixed(2)}</span>`;
}

function readableType(value) {
  const text = String(value || 'candidate')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferSourcePack(item) {
  const haystack = [
    item.source_pack,
    item.detected_from,
    item.source_id_hint,
    item.source_hint,
    item.domain,
    item.url,
    item.title,
    ...asArray(item.suggested_purposes),
  ].join(' ').toLowerCase();

  if (
    haystack.includes('geo_') ||
    haystack.includes('geo radar') ||
    haystack.includes('gfz') ||
    haystack.includes('dfg') ||
    haystack.includes('gsi') ||
    haystack.includes('geoscience') ||
    haystack.includes('geothermal') ||
    haystack.includes('subsurface')
  ) return { key: 'geo', label: 'Geo / Earth' };

  if (
    haystack.includes('lawpro') ||
    haystack.includes('lawaters') ||
    haystack.includes('fisheriesireland') ||
    haystack.includes('farmingforwater') ||
    haystack.includes('water quality') ||
    haystack.includes('catchment') ||
    haystack.includes('river restoration')
  ) return { key: 'water', label: 'Water / NbS' };

  if (
    haystack.includes('enterprise-ireland') ||
    haystack.includes('seai') ||
    haystack.includes('climate') ||
    haystack.includes('energy') ||
    haystack.includes('decarbonisation')
  ) return { key: 'climate', label: 'Climate' };

  if (
    haystack.includes('researchireland') ||
    haystack.includes('research ireland') ||
    haystack.includes('horizon') ||
    haystack.includes('epa') ||
    haystack.includes('research')
  ) return { key: 'research', label: 'Research' };

  if (haystack.includes('heritage')) return { key: 'heritage', label: 'Heritage' };
  return { key: 'general', label: 'General' };
}

function renderSourcePackBadge(item) {
  const pack = inferSourcePack(item);
  return `<span class="triage-badge source-pack source-pack-${escapeHtml(pack.key)}">${escapeHtml(pack.label)}</span>`;
}

function renderTypeBadge(item) {
  return `<span class="triage-badge candidate-type">${escapeHtml(readableType(item.candidate_type))}</span>`;
}

function renderSeenBadge(item) {
  if (item.seen_in_latest_run === true) {
    return '<span class="triage-badge seen-latest">Seen latest</span>';
  }
  if (item.seen_in_latest_run === false) {
    return '<span class="triage-badge not-seen-latest">Not in latest run</span>';
  }
  return '<span class="triage-badge seen-unknown">Seen unknown</span>';
}

function renderTriageBadges(item) {
  return `
    <div class="triage-row">
      ${renderSourcePackBadge(item)}
      ${renderTypeBadge(item)}
      ${renderSeenBadge(item)}
    </div>
  `;
}

function detailRows(item) {
  const rows = [];
  const status = normalizeStatus(item);
  const pack = inferSourcePack(item);

  rows.push({ label: 'Status', value: statusLabel(status) });
  rows.push({ label: 'Mode relevance', value: modeFitDetailText(item) });
  rows.push({ label: 'Source pack', value: pack.label });

  if (item.candidate_type) rows.push({ label: 'Candidate type', value: readableType(item.candidate_type) });
  if (item.url) rows.push({ label: 'URL', value: item.url });
  if (item.trusted_registry_id) rows.push({ label: 'Trusted source id', value: item.trusted_registry_id });
  if (item.deadline_hint) rows.push({ label: 'Deadline hint', value: item.deadline_hint });

  if (asArray(item.suggested_applicant_types).length > 0) {
    rows.push({ label: 'Suggested applicant types', value: asArray(item.suggested_applicant_types).join(', ') });
  }

  if (item.suggested_access_route) rows.push({ label: 'Suggested access route', value: item.suggested_access_route });
  if (item.suggested_scale) rows.push({ label: 'Suggested scale', value: item.suggested_scale });

  if (asArray(item.suggested_purposes).length > 0) {
    rows.push({ label: 'Suggested purposes', value: asArray(item.suggested_purposes).join(', ') });
  }

  if (asArray(item.reason_flags).length > 0) {
    rows.push({ label: 'Reason flags', value: asArray(item.reason_flags).join(', ') });
  }

  if (item.first_seen || item.last_seen) {
    rows.push({ label: 'Seen', value: `First: ${item.first_seen || '—'} | Last: ${item.last_seen || '—'}` });
  }

  const confidence = confidenceValue(item);
  if (confidence !== null) rows.push({ label: 'Confidence', value: confidence.toFixed(2) });

  return rows;
}

function lastSeenTime(item) {
  const value = Date.parse(item.last_seen || item.first_seen || '');
  return Number.isFinite(value) ? value : 0;
}

function modeRank(item) {
  let rank = 0;
  MODE_ORDER.forEach((mode) => {
    const fit = modeFitValue(item, mode);
    if (fit === 'include') rank = Math.max(rank, 2);
    if (fit === 'maybe') rank = Math.max(rank, 1);
  });
  return rank;
}

function filteredCandidates() {
  const search = el.search.value.trim().toLowerCase();
  const view = el.view.value || 'real';
  const selectedMode = el.modeFilter ? el.modeFilter.value : 'all';

  return (state.payload.candidates || []).filter((item) => {
    const status = normalizeStatus(item);
    const pack = inferSourcePack(item);

    const haystack = [
      item.id,
      item.title,
      item.domain,
      item.source_hint,
      item.snippet,
      item.deadline_hint,
      item.trusted_registry_id,
      item.url,
      item.candidate_type,
      item.triage_class,
      item.triage_reason,
      pack.label,
      modeFitSearchText(item),
      ...asArray(item.suggested_purposes),
      ...asArray(item.suggested_applicant_types),
      ...asArray(item.reason_flags),
      ...asArray(item.promotion_reasons),
    ].join(' ').toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (!candidateMatchesMode(item, selectedMode)) return false;

    if (view === 'real') {
      return isRealOpportunity(item);
    }

    if (view === 'active') {
      return status === 'pending_review';
    }

    if (view === 'suppressed_existing') {
      return status === 'suppressed_existing';
    }

    if (view === 'suppressed_non_actionable') {
      return (
        status === 'suppressed_non_actionable' ||
        status === 'suppressed_generic_page' ||
        status === 'suppressed_stale' ||
        status === 'suppressed_fetch_error'
      );
    }

    if (view === 'completed') {
      return status === 'promoted' || status === 'rejected';
    }

    return true;
  });
}


function sortedCandidates(items) {
  const rank = {
    pending_review: 0,
    suppressed_existing: 1,
    suppressed_non_actionable: 2,
    suppressed_generic_page: 2,
    suppressed_stale: 2,
    suppressed_fetch_error: 2,
    promoted: 3,
    rejected: 4,
  };

  return [...items].sort((a, b) => {
    const statusDiff = (rank[normalizeStatus(a)] ?? 99) - (rank[normalizeStatus(b)] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    const modeDiff = modeRank(b) - modeRank(a);
    if (modeDiff !== 0) return modeDiff;

    const confidenceDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;

    const latestDiff = Number(Boolean(b.seen_in_latest_run)) - Number(Boolean(a.seen_in_latest_run));
    if (latestDiff !== 0) return latestDiff;

    const dateDiff = lastSeenTime(b) - lastSeenTime(a);
    if (dateDiff !== 0) return dateDiff;

    return (a.title || '').localeCompare(b.title || '');
  });
}

function renderSummary(allCandidates) {
  const counts = {
    pending_review: 0,
    suppressed_existing: 0,
    suppressed_non_actionable: 0,
    completed: 0,
  };

  allCandidates.forEach((item) => {
    const status = normalizeStatus(item);
    if (status === 'pending_review') counts.pending_review += 1;
    else if (status === 'suppressed_existing') counts.suppressed_existing += 1;
    else if (
      status === 'suppressed_non_actionable' ||
      status === 'suppressed_generic_page' ||
      status === 'suppressed_stale' ||
      status === 'suppressed_fetch_error'
    ) counts.suppressed_non_actionable += 1;
    else if (status === 'promoted' || status === 'rejected') counts.completed += 1;
  });

  el.summaryGrid.innerHTML = [
    summaryBox('Needs decision', counts.pending_review),
    summaryBox('Already covered', counts.suppressed_existing),
    summaryBox('Non-actionable', counts.suppressed_non_actionable),
    summaryBox('Completed', counts.completed),
  ].join('');
}

function renderCards() {
  const allCandidates = state.payload.candidates || [];
  const candidates = sortedCandidates(filteredCandidates());

  renderSummary(allCandidates);

  if (candidates.length === 0) {
    el.cards.innerHTML = '<div class="empty-state">No candidates match the current filter. Switch Queue view to Everything / audit view to see the full discovery file.</div>';
    return;
  }

  el.cards.innerHTML = candidates.map((item) => {
    const status = normalizeStatus(item);

    const detailHtml = detailRows(item).map((row) => `
      <div class="detail-item">
        <div class="detail-label">${escapeHtml(row.label)}</div>
        <div class="detail-value">${escapeHtml(row.value)}</div>
      </div>
    `).join('');

    const copyValue = item.id || item.url || '';

    return `
      <article class="candidate-card">
        <div class="card-topline">
          <span class="badge ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
          ${renderConfidenceBadge(item)}
        </div>

        <h3>${escapeHtml(item.title || 'Untitled candidate')}</h3>

        <p class="meta">
          ${escapeHtml(item.domain || 'unknown domain')}
          ${item.source_hint ? ` · via ${escapeHtml(item.source_hint)}` : ''}
          ${item.trusted_registry_id ? `<br><strong>Covered by:</strong> ${escapeHtml(item.trusted_registry_id)}` : ''}
        </p>

        ${renderTriageBadges(item)}
        ${renderModeFitBadges(item)}

        <p class="snippet">${escapeHtml(displaySnippet(item))}</p>

        <p class="why">
          <strong>Why:</strong> ${escapeHtml(shortWhy(item))}
        </p>

        <details>
          <summary>More detail</summary>
          <div class="detail-wrap">
            <div class="detail-grid">
              ${detailHtml}
            </div>
          </div>
        </details>

        <div class="actions">
          ${copyValue ? `
            <button
              type="button"
              class="copy-id-button"
              data-copy-value="${escapeHtml(copyValue)}"
              title="Copy the exact value to use in the admin workflow."
            >
              Copy admin input
            </button>
          ` : ''}

          <a
            href="${escapeHtml(item.url)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the candidate page in a new tab."
          >
            Open candidate page
          </a>
        </div>
      </article>
    `;
  }).join('');
}

function bindCardActions() {
  el.cards.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-id-button');
    if (!button) return;

    const copyValue = button.getAttribute('data-copy-value') || '';
    if (!copyValue) return;

    const originalText = button.textContent;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copyValue);
      } else {
        const temp = document.createElement('textarea');
        temp.value = copyValue;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = originalText; }, 1200);
    } catch (error) {
      console.error('Copy failed', error);
      button.textContent = 'Copy failed';
      window.setTimeout(() => { button.textContent = originalText; }, 1200);
    }
  });
}

async function init() {
  const response = await fetch('./data/discovery-candidates.json', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Could not fetch discovery-candidates.json: HTTP ${response.status}`);
  }

  const payload = await response.json();

  state.payload = Array.isArray(payload) ? { candidates: payload } : payload;

  bindCardActions();
  renderCards();

  [el.search, el.view, el.modeFilter].filter(Boolean).forEach((node) => {
    node.addEventListener('input', renderCards);
    node.addEventListener('change', renderCards);
  });
}

init().catch((error) => {
  console.error(error);
  const message = escapeHtml(error && error.message ? error.message : String(error));
  el.cards.innerHTML = `<div class="empty-state">Review queue failed to load: <code>${message}</code></div>`;
});
