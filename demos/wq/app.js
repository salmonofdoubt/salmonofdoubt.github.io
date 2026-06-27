const state = {
  payload: null,
  thresholds: null,
  focusAreas: null,
  map: null,
  focusLayer: null,
  markers: [],
  records: [],
  selectedRecord: null,
  focusAreaId: null,
  deferredInstallPrompt: null
};

const els = {
  records: document.getElementById("statRecords"),
  sources: document.getElementById("statSources"),
  alerts: document.getElementById("statAlerts"),
  updated: document.getElementById("statUpdated"),
  map: document.getElementById("waterMap"),
  selected: document.getElementById("selectedRecord"),
  layerFilter: document.getElementById("layerFilter"),
  unitMode: document.getElementById("unitMode"),
  search: document.getElementById("searchBox"),
  signalGrid: document.getElementById("signalGrid"),
  sourceGrid: document.getElementById("sourceGrid"),
  chart: document.getElementById("cqChart"),
  chartCaption: document.getElementById("chartCaption"),
  chartParameter: document.getElementById("chartParameter"),
  chartScale: document.getElementById("chartScale"),
  focusSelect: document.getElementById("focusAreaSelect"),
  zoomFocus: document.getElementById("zoomFocus"),
  fitIreland: document.getElementById("fitIreland"),
  share: document.getElementById("shareApp"),
  install: document.getElementById("installApp")
};

const TYPE_LABELS = {
  water_level: "Live hydrometry",
  bathing_water: "Bathing location",
  bathing_measurement: "Bathing sample",
  bathing_alert: "Bathing alert",
  wfd_context: "WFD context",
  groundwater_context: "Groundwater context",
  marine_context: "Marine shore context"
};

const TYPE_STYLE = {
  water_level: { radius: 5, color: "#67e8f9", fillColor: "#0891b2" },
  bathing_water: { radius: 7, color: "#5eead4", fillColor: "#0f766e" },
  bathing_measurement: { radius: 7, color: "#86efac", fillColor: "#15803d" },
  bathing_alert: { radius: 9, color: "#fb7185", fillColor: "#be123c" },
  wfd_context: { radius: 6, color: "#c084fc", fillColor: "#7e22ce" },
  groundwater_context: { radius: 6, color: "#fde68a", fillColor: "#a16207" },
  marine_context: { radius: 6, color: "#93c5fd", fillColor: "#1d4ed8" }
};

function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function safeText(value, fallback = "not reported") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function prettyNumber(value, digits = 3) {
  const num = numberValue(value);
  if (num === null) return safeText(value);
  if (Math.abs(num) >= 1000) return num.toLocaleString("en-IE", { maximumFractionDigits: 0 });
  if (Math.abs(num) >= 10) return num.toLocaleString("en-IE", { maximumFractionDigits: 2 });
  return num.toLocaleString("en-IE", { maximumFractionDigits: digits });
}

function normaliseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function activeFocusArea() {
  const areas = state.focusAreas?.areas || [];
  return areas.find(area => area.id === state.focusAreaId) || areas[0] || null;
}

function convertedParameter(parameter) {
  const mode = els.unitMode?.value || "native";
  if (mode === "native") return parameter;

  const key = normaliseKey(parameter.key || parameter.label);
  const value = numberValue(parameter.value);
  const unit = String(parameter.unit || "").toLowerCase();

  if (value === null) return parameter;

  const conversions = {
    no3_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
    nitrate_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
    nh4_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
    ammonium_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
    po4_p: { factor: 32.285, unit: "µmol P/L", basis: "as phosphorus" },
    phosphate_p: { factor: 32.285, unit: "µmol P/L", basis: "as phosphorus" }
  };

  if (mode === "molar" && conversions[key] && unit.includes("mg")) {
    return {
      ...parameter,
      value: value * conversions[key].factor,
      unit: conversions[key].unit,
      basis: conversions[key].basis,
      converted_from: `${parameter.value} ${parameter.unit}`
    };
  }

  if (mode === "mass" && unit.includes("mg")) {
    return {
      ...parameter,
      value: value * 1000,
      unit: String(parameter.unit).replace(/mg/i, "µg"),
      converted_from: `${parameter.value} ${parameter.unit}`
    };
  }

  return parameter;
}

function thresholdFor(parameter) {
  const key = normaliseKey(parameter.key || parameter.label);
  const value = numberValue(parameter.value);

  if (value === null || !state.thresholds) {
    return { label: "No threshold", className: "context", detail: "No numeric value available." };
  }

  const bathing = state.thresholds.bathing_coastal_transitional?.parameters || {};
  const threshold = bathing[key];

  if (!threshold) {
    return {
      label: "Context only",
      className: "context",
      detail: "No universal threshold is applied for this parameter."
    };
  }

  if (value <= threshold.excellent) {
    return {
      label: "Excellent context",
      className: "good",
      detail: `≤ ${threshold.excellent} ${threshold.unit}`
    };
  }

  if (value <= threshold.good) {
    return {
      label: "Good context",
      className: "good",
      detail: `≤ ${threshold.good} ${threshold.unit}`
    };
  }

  if (value <= threshold.sufficient) {
    return {
      label: "Sufficient context",
      className: "watch",
      detail: `≤ ${threshold.sufficient} ${threshold.unit}`
    };
  }

  return {
    label: "Poor context",
    className: "bad",
    detail: `> ${threshold.sufficient} ${threshold.unit}`
  };
}

function parameterHtml(parameter) {
  const converted = convertedParameter(parameter);
  const threshold = thresholdFor(parameter);

  return `
    <div class="parameter-row">
      <strong>${safeText(converted.label || converted.key, "Parameter")}</strong>
      <span>${prettyNumber(converted.value)} ${safeText(converted.unit, "")}</span>
      ${converted.converted_from ? `<small>Converted from ${converted.converted_from}</small>` : ""}
      ${converted.basis ? `<small>Basis: ${converted.basis}</small>` : ""}
      <span class="threshold-pill ${threshold.className}">${threshold.label}</span>
      <small>${threshold.detail}</small>
    </div>
  `;
}

function recordHasCoordinates(record) {
  return Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lon));
}

function recordWithinArea(record, area) {
  if (!area || !recordHasCoordinates(record)) return false;
  const [[south, west], [north, east]] = area.bounds;
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

function recordMatches(record) {
  const layer = els.layerFilter?.value || "all";
  const query = String(els.search?.value || "").trim().toLowerCase();

  if (layer !== "all" && record.type !== layer) return false;

  if (!query) return true;

  const haystack = [
    record.id,
    record.name,
    record.type,
    record.source,
    record.freshness,
    record.status,
    record.description,
    ...(record.parameters || []).map(parameter => `${parameter.key} ${parameter.label} ${parameter.value} ${parameter.unit}`)
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

function markerStyle(record) {
  return TYPE_STYLE[record.type] || { radius: 6, color: "#5eead4", fillColor: "#0f766e" };
}

function popupHtml(record) {
  const params = (record.parameters || []).slice(0, 3).map(parameterHtml).join("");

  return `
    <div class="water-popup">
      <h3>${safeText(record.name, "Water signal")}</h3>
      <p><strong>${TYPE_LABELS[record.type] || record.type}</strong></p>
      <p>${safeText(record.source_label || record.source)}</p>
      <p>${formatDate(record.observed_at || record.generated_at)}</p>
      ${params}
    </div>
  `;
}

function selectedHtml(record) {
  const params = (record.parameters || []).map(parameterHtml).join("");

  return `
    <h2>${safeText(record.name, "Water signal")}</h2>
    <p>${TYPE_LABELS[record.type] || record.type}</p>

    <div class="record-meta">
      <div><strong>Source</strong><br>${safeText(record.source_label || record.source)}</div>
      <div><strong>Freshness</strong><br>${safeText(record.freshness, "context")}</div>
      <div><strong>Observed</strong><br>${formatDate(record.observed_at || record.generated_at)}</div>
      <div><strong>Status</strong><br>${safeText(record.status, "not classified")}</div>
    </div>

    ${params || "<p>No numeric parameters were normalised for this record yet.</p>"}

    ${record.description ? `<p>${record.description}</p>` : ""}
    ${record.url ? `<p><a href="${record.url}" target="_blank" rel="noopener">Open official/source page</a></p>` : ""}
  `;
}

function clearMarkers() {
  state.markers.forEach(marker => marker.remove());
  state.markers = [];
}

function renderMapRecords() {
  if (!state.map) return;

  clearMarkers();

  const records = state.records.filter(recordMatches).filter(recordHasCoordinates);

  records.forEach(record => {
    const style = markerStyle(record);
    const marker = L.circleMarker([Number(record.lat), Number(record.lon)], {
      radius: style.radius,
      color: style.color,
      fillColor: style.fillColor,
      fillOpacity: 0.86,
      weight: 1.5
    }).addTo(state.map);

    marker.bindPopup(popupHtml(record));
    marker.on("click", () => {
      state.selectedRecord = record;
      els.selected.innerHTML = selectedHtml(record);
    });

    state.markers.push(marker);
  });
}

function renderStats() {
  const summary = state.payload?.summary || {};
  const sourceCount = (state.payload?.sources || []).length;
  const alertCount = state.records.filter(record => record.type === "bathing_alert").length;

  els.records.textContent = Number(summary.mapped_records || state.records.filter(recordHasCoordinates).length).toLocaleString("en-IE");
  els.sources.textContent = Number(sourceCount).toLocaleString("en-IE");
  els.alerts.textContent = Number(alertCount).toLocaleString("en-IE");
  els.updated.textContent = state.payload?.generated_at_utc
    ? new Date(state.payload.generated_at_utc).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })
    : "seed";
}

function renderFocusOptions() {
  const areas = state.focusAreas?.areas || [];
  if (!els.focusSelect) return;

  els.focusSelect.innerHTML = areas.map(area => `
    <option value="${area.id}">${area.name}</option>
  `).join("");

  els.focusSelect.value = state.focusAreaId;
}

function renderSignals() {
  const area = activeFocusArea();
  const focusRecords = state.records.filter(record => recordWithinArea(record, area));
  const nationalAlerts = state.records.filter(record => record.type === "bathing_alert");
  const bathingMeasurements = state.records.filter(record => record.type === "bathing_measurement");
  const hydro = state.records.filter(record => record.type === "water_level");
  const contexts = state.records.filter(record => ["wfd_context", "groundwater_context", "marine_context"].includes(record.type));

  const cards = [
    {
      title: "Active focus records",
      value: focusRecords.length,
      text: area ? `Mapped records inside ${area.name}.` : "No focus area selected."
    },
    {
      title: "Current bathing alerts",
      value: nationalAlerts.length,
      text: "Active EPA bathing-water alerts or restrictions returned by the public API."
    },
    {
      title: "Latest bathing samples",
      value: bathingMeasurements.length,
      text: "Recent E. coli and intestinal enterococci sample records harvested from the EPA Bathing Water API."
    },
    {
      title: "Hydrometric stations",
      value: hydro.length,
      text: "OPW live/latest station readings with coordinates."
    },
    {
      title: "Context records",
      value: contexts.length,
      text: "WFD, groundwater and marine context entries. Historical chemistry joins will extend this panel."
    },
    {
      title: "C-Q readiness",
      value: state.payload?.analysis?.cq_pairs?.length || 0,
      text: "Paired flow-concentration records ready for log-log analysis."
    }
  ];

  els.signalGrid.innerHTML = cards.map(card => `
    <article class="signal-card">
      <p class="eyebrow mini">${card.title}</p>
      <h3>${Number(card.value).toLocaleString("en-IE")}</h3>
      <p>${card.text}</p>
    </article>
  `).join("");
}

function renderSources() {
  const sources = state.payload?.sources || [];

  els.sourceGrid.innerHTML = sources.map(source => `
    <article class="source-card">
      <p class="eyebrow mini">${safeText(source.freshness_class, "source")}</p>
      <h3>${safeText(source.name, source.id)}</h3>
      <span class="status-pill ${source.status || "planned"}">${safeText(source.status, "planned")}</span>
      <dl>
        <div><dt>Records</dt><dd>${Number(source.records || 0).toLocaleString("en-IE")}</dd></div>
        <div><dt>Licence</dt><dd>${safeText(source.licence, "check source")}</dd></div>
        <div><dt>Fetched</dt><dd>${formatDate(source.fetched_at_utc)}</dd></div>
        <div><dt>Caveat</dt><dd>${safeText(source.caveat, "No caveat supplied.")}</dd></div>
        ${source.error ? `<div><dt>Error</dt><dd>${source.error}</dd></div>` : ""}
      </dl>
    </article>
  `).join("");
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pairs = state.payload?.analysis?.cq_pairs || [];
  const wanted = els.chartParameter?.value || "all";
  const scale = els.chartScale?.value || "log";

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#061816";
  ctx.fillRect(0, 0, width, height);

  const filtered = pairs.filter(pair => wanted === "all" || normaliseKey(pair.parameter) === wanted)
    .filter(pair => Number(pair.flow_m3_s) > 0 && Number(pair.concentration_value) > 0);

  if (!filtered.length) {
    ctx.fillStyle = "#9ccbc4";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("No paired flow-concentration data yet.", 42, 92);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("The chart engine is ready. Historical chemistry and OPW flow joins come next.", 42, 128);
    els.chartCaption.textContent = "C-Q analysis requires paired discharge Q and concentration C for the same station or defensible waterbody join.";
    return;
  }

  const xValues = filtered.map(pair => scale === "log" ? Math.log10(Number(pair.flow_m3_s)) : Number(pair.flow_m3_s));
  const yValues = filtered.map(pair => scale === "log" ? Math.log10(Number(pair.concentration_value)) : Number(pair.concentration_value));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const pad = 54;

  function sx(value) {
    if (xMax === xMin) return width / 2;
    return pad + ((value - xMin) / (xMax - xMin)) * (width - pad * 1.6);
  }

  function sy(value) {
    if (yMax === yMin) return height / 2;
    return height - pad - ((value - yMin) / (yMax - yMin)) * (height - pad * 1.6);
  }

  ctx.strokeStyle = "rgba(156, 203, 196, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 20);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - 24, height - pad);
  ctx.stroke();

  ctx.fillStyle = "#5eead4";
  filtered.forEach((pair, index) => {
    const x = sx(xValues[index]);
    const y = sy(yValues[index]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#ecfffb";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText(scale === "log" ? "log₁₀(Q), m³ s⁻¹" : "Q, m³ s⁻¹", pad, height - 18);
  ctx.save();
  ctx.translate(18, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(scale === "log" ? "log₁₀(C)" : "Concentration", 0, 0);
  ctx.restore();

  els.chartCaption.textContent = `${filtered.length} paired records shown. Regression and hysteresis diagnostics will be added when source joins are stable.`;
}

function drawFocusArea() {
  if (!state.map) return;
  const area = activeFocusArea();
  if (!area) return;

  if (!state.focusLayer) {
    state.focusLayer = L.layerGroup().addTo(state.map);
  }

  state.focusLayer.clearLayers();

  L.rectangle(area.bounds, {
    color: "#5eead4",
    weight: 2,
    fillOpacity: 0.04
  }).addTo(state.focusLayer);
}

function fitFocusArea() {
  const area = activeFocusArea();
  if (!area || !state.map) return;

  drawFocusArea();
  state.map.fitBounds(area.bounds, { padding: [18, 18] });
}

function fitIreland() {
  if (!state.map) return;
  state.map.setView([53.45, -7.85], 7);
}

function initMap() {
  if (!window.L || !els.map) return;

  const area = activeFocusArea();
  const centre = area?.centre || [53.45, -7.85];
  const zoom = area?.zoom || 7;

  state.map = L.map(els.map, {
    scrollWheelZoom: false
  }).setView(centre, zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);

  drawFocusArea();
  renderMapRecords();
}

function installTabs() {
  document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-panel]").forEach(item => item.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("is-active"));

      button.classList.add("is-active");
      document.getElementById(button.dataset.panel)?.classList.add("is-active");

      if (button.dataset.panel === "mapPanel" && state.map) {
        window.setTimeout(() => state.map.invalidateSize(), 60);
      }

      if (button.dataset.panel === "chartsPanel") {
        drawChart();
      }
    });
  });
}

