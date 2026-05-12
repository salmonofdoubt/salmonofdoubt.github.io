async function loadMonitor() {
  const response = await fetch("data/monitor.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load data/monitor.json");
  }
  return response.json();
}

function text(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function percent(value) {
  return `${Number(value).toFixed(0)}%`;
}

function metricCard(label, value, note, className = "") {
  return `
    <article class="metric-card ${className}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `;
}

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function percentOrNA(value, available = true) {
  if (!available || !isNumber(value)) return "n/a";
  return `${Number(value).toFixed(0)}%`;
}

function co2OrNA(value, available = true) {
  if (!available || !isNumber(value) || Number(value) <= 0) return "n/a";
  return `<span class="co2-value">${Number(value).toFixed(0)}</span><span class="co2-unit">g/kWh</span>`;
}

function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const importsAvailable = e.imports_available !== false;
  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;

  target.innerHTML = [
    metricCard("Demand now", `${Number(e.demand_mw || 0).toLocaleString()} MW`, "Latest mapped system demand"),
    metricCard("Renewables", percentOrNA(e.renewables_percent), "Wind + solar in latest mapped interval"),
    metricCard("Wind", percentOrNA(e.wind_percent), "Mapped wind generation now"),
    metricCard("Solar", percentOrNA(e.solar_percent), "Mapped solar generation now"),
    metricCard("Residual", percentOrNA(e.residual_percent ?? e.gas_percent), "Not gas: unclassified remaining supply"),
    metricCard("Imports", percentOrNA(e.imports_percent, importsAvailable), importsAvailable ? "Mapped interconnector contribution" : "Not mapped in current source", importsAvailable ? "" : "missing"),
    metricCard("CO₂ intensity", co2OrNA(e.co2_g_per_kwh, co2Available), co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source", co2Available ? "co2-card" : "missing co2-card")
  ].join("");
}

function renderMix(data) {
  const target = document.getElementById("mixBars");
  if (!target) return;

  const rows = data.fuel_mix_24h || [];
  const availableRows = rows.filter(item => item.available !== false);
  const dominant = [...availableRows].sort((a, b) => b.percent - a.percent)[0];

  text("dominantFuel", dominant ? `${dominant.label} dominant` : "No mapped data");

  target.innerHTML = rows.map(item => {
    const available = item.available !== false;
    const width = available ? Math.max(0, Math.min(100, Number(item.percent || 0))) : 0;
    const value = available ? percent(item.percent) : "n/a";

    return `
      <div class="mix-row ${item.class} ${available ? "" : "unavailable"}">
        <label>${item.label}</label>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%"></div>
        </div>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");
}

function truthClass(status) {
  if (status === "on") return "on";
  if (status === "off") return "off";
  return "risk";
}

function renderTruthMeter(data) {
  const target = document.getElementById("truthGrid");
  if (!target) return;

  target.innerHTML = data.truth_meter.map(item => `
    <article class="truth-card ${truthClass(item.status)}">
      <div class="truth-top">
        <h3>${item.name}</h3>
        <span class="truth-status">${item.status_label}</span>
      </div>
      <span class="truth-value">${item.value}</span>
      <p>${item.note}</p>
    </article>
  `).join("");
}

function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory;
  const width = 900;
  const height = 300;
  const pad = 36;

  const years = rows.map(d => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const x = year => pad + ((year - minYear) / (maxYear - minYear)) * (width - pad * 2);
  const y = value => height - pad - (value / 100) * (height - pad * 2);

  const targetPath = rows
    .filter(d => d.target !== null)
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.target)}`)
    .join(" ");

  const actualRows = rows.filter(d => d.actual !== null);
  const actualPath = actualRows
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.actual)}`)
    .join(" ");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = rows.find(d => d.year === latest.year);
  const gap = sameYear ? sameYear.target - latest.actual : 0;

  text("targetGap", `${gap.toFixed(0)} point gap`);

  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line class="grid-line" x1="${pad}" y1="${y(80)}" x2="${width - pad}" y2="${y(80)}"></line>
      <line class="grid-line" x1="${pad}" y1="${y(50)}" x2="${width - pad}" y2="${y(50)}"></line>
      <line class="grid-line" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>

      <path class="line-target" d="${targetPath}"></path>
      <path class="line-actual" d="${actualPath}"></path>

      ${actualRows.map(d => `<circle cx="${x(d.year)}" cy="${y(d.actual)}" r="4" fill="var(--blue)"></circle>`).join("")}
      ${rows.filter(d => d.target !== null).map(d => `<circle cx="${x(d.year)}" cy="${y(d.target)}" r="3" fill="var(--lime)"></circle>`).join("")}

      <text class="axis-text" x="${pad}" y="${y(80) - 8}">80% target</text>
      <text class="axis-text" x="${pad}" y="${y(50) - 8}">50%</text>
      <text class="axis-text" x="${pad}" y="${height - 10}">${minYear}</text>
      <text class="axis-text" x="${width - pad - 34}" y="${height - 10}">${maxYear}</text>
      <text class="axis-text" x="${width - 210}" y="34">Dashed: required path</text>
      <text class="axis-text" x="${width - 210}" y="52">Solid: observed/prototype path</text>
    </svg>
  `;
}


