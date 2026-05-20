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
  shortlist: document.getElementById("practicalShortlist"),
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

function itemFilterTerms(item) {
  return [
    item.title,
    item.summary,
    item.source_name,
    item.publisher,
    item.theme,
    item.section,
    item.freshness_status,
    item.action_relevance,
    item.practical_fit,
    item.research_use_type,
    item.local_relevance?.label,
    item.opportunity_fit?.fit,
    item.opportunity_fit?.eligible_hint,
    item.opportunity_fit?.action_needed,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.pressure_categories) ? item.pressure_categories : []),
    ...(Array.isArray(item.local_relevance?.matched_terms) ? item.local_relevance.matched_terms : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function themeAliases(value) {
  const aliases = {
    "invasive-species": [
      "invasive-species",
      "invasive species",
      "invasive plant",
      "invasive aquatic",
      "spartina",
      "cordgrass",
      "japanese knotweed",
      "himalayan balsam",
      "zebra mussel"
    ],
    "birds-wetlands": [
      "birds-wetlands",
      "birds / wetland ecology",
      "waterbirds",
      "wetland birds",
      "estuary birds",
      "waders",
      "shorebirds",
      "wintering birds",
      "birdwatch"
    ],
    "river-ecology": [
      "river-ecology",
      "river ecology",
      "freshwater ecology",
      "aquatic ecology",
      "macroinvertebrates",
      "fish passage",
      "habitat restoration",
      "ecological status",
      "q-value"
    ],
    "slurry-manure-timing": [
      "slurry-manure-timing",
      "manure / slurry timing",
      "slurry spreading",
      "manure spreading",
      "organic fertiliser",
      "organic fertilizer",
      "fertiliser spreading",
      "fertilizer spreading",
      "closed period",
      "spreading dates",
      "nitrates",
      "nitrates action programme",
      "nitrates derogation",
      "rainfall",
      "rain forecast",
      "agricultural runoff"
    ],
    "septic-wastewater": [
      "septic-wastewater",
      "septic / domestic wastewater",
      "septic tank",
      "septic tanks",
      "domestic wastewater",
      "on-site wastewater",
      "onsite wastewater",
      "private well",
      "groundwater"
    ],
    "wetland-nbs": [
      "wetland-nbs",
      "NbS / restoration",
      "nature-based",
      "nature based",
      "constructed wetland",
      "riparian buffer",
      "wetland",
      "river restoration"
    ],
    "incident-alert": [
      "incident-alert",
      "incident / alert",
      "fish kill",
      "pollution incident",
      "sewage overflow",
      "algal bloom",
      "bathing water"
    ]
  };

  return aliases[value] || [value];
}

function itemMatchesTheme(item, selectedTheme) {
  if (selectedTheme === "all") return true;

  const directMatches =
    item.theme === selectedTheme ||
    itemSection(item) === selectedTheme ||
    (Array.isArray(item.tags) && item.tags.includes(selectedTheme)) ||
    (Array.isArray(item.pressure_categories) && item.pressure_categories.includes(selectedTheme));

  if (directMatches) return true;

  const terms = itemFilterTerms(item);
  return themeAliases(selectedTheme).some(alias => terms.includes(String(alias).toLowerCase()));
}

function visibleItems() {
  const q = clean(els.search.value).toLowerCase();
  const theme = els.theme.value;
  const freshness = els.freshness.value;

  return state.items.filter((item) => {
    const haystack = itemFilterTerms(item);

    const matchesSearch = !q || haystack.includes(q);
    const matchesTheme = itemMatchesTheme(item, theme);
    const matchesFreshness = freshness === "all" || item.freshness_status === freshness;

    return matchesSearch && matchesTheme && matchesFreshness;
  });
}

function practicalSortScore(item) {
  let score = Number(item.score || 0);

  if (item.action_relevance) score += 8;
  if (item.opportunity_fit?.fit === "High") score += 12;
  if (item.local_relevance?.score >= 45) score += 12;
  if (item.local_relevance?.score >= 20) score += 6;
  if (item.freshness_status === "fresh") score += 8;
  if ((item.pressure_categories || []).includes("septic / domestic wastewater")) score += 8;
  if ((item.pressure_categories || []).includes("incident / alert")) score += 7;

  return score;
}

function renderPracticalShortlist(items) {
  if (!els.shortlist) return;

  const shortlist = [...items]
    .sort((a, b) => practicalSortScore(b) - practicalSortScore(a))
    .slice(0, 5);

  if (!shortlist.length) {
    els.shortlist.innerHTML = "";
    return;
  }

  els.shortlist.innerHTML = `
    <section class="shortlist-card" aria-label="Top practical signals">
      <div class="shortlist-heading">
        <p class="eyebrow">Today’s practical shortlist</p>
        <h3>Top signals for Trust action</h3>
      </div>
      <ol class="shortlist-list">
        ${shortlist.map((item) => `
          <li>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
            <p>${escapeHtml(item.action_relevance || "Useful signal for Trust review.")}</p>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}


function renderSummary(items) {
  const lanes = [
    {
      id: "ireland-catchment-practice",
      label: "Irish practice",
      count: items.filter((item) => itemSection(item) === "ireland-catchment-practice").length
    },
    {
      id: "waterbody-evidence-alerts",
      label: "Evidence/alerts",
      count: items.filter((item) => itemSection(item) === "waterbody-evidence-alerts").length
    },
    {
      id: "grants-opportunities",
      label: "Grants",
      count: items.filter((item) => itemSection(item) === "grants-opportunities").length
    },
    {
      id: "research-papers",
      label: "Research",
      count: items.filter((item) => itemSection(item) === "research-papers").length
    }
  ];

  els.summary.innerHTML = `
    <div class="result-stripe" aria-label="Current lane counts">
      <span class="result-stripe-label">Current lanes:</span>
      ${lanes.map((lane) => `
        <button
          type="button"
          class="result-lane-link"
          data-lane-target="${escapeHtml(lane.id)}"
          ${lane.count ? "" : "disabled"}
          aria-label="Jump to ${escapeHtml(lane.label)} lane"
        >
          <strong>${lane.count}</strong> ${escapeHtml(lane.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCard(item) {
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 6) : [];
  const pressures = Array.isArray(item.pressure_categories) ? item.pressure_categories.slice(0, 5) : [];
  const freshnessClass = item.freshness_status === "reference" ? "warn" : "";
  const lane = itemSection(item).replaceAll("-", " ");
  const local = item.local_relevance;
  const grantFit = item.opportunity_fit;
  const researchUse = item.research_use_type;

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
          ${local?.label ? `<span class="chip">${escapeHtml(local.label)}</span>` : ""}
          ${researchUse ? `<span class="chip">${escapeHtml(researchUse)}</span>` : ""}
        </div>

        <p class="news-summary">${escapeHtml(item.summary || "Open the source to inspect this item.")}</p>

        ${item.action_relevance ? `
          <div class="action-relevance">
            <strong>Trust relevance:</strong>
            <span>${escapeHtml(item.action_relevance)}</span>
          </div>
        ` : ""}

        ${grantFit ? `
          <div class="grant-fit">
            <strong>Opportunity fit: ${escapeHtml(grantFit.fit)}</strong>
            <span>${escapeHtml(grantFit.eligible_hint || "")}</span>
            <em>${escapeHtml(grantFit.action_needed || "")}</em>
          </div>
        ` : ""}

        ${pressures.length ? `
          <div class="pressure-row" aria-label="Pressure categories">
            ${pressures.map((pressure) => `<span class="pressure-chip">${escapeHtml(pressure)}</span>`).join("")}
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

loadLatest();
loadArchive();