function installShareButton() {
  if (!els.share) return;

  const original = els.share.textContent;

  els.share.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "Explore live and latest Irish water-quality signals.",
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      els.share.textContent = "Copied";
      window.setTimeout(() => els.share.textContent = original, 1400);
    } catch (error) {
      window.prompt("Copy this link", window.location.href);
    }
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function deviceType() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  if (/iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function installPwaButton() {
  if (!els.install) return;

  const defaultLabel = "Install";

  function flash(label) {
    els.install.textContent = label;
    window.setTimeout(() => els.install.textContent = defaultLabel, 2200);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    els.install.textContent = "Installed";
  });

  els.install.addEventListener("click", async () => {
    if (isStandalone()) {
      flash("Installed");
      return;
    }

    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      try {
        await state.deferredInstallPrompt.userChoice;
      } finally {
        state.deferredInstallPrompt = null;
      }
      return;
    }

    const type = deviceType();
    if (type === "ios") flash("Share → Add");
    else if (type === "android") flash("Menu → Install");
    else flash("Browser menu");
  });
}

async function loadJson(path) {
  const response = await fetch(path + "?v=" + Date.now());
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    installTabs();
    installShareButton();
    installPwaButton();

    const [payload, thresholds, focusAreas] = await Promise.all([
      loadJson("./data/latest.json"),
      loadJson("./data/thresholds.json"),
      loadJson("./data/focus-areas.json")
    ]);

    state.payload = payload;
    state.thresholds = thresholds;
    state.focusAreas = focusAreas;
    state.focusAreaId = focusAreas.default_area || focusAreas.areas?.[0]?.id || null;
    state.records = Array.isArray(payload.records) ? payload.records : [];

    renderFocusOptions();
    renderStats();
    renderSignals();
    renderSources();
    initMap();
    drawChart();

    [els.layerFilter, els.search].forEach(control => {
      control?.addEventListener("input", renderMapRecords);
      control?.addEventListener("change", renderMapRecords);
    });

    els.unitMode?.addEventListener("change", () => {
      renderMapRecords();
      if (state.selectedRecord) {
        els.selected.innerHTML = selectedHtml(state.selectedRecord);
      }
    });

    [els.chartParameter, els.chartScale].forEach(control => {
      control?.addEventListener("change", drawChart);
    });

    els.focusSelect?.addEventListener("change", () => {
      state.focusAreaId = els.focusSelect.value;
      renderSignals();
      fitFocusArea();
    });

    els.zoomFocus?.addEventListener("click", fitFocusArea);
    els.fitIreland?.addEventListener("click", fitIreland);
  } catch (error) {
    console.error(error);
    if (els.selected) {
      els.selected.innerHTML = `
        <h2>Could not load water data</h2>
        <p>${error.message}</p>
      `;
    }
  }
}

init();
