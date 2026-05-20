const state = {
  items: [],
  archive: [],
  sections: [
    {
      id: "ireland-catchment-practice",
      title: "Ireland Catchment Practice",
      intro: "Irish river, lake, estuary, lagoon, water-quality, restoration, monitoring, citizen-science, and community-action signals."
    },
    {
      id: "waterbody-evidence-alerts",
      title: "Waterbody Evidence and Alerts",
      intro: "Evidence, incidents, monitoring signals, research, and practice for rivers, lakes, estuaries, lagoons, wetlands, and connected waters."
    },
    {
      id: "grants-opportunities",
      title: "Grants and Opportunities",
      intro: "Funding calls and support routes relevant to river trusts, catchment groups, citizen science, biodiversity, wetlands, and community water action."
    },
    {
      id: "research-papers",
      title: "Practical Research Papers and Reviews",
      intro: "Scholarly evidence ranked for practical Nanny-Delvin usefulness: Ireland first, comparable temperate systems second, and transferable NbS / water-quality evidence where it helps action."
    }
  ]
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

function itemSection(item) {
  return item.section || item.section_id || "ireland-catchment-practice";
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
      item.section,
      item.freshness_status,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ].join(" ").toLowerCase();

    const matchesSearch = !q || haystack.includes(q);
    const matchesTheme = theme === "all" || item.theme === theme || (item.tags || []).includes(theme) || itemSection(item) === theme;
    const matchesFreshness = freshness === "all" || item.freshness_status === freshness;

    return matchesSearch && matchesTheme && matchesFreshness;
  });
}

function renderSummary(items) {
  const fresh = items.filter((item) => item.freshness_status === "fresh").length;
  const reference = items.filter((item) => item.freshness_status === "reference").length;
  const ireland = items.filter((item) => itemSection(item) === "ireland-catchment-practice").length;
  const evidence = items.filter((item) => itemSection(item) === "waterbody-evidence-alerts").length;
  const grants = items.filter((item) => itemSection(item) === "grants-opportunities").length;
  const research = items.filter((item) => itemSection(item) === "research-papers").length;

  els.summary.innerHTML = `
    <button type="button" class="summary-pill summary-button" data-filter-kind="reset">${items.length} visible items</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="freshness" data-filter-value="fresh">${fresh} fresh/current</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="freshness" data-filter-value="reference">${reference} reference/background</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="theme" data-filter-value="ireland-catchment-practice">${ireland} Irish practice</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="theme" data-filter-value="waterbody-evidence-alerts">${evidence} evidence/alerts</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="theme" data-filter-value="grants-opportunities">${grants} grants</button>
    <button type="button" class="summary-pill summary-button" data-filter-kind="theme" data-filter-value="research-papers">${research} research papers</button>
  `;
}

function renderCard(item) {
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 6) : [];
  const freshnessClass = item.freshness_status === "reference" ? "warn" : "";
  const lane = itemSection(item).replaceAll("-", " ");

  return `
    <article class="news-card">
      <div>
        <p class="mini-label">${escapeHtml(lane)}</p>
        <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <div class="news-meta">
          <span class="chip">${escapeHtml(item.source_name || item.publisher || "Source")}</span>
          <span class="chip">${escapeHtml(formatDate(item.published))}</span>
          <span class="chip ${freshnessClass}">${escapeHtml(item.freshness_label || item.freshness_status || "Freshness unknown")}</span>
          ${item.practical_fit ? `<span class="chip">${escapeHtml(item.practical_fit)}</span>` : ""}
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
}

function renderItems() {
  const items = visibleItems();
  renderSummary(items);

  if (!items.length) {
    els.list.innerHTML = `<div class="empty">No items match this filter.</div>`;
    return;
  }

  els.list.innerHTML = state.sections.map((section) => {
    const sectionItems = items.filter((item) => itemSection(item) === section.id);

    return `
      <section class="news-section-group" id="${escapeHtml(section.id)}">
        <div class="news-section-heading">
          <div>
            <p class="eyebrow">${escapeHtml(section.id.replaceAll("-", " "))}</p>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.description || section.intro)}</p>
          </div>
          <span class="section-count">${sectionItems.length} item${sectionItems.length === 1 ? "" : "s"}</span>
        </div>
        ${sectionItems.length ? sectionItems.map(renderCard).join("") : `<div class="empty">No matching items in this lane yet.</div>`}
      </section>
    `;
  }).join("");
}

function renderArchive() {
  if (!state.archive.length) {
    els.archive.innerHTML = `<div class="empty">No archive snapshots yet. The first refresh will create one.</div>`;
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
  els.list.innerHTML = `<div class="empty">Loading Nanny-Delvin Water Radar...</div>`;

  try {
    const response = await fetch(`data/news.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.items = Array.isArray(data.items) ? data.items : [];
    if (Array.isArray(data.sections) && data.sections.length) state.sections = data.sections;

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


function applySummaryFilter(button) {
  const kind = button.dataset.filterKind;
  const value = button.dataset.filterValue || "all";

  if (kind === "reset") {
    els.search.value = "";
    els.theme.value = "all";
    els.freshness.value = "all";
    renderItems();
    return;
  }

  if (kind === "theme") {
    els.theme.value = value;
    renderItems();
    document.getElementById("latest")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (kind === "freshness") {
    els.freshness.value = value;
    renderItems();
    document.getElementById("latest")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

els.summary.addEventListener("click", (event) => {
  const button = event.target.closest(".summary-button");
  if (!button) return;
  applySummaryFilter(button);
});
