(() => {
  const state = {
    items: [],
    search: "",
    status: "",
    type: ""
  };

  const $ = (selector) => document.querySelector(selector);

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const number = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.json();
  }

  function sum(field) {
    return state.items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
  }

  function renderSummary(data) {
    $("[data-storage-count]").textContent = number.format(state.items.length);
    $("[data-storage-capacity]").textContent = `${number.format(sum("capacity_mw"))} MW`;
    $("[data-storage-energy]").textContent = `${number.format(sum("energy_gwh"))} GWh`;
    $("[data-storage-status]").textContent = data.generated_at ? "Loaded" : "Unknown";
  }

  function populateFilters() {
    const statusSelect = $("[data-storage-status-filter]");
    const typeSelect = $("[data-storage-type-filter]");

    const statuses = [...new Set(state.items.map((item) => item.status).filter(Boolean))].sort();
    const types = [...new Set(state.items.map((item) => item.asset_type).filter(Boolean))].sort();

    statusSelect.innerHTML = '<option value="">All statuses</option>' +
      statuses.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

    typeSelect.innerHTML = '<option value="">All types</option>' +
      types.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function matches(item) {
    const haystack = [
      item.name,
      item.developer,
      item.location,
      item.technology,
      item.asset_type,
      item.status,
      ...(item.watch_flags || [])
    ].join(" ").toLowerCase();

    if (state.search && !haystack.includes(state.search.toLowerCase())) return false;
    if (state.status && item.status !== state.status) return false;
    if (state.type && item.asset_type !== state.type) return false;
    return true;
  }

  function fact(label, value) {
    return `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderItem(item) {
    const sources = (item.sources || [])
      .map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`)
      .join("");

    const tags = [
      item.asset_type,
      item.status,
      item.location
    ].filter(Boolean).map((tag) => `<span class="storage-pill">${escapeHtml(tag)}</span>`).join("");

    const warnings = (item.watch_flags || [])
      .map((flag) => `<li>${escapeHtml(flag)}</li>`)
      .join("");

    return `
      <article class="storage-card">
        <div class="storage-card__topline">${tags}</div>

        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(item.technology || "")}</p>
        </div>

        <div class="storage-card__facts">
          ${fact("Capacity", item.capacity_mw ? `${number.format(item.capacity_mw)} MW` : "TBC")}
          ${fact("Duration", item.duration_hours ? `${number.format(item.duration_hours)} h` : "TBC")}
          ${fact("Stored energy", item.energy_gwh ? `${number.format(item.energy_gwh)} GWh` : "TBC")}
          ${fact("Investment", item.investment_eur_bn ? `€${number.format(item.investment_eur_bn)}bn` : "TBC")}
        </div>

        <p><strong>Developer:</strong> ${escapeHtml(item.developer || "TBC")}</p>
        <p><strong>Planning reference:</strong> ${escapeHtml(item.planning_reference || "TBC")}</p>
        <p class="storage-card__warning"><strong>Counting rule:</strong> ${escapeHtml(item.counting_rule || "Track separately from renewable generation.")}</p>

        ${warnings ? `<div><strong>Watch flags</strong><ul>${warnings}</ul></div>` : ""}

        <div class="storage-card__sources">${sources}</div>
      </article>
    `;
  }

  function renderList() {
    const target = $("[data-storage-list]");
    const items = state.items.filter(matches);

    if (!items.length) {
      target.innerHTML = "<p>No storage watcher items match the current filters.</p>";
      return;
    }

    target.innerHTML = items.map(renderItem).join("");
  }

  function bindControls() {
    $("[data-storage-search]").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderList();
    });

    $("[data-storage-status-filter]").addEventListener("change", (event) => {
      state.status = event.target.value;
      renderList();
    });

    $("[data-storage-type-filter]").addEventListener("change", (event) => {
      state.type = event.target.value;
      renderList();
    });
  }

  async function init() {
    try {
      const data = await loadJson("data/storage-flexibility.json");
      state.items = Array.isArray(data.items) ? data.items : [];
      renderSummary(data);
      populateFilters();
      bindControls();
      renderList();
    } catch (error) {
      console.error(error);
      const target = $("[data-storage-list]");
      target.innerHTML = "<p>Storage watcher data could not be loaded.</p>";
      $("[data-storage-status]").textContent = "Error";
    }
  }

  init();
})();
