const ISSUE_REPO_BASE = 'https://github.com/salmonofdoubt/salmonofdoubt.github.io';
const state = { payload: null };

const el = {
  summaryGrid: document.getElementById('summary-grid'),
  cards: document.getElementById('cards'),
  search: document.getElementById('search'),
  lane: document.getElementById('lane'),
  workflow: document.getElementById('workflow'),
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

function canonicalFamilyKeyFromUrl(url) {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname.replace(/_[a-z]{2}$/i, '');
    path = path.replace(/\/+$/g, '') || '/';
    return `${parsed.hostname.replace(/^www\./i, '')}${path}`;
  } catch {
    return url || 'unknown';
  }
}

function fallbackReviewKey(item) {
  const family = item.canonical_family_key || canonicalFamilyKeyFromUrl(item.url || '');
  const title = (item.title || '').trim().toLowerCase();
  const source = (item.source_hint || '').trim().toLowerCase();
  const domain = (item.domain || '').trim().toLowerCase();
  return `${family}::${title}::${source}::${domain}`;
}

function derivePromotionSignal(item) {
  if (item.promotion_signal === 'green' || item.promotion_signal === 'amber' || item.promotion_signal === 'red') {
    return item.promotion_signal;
  }

  const candidateType = item.candidate_type || '';
  const title = `${item.title || ''} ${item.url || ''}`.toLowerCase();
  const deadline = `${item.deadline_hint || ''}`.toLowerCase();
  const reasons = `${(item.reason_flags || []).join(' ')} ${(item.promotion_reasons || []).join(' ')}`.toLowerCase();

  if (
    candidateType === 'news_page' ||
    candidateType === 'award_page' ||
    title.includes('announc') ||
    title.includes('press release') ||
    deadline.includes('passed') ||
    reasons.includes('announcement') ||
    reasons.includes('passed-deadline')
  ) {
    return 'red';
  }

  const hasApplicants = (item.suggested_applicant_types || []).length > 0;
  const hasRoute = !!item.suggested_access_route;
  const hasScale = !!item.suggested_scale;
  const actionable =
    title.includes('grant') ||
    title.includes('fund') ||
    title.includes('call') ||
    title.includes('scheme');

  if (hasApplicants && hasRoute && hasScale && actionable && Number(item.confidence || 0) >= 0.58) {
    return 'green';
  }

  if ((hasApplicants || hasRoute || hasScale) && Number(item.confidence || 0) >= 0.48) {
    return 'amber';
  }

  return 'red';
}

function signalRank(signal) {
  if (signal === 'green') return 3;
  if (signal === 'amber') return 2;
  return 1;
}

function signalLabel(signal) {
  if (signal === 'green') return 'Promotable';
  if (signal === 'amber') return 'Review carefully';
  return 'Discovery only';
}

function signalTitle(signal) {
  if (signal === 'green') {
    return 'Looks like a real funding route or call page and is worth promotion review.';
  }
  if (signal === 'amber') {
    return 'Possibly useful, but the signal is incomplete or weaker. Check before promoting.';
  }
  return 'Likely announcement, historic page, award note, or weak lead. Usually not for public promotion.';
}

function signalClass(signal) {
  if (signal === 'green') return 'signal-green';
  if (signal === 'amber') return 'signal-amber';
  return 'signal-red';
}

function workflowBucket(item) {
  if (item.status === 'promoted' || item.status === 'rejected') return 'completed';
  if (item.promotion_requested) return 'requested';
  if (item.status === 'cl_drafted' || item.cl_draft_ready) return 'draft_ready';
  if (item.status === 'approved') return 'approved';
  return 'pending';
}

function workflowLabel(bucket) {
  if (bucket === 'requested') return 'Request open';
  if (bucket === 'draft_ready') return 'Draft ready';
  if (bucket === 'approved') return 'Approved';
  if (bucket === 'completed') return 'Completed';
  return 'Pending';
}

function workflowTitle(bucket) {
  if (bucket === 'requested') return 'A GitHub promotion request issue already exists for this candidate.';
  if (bucket === 'draft_ready') return 'A draft was already generated for this candidate.';
  if (bucket === 'approved') return 'This candidate was approved in workflow but not yet fully promoted.';
  if (bucket === 'completed') return 'This candidate is already promoted or rejected.';
  return 'Still waiting for review.';
}

