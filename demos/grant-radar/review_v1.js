const ISSUE_REPO_BASE = 'https://github.com/salmonofdoubt/salmonofdoubt.github.io';
const state = { payload: null };

const el = {
  summaryGrid: document.getElementById('summary-grid'),
  cards: document.getElementById('cards'),
  search: document.getElementById('search'),
  status: document.getElementById('status'),
  confidence: document.getElementById('confidence'),
  seen: document.getElementById('seen'),
  requested: document.getElementById('requested'),
  trusted: document.getElementById('trusted'),
  dedupe: document.getElementById('dedupe'),
};

function scoreClass(score) {
  if (score >= 0.8) return 'score-high';
  if (score >= 0.6) return 'score-mid';
  return 'score-low';
}

function statusClass(status) {
  if (status === 'approved') return 'pill-approved';
  if (status === 'cl_drafted') return 'pill-cl-drafted';
  if (status === 'rejected') return 'pill-rejected';
  if (status === 'promoted') return 'pill-promoted';
  return 'pill-pending';
}

function summaryBox(label, value) {
  return `
    <div class="summary-box">
      <div class="summary-label">${label}</div>
      <div class="summary-value">${value}</div>
    </div>
  `;
}

function canonicalFamilyKeyFromUrl(url) {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname.replace(/_[a-z]{2}$/i, '');
    path = path.replace(/\/+$/g, '') || '/';
    return `${parsed.hostname.replace(/^www\./i, '')}${path}`;
  } catch (error) {
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

function chooseBetterItem(existing, candidate) {
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

  const existingAlreadyTrusted = !!existing.already_trusted;
  const candidateAlreadyTrusted = !!candidate.already_trusted;
  if (candidateAlreadyTrusted && !existingAlreadyTrusted) return candidate;
  if (existingAlreadyTrusted && !candidateAlreadyTrusted) return existing;

  const existingConfidence = Number(existing.confidence || 0);
  const candidateConfidence = Number(candidate.confidence || 0);
  if (candidateConfidence > existingConfidence) return candidate;
  if (existingConfidence > candidateConfidence) return existing;

  const existingSourcePage = existing.discovered_via === 'source_page';
  const candidateSourcePage = candidate.discovered_via === 'source_page';
  if (candidateSourcePage && !existingSourcePage) return candidate;
  if (existingSourcePage && !candidateSourcePage) return existing;

  return existing;
}

function getVisibleCandidates(rawCandidates) {
  if (!el.dedupe || el.dedupe.value === 'raw') {
    return rawCandidates;
  }

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

function renderSummary(rawCandidates, visibleCandidates) {
  el.summaryGrid.innerHTML = [
    summaryBox('Raw candidates', rawCandidates.length),
    summaryBox('Visible candidates', visibleCandidates.length),
    summaryBox('High confidence', visibleCandidates.filter((item) => Number(item.confidence || 0) >= 0.8).length),
    summaryBox('Requests open', visibleCandidates.filter((item) => item.promotion_requested).length),
    summaryBox('Drafts ready', visibleCandidates.filter((item) => item.cl_draft_ready).length),
    summaryBox('Already trusted', visibleCandidates.filter((item) => item.already_trusted).length),
  ].join('');
}

function filteredCandidates() {
  const search = el.search.value.trim().toLowerCase();
  const status = el.status.value;
  const minConfidence = Number(el.confidence.value);
  const seen = el.seen.value;
  const requested = el.requested.value;
  const trusted = el.trusted.value;

  return (state.payload.candidates || []).filter((item) => {
    const haystack = [
      item.title,
      item.domain,
      item.source_hint,
      item.canonical_family_key,
      ...(item.suggested_purposes || []),
      ...(item.suggested_applicant_types || []),
      ...(item.reason_flags || []),
    ].join(' ').toLowerCase();

    if (search && !haystack.includes(search)) return false;

    if (status === 'all') {
      if (item.status === 'promoted' || item.status === 'rejected') return false;
    } else if (item.status !== status) {
      return false;
    }

    if (trusted === 'hide' && item.already_trusted) return false;
    if (trusted === 'only' && !item.already_trusted) return false;

    if (Number(item.confidence || 0) < minConfidence) return false;
    if (seen === 'yes' && !item.seen_in_latest_run) return false;
    if (seen === 'no' && item.seen_in_latest_run) return false;
    if (requested === 'yes' && !item.promotion_requested) return false;
    if (requested === 'no' && item.promotion_requested) return false;
    return true;
  });
}

function buildIssueUrl(item) {
  const title = `[Grant Radar] Promote candidate ${item.id}`;
  const body = [
    '## Candidate',
    `candidate_id: ${item.id}`,
    `candidate_url: ${item.url}`,
    `candidate_title: ${item.title || ''}`,
    '',
    '## Decision',
    '- [ ] Accept promotion into trusted catalogue',
    '- [ ] Reject suggestion',
    '',
    '## Notes',
    'Created from the Grant Radar review page.',
  ].join('\n');

  return `${ISSUE_REPO_BASE}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function renderCards() {
  const rawCandidates = filteredCandidates();
  const candidates = getVisibleCandidates(rawCandidates);

  renderSummary(rawCandidates, candidates);

  if (candidates.length === 0) {
    el.cards.innerHTML = '<div class="empty-state">No candidates match the current review filters.</div>';
    return;
  }

  el.cards.innerHTML = candidates.map((item) => `
    <article class="candidate-card">
      <div class="top-row">
        <div class="tag-row">
          <span class="pill ${statusClass(item.status)}">${(item.status || 'pending_review').replaceAll('_', ' ')}</span>
          <span class="pill ${scoreClass(Number(item.confidence || 0))}">confidence ${Number(item.confidence || 0).toFixed(2)}</span>
          ${item.promotion_requested ? '<span class="pill pill-requested">request open</span>' : ''}
          ${item.already_trusted ? `<span class="pill pill-already">already trusted${item.trusted_registry_id ? `: ${item.trusted_registry_id}` : ''}</span>` : ''}
        </div>
        <div class="small">${item.seen_in_latest_run ? 'Seen in latest run' : 'Older candidate'}</div>
      </div>

      <h3>${item.title || 'Untitled candidate'}</h3>
      <p class="small">${item.domain} · via ${item.discovered_via} · source hint: ${item.source_hint || '—'}</p>
      <p>${item.snippet || 'No snippet available.'}</p>

      <div class="tag-row">
        ${(item.suggested_purposes || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>

      <div class="tag-row" style="margin-top: 0.55rem;">
        ${(item.suggested_applicant_types || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>

      <p class="small" style="margin-top: 0.8rem;"><strong>Reason flags:</strong> ${(item.reason_flags || []).join(', ') || '—'}</p>
      <p class="small"><strong>Deadline hint:</strong> ${item.deadline_hint || '—'}</p>
      <p class="small"><strong>First seen:</strong> ${item.first_seen || '—'}<br><strong>Last seen:</strong> ${item.last_seen || '—'}</p>
      <p class="small"><strong>Family key:</strong> ${item.canonical_family_key || fallbackReviewKey(item)}</p>

      ${item.promotion_requested ? `
        <div class="request-note">
          <strong>Suggestion logged.</strong><br>
          Manage the accept/reject decision in the linked GitHub request issue.
        </div>
      ` : `
        <div class="request-row" style="margin-top: 0.85rem;">
          <label class="suggest-toggle">
            <input type="checkbox" class="suggest-checkbox" data-candidate-id="${item.id}" />
            Suggest for promotion
          </label>
          <button type="button" class="request-btn" data-candidate-id="${item.id}" ${item.already_trusted ? 'disabled' : 'disabled'}>Open request issue</button>
        </div>
      `}

      ${item.cl_draft_ready ? `
        <div class="draft-note">
          <strong>Draft ready.</strong><br>
          Draft path is stable and reused for this candidate, so the site does not keep growing.
        </div>
      ` : ''}

      <div class="actions">
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">Open candidate page</a>
        ${item.promotion_request_issue_url ? `<a href="${item.promotion_request_issue_url}" target="_blank" rel="noopener noreferrer">Open request issue</a>` : ''}
        ${item.cl_draft_html ? `<a href="./${item.cl_draft_html}" target="_blank" rel="noopener noreferrer">Open draft</a>` : ''}
        ${item.cl_draft_json ? `<a href="./${item.cl_draft_json}" target="_blank" rel="noopener noreferrer">Open draft JSON</a>` : ''}
      </div>
    </article>
  `).join('');

  el.cards.querySelectorAll('.suggest-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const card = event.target.closest('.candidate-card');
      const button = card.querySelector('.request-btn');
      if (button) button.disabled = !event.target.checked;
    });
  });

  el.cards.querySelectorAll('.request-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.candidateId;
      const item = candidates.find((candidate) => candidate.id === id);
      if (!item || item.already_trusted) return;
      window.open(buildIssueUrl(item), '_blank', 'noopener');
    });
  });
}

async function init() {
  const response = await fetch('./data/discovery-candidates.json', { cache: 'no-store' });
  state.payload = await response.json();

  renderCards();

  [el.search, el.status, el.confidence, el.seen, el.requested, el.trusted, el.dedupe]
    .filter(Boolean)
    .forEach((node) => {
      node.addEventListener('input', renderCards);
      node.addEventListener('change', renderCards);
    });
}

init().catch((error) => {
  console.error(error);
  el.cards.innerHTML = '<div class="empty-state">Review queue failed to load. Check that <code>data/discovery-candidates.json</code> exists.</div>';
});
