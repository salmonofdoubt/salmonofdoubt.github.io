const state = { payload: null };

const el = {
  summaryGrid: document.getElementById('summary-grid'),
  cards: document.getElementById('cards'),
  search: document.getElementById('search'),
  view: document.getElementById('view'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  if (status === 'approved' || status === 'cl_drafted') {
    return 'pending_review';
  }

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
  if (status === 'suppressed_non_actionable') return 'badge-suppressed';
  if (status === 'suppressed_generic_page') return 'badge-suppressed';
  if (status === 'suppressed_stale') return 'badge-suppressed';
  if (status === 'suppressed_fetch_error') return 'badge-suppressed';
  if (status === 'promoted') return 'badge-promoted';
  if (status === 'rejected') return 'badge-rejected';
  return 'badge-pending';
}

function displaySnippet(item) {
  return item.snippet || 'No snippet available.';
}

function shortWhy(item) {
  const reasons = Array.isArray(item.promotion_reasons) ? item.promotion_reasons.filter(Boolean) : [];
  const flags = Array.isArray(item.reason_flags) ? item.reason_flags.filter(Boolean) : [];

  if (reasons.length > 0) {
    return reasons.slice(0, 3).join(', ');
  }

  if (flags.length > 0) {
    return flags.slice(0, 3).join(', ');
  }

  return 'No concise reason text available.';
}

function detailRows(item) {
  const rows = [];
  const status = normalizeStatus(item);

  rows.push({ label: 'Status', value: statusLabel(status) });

  if (item.id) {
    rows.push({ label: 'Candidate ID', value: item.id });
  }

  if (item.trusted_registry_id) {
    rows.push({ label: 'Trusted source id', value: item.trusted_registry_id });
  }

  if (item.deadline_hint) {
    rows.push({ label: 'Deadline hint', value: item.deadline_hint });
  }

  if ((item.suggested_applicant_types || []).length > 0) {
    rows.push({
      label: 'Suggested applicant types',
      value: item.suggested_applicant_types.join(', '),
    });
  }

  if (item.suggested_access_route) {
    rows.push({ label: 'Suggested access route', value: item.suggested_access_route });
  }

  if (item.suggested_scale) {
    rows.push({ label: 'Suggested scale', value: item.suggested_scale });
  }

  if ((item.suggested_purposes || []).length > 0) {
    rows.push({
      label: 'Suggested purposes',
      value: item.suggested_purposes.join(', '),
    });
  }

  if ((item.reason_flags || []).length > 0) {
    rows.push({
      label: 'Reason flags',
      value: item.reason_flags.join(', '),
    });
  }

  if (item.first_seen || item.last_seen) {
    rows.push({
      label: 'Seen',
      value: `First: ${item.first_seen || '—'} | Last: ${item.last_seen || '—'}`,
    });
  }

  if (typeof item.confidence !== 'undefined') {
    rows.push({
      label: 'Confidence',
      value: Number(item.confidence || 0).toFixed(2),
    });
  }

  return rows;
}

function filteredCandidates() {
  const search = el.search.value.trim().toLowerCase();
  const view = el.view.value;

  return (state.payload.candidates || []).filter((item) => {
    const status = normalizeStatus(item);
    const haystack = [
      item.id,
      item.title,
      item.domain,
      item.source_hint,
      item.snippet,
      item.deadline_hint,
      item.trusted_registry_id,
      ...(item.suggested_purposes || []),
      ...(item.suggested_applicant_types || []),
      ...(item.reason_flags || []),
      ...(item.promotion_reasons || []),
    ]
      .join(' ')
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;

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
    promoted: 3,
    rejected: 4,
  };

  return [...items].sort((a, b) => {
    const statusDiff = rank[normalizeStatus(a)] - rank[normalizeStatus(b)];
    if (statusDiff !== 0) return statusDiff;

    const confidenceDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;

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
    el.cards.innerHTML = '<div class="empty-state">No candidates match the current filter.</div>';
    return;
  }

  el.cards.innerHTML = candidates.map((item) => {
    const status = normalizeStatus(item);
    const detailHtml = detailRows(item)
      .map((row) => `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(row.label)}</div>
          <div class="detail-value">${escapeHtml(row.value)}</div>
        </div>
      `)
      .join('');

    return `
      <article class="candidate-card">
        <div class="badge-row">
          <span class="badge ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>

        <h3>${escapeHtml(item.title || 'Untitled candidate')}</h3>

        <p class="meta">
          <strong>ID:</strong> <code>${escapeHtml(item.id || '')}</code><br>
          ${escapeHtml(item.domain || 'unknown domain')}
          ${item.source_hint ? ` · via ${escapeHtml(item.source_hint)}` : ''}
          ${item.trusted_registry_id ? `<br><strong>Covered by:</strong> ${escapeHtml(item.trusted_registry_id)}` : ''}
        </p>

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
          ${item.id ? `
            <button
              type="button"
              class="copy-id-button"
              data-copy-id="${escapeHtml(item.id)}"
              title="Copy candidate ID for the admin workflow."
            >
              Copy candidate ID
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

    const candidateId = button.getAttribute('data-copy-id') || '';
    if (!candidateId) return;

    const originalText = button.textContent;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(candidateId);
      } else {
        const temp = document.createElement('textarea');
        temp.value = candidateId;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1200);
    } catch (error) {
      console.error('Copy failed', error);
      button.textContent = 'Copy failed';
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1200);
    }
  });
}

async function init() {
  const response = await fetch('./data/discovery-candidates.json', { cache: 'no-store' });
  const payload = await response.json();

  // discovery-candidates.json is currently written as a plain array.
  // Older review UI code expected { candidates: [...] }.
  // Support both shapes so the review page does not silently render zero.
  state.payload = Array.isArray(payload) ? { candidates: payload } : payload;

  bindCardActions();
  renderCards();

  [el.search, el.view].forEach((node) => {
    node.addEventListener('input', renderCards);
    node.addEventListener('change', renderCards);
  });
}

init().catch((error) => {
  console.error(error);
  el.cards.innerHTML = '<div class="empty-state">Review queue failed to load. Check that <code>data/discovery-candidates.json</code> exists.</div>';
});