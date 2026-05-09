
const WB_BASE = "https://api.worldbank.org/v2";
const state = {
  countries: [],
  indicators: [],
  rawValues: {},
  scores: [],
  filtered: [],
  dataMode: "loading",
  camera: { eye: { x: 1.55, y: 1.45, z: 1.2 } }
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [countries, indicators] = await Promise.all([
      fetchJSON("data/countries.json"),
      fetchJSON("data/indicators.json")
    ]);
    state.countries = countries;
    state.indicators = indicators;
    renderIndicatorTable();
    bindControls();
    populateRegionFilter();

    try {
      await loadWorldBankData();
      state.scores = computeScores();
      state.dataMode = "Live World Bank API";
      document.getElementById("dataMode").innerHTML = `<span class="status-pill">Live public indicators</span>`;
    } catch (error) {
      console.warn("World Bank API failed; using fallback dataset.", error);
      state.scores = await loadFallbackScores();
      state.dataMode = "Fallback";
      document.getElementById("dataMode").innerHTML = `<span class="status-pill">Fallback illustrative data</span>`;
    }

    applyFilters();
  } catch (error) {
    document.getElementById("plot").innerHTML = `<div class="warning-box">Could not initialise demo: ${escapeHtml(error.message)}</div>`;
  }
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.text();
}

