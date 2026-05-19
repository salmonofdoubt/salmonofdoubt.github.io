const state = {
  items: [],
  archive: [],
};

const els = {
  list: document.getElementById("newsList"),
  summary: document.getElementById("summary"),
  archive: document.getElementById("archiveList"),
  search: document.getElementById("searchInput"),
  theme: document.getElementById("themeFilter"),
  freshness: document.getElementById("freshnessFilter"),
  lastRefresh: document.getElementById("lastRefresh"),
  refreshNote: document.getElementById("refreshNote"),
};

function clean(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim() || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Date unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function visibleItems() {
  const q = clean(els.search.value).toLowerCase();
  const theme = els.theme.value;
  const freshness = els.freshness.value;

  return state.items.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.source_name,
      item.publisher,
      item.theme,
      item.freshness_status,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ].join(" ").toLowerCase();

    const matchesSearch = !q || haystack.includes(q);
    const matchesTheme = theme === "all" || item.theme === theme || (item.tags || []).includes(theme);
    const matchesFreshness = freshness === "all" || item.freshness_status === freshness;

    return matchesSearch && matchesTheme && matchesFreshness;
  });
}

function renderSummary(items) {
  const fresh = items.filter((item) => item.freshness_status === "fresh").length;
  const reference = items.filter((item) => item.freshness_status === "reference").length;

  els.summary.innerHTML = `
    <div class="summary-pill">${items.length} visible items</div>
    <div class="summary-pill">${fresh} fresh/current</div>
    <div class="summary-pill">${reference} reference/background</div>
    <div class="summary-pill">${state.items.length} total in latest radar</div>
  `;
}

function renderItems() {
  const items = visibleItems();
  renderSummary(items);

  if (!items.length) {
    els.list.innerHTML = `<div class="empty">No items match this filter.</div>`;
    return;
  }

  els.list.innerHTML = items.map((item) => {
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 5) : [];
    const freshnessClass = item.freshness_status === "reference" ? "warn" : "";
    return `
      <article class="news-card">
        <div>
          <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
          <div class="news-meta">
            <span class="chip">${escapeHtml(item.source_name || item.publisher || "Source")}</span>
            <span class="chip">${escapeHtml(formatDate(item.published))}</span>
            <span class="chip ${freshnessClass}">${escapeHtml(item.freshness_label || item.freshness_status || "Freshness unknown")}</span>
          </div>
          <p class="news-summary">${escapeHtml(item.summary || "Open the source to inspect this item.")}</p>
          <div class="news-tags">
            ${tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <aside class="news-side">
          <div class="score-box">
            <span>Usefulness</span>
            <strong>${escapeHtml(Math.round(Number(item.score || 0)))}</strong>
          </div>
          <a class="open-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open source</a>
        </aside>
      </article>
    `;
  }).join("");
}

function renderArchive() {
  if (!state.archive.length) {
    els.archive.innerHTML = `<div class="empty">No archive snapshots yet. The first daily refresh will create one.</div>`;
    return;
  }

  els.archive.innerHTML = state.archive.map((entry) => `
    <article class="archive-item">
      <div>
        <strong>${escapeHtml(entry.date || "Unknown date")}</strong>
        <p>${escapeHtml(entry.count || 0)} items · generated ${escapeHtml(formatDate(entry.generated_at))}</p>
      </div>
      <a class="archive-link" href="${escapeHtml(entry.path)}" target="_blank" rel="noopener">Open JSON</a>
    </article>
  `).join("");
}

async function loadLatest() {
  els.list.innerHTML = `<div class="empty">Loading UrbanForest news...</div>`;

  try {
    const response = await fetch(`data/news.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.items = Array.isArray(data.items) ? data.items : [];
    els.lastRefresh.textContent = data.generated_at ? formatDate(data.generated_at) : "Not yet generated";
    els.refreshNote.textContent = data.note || "Source-led daily discovery.";

    renderItems();
  } catch (error) {
    console.warn(error);
    els.lastRefresh.textContent = "No refresh yet";
    els.list.innerHTML = `<div class="empty">Could not load data/news.json. The workflow may not have run yet.</div>`;
  }
}

async function loadArchive() {
  try {
    const response = await fetch(`data/archive/index.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.archive = Array.isArray(data.snapshots) ? data.snapshots : [];
    renderArchive();
  } catch (error) {
    console.warn(error);
    state.archive = [];
    renderArchive();
  }
}

els.search.addEventListener("input", renderItems);
els.theme.addEventListener("change", renderItems);
els.freshness.addEventListener("change", renderItems);

loadLatest();
loadArchive();