function driftStatusClass(status) {
  if (status === "on") return "on";
  if (status === "off") return "off";
  return "risk";
}

function targetMetricValue(value, unit = "") {
  return `<span class="target-number">${escapeHtml(value)}</span>${unit ? `<span class="target-unit">${escapeHtml(unit)}</span>` : ""}`;
}

function renderTargetDrift(data) {
  const target = document.getElementById("targetDriftGrid");
  if (!target) return;

  const drift = data.target_drift || {};
  if (!Object.keys(drift).length) {
    target.innerHTML = "";
    return;
  }

  const statusClass = driftStatusClass(drift.status);

  target.innerHTML = `
    <article class="target-drift-card ${statusClass}">
      <span>Latest official RES-E</span>
      <strong>${targetMetricValue(Number(drift.latest_value).toFixed(1), "%")}</strong>
      <small>${drift.latest_year}</small>
    </article>

    <article class="target-drift-card">
      <span>2030 benchmark</span>
      <strong>${targetMetricValue(Number(drift.target_value).toFixed(0), "%")}</strong>
      <small>Renewable electricity</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Gap to target</span>
      <strong>${targetMetricValue(Number(drift.gap_to_target_pp).toFixed(1), "pp")}</strong>
      <small>${drift.years_remaining} years remaining</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Required gain</span>
      <strong>${targetMetricValue(Number(drift.required_annual_gain_pp).toFixed(2), "pp/yr")}</strong>
      <small>From ${drift.latest_year} to ${drift.target_year}</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Recent gain</span>
      <strong>${targetMetricValue(Number(drift.recent_two_year_gain_pp_per_year).toFixed(2), "pp/yr")}</strong>
      <small>Two-year average</small>
    </article>

    <article class="target-drift-card target-status-card ${statusClass}">
      <span>Status</span>
      <strong>${escapeHtml(drift.status_label)}</strong>
      <small>${escapeHtml(drift.caveat || "")}</small>
    </article>
  `;
}

function renderPrices(data) {
  const target = document.getElementById("priceGrid");
  if (!target) return;

  target.innerHTML = data.prices.map(item => `
    <article class="price-card">
      <h3>${item.label}</h3>
      <span class="price-value">${item.value}</span>
      <p>${item.detail}</p>
    </article>
  `).join("");
}

function renderResidual(data) {
  text("residualSignal", data.gas.signal);
  text("residualNarrative", data.gas.narrative);

  const gauge = document.getElementById("residualGauge");
  if (gauge) {
    gauge.style.setProperty("--value", `${Math.max(0, Math.min(100, data.gas.share_percent))}%`);
  }
}

function renderCounties(data) {
  const target = document.getElementById("countyList");
  if (!target) return;

  target.innerHTML = data.counties.map(county => `
    <div class="county-item">
      <strong>${county.name}</strong>
      <div class="bar-track">
        <div class="bar-fill" style="width:${county.score}%"></div>
      </div>
      <span>${county.score}</span>
      <small>${county.note}</small>
    </div>
  `).join("");
}


function localEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function heatClass(bucket) {
  return `heat-${bucket || "medium"}`;
}