async function loadWorldBankData() {
  const countryCodes = state.countries.map(c => c.code).join(";");
  const years = "2010:2026";

  for (const indicator of state.indicators) {
    const url = `${WB_BASE}/country/${countryCodes}/indicator/${indicator.code}?format=json&per_page=20000&date=${years}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`World Bank request failed for ${indicator.code}`);
    const payload = await response.json();
    const rows = payload[1];
    if (!Array.isArray(rows)) throw new Error(`World Bank payload empty for ${indicator.code}`);

    for (const row of rows) {
      if (!row || row.value === null || row.value === undefined || !row.countryiso3code) continue;
      const country = state.countries.find(c => c.iso3 === row.countryiso3code);
      if (!country) continue;
      const current = getNestedValue(state.rawValues, [country.code, indicator.code]);
      const year = Number(row.date);
      if (!current || year > current.year) {
        setNestedValue(state.rawValues, [country.code, indicator.code], {
          value: Number(row.value),
          year,
          indicator: indicator.code,
          label: indicator.label
        });
      }
    }
  }

  const valueCount = Object.values(state.rawValues).reduce((sum, countryValues) => sum + Object.keys(countryValues).length, 0);
  if (valueCount < state.countries.length * 3) {
    throw new Error("Too few World Bank values returned for a meaningful live view.");
  }
}

function computeScores() {
  return state.countries.map(country => {
    const layerScores = { individual: [], collective: [], planetary: [] };
    const detail = [];

    for (const indicator of state.indicators) {
      const raw = getNestedValue(state.rawValues, [country.code, indicator.code]);
      if (!raw) {
        detail.push({ ...indicator, raw: null, score: null, year: null });
        continue;
      }
      const score = transformValue(raw.value, indicator);
      layerScores[indicator.layer].push({ score, weight: Number(indicator.weight) });
      detail.push({ ...indicator, raw: raw.value, score, year: raw.year });
    }

    const individual = weightedAverage(layerScores.individual);
    const collective = weightedAverage(layerScores.collective);
    const planetary = weightedAverage(layerScores.planetary);
    const completeness = state.indicators.length ? detail.filter(d => d.raw !== null).length / state.indicators.length : 0;
    const overall = average([individual, collective, planetary]);

    return {
      country: country.name,
      code: country.code,
      iso3: country.iso3,
      region: country.region,
      individual_intelligence: individual,
      collective_intelligence: collective,
      planetary_intelligence: planetary,
      overall_synergy: overall,
      completeness,
      archetype: classifyArchetype(individual, collective, planetary),
      data_status: state.dataMode,
      detail
    };
  }).filter(d => Number.isFinite(d.overall_synergy));
}

function transformValue(value, indicator) {
  let score;
  switch (indicator.transform) {
    case "scale_0_1":
      score = value * 100;
      break;
    case "percent":
      score = value;
      break;
    case "capped_percent":
      score = (Math.min(value, indicator.cap || 100) / (indicator.cap || 100)) * 100;
      break;
    case "wgi_estimate":
      score = ((value + 2.5) / 5) * 100;
      break;
    case "linear":
      score = ((value - indicator.min) / (indicator.max - indicator.min)) * 100;
      break;
    case "inverse_linear":
      score = 100 - ((value - indicator.min) / (indicator.max - indicator.min)) * 100;
      break;
    default:
      score = value;
  }
  return clamp(score, 0, 100);
}

function weightedAverage(items) {
  const valid = items.filter(d => Number.isFinite(d.score) && Number.isFinite(d.weight));
  const wsum = valid.reduce((sum, d) => sum + d.weight, 0);
  if (!valid.length || wsum === 0) return NaN;
  return valid.reduce((sum, d) => sum + d.score * d.weight, 0) / wsum;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return NaN;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function classifyArchetype(i, c, p) {
  if (i >= 70 && c >= 70 && p >= 65) return "High integration";
  if (i >= 70 && c < 65) return "Individual-rich, coordination-limited";
  if (c >= 70 && p < 55) return "Institutionally strong, planetary lag";
  if (p >= 65 && c < 65) return "Planet-aware, governance-limited";
  if (i < 55 && c < 55 && p < 55) return "Low composite capacity";
  return "Mixed transition";
}

async function loadFallbackScores() {
  const text = await fetchText("data/country_scores_fallback.csv");
  const rows = parseCSV(text);
  return rows.map(row => ({
    country: row.country,
    code: row.code,
    region: row.region,
    individual_intelligence: Number(row.individual_intelligence),
    collective_intelligence: Number(row.collective_intelligence),
    planetary_intelligence: Number(row.planetary_intelligence),
    overall_synergy: Number(row.overall_synergy),
    completeness: 0,
    archetype: classifyArchetype(Number(row.individual_intelligence), Number(row.collective_intelligence), Number(row.planetary_intelligence)),
    data_status: row.data_status,
    detail: []
  }));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines.shift());
  return lines.map(line => {
    const cells = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""]));
  });
}

function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function bindControls() {
  ["regionFilter", "countrySearch", "minSynergy", "colourMode"].forEach(id => {
    document.getElementById(id).addEventListener("input", applyFilters);
    document.getElementById(id).addEventListener("change", applyFilters);
  });

  document.getElementById("minSynergy").addEventListener("input", e => {
    document.getElementById("minSynergyValue").textContent = e.target.value;
  });

  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("regionFilter").value = "All";
    document.getElementById("countrySearch").value = "";
    document.getElementById("minSynergy").value = 0;
    document.getElementById("minSynergyValue").textContent = "0";
    document.getElementById("colourMode").value = "archetype";
    applyFilters();
  });

  document.getElementById("resetCamera").addEventListener("click", () => {
    Plotly.relayout("plot", { "scene.camera": state.camera });
  });
}

function populateRegionFilter() {
  const regions = [...new Set(state.countries.map(c => c.region))].sort();
  document.getElementById("regionFilter").innerHTML =
    `<option value="All">All regions</option>` + regions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
}

function applyFilters() {
  const region = document.getElementById("regionFilter").value;
  const search = document.getElementById("countrySearch").value.trim().toLowerCase();
  const minSynergy = Number(document.getElementById("minSynergy").value);

  state.filtered = state.scores.filter(row => {
    const regionMatch = region === "All" || row.region === region;
    const searchMatch = !search || row.country.toLowerCase().includes(search);
    const synergyMatch = row.overall_synergy >= minSynergy;
    return regionMatch && searchMatch && synergyMatch;
  });

  updateSummary();
  renderPlot();
}

function updateSummary() {
  const rows = state.filtered;
  const avg = key => rows.length ? average(rows.map(r => r[key])).toFixed(1) : "0.0";
  document.getElementById("displayedCount").textContent = rows.length;
  document.getElementById("avgIndividual").textContent = avg("individual_intelligence");
  document.getElementById("avgCollective").textContent = avg("collective_intelligence");
  document.getElementById("avgPlanetary").textContent = avg("planetary_intelligence");
  document.getElementById("avgCompleteness").textContent = rows.length ? `${Math.round(average(rows.map(r => r.completeness)) * 100)}%` : "0%";
}

function renderPlot() {
  const mode = document.getElementById("colourMode").value;
  const rows = state.filtered;
  let traces;

  if (mode === "synergy") {
    traces = [{
      type: "scatter3d",
      mode: "markers",
      name: "Countries",
      x: rows.map(r => r.individual_intelligence),
      y: rows.map(r => r.collective_intelligence),
      z: rows.map(r => r.planetary_intelligence),
      text: rows.map(r => r.country),
      customdata: rows,
      marker: {
        size: rows.map(r => Math.max(7, r.overall_synergy / 5.8)),
        color: rows.map(r => r.overall_synergy),
        colorscale: "Viridis",
        showscale: true,
        opacity: 0.9,
        colorbar: { title: "Synergy" },
        line: { width: 0.45, color: "#edf3ff" }
      },
      hovertemplate: hoverTemplate()
    }];
  } else {
    const groupKey = mode === "region" ? "region" : "archetype";
    const groups = [...new Set(rows.map(r => r[groupKey]))].sort();
    traces = groups.map(group => {
      const subset = rows.filter(r => r[groupKey] === group);
      return {
        type: "scatter3d",
        mode: "markers",
        name: group,
        x: subset.map(r => r.individual_intelligence),
        y: subset.map(r => r.collective_intelligence),
        z: subset.map(r => r.planetary_intelligence),
        text: subset.map(r => r.country),
        customdata: subset,
        marker: {
          size: subset.map(r => Math.max(7, r.overall_synergy / 5.8)),
          opacity: 0.9,
          line: { width: 0.45, color: "#edf3ff" }
        },
        hovertemplate: hoverTemplate()
      };
    });
  }

  const layout = {
    margin: { l: 0, r: 0, t: 10, b: 0 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    legend: { font: { color: "#edf3ff" }, orientation: "h", x: 0.02, y: 0.98 },
    scene: {
      camera: state.camera,
      xaxis: axisStyle("Individual intelligence"),
      yaxis: axisStyle("Collective intelligence"),
      zaxis: axisStyle("Planetary intelligence")
    }
  };

  const config = { responsive: true, displaylogo: false };

  Plotly.newPlot("plot", traces, layout, config).then(gd => {
    gd.removeAllListeners("plotly_click");
    gd.on("plotly_click", event => {
      const point = event.points && event.points[0];
      if (point && point.customdata) renderSelected(point.customdata);
    });
  });
}

function axisStyle(title) {
  return {
    title,
    range: [0, 100],
    color: "#edf3ff",
    gridcolor: "rgba(153,177,255,0.18)",
    zerolinecolor: "rgba(153,177,255,0.25)",
    backgroundcolor: "rgba(17,24,42,0.45)"
  };
}

function hoverTemplate() {
  return "<b>%{text}</b><br>" +
    "Individual: %{x:.1f}<br>" +
    "Collective: %{y:.1f}<br>" +
    "Planetary: %{z:.1f}<br>" +
    "Synergy: %{customdata.overall_synergy:.1f}<br>" +
    "Archetype: %{customdata.archetype}<extra></extra>";
}

function renderSelected(row) {
  const detailRows = row.detail && row.detail.length
    ? row.detail.map(d => `
        <tr>
          <td>${escapeHtml(d.layer)}</td>
          <td>${escapeHtml(d.label)}</td>
          <td>${d.raw === null ? "missing" : formatValue(d.raw)}</td>
          <td>${d.score === null ? "missing" : d.score.toFixed(1)}</td>
          <td>${d.year || "n/a"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5">Fallback mode has no live source-year detail.</td></tr>`;

  document.getElementById("selectedCountry").innerHTML = `
    <h3>${escapeHtml(row.country)}</h3>
    <div class="profile-meta">
      <span>${escapeHtml(row.region)}</span>
      <span>${escapeHtml(row.archetype)}</span>
      <span>${escapeHtml(row.data_status || state.dataMode)}</span>
    </div>
    <div class="score-grid">
      <div class="score-card"><span>Individual</span><strong>${row.individual_intelligence.toFixed(1)}</strong></div>
      <div class="score-card"><span>Collective</span><strong>${row.collective_intelligence.toFixed(1)}</strong></div>
      <div class="score-card"><span>Planetary</span><strong>${row.planetary_intelligence.toFixed(1)}</strong></div>
      <div class="score-card"><span>Synergy</span><strong>${row.overall_synergy.toFixed(1)}</strong></div>
    </div>
    <h4>Indicator detail</h4>
    <table class="detail-table">
      <thead><tr><th>Layer</th><th>Indicator</th><th>Raw value</th><th>Score</th><th>Year</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
  `;
}

function renderIndicatorTable() {
  const rows = state.indicators.map(i => `
    <tr>
      <td>${escapeHtml(i.layer)}</td>
      <td><strong>${escapeHtml(i.label)}</strong><br><span class="muted small">${escapeHtml(i.code)}</span></td>
      <td>${escapeHtml(i.direction)}</td>
      <td>${Number(i.weight).toFixed(2)}</td>
      <td>${escapeHtml(i.transform)}</td>
      <td>${escapeHtml(i.notes)}</td>
    </tr>
  `).join("");

  document.getElementById("indicatorTable").innerHTML = `
    <table class="indicator-table">
      <thead>
        <tr><th>Layer</th><th>Indicator</th><th>Direction</th><th>Weight</th><th>Transform</th><th>Note</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatValue(value) {
  if (!Number.isFinite(value)) return "missing";
  if (Math.abs(value) < 3) return value.toFixed(3);
  return value.toFixed(2);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function getNestedValue(obj, keys) { return keys.reduce((o, k) => o && o[k] !== undefined ? o[k] : undefined, obj); }
function setNestedValue(obj, keys, value) {
  let cursor = obj;
  keys.slice(0, -1).forEach(k => {
    if (!cursor[k]) cursor[k] = {};
    cursor = cursor[k];
  });
  cursor[keys[keys.length - 1]] = value;
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
