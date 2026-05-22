const COUNTRY_NAMES = {
  IE: "Ireland",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy"
};

const recentState = {
  payload: null,
  items: []
};

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countryLabel(code) {
  return COUNTRY_NAMES[code] || code || "Unknown";
}

function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short"
  });
}

function formatDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function uniqueCountries(items) {
  return [...new Set(items.map(item => item.country).filter(Boolean))].sort();
}

function populateCountryFilter(items, coverageCountries = []) {
  const select = byId("recentCountryFilter");
  if (!select || select.dataset.populated === "true") return;

  const countries = uniqueCountries(items).length
    ? uniqueCountries(items)
    : [...coverageCountries].sort();

  countries.forEach(code => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = countryLabel(code);
    select.appendChild(option);
  });

  select.dataset.populated = "true";
  select.addEventListener("change", renderRecentObservations);
}

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function observationSort(a, b) {
  return String(b.observation_date || "").localeCompare(String(a.observation_date || ""));
}

function renderObservation(item) {
  const count = item.count === null || item.count === undefined ? "seen" : `${item.count} seen`;
  const name = item.common_name || "Unknown species";
  const sci = item.scientific_name || "";
  const location = item.region || "Unknown location";
  const country = countryLabel(item.country);
  const date = formatDate(item.observation_date);

  return `
    <article class="recent-observation-card">
      <div>
        <h3>${escapeHtml(name)}</h3>
        <p class="recent-observation-scientific">${escapeHtml(sci)}</p>
      </div>
      <dl>
        <div><dt>Where</dt><dd>${escapeHtml(location)}, ${escapeHtml(country)}</dd></div>
        <div><dt>When</dt><dd>${escapeHtml(date)}</dd></div>
        <div><dt>Count</dt><dd>${escapeHtml(count)}</dd></div>
      </dl>
    </article>
  `;
}

function renderRecentObservations() {
  const list = byId("recentObservationsList");
  const status = byId("recentObservationsStatus");
  const select = byId("recentCountryFilter");

  if (!list || !status) return;

  const payload = recentState.payload || {};
  const items = recentState.items || [];
  const selectedCountry = select?.value || "all";

  const filtered = selectedCountry === "all"
    ? items
    : items.filter(item => item.country === selectedCountry);

  setText("recentObservationCount", String(items.length));
  setText("recentObservationCountries", String(uniqueCountries(items).length || payload.coverage?.countries?.length || "–"));
  setText("recentObservationUpdated", formatDateTime(payload.generated_at));

  const warnings = Array.isArray(payload.warnings) && payload.warnings.length
    ? ` · ${payload.warnings.join("; ")}`
    : "";

  if (payload.status === "missing_api_key") {
    status.textContent = "eBird API key not configured yet.";
    list.innerHTML = `<p class="recent-observations-empty">Recent observations are structurally ready, but EBIRD_API_KEY has not produced live data yet.</p>`;
    return;
  }

  if (!items.length) {
    status.textContent = "No recent observations available.";
    list.innerHTML = `<p class="recent-observations-empty">No recent eBird records are currently available in the generated dataset.</p>`;
    return;
  }

  status.textContent = `${filtered.length} shown from ${items.length} recent records${warnings}.`;

  list.innerHTML = filtered
    .slice()
    .sort(observationSort)
    .map(renderObservation)
    .join("");
}

async function loadRecentObservations() {
  try {
    const response = await fetch("./data/recent-observations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    recentState.payload = payload;
    recentState.items = Array.isArray(payload.items) ? payload.items : [];

    populateCountryFilter(recentState.items, payload.coverage?.countries || []);
    renderRecentObservations();
  } catch (error) {
    const status = byId("recentObservationsStatus");
    const list = byId("recentObservationsList");

    if (status) status.textContent = "Recent observations unavailable.";
    if (list) {
      list.innerHTML = `<p class="recent-observations-empty">Could not load recent-observations.json: ${escapeHtml(error.message)}</p>`;
    }
  }
}

loadRecentObservations();
