const state = {
  items: [],
  archive: [],
  sections: [
    { id: "ireland-urban-forest-practice", title: "Ireland Urban Forest Practice", intro: "Irish delivery, schools, campuses, communities, local authorities, and practical implementation signals." },
    { id: "urban-nbs-implementation", title: "Urban NbS Implementation", intro: "SuDS, rain gardens, bioswales, shade, depaving, soil restoration, and urban nature-based solution delivery." },
    { id: "funding-opportunities", title: "Funding and Opportunities", intro: "Grants, schemes, calls, and support routes for planting, monitoring, maintenance, and education." },
    { id: "research-evidence", title: "Practical Research and Evidence", intro: "Evidence for biodiversity, wellbeing, shade, survival, maintenance, monitoring, soil, and governance." },
    { id: "design-maintenance-risk", title: "Design, Maintenance and Risk", intro: "Tree survival, watering, soil care, vandalism, public acceptance, carbon claims, and stewardship risk." }
  ]
};

const els = {
  list: document.getElementById("newsList"),
  summary: document.getElementById("summary"),
  archive: document.getElementById("archiveList"),
  search: document.getElementById("searchInput"),
  theme: document.getElementById("themeFilter"),
  freshness: document.getElementById("freshnessFilter"),
  date: document.getElementById("dateFilter"),
  lastRefresh: document.getElementById("lastRefresh"),
  refreshNote: document.getElementById("refreshNote"),
  shortlist: document.getElementById("practicalShortlist"),
  digest: document.getElementById("weeklyDigest"),
  health: document.getElementById("sourceHealthMini")
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


function normaliseSection(value) {
  const aliases = {
    "ireland-practice": "ireland-urban-forest-practice",
    "temperate-practice": "urban-nbs-implementation",
    "research-evidence": "research-evidence",
    "funding-policy": "funding-opportunities",
    "maintenance": "design-maintenance-risk"
  };

  return aliases[value] || value || "ireland-urban-forest-practice";
}

function itemSection(item) {
  return normaliseSection(item.section || item.section_id || "ireland-urban-forest-practice");
}

function itemText(item) {
  return [
    item.title,
    item.summary,
    item.source_name,
    item.publisher,
    item.theme,
    item.section,
    item.freshness_status,
    item.urbanforest_relevance,
    item.research_use_type,
    item.transfer_relevance,
    item.local_relevance?.label,
    item.opportunity_fit?.fit,
    item.opportunity_fit?.eligible_hint,
    item.opportunity_fit?.action_needed,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.benefit_categories) ? item.benefit_categories : []),
    ...(Array.isArray(item.local_relevance?.matched_terms) ? item.local_relevance.matched_terms : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function themeAliases(value) {
  const aliases = {
    "dublin-ireland-local": ["dublin", "trinity", "tcd", "ireland", "irish", "dublin city council", "fingal", "high dublin", "strong ireland"],
    "urban-heat-shade": ["urban heat", "heat island", "shade", "cooling", "tree canopy", "Urban heat / shade"],
    "biodiversity-habitat": ["biodiversity", "habitat", "pollinator", "native", "Biodiversity / habitat"],
    "soil-health": ["soil", "soil restoration", "compaction", "mulch", "Soil health"],
    "stormwater-suds": ["stormwater", "rain garden", "bioswale", "suds", "Stormwater / SuDS"],
    "wellbeing": ["wellbeing", "mental health", "health", "Wellbeing / health"],
    "school-education": ["school", "education", "campus", "School / education"],
    "community-stewardship": ["community", "volunteer", "stewardship", "Community stewardship"],
    "tree-survival-maintenance": ["maintenance", "survival", "watering", "aftercare", "Tree survival / maintenance"],
    "funding-grants": ["grant", "funding", "scheme", "Funding / grants"],
    "monitoring-evaluation": ["monitoring", "evaluation", "indicator", "Monitoring / evaluation"],
    "carbon-claims": ["carbon", "offset", "greenwashing", "Carbon / climate claims"]
  };
  return aliases[value] || [value];
}

function itemMatchesTheme(item, selectedTheme) {
  if (selectedTheme === "all") return true;
  if (item.theme === selectedTheme || itemSection(item) === selectedTheme) return true;
  if (Array.isArray(item.tags) && item.tags.includes(selectedTheme)) return true;
  if (Array.isArray(item.benefit_categories) && item.benefit_categories.includes(selectedTheme)) return true;
  const haystack = itemText(item);
  return themeAliases(selectedTheme).some(alias => haystack.includes(String(alias).toLowerCase()));
}

function itemDateInRange(item, range) {
  if (range === "all") return true;
  if (range === "recentPlusResearch") {
    if (itemSection(item) === "research-evidence") return true;
    range = "12m";
  }
  if (!item.published) return false;
  const published = new Date(item.published);
  if (Number.isNaN(published.getTime())) return false;
  const ageDays = (Date.now() - published.getTime()) / (24 * 60 * 60 * 1000);
  if (range === "12m") return ageDays <= 366;
  return true;
}

function visibleItems() {
  const q = clean(els.search.value).toLowerCase();
  const theme = els.theme.value;
  const freshness = els.freshness.value;
  const dateRange = els.date?.value || "recentPlusResearch";

  return state.items.filter((item) => {
    const haystack = itemText(item);
    const matchesSearch = !q || haystack.includes(q);
    const matchesTheme = itemMatchesTheme(item, theme);
    const matchesFreshness = freshness === "all" || item.freshness_status === freshness;
    const matchesDate = itemDateInRange(item, dateRange);
    return matchesSearch && matchesTheme && matchesFreshness && matchesDate;
  });
}

function practicalSortScore(item) {
  let score = Number(item.score || 0);
  if (item.urbanforest_relevance) score += 10;
  if (item.opportunity_fit?.fit === "High") score += 14;
  if (item.local_relevance?.score >= 50) score += 14;
  else if (item.local_relevance?.score >= 24) score += 8;
  if (item.freshness_status === "fresh") score += 6;
  for (const b of item.benefit_categories || []) {
    if (["Tree survival / maintenance", "Funding / grants", "Stormwater / SuDS", "Urban heat / shade"].includes(b)) score += 7;
    else score += 3;
  }
  return score;
}

function renderPracticalShortlist(items) {
  if (!els.shortlist) return;
  const shortlist = [...items].sort((a, b) => practicalSortScore(b) - practicalSortScore(a)).slice(0, 5);
  if (!shortlist.length) {
    els.shortlist.innerHTML = "";
    return;
  }
  els.shortlist.innerHTML = `
    <section class="shortlist-card" aria-label="Top practical signals">
      <div class="shortlist-heading">
        <p class="eyebrow">Practical shortlist</p>
        <h3>Top signals for UrbanForest action</h3>
      </div>
      <ol class="shortlist-list">
        ${shortlist.map((item) => `
          <li>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
            <p>${escapeHtml(item.urbanforest_relevance || "Useful signal for UrbanForest review.")}</p>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderSummary(items) {
  const lanes = [
    ["ireland-urban-forest-practice", "Ireland practice"],
    ["urban-nbs-implementation", "Urban NbS"],
    ["funding-opportunities", "Funding"],
    ["research-evidence", "Research"],
    ["design-maintenance-risk", "Design/risk"]
  ].map(([id, label]) => ({
    id, label, count: items.filter(item => itemSection(item) === id).length
  }));

  els.summary.innerHTML = `
    <div class="result-stripe" aria-label="Current lane counts">
      <span class="result-stripe-label">Current lanes:</span>
      ${lanes.map((lane) => `
        <button type="button" class="result-lane-link" data-lane-target="${escapeHtml(lane.id)}" ${lane.count ? "" : "disabled"}>
          <strong>${lane.count}</strong> ${escapeHtml(lane.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCard(item) {
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 6) : [];
  const benefits = Array.isArray(item.benefit_categories) ? item.benefit_categories.slice(0, 6) : [];
  const freshnessClass = item.freshness_status === "reference" ? "warn" : "";
  const local = item.local_relevance;
  const grantFit = item.opportunity_fit;

  return `
    <article class="news-card">
      <div>
        <p class="mini-label">${escapeHtml(itemSection(item).replaceAll("-", " "))}</p>
        <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <div class="news-meta">
          <span class="chip">${escapeHtml(item.source_name || item.publisher || "Source")}</span>
          <span class="chip">${escapeHtml(formatDate(item.published))}</span>
          <span class="chip ${freshnessClass}">${escapeHtml(item.freshness_label || item.freshness_status || "Freshness unknown")}</span>
          ${local?.label ? `<span class="chip">${escapeHtml(local.label)}</span>` : ""}
          ${item.research_use_type ? `<span class="chip">${escapeHtml(item.research_use_type)}</span>` : ""}
        </div>
        <p class="news-summary">${escapeHtml(item.summary || "Open the source to inspect this item.")}</p>
        ${item.urbanforest_relevance ? `
          <div class="action-relevance">
            <strong>UrbanForest relevance:</strong>
            <span>${escapeHtml(item.urbanforest_relevance)}</span>
          </div>
        ` : ""}
        ${grantFit ? `
          <div class="grant-fit">
            <strong>Opportunity fit: ${escapeHtml(grantFit.fit)}</strong>
            <span>${escapeHtml(grantFit.eligible_hint || "")}</span>
            <em>${escapeHtml(grantFit.action_needed || "")}</em>
          </div>
        ` : ""}
        ${benefits.length ? `
          <div class="pressure-row" aria-label="Benefit and delivery categories">
            ${benefits.map((b) => `<span class="pressure-chip">${escapeHtml(b)}</span>`).join("")}
          </div>
        ` : ""}
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
  renderPracticalShortlist(items);
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
    els.archive.innerHTML = `<div class="empty">No archive snapshots yet.</div>`;
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

function sectionLabel(section) {
  const labels = {
    "ireland-urban-forest-practice": "Ireland practice",
    "urban-nbs-implementation": "Urban NbS",
    "funding-opportunities": "Funding",
    "research-evidence": "Research",
    "design-maintenance-risk": "Design/risk"
  };
  return labels[section] || clean(section || "unknown").replaceAll("-", " ");
}

function renderWeeklyDigest(data) {
  if (!els.digest) return;
  const items = Array.isArray(data.items) ? data.items.slice(0, 5) : [];
  if (!items.length) {
    els.digest.innerHTML = `<p class="eyebrow">Weekly digest</p><h2>No digest yet</h2><p>The next refresh will generate a practical digest.</p>`;
    return;
  }
  els.digest.innerHTML = `
    <p class="eyebrow">Weekly digest</p>
    <h2>Top practical signals</h2>
    <ol class="ops-list">
      ${items.map((item) => `
        <li>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
          <span>${escapeHtml(sectionLabel(item.section))} · practical score ${escapeHtml(item.practical_score ?? "n/a")}</span>
        </li>
      `).join("")}
    </ol>
    <a class="open-link" href="data/weekly-digest.json" target="_blank" rel="noopener">Open digest JSON</a>
  `;
}

function renderSourceHealth(data) {
  if (!els.health) return;
  const active = Number(data.sources_active || 0);
  const quiet = Number(data.sources_checked_no_current_items || 0);
  const failed = Number(data.sources_failed || 0);
  const total = Number(data.total_sources || 0);
  els.health.innerHTML = `
    <p class="eyebrow">Source health</p>
    <h2>${active}/${total} active sources</h2>
    <div class="ops-metrics">
      <span><strong>${active}</strong> active</span>
      <span><strong>${quiet}</strong> quiet</span>
      <span class="${failed ? "warn" : ""}"><strong>${failed}</strong> failed</span>
    </div>
    <p>${escapeHtml(data.total_items || 0)} current items · ${escapeHtml(data.archive_snapshots || 0)} archive snapshots.</p>
    <a class="open-link" href="data/source-health.json" target="_blank" rel="noopener">Open source health JSON</a>
  `;
}

async function loadLatest() {
  els.list.innerHTML = `<div class="empty">Loading UrbanForest radar...</div>`;
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

async function loadOpsStatus() {
  try {
    const [digestResponse, healthResponse] = await Promise.all([
      fetch(`data/weekly-digest.json?v=${Date.now()}`),
      fetch(`data/source-health.json?v=${Date.now()}`)
    ]);
    if (digestResponse.ok) renderWeeklyDigest(await digestResponse.json());
    if (healthResponse.ok) renderSourceHealth(await healthResponse.json());
  } catch (error) {
    console.warn(error);
  }
}

function jumpToResultLane(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("lane-focus-pulse");
  window.setTimeout(() => target.classList.remove("lane-focus-pulse"), 900);
}

els.summary.addEventListener("click", (event) => {
  const button = event.target.closest(".result-lane-link");
  if (!button || button.disabled) return;
  jumpToResultLane(button.dataset.laneTarget);
});

els.search.addEventListener("input", renderItems);
els.theme.addEventListener("change", renderItems);
els.freshness.addEventListener("change", renderItems);
els.date?.addEventListener("change", renderItems);

if (els.date && !els.date.value) els.date.value = "recentPlusResearch";

loadLatest();
loadArchive();
loadOpsStatus();
