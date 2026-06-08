const state = {
  registry: null,
  items: [],
  jobs: [],
  filters: {
    search: "",
    monitor: "",
    status: "",
    confidence: ""
  }
};

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const niceDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

async function loadJson(path, fallback) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return fallback;
  return response.json();
}

function renderStatus() {
  const target = $("[data-status-strip]");
  if (!target) return;

  const publicJobs = state.jobs.filter((job) => job.public !== false);
  if (!publicJobs.length) {
    target.innerHTML = `<p class="muted">No job status data available yet.</p>`;
    return;
  }

  target.innerHTML = publicJobs.map((job) => `
    <article class="status-card">
      <strong>${escapeHtml(job.name)}</strong>
      <div class="pill-row">
        <span class="pill" data-state="${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
        <span class="pill">${escapeHtml(job.frequency)}</span>
      </div>
      <p class="muted">Updated: ${escapeHtml(niceDate(job.last_success_at))}</p>
    </article>
  `).join("");
}

function populateFilters() {
  const monitorSelect = $("[data-monitor-filter]");
  const statusSelect = $("[data-status-filter]");
  const confidenceSelect = $("[data-confidence-filter]");

  const monitors = [...new Set(state.items.map((item) => item.monitor).filter(Boolean))].sort();
  const statuses = [...new Set(state.items.map((item) => item.status).filter(Boolean))].sort();
  const confidence = [...new Set(state.items.map((item) => item.confidence).filter(Boolean))].sort();

  monitorSelect.innerHTML = `<option value="">All monitors</option>` + monitors.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
  statusSelect.innerHTML = `<option value="">All statuses</option>` + statuses.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
  confidenceSelect.innerHTML = `<option value="">All confidence levels</option>` + confidence.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
}

function passesFilters(item) {
  const text = [
    item.title,
    item.summary,
    item.monitor,
    item.lane,
    item.location,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].join(" ").toLowerCase();

  if (state.filters.search && !text.includes(state.filters.search.toLowerCase())) return false;
  if (state.filters.monitor && item.monitor !== state.filters.monitor) return false;
  if (state.filters.status && item.status !== state.filters.status) return false;
  if (state.filters.confidence && item.confidence !== state.filters.confidence) return false;
  return true;
}

function renderItems() {
  const target = $("[data-items]");
  if (!target) return;

  const items = state.items.filter(passesFilters);

  if (!items.length) {
    target.innerHTML = `<p class="muted">No monitor items match the current filters.</p>`;
    return;
  }

  target.innerHTML = items.map((item) => {
    const source = item.source_url
      ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_name || "Source")}</a>`
      : `<span>${escapeHtml(item.source_name || "No source link")}</span>`;

    return `
      <article class="item-card">
        <div class="pill-row">
          <span class="pill">${escapeHtml(item.monitor)}</span>
          <span class="pill">${escapeHtml(item.lane)}</span>
          <span class="pill" data-confidence="${escapeHtml(item.confidence)}">${escapeHtml(item.confidence)}</span>
        </div>

        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || "No summary supplied.")}</p>
        </div>

        ${item.counting_rule ? `<p><strong>Counting rule:</strong> ${escapeHtml(item.counting_rule)}</p>` : ""}
        ${item.caveat ? `<p><strong>Caveat:</strong> ${escapeHtml(item.caveat)}</p>` : ""}

        <div class="item-card__footer">
          <span class="pill">${escapeHtml(item.status)}</span>
          <span class="pill">${escapeHtml(item.importance)} importance</span>
          ${source}
        </div>
      </article>
    `;
  }).join("");
}

function bindFilters() {
  $("[data-search]").addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    renderItems();
  });

  $("[data-monitor-filter]").addEventListener("change", (event) => {
    state.filters.monitor = event.target.value;
    renderItems();
  });

  $("[data-status-filter]").addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderItems();
  });

  $("[data-confidence-filter]").addEventListener("change", (event) => {
    state.filters.confidence = event.target.value;
    renderItems();
  });
}

async function init() {
  const [registry, items, status] = await Promise.all([
    loadJson("../data/monitor-registry.json", {}),
    loadJson("../data/monitor-items.json", { items: [] }),
    loadJson("../data/job-status.json", { jobs: [] })
  ]);

  state.registry = registry;
  state.items = Array.isArray(items.items) ? items.items : [];
  state.jobs = Array.isArray(status.jobs) ? status.jobs : [];

  const generated = $("[data-generated-at]");
  if (generated) {
    generated.textContent = `Status generated: ${niceDate(status.generated_at)}`;
  }

  renderStatus();
  populateFilters();
  bindFilters();
  renderItems();
}

init().catch((error) => {
  console.error(error);
  const target = $("[data-items]");
  if (target) target.innerHTML = `<p class="muted">Monitor data could not be loaded.</p>`;
});