function renderCountyHosting(data) {
  const heatmap = document.getElementById("countyHeatmap");
  const summaryTarget = document.getElementById("countySummaryCards");
  if (!heatmap && !summaryTarget) return;

  const hosting = data.county_hosting || {};
  const counties = data.counties || [];

  if (heatmap) {
    heatmap.innerHTML = counties.map(county => {
      const row = Number(county.row || 1);
      const col = Number(county.col || 1);
      const score = Number(county.hosting_score ?? county.score ?? 0);
      const cls = heatClass(county.heat_bucket);

      return `
        <button
          class="county-tile ${cls}"
          style="grid-row:${row}; grid-column:${col};"
          type="button"
          title="${localEscapeHtml(county.name)}: ${score}/100 · ${localEscapeHtml(county.note)}"
          aria-label="${localEscapeHtml(county.name)} hosting score ${score} out of 100"
        >
          <strong>${localEscapeHtml(county.code)}</strong>
          <span>${score}</span>
        </button>
      `;
    }).join("");
  }

  if (summaryTarget) {
    const sorted = [...counties].sort((a, b) => Number(b.hosting_score || 0) - Number(a.hosting_score || 0));
    const top = sorted.slice(0, 5);
    const low = sorted.slice(-5).reverse();

    const list = rows => rows.map(c => `
      <li>
        <strong>${localEscapeHtml(c.name)}</strong>
        <span>${Number(c.hosting_score || 0)}/100 · ${localEscapeHtml(c.dominant_technology || "Mixed")}</span>
      </li>
    `).join("");

    summaryTarget.innerHTML = `
      <article class="county-summary-card high">
        <h4>High hosting signal</h4>
        <ul>${list(top)}</ul>
      </article>

      <article class="county-summary-card low">
        <h4>Low-host / demand-adjacent signal</h4>
        <ul>${list(low)}</ul>
      </article>

      <article class="county-summary-card caveat">
        <h4>Method caveat</h4>
        <p>${localEscapeHtml(hosting.caveat || "County hosting index scaffold. SEAI integration pending.")}</p>
      </article>
    `;
  }
}