function workflowClass(bucket) {
  if (bucket === 'requested') return 'workflow-requested';
  if (bucket === 'draft_ready') return 'workflow-draft';
  if (bucket === 'approved') return 'workflow-approved';
  if (bucket === 'completed') return 'workflow-completed';
  return '';
}

function chooseBetterItem(existing, candidate) {
  const existingSignal = signalRank(derivePromotionSignal(existing));
  const candidateSignal = signalRank(derivePromotionSignal(candidate));

  if (candidateSignal > existingSignal) return candidate;
  if (existingSignal > candidateSignal) return existing;

  const existingIsEn = /_en$/i.test(existing.url || '');
  const candidateIsEn = /_en$/i.test(candidate.url || '');

  if (candidateIsEn && !existingIsEn) return candidate;
  if (existingIsEn && !candidateIsEn) return existing;

  const existingRequested = !!existing.promotion_requested;
  const candidateRequested = !!candidate.promotion_requested;
  if (candidateRequested && !existingRequested) return candidate;
  if (existingRequested && !candidateRequested) return existing;

  const existingDraft = !!existing.cl_draft_ready;
  const candidateDraft = !!candidate.cl_draft_ready;
  if (candidateDraft && !existingDraft) return candidate;
  if (existingDraft && !candidateDraft) return existing;

  const existingConfidence = Number(existing.confidence || 0);
  const candidateConfidence = Number(candidate.confidence || 0);
  if (candidateConfidence > existingConfidence) return candidate;
  if (existingConfidence > candidateConfidence) return existing;

  return existing;
}

function getVisibleCandidates(rawCandidates) {
  const byKey = new Map();

  rawCandidates.forEach((item) => {
    const key = fallbackReviewKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      return;
    }
    byKey.set(key, chooseBetterItem(existing, item));
  });

  return Array.from(byKey.values());
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

  if (item.programme_state || item.expected_next_window) {
    rows.push({
      label: 'Programme state',
      value: `${item.programme_state || 'unknown'}${item.expected_next_window ? ` | Next window: ${item.expected_next_window}` : ''}`,
    });
  }

  return rows;
}

