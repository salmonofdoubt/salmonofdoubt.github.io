(() => {
  const state = {
    items: [],
    search: "",
    bucket: "decision",
    relevance: "",
    type: ""
  };

  const $ = (selector) => document.querySelector(selector);
  const number = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.json();
  }

  function valueOrBlank(value) {
    return value === null || value === undefined || value === "" ? "" : value;
  }

  function formatMw(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `${number.format(n)} MW` : "TBC";
  }

  function formatGwh(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `${number.format(n)} GWh` : "TBC";
  }

  function formatHours(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `${number.format(n)} h` : "TBC";
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function renderSummary(payload) {
    const summary = payload.summary || {};
    const hidden = (summary.background || 0) + (summary.reject_noise || 0);

    setText("[data-summary-total]", number.format(summary.total || state.items.length));
    setText("[data-summary-promising]", number.format(summary.promising || 0));
    setText("[data-summary-watch]", number.format(summary.watch || 0));
    setText("[data-summary-hidden]", number.format(hidden));
  }

  function populateFilters() {
    const relevanceSelect = $("[data-relevance-filter]");
    const typeSelect = $("[data-type-filter]");

    const relevances = [...new Set(state.items.map((item) => item.relevance).filter(Boolean))].sort();
    const types = [...new Set(state.items.map((item) => item.asset_type).filter(Boolean))].sort();

    relevanceSelect.innerHTML = '<option value="">All relevance</option>' +
      relevances.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

    typeSelect.innerHTML = '<option value="">All types</option>' +
      types.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function itemText(item) {
    return [
      item.name,
      item.status,
      item.asset_type,
      item.location,
      item.developer,
      item.technology,
      item.source,
      ...(item.reasons || [])
    ].join(" ").toLowerCase();
  }

  function bucketMatch(item) {
    if (state.bucket === "all") return true;
    if (state.bucket === "decision") return item.bucket === "Promising" || item.bucket === "Watch";
    return item.bucket === state.bucket;
  }

  function matches(item) {
    if (!bucketMatch(item)) return false;
    if (state.relevance && item.relevance !== state.relevance) return false;
    if (state.type && item.asset_type !== state.type) return false;
    if (state.search && !itemText(item).includes(state.search.toLowerCase())) return false;
    return true;
  }

  function fact(label, value) {
    return `
      <div>
        <span class="storage-card__label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderCard(item) {
    const reasons = (item.reasons || [])
      .map((reason) => `<li>${escapeHtml(reason)}</li>`)
      .join("");

    const sourceLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source || "Source")}</a>`
      : "";

    return `
      <article class="storage-card">
        <div class="storage-card__topline">
          <span class="storage-pill" data-bucket="${escapeHtml(item.bucket)}">${escapeHtml(item.bucket)}</span>
          <span class="storage-pill">Score ${escapeHtml(item.score)}</span>
          <span class="storage-pill">${escapeHtml(item.relevance || "unclear")}</span>
          <span class="storage-pill">${escapeHtml(item.asset_type || "storage/flexibility")}</span>
        </div>

        <div>
          <h2>${escapeHtml(item.rank)}. ${escapeHtml(item.name || "Untitled storage item")}</h2>
          <p>${escapeHtml(item.technology || "No summary supplied.")}</p>
        </div>

        <div class="storage-card__facts">
          ${fact("Capacity", formatMw(item.capacity_mw))}
          ${fact("Duration", formatHours(item.duration_hours))}
          ${fact("Energy", formatGwh(item.energy_gwh))}
          ${fact("Status", valueOrBlank(item.status) || "Watch")}
        </div>

        <p><strong>Location:</strong> ${escapeHtml(item.location || "Not specified")}</p>
        <p><strong>Developer:</strong> ${escapeHtml(item.developer || "Not specified")}</p>

        <p class="storage-card__warning">
          <strong>Counting rule:</strong>
          ${escapeHtml(item.counting_rule || "Track separately from connected renewable generation.")}
        </p>

        ${reasons ? `<div class="storage-card__reasoning"><strong>Why ranked here</strong><ul>${reasons}</ul></div>` : ""}

        <div class="storage-card__sources">${sourceLink}</div>
      </article>
    `;
  }

  function renderList() {
    const target = $("[data-storage-list]");
    const note = $("[data-result-note]");

    const matchesList = state.items.filter(matches);
    const visible = matchesList.slice(0, 60);

    note.textContent = `Showing ${number.format(visible.length)} of ${number.format(matchesList.length)} matching ranked items.`;

    if (!visible.length) {
      target.innerHTML = "<p>No storage items match the current filters.</p>";
      return;
    }

    target.innerHTML = visible.map(renderCard).join("");
  }

  function bindControls() {
    $("[data-search]").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderList();
    });

    $("[data-bucket-filter]").addEventListener("change", (event) => {
      state.bucket = event.target.value;
      renderList();
    });

    $("[data-relevance-filter]").addEventListener("change", (event) => {
      state.relevance = event.target.value;
      renderList();
    });

    $("[data-type-filter]").addEventListener("change", (event) => {
      state.type = event.target.value;
      renderList();
    });
  }

  async function init() {
    try {
      const payload = await loadJson("data/storage-ranked.json");
      state.items = Array.isArray(payload.items) ? payload.items : [];

      renderSummary(payload);
      populateFilters();
      bindControls();
      renderList();
    } catch (error) {
      console.error(error);
      const target = $("[data-storage-list]");
      target.innerHTML = "<p>Ranked storage data could not be loaded. Run scripts/rank-storage-watcher.py.</p>";
    }
  }

  init();
})();