function renderSourceConsole(data) {
  const target = document.getElementById("sourceConsole");
  if (!target) return;

  const registry = data.source_registry || [];

  target.innerHTML = registry.map(entry => {
    const status = entry.status || {};
    const mode = status.mode || status.parser?.sheet || "not reported";
    const caveat = status.caveat || "No caveat recorded.";
    const harvested = status.harvested_at || status.generated_at || "not reported";
    const source = status.source || entry.name || "Unknown source";
    const url = status.source_url || null;

    return `
      <article class="source-console-card">
        <div class="source-console-top">
          <h4>${escapeHtml(entry.name || "Source")}</h4>
          <span>${escapeHtml(mode)}</span>
        </div>
        <p><strong>Source:</strong> ${
          url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source)}</a>`
            : escapeHtml(source)
        }</p>
        <p><strong>Updated:</strong> ${escapeHtml(harvested)}</p>
        <p class="source-console-caveat">${escapeHtml(caveat)}</p>
      </article>
    `;
  }).join("");
}


function pulseNumber(value, digits = 0) {
  if (!isNumber(value)) return "n/a";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function pulseLast(history, key) {
  const rows = [...(history || [])].reverse();
  for (const row of rows) {
    if (isNumber(row[key])) return Number(row[key]);
  }
  return null;
}

function pulseSeries(history, key, limit = 30) {
  return (history || [])
    .slice(-limit)
    .map(row => isNumber(row[key]) ? Number(row[key]) : null);
}

function sparkline(series) {
  const values = series.filter(v => isNumber(v));
  if (values.length < 2) {
    return `<svg class="pulse-sparkline empty" viewBox="0 0 100 34" aria-hidden="true">
      <line x1="0" y1="24" x2="100" y2="24"></line>
    </svg>`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = [];
  series.forEach((v, i) => {
    if (!isNumber(v)) return;
    const x = series.length === 1 ? 100 : (i / (series.length - 1)) * 100;
    const y = 30 - ((Number(v) - min) / span) * 24;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });

  return `<svg class="pulse-sparkline" viewBox="0 0 100 34" aria-hidden="true">
    <line x1="0" y1="30" x2="100" y2="30"></line>
    <polyline points="${points.join(" ")}"></polyline>
  </svg>`;
}

function pulseCard({label, value, unit, note, key, history, tone = ""}) {
  return `
    <article class="pulse-card ${tone}">
      <div class="pulse-card-top">
        <span>${escapeHtml(label)}</span>
        <strong>${value}<small>${escapeHtml(unit || "")}</small></strong>
      </div>
      ${sparkline(pulseSeries(history, key))}
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}

function renderDailyPulse(data) {
  const target = document.getElementById("dailyPulseGrid");
  if (!target) return;

  const history = data.daily_history || [];
  const e = data.electricity_now || {};
  const drift = data.target_drift || {};
  const prices = data.prices || [];

  const electricityPrice = prices.find(p => p.label === "Household electricity");
  const gasPrice = prices.find(p => p.label === "Household gas");

  // Current display values should come from electricity_now / current monitor first.
  // History is for sparklines and fallback only.
  const demandGw = isNumber(e.demand_mw) ? Number(e.demand_mw) / 1000 : pulseLast(history, "demand_gw");
  const renewables = isNumber(e.renewables_percent) ? e.renewables_percent : pulseLast(history, "renewables_percent");
  const co2 = isNumber(e.co2_g_per_kwh) ? e.co2_g_per_kwh : pulseLast(history, "co2_g_per_kwh");
  const imports = isNumber(e.imports_percent) ? e.imports_percent : pulseLast(history, "imports_percent");
  const residual = isNumber(e.residual_percent ?? e.gas_percent)
    ? (e.residual_percent ?? e.gas_percent)
    : pulseLast(history, "residual_percent");

  const gap = isNumber(drift.gap_to_target_pp) ? drift.gap_to_target_pp : pulseLast(history, "target_gap_pp");

  const electricityPriceValue = isNumber(electricityPrice?.ireland_c_per_kwh)
    ? electricityPrice.ireland_c_per_kwh
    : pulseLast(history, "household_electricity_c_per_kwh");

  const gasPriceValue = isNumber(gasPrice?.ireland_c_per_kwh)
    ? gasPrice.ireland_c_per_kwh
    : pulseLast(history, "household_gas_c_per_kwh");

  target.innerHTML = [
    pulseCard({
      label: "Electricity demand",
      value: pulseNumber(demandGw, 2),
      unit: "GW",
      note: "Latest mapped system demand.",
      key: "demand_gw",
      history
    }),
    pulseCard({
      label: "Renewables now",
      value: pulseNumber(renewables, 0),
      unit: "%",
      note: "Wind and solar in the latest mapped interval.",
      key: "renewables_percent",
      history,
      tone: "good"
    }),
    pulseCard({
      label: "CO₂ now",
      value: pulseNumber(co2, 0),
      unit: "g/kWh",
      note: co2 ? "Latest Smart Grid Dashboard carbon signal; line shows daily snapshots." : "Not available in this build.",
      key: "co2_g_per_kwh",
      history,
      tone: co2 ? "" : "muted"
    }),
    pulseCard({
      label: "Imports",
      value: pulseNumber(imports, 0),
      unit: "%",
      note: "Mapped interconnector contribution.",
      key: "imports_percent",
      history
    }),
    pulseCard({
      label: "Residual supply",
      value: pulseNumber(residual, 0),
      unit: "%",
      note: "Computed remainder, not measured gas.",
      key: "residual_percent",
      history,
      tone: "caution"
    }),
    pulseCard({
      label: "2030 gap",
      value: pulseNumber(gap, 1),
      unit: "pp",
      note: "Percentage-point gap to 80% renewable electricity.",
      key: "target_gap_pp",
      history,
      tone: "risk"
    }),
    pulseCard({
      label: "Electricity price",
      value: pulseNumber(electricityPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_electricity_c_per_kwh",
      history
    }),
    pulseCard({
      label: "Gas price",
      value: pulseNumber(gasPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_gas_c_per_kwh",
      history
    })
  ].join("");
}

function renderMeta(data) {
  const generated = new Date(data.meta.generated_at);

  text("projectStatus", data.meta.status);
  text("projectStatusText", "Static prototype is wired. Next step: GitHub Action harvesters for EirGrid, SEAI, CSO and Gas Networks Ireland.");
  text("dataMode", data.meta.mode);
  text("updatedAt", Number.isNaN(generated.getTime()) ? "Unknown" : generated.toISOString().slice(0, 10));
  text("confidence", data.meta.confidence);
}

function renderStory(data) {
  text("dailyHeadline", data.daily_story.headline);
  text("dailyInterpretation", data.daily_story.interpretation);
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function qualityItem(label, status, detail) {
  return `
    <div class="quality-item ${status}">
      <span class="quality-badge">${status}</span>
      <strong>${escapeHtml(label)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function renderDataQuality(data) {
  const target = document.getElementById("dataQualityList");
  if (!target) return;

  const e = data.electricity_now || {};
  const source = data.source_status || {};
  const parser = source.parser || {};
  const columns = parser.columns || {};
  const components = columns.interconnector_components || [];

  const importsMapped = e.imports_available !== false && (
    columns.imports || components.length
  );

  const co2Mapped = e.co2_available !== false &&
    Number.isFinite(Number(e.co2_g_per_kwh)) &&
    Number(e.co2_g_per_kwh) > 0;

  const rows = [
    qualityItem(
      "Demand",
      columns.demand ? "mapped" : "missing",
      columns.demand || "No demand column detected"
    ),
    qualityItem(
      "Wind",
      columns.wind ? "mapped" : "missing",
      columns.wind || "No wind-generation column detected"
    ),
    qualityItem(
      "Solar",
      columns.solar ? "mapped" : "missing",
      columns.solar || "No solar-generation column detected"
    ),
    qualityItem(
      "Imports",
      importsMapped ? "mapped" : "missing",
      importsMapped
        ? (columns.imports || components.join(" + "))
        : "No net interconnector column mapped"
    ),
    qualityItem(
      "Residual",
      "computed",
      "Demand minus detected wind, solar and mapped positive imports. Not measured gas."
    ),
    qualityItem(
      "CO₂ intensity",
      co2Mapped ? "mapped" : "missing",
      co2Mapped ? (columns.co2 || "Mapped CO₂ column") : "No CO₂ / carbon-intensity column found in current workbook"
    )
  ];

  target.innerHTML = rows.join("");
}

async function init() {
  try {
    const data = await loadMonitor();
    renderMeta(data);
    renderDailyPulse(data);
    renderMetrics(data);
    renderMix(data);
    renderStory(data);
    renderTruthMeter(data);
    renderTrajectory(data);
    renderTargetDrift(data);
    renderPrices(data);
    renderResidual(data);
    renderCounties(data);
    renderDataQuality(data);
    renderCountyHosting(data);
    renderSourceConsole(data);
  } catch (error) {
    console.error(error);
    text("projectStatus", "Data load failed");
    text("projectStatusText", error.message);
  }
}

document.addEventListener("DOMContentLoaded", init);

function initShareTools() {
  const siteUrl = "https://salmonofdoubt.github.io/demos/ireland-energy-monitor/";
  const title = "Ireland Energy Monitor";

  const openLink = document.getElementById("share-open-link");
  if (openLink) openLink.href = siteUrl;

  const copyBtn = document.getElementById("copy-link-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(siteUrl);
        copyBtn.textContent = "✓ Copied";
        setTimeout(() => {
          copyBtn.textContent = "⧉ Copy link";
        }, 1600);
      } catch {
        copyBtn.textContent = "Copy failed";
        setTimeout(() => {
          copyBtn.textContent = "⧉ Copy link";
        }, 1600);
      }
    });
  }

  const nativeBtn = document.getElementById("native-share-btn");
  if (nativeBtn) {
    if (!navigator.share) {
      nativeBtn.style.display = "none";
    } else {
      nativeBtn.addEventListener("click", async () => {
        try {
          await navigator.share({
            title,
            text: "Open civic prototype tracking Ireland's energy transition.",
            url: siteUrl
          });
        } catch {
          /* User cancelled or platform blocked share. No action needed. */
        }
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", initShareTools);

/* v0.9 override: real Ireland county boundary heatmap */
const IEM_COUNTY_CANONICAL = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry",
  "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth",
  "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary",
  "Waterford", "Westmeath", "Wexford", "Wicklow"
];

function iemNormCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^county\s+/, "")
    .replace(/^co\.\s*/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function iemDetectCountyName(properties = {}) {
  const values = Object.values(properties).map(v => String(v || ""));

  for (const county of IEM_COUNTY_CANONICAL) {
    const needle = iemNormCountyName(county);
    if (values.some(v => iemNormCountyName(v).includes(needle))) return county;
  }

  return "";
}

function iemCollectGeoCoords(input, out = []) {
  if (!Array.isArray(input)) return out;

  if (typeof input[0] === "number" && typeof input[1] === "number") {
    out.push([Number(input[0]), Number(input[1])]);
    return out;
  }

  input.forEach(item => iemCollectGeoCoords(item, out));
  return out;
}

function iemGeoBounds(features) {
  const coords = [];
  features.forEach(feature => iemCollectGeoCoords(feature.geometry?.coordinates, coords));

  const xs = coords.map(c => c[0]).filter(isNumber);
  const ys = coords.map(c => c[1]).filter(isNumber);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function iemMakeProjector(bounds, width, height, pad) {
  const scale = Math.min(
    (width - pad * 2) / (bounds.maxX - bounds.minX || 1),
    (height - pad * 2) / (bounds.maxY - bounds.minY || 1)
  );

  const mapW = (bounds.maxX - bounds.minX) * scale;
  const mapH = (bounds.maxY - bounds.minY) * scale;
  const xOffset = (width - mapW) / 2;
  const yOffset = (height - mapH) / 2;

  return ([x, y]) => [
    xOffset + (x - bounds.minX) * scale,
    yOffset + (bounds.maxY - y) * scale
  ];
}

function iemRingPath(ring, project) {
  return ring.map((coord, i) => {
    const [x, y] = project(coord);
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ") + " Z";
}

function iemGeometryPath(geometry, project) {
  if (!geometry) return "";

  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ring => iemRingPath(ring, project)).join(" ");
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .flatMap(poly => poly.map(ring => iemRingPath(ring, project)))
      .join(" ");
  }

  return "";
}

function iemFeatureCentroid(feature, project) {
  const coords = iemCollectGeoCoords(feature.geometry?.coordinates, []);
  if (!coords.length) return [0, 0];

  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);

  return project([
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2
  ]);
}

function iemRenderCountyTileFallback(heatmap, counties) {
  heatmap.classList.remove("ireland-boundary-map");

  heatmap.innerHTML = counties.map(county => {
    const row = Number(county.row || 1);
    const col = Number(county.col || 1);
    const score = Number(county.hosting_score ?? county.score ?? 0);
    const cls = heatClass(county.heat_bucket);

    return `
      <button
        class="county-tile ${cls}"
        style="grid-row:${row}; grid-column:${col};"
        type="button"
        title="${localEscapeHtml(county.name)}: ${score}/100 · ${localEscapeHtml(county.note)}"
        aria-label="${localEscapeHtml(county.name)} hosting score ${score} out of 100"
      >
        <strong>${localEscapeHtml(county.code)}</strong>
        <span>${score}</span>
      </button>
    `;
  }).join("");
}

async function renderCountyHosting(data) {
  const heatmap = document.getElementById("countyHeatmap");
  const summaryTarget = document.getElementById("countySummaryCards");
  if (!heatmap && !summaryTarget) return;

  const hosting = data.county_hosting || {};
  const counties = data.counties || [];
  const byName = new Map(counties.map(c => [iemNormCountyName(c.name), c]));

  if (heatmap) {
    try {
      const response = await fetch("data/source/ireland_counties.geojson", { cache: "force-cache" });
      if (!response.ok) throw new Error(`GeoJSON load failed: ${response.status}`);

      const geojson = await response.json();

      const features = (geojson.features || [])
        .map(feature => ({
          ...feature,
          countyName: iemDetectCountyName(feature.properties || {})
        }))
        .filter(feature => byName.has(iemNormCountyName(feature.countyName)));

      if (!features.length) throw new Error("No matching county features found.");

      const width = 720;
      const height = 760;
      const pad = 34;
      const bounds = iemGeoBounds(features);
      const project = iemMakeProjector(bounds, width, height, pad);

      const paths = features.map(feature => {
        const county = byName.get(iemNormCountyName(feature.countyName));
        const score = Number(county.hosting_score ?? county.score ?? 0);
        const cls = heatClass(county.heat_bucket);
        const d = iemGeometryPath(feature.geometry, project);

        return `
          <path
            class="county-boundary ${cls}"
            d="${d}"
            tabindex="0"
            role="img"
            aria-label="${localEscapeHtml(county.name)} hosting score ${score} out of 100"
          >
            <title>${localEscapeHtml(county.name)}: ${score}/100 · ${localEscapeHtml(county.note)}</title>
          </path>
        `;
      }).join("");

      const labels = features.map(feature => {
        const county = byName.get(iemNormCountyName(feature.countyName));
        const score = Number(county.hosting_score ?? county.score ?? 0);
        const [x, y] = iemFeatureCentroid(feature, project);
        const code = localEscapeHtml(county.code || county.name.slice(0, 2).toUpperCase());

        return `
          <g class="county-map-label" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
            <text class="county-map-code" text-anchor="middle" y="-2">${code}</text>
            <text class="county-map-score" text-anchor="middle" y="15">${score}</text>
          </g>
        `;
      }).join("");

      heatmap.classList.add("ireland-boundary-map");
      heatmap.innerHTML = `
        <svg class="county-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ireland county hosting heatmap using official county geometry">
          <g class="county-map-glow">${paths}</g>
          <g class="county-map-counties">${paths}</g>
          <g class="county-map-labels">${labels}</g>
        </svg>
      `;
    } catch (error) {
      console.warn(error);
      iemRenderCountyTileFallback(heatmap, counties);
    }
  }

  if (summaryTarget) {
    const sorted = [...counties].sort((a, b) => Number(b.hosting_score || 0) - Number(a.hosting_score || 0));
    const top = sorted.slice(0, 5);
    const low = sorted.slice(-5).reverse();

    const list = rows => rows.map(c => `
      <li>
        <strong>${localEscapeHtml(c.name)}</strong>
        <span>${Number(c.hosting_score || 0)}/100 · ${localEscapeHtml(c.dominant_technology || "Mixed")}</span>
      </li>
    `).join("");

    summaryTarget.innerHTML = `
      <article class="county-summary-card high">
        <h4>High hosting signal</h4>
        <ul>${list(top)}</ul>
      </article>

      <article class="county-summary-card low">
        <h4>Low-host / demand-adjacent signal</h4>
        <ul>${list(low)}</ul>
      </article>

      <article class="county-summary-card caveat">
        <h4>Method caveat</h4>
        <p>${localEscapeHtml(hosting.caveat || "County hosting index scaffold. SEAI integration pending.")}</p>
      </article>
    `;
  }
}

/* Force county boundary redraw after normal app init */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("data/monitor.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();

    if (typeof renderCountyHosting === "function") {
      await renderCountyHosting(data);
    }
  } catch (error) {
    console.warn("County boundary redraw failed", error);
  }
});

/* v0.9.1 fix: avoid spread-call stack overflow on large GeoJSON coordinate arrays */
function iemMinMax(values) {
  let min = Infinity;
  let max = -Infinity;

  for (const value of values) {
    const number = Number(value);
    if (!Number.isFinite(number)) continue;
    if (number < min) min = number;
    if (number > max) max = number;
  }

  return { min, max };
}

function iemGeoBounds(features) {
  const coords = [];
  features.forEach(feature => iemCollectGeoCoords(feature.geometry?.coordinates, coords));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [xRaw, yRaw] of coords) {
    const x = Number(xRaw);
    const y = Number(yRaw);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

function iemFeatureCentroid(feature, project) {
  const coords = iemCollectGeoCoords(feature.geometry?.coordinates, []);
  if (!coords.length) return [0, 0];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [xRaw, yRaw] of coords) {
    const x = Number(xRaw);
    const y = Number(yRaw);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return project([
    (minX + maxX) / 2,
    (minY + maxY) / 2
  ]);
}