function buildIssueUrl(item) {
  const title = `[Grant Radar] Promote candidate ${item.id}`;
  const body = [
    '## Candidate',
    `candidate_id: ${item.id}`,
    `candidate_url: ${item.url}`,
    `candidate_title: ${item.title || ''}`,
    `promotion_signal: ${derivePromotionSignal(item)}`,
    '',
    '## Decision',
    '- [ ] Accept promotion into trusted catalogue',
    '- [ ] Reject suggestion',
    '',
    '## Notes',
    'Created from the simplified Grant Radar review page.',
  ].join('\n');

  return `${ISSUE_REPO_BASE}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function filteredCandidates() {
  const search = el.search.value.trim().toLowerCase();
  const lane = el.lane.value;
  const workflow = el.workflow.value;

  const visible = getVisibleCandidates(state.payload.candidates || []);

  return visible.filter((item) => {
    const haystack = [
      item.title,
      item.domain,
      item.source_hint,
      item.snippet,
      ...(item.suggested_purposes || []),
      ...(item.suggested_applicant_types || []),
      ...(item.reason_flags || []),
      ...(item.promotion_reasons || []),
    ]
      .join(' ')
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (lane !== 'all' && derivePromotionSignal(item) !== lane) return false;

    const bucket = workflowBucket(item);

    if (workflow === 'active' && bucket === 'completed') return false;
    if (workflow !== 'active' && workflow !== 'all' && bucket !== workflow) return false;

    return true;
  });
}

function sortedCandidates(items) {
  return [...items].sort((a, b) => {
    const signalDiff = signalRank(derivePromotionSignal(b)) - signalRank(derivePromotionSignal(a));
    if (signalDiff !== 0) return signalDiff;

    const requestedDiff = Number(!!b.promotion_requested) - Number(!!a.promotion_requested);
    if (requestedDiff !== 0) return requestedDiff;

    const draftDiff = Number(!!b.cl_draft_ready) - Number(!!a.cl_draft_ready);
    if (draftDiff !== 0) return draftDiff;

    const confidenceDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;

    return (a.title || '').localeCompare(b.title || '');
  });
}

function renderSummary(candidates) {
  const green = candidates.filter((item) => derivePromotionSignal(item) === 'green').length;
  const amber = candidates.filter((item) => derivePromotionSignal(item) === 'amber').length;
  const red = candidates.filter((item) => derivePromotionSignal(item) === 'red').length;

  el.summaryGrid.innerHTML = [
    summaryBox('Visible candidates', candidates.length),
    summaryBox('Promotable', green),
    summaryBox('Review carefully', amber),
    summaryBox('Discovery only', red),
  ].join('');
}

function renderCards() {
  const candidates = sortedCandidates(filteredCandidates());

  renderSummary(candidates);

  if (candidates.length === 0) {
    el.cards.innerHTML = '<div class="empty-state">No candidates match the current filters.</div>';
    return;
  }

  el.cards.innerHTML = candidates.map((item) => {
    const signal = derivePromotionSignal(item);
    const bucket = workflowBucket(item);
    const detailHtml = detailRows(item)
      .map((row) => `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(row.label)}</div>
          <div class="detail-value">${escapeHtml(row.value)}</div>
        </div>
      `)
      .join('');

    const suggestButton = item.promotion_requested
      ? `<a href="${escapeHtml(item.promotion_request_issue_url || buildIssueUrl(item))}" target="_blank" rel="noopener noreferrer" title="Open the existing promotion request issue.">Open request issue</a>`
      : item.already_trusted
        ? ''
        : `<a href="${escapeHtml(buildIssueUrl(item))}" target="_blank" rel="noopener noreferrer" title="Open a GitHub issue to request promotion of this candidate.">Suggest for promotion</a>`;

    const draftLink = item.cl_draft_html
      ? `<a href="./${escapeHtml(item.cl_draft_html)}" target="_blank" rel="noopener noreferrer" title="Open the generated draft page for this candidate.">Open draft</a>`
      : '';

    return `
      <article class="candidate-card">
        <div class="card-top">
          <div class="badge-row">
            <span
              class="badge ${signalClass(signal)}"
              title="${escapeHtml(signalTitle(signal))}"
            >
              ${escapeHtml(signalLabel(signal))}
            </span>

            ${bucket !== 'pending' ? `
              <span
                class="badge ${workflowClass(bucket)}"
                title="${escapeHtml(workflowTitle(bucket))}"
              >
                ${escapeHtml(workflowLabel(bucket))}
              </span>
            ` : ''}

            ${item.already_trusted ? `
              <span
                class="badge workflow-trusted"
                title="A related or matching item is already present in the trusted catalogue."
              >
                Already trusted
              </span>
            ` : ''}
          </div>
        </div>

        <h3>${escapeHtml(item.title || 'Untitled candidate')}</h3>

        <p class="meta">
          ${escapeHtml(item.domain || 'unknown domain')}
          ${item.source_hint ? ` · via ${escapeHtml(item.source_hint)}` : ''}
        </p>

        <p class="snippet">${escapeHtml(item.snippet || 'No snippet available.')}</p>

        <p class="why">
          <strong>Why it surfaced:</strong>
          ${escapeHtml(shortWhy(item))}
        </p>

        ${detailHtml ? `
          <details>
            <summary>More detail</summary>
            <div class="detail-wrap">
              <div class="detail-grid">
                ${detailHtml}
              </div>
            </div>
          </details>
        ` : ''}

        <div class="actions">
          <a
            href="${escapeHtml(item.url)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the candidate page in a new tab."
          >
            Open candidate page
          </a>
          ${suggestButton}
          ${draftLink}
        </div>
      </article>
    `;
  }).join('');
}

async function init() {
  const response = await fetch('./data/discovery-candidates.json', { cache: 'no-store' });
  state.payload = await response.json();

  renderCards();

  [el.search, el.lane, el.workflow].forEach((node) => {
    node.addEventListener('input', renderCards);
    node.addEventListener('change', renderCards);
  });
}

init().catch((error) => {
  console.error(error);
  el.cards.innerHTML = '<div class="empty-state">Review queue failed to load. Check that <code>data/discovery-candidates.json</code> exists.</div>';
});