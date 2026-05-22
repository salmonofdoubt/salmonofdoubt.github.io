const COUNTRY_NAMES = {
  IE: "Ireland",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy"
};

const recentState = {
  payload: null,
  items: [],
  birdIndex: new Map()
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

function normaliseKey(value) {
  return String(value || "").trim().toLowerCase();
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

function atlasBirdForObservation(item) {
  const byCommon = recentState.birdIndex.get(normaliseKey(item.common_name));
  const byScientific = recentState.birdIndex.get(normaliseKey(item.scientific_name));
  return byCommon || byScientific || null;
}

function imageForObservation(item) {
  const bird = atlasBirdForObservation(item);
  const image = bird?.image || {};
  return image.thumb || image.thumbnail || image.original || image.url || "";
}

function atlasLinkForObservation(item) {
  const bird = atlasBirdForObservation(item);
  if (!bird) return "";

  const query = encodeURIComponent(bird.common_name || item.common_name || item.scientific_name || "");
  return `./?bird=${query}&scope=catalogue&sound=all#birdGrid`;
}

function renderThumb(item) {
  const src = imageForObservation(item);
  const name = item.common_name || item.scientific_name || "Bird";

  if (!src) {
    return `<span class="recent-observation-thumb recent-observation-thumb--empty" aria-hidden="true">${escapeHtml(String(name).slice(0, 1))}</span>`;
  }

  return `
    <img
      class="recent-observation-thumb"
      src="${escapeHtml(src)}"
      alt=""
      loading="lazy"
      decoding="async"
      width="72"
      height="72"
    />
  `;
}

function renderObservation(item) {
  const count = item.count === null || item.count === undefined ? "seen" : `${item.count} seen`;
  const name = item.common_name || "Unknown species";
  const sci = item.scientific_name || "";
  const location = item.region || "Unknown location";
  const country = countryLabel(item.country);
  const date = formatDate(item.observation_date);
  const atlasLink = atlasLinkForObservation(item);

  const titleBlock = `
    ${renderThumb(item)}
    <span>
      <strong>${escapeHtml(name)}</strong>
      <em>${escapeHtml(sci)}</em>
    </span>
  `;

  const title = atlasLink
    ? `<a class="recent-observation-mainlink" href="${atlasLink}" aria-label="Open ${escapeHtml(name)} in the sound atlas">${titleBlock}</a>`
    : `<div class="recent-observation-mainlink recent-observation-mainlink--disabled">${titleBlock}</div>`;

  const soundAction = atlasLink
    ? `<a class="recent-observation-soundlink" href="${atlasLink}">Open sound card</a>`
    : `<span class="recent-observation-soundlink is-disabled">No sound card</span>`;

  return `
    <article class="recent-observation-card">
      ${title}

      <dl class="recent-observation-meta">
        <div class="recent-observation-where">
          <dt>Where</dt>
          <dd>${escapeHtml(location)}, ${escapeHtml(country)}</dd>
        </div>

        <div>
          <dt>When</dt>
          <dd>${escapeHtml(date)}</dd>
        </div>

        <div>
          <dt>Count</dt>
          <dd>${escapeHtml(count)}</dd>
        </div>

        <div class="recent-observation-action">
          ${soundAction}
        </div>
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

async function loadBirdIndex() {
  try {
    const response = await fetch("./data/birds.json", { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const birds = Array.isArray(payload.birds) ? payload.birds : [];

    birds.forEach(bird => {
      if (bird.common_name) recentState.birdIndex.set(normaliseKey(bird.common_name), bird);
      if (bird.scientific_name) recentState.birdIndex.set(normaliseKey(bird.scientific_name), bird);
    });
  } catch (error) {
    console.warn("Could not load bird image index", error);
  }
}

async function loadRecentObservations() {
  try {
    const [recentResponse] = await Promise.all([
      fetch("./data/recent-observations.json", { cache: "no-cache" }),
      loadBirdIndex()
    ]);

    if (!recentResponse.ok) throw new Error(`HTTP ${recentResponse.status}`);

    const payload = await recentResponse.json();
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
