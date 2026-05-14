// IETM demand balance sanity helper: BEGIN
function demandPassesBalanceCheck(e) {
  const demandMw = Number(e.demand_mw);
  const generationMw = Number(e.generation_mw);
  const interconnectionMw = Number(e.interconnection_mw || 0);

  if (!Number.isFinite(demandMw) || !Number.isFinite(generationMw)) {
    return false;
  }

  // Positive interconnection_mw = net import, negative = net export.
  const expectedDemandMw = generationMw + interconnectionMw;
  const gapMw = demandMw - expectedDemandMw;

  return Math.abs(gapMw) <= 300;
}

function demandBalanceGapMw(e) {
  const demandMw = Number(e.demand_mw);
  const generationMw = Number(e.generation_mw);
  const interconnectionMw = Number(e.interconnection_mw || 0);

  if (!Number.isFinite(demandMw) || !Number.isFinite(generationMw)) {
    return null;
  }

  return demandMw - (generationMw + interconnectionMw);
}
// IETM demand balance sanity helper: END

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

function formatPowerMw(value, options = {}) {
  const mw = Number(value);
  if (!Number.isFinite(mw)) return "n/a";

  const forceGw = options.forceGw === true;
  const absMw = Math.abs(mw);

  if (forceGw || absMw >= 1000) {
    return `${(mw / 1000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} GW`;
  }

  return `${mw.toLocaleString(undefined, {
    maximumFractionDigits: 0
  })} MW`;
}


function metricAccentKey(label) {
  const key = String(label || "").toLowerCase();

  if (key.includes("thermal")) return "thermal";
  if (key.includes("others")) return "others-calculated";

  if (key.includes("others")) return "other-renewables";

  if (key.includes("thermal")) return "thermal";

  if (key.includes("renewable")) return "renewables";
  if (key.includes("wind")) return "wind";
  if (key.includes("solar")) return "solar";
  if (key.includes("generation")) return "demand";
  if (key.includes("residual")) return "residual";
  if (key.includes("import")) return "imports";
  if (key.includes("demand")) return "demand";
  if (key.includes("co₂") || key.includes("co2") || key.includes("carbon")) return "co2";

  return "neutral";
}

function metricCard(label, value, note, className = "") {
  const accent = metricAccentKey(label);

  return `
    <article class="metric-card ${className}" data-accent="${accent}">
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


// IETM canonical generation mix helper: BEGIN
function iemGenerationMixParts(e) {
  const wind = isNumber(e.wind_percent)
    ? Math.max(0, Math.min(100, Math.round(Number(e.wind_percent))))
    : 0;

  const solar = isNumber(e.solar_percent)
    ? Math.max(0, Math.min(100, Math.round(Number(e.solar_percent))))
    : 0;

  const renewables = isNumber(e.renewables_percent)
    ? Math.max(0, Math.min(100, Math.round(Number(e.renewables_percent))))
    : Math.max(0, Math.min(100, wind + solar));

  const otherRenewables = Math.max(0, renewables - wind - solar);
  const thermalOther = Math.max(0, 100 - renewables);

  return {
    wind,
    solar,
    renewables,
    otherRenewables,
    thermalOther
  };
}
// IETM canonical generation mix helper: END

function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const importsAvailable = e.imports_available !== false;
  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;

  target.innerHTML = [
    metricCard("Demand now", formatPowerMw(e.demand_mw || 0, { forceGw: true }), "Current mapped system demand"),
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

function truthSignalLabel(status) {
  if (status === "on") return "On track";
  if (status === "off") return "Off track";
  return "At risk";
}

function truthContextLabel(item) {
  const signal = truthSignalLabel(item.status);
  const context = item.status_label || "";
  if (!context || context.toLowerCase() === signal.toLowerCase()) return "";
  return context;
}

function renderTruthMeter(data) {
  const target = document.getElementById("truthGrid");
  if (!target) return;

  const scale = `
    <article class="truth-card truth-scale-card">
      <div class="truth-top">
        <h3>Signal scale</h3>
        <span class="truth-status truth-status-scale">Fixed labels</span>
      </div>
      <div class="truth-scale-row" aria-label="Truth meter signal scale">
        <span class="truth-scale-pill on">On track</span>
        <span class="truth-scale-pill risk">At risk</span>
        <span class="truth-scale-pill off">Off track</span>
      </div>
      <p>
        Every module receives exactly one transition signal. Descriptive terms such as
        “Improving”, “Pressured” or “Unclassified” are readings, not final labels.
      </p>
    </article>
  `;

  const cards = (data.truth_meter || []).map(item => {
    const cls = truthClass(item.status);
    const signal = truthSignalLabel(item.status);
    const context = truthContextLabel(item);

    return `
      <article class="truth-card ${cls}">
        <div class="truth-top">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="truth-status truth-status-${cls}">Signal: ${escapeHtml(signal)}</span>
        </div>

        <div class="truth-reading">
          <span>Current reading</span>
          <strong>${escapeHtml(item.value)}</strong>
          ${context ? `<small>${escapeHtml(context)}</small>` : ""}
        </div>

        <p class="truth-logic"><strong>Logic:</strong> ${escapeHtml(item.note)}</p>
      </article>
    `;
  }).join("");

  target.innerHTML = scale + cards;
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

  text("targetGap", `${gap.toFixed(0)} pp path gap`);

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
      <span>2030 target gap</span>
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

function pulseCard({key = "", label, value, unit, note, history, tone = ""}) {
  return `
    <article class="pulse-card ${tone}" data-kpi="${escapeHtml(key || "")}">
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
  const generationGw = isNumber(e.generation_mw) ? Number(e.generation_mw) / 1000 : pulseLast(history, "generation_gw");
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
      key: "generation",
      label: "Generation now",
      value: pulseNumber(generationGw, 2),
      unit: "GW",
      note: "Current production-side signal.",
      key: "generation_gw",
      history
    }),
    ...(demandPassesBalanceCheck(e) ? [pulseCard({
      key: "demand",
      label: "System demand",
      value: pulseNumber(demandGw, 2),
      unit: "GW",
      note: "Current load-side signal.",
      key: "demand_gw",
      history
    })] : []),
    pulseCard({
      key: "renewables",
      label: "Renewables now",
      value: pulseNumber(renewables, 0),
      unit: "%",
      note: "Wind and solar reported; others calculated from renewable total.",
      key: "renewables_percent",
      history,
      tone: "good"
    }),
    pulseCard({
      key: "residual",
      tone: "thermal",
      label: "Residual supply",
      value: pulseNumber(residual, 0),
      unit: "%",
      note: "Non-renewable generation remainder.",
      key: "residual_percent",
      history,
      tone: "caution"
    }),
    pulseCard({
      key: "co2",
      label: "CO₂ now",
      value: pulseNumber(co2, 0),
      unit: "g/kWh",
      note: co2 ? "Latest Smart Grid Dashboard carbon signal; line shows daily snapshots." : "Not available in this build.",
      key: "co2_g_per_kwh",
      history,
      tone: co2 ? "" : "muted"
    }),
    pulseCard({
      key: "interconnection",
      label: "Imports",
      value: pulseNumber(imports, 0),
      unit: "%",
      note: "Mapped interconnector contribution.",
      key: "imports_percent",
      history
    }),
    pulseCard({
      key: "target-gap",
      label: "2030 target gap",
      value: pulseNumber(gap, 1),
      unit: "pp",
      note: "Percentage-point gap to 80% renewable electricity.",
      key: "target_gap_pp",
      history,
      tone: "risk"
    }),
    pulseCard({
      key: "electricity-price",
      label: "Electricity price",
      value: pulseNumber(electricityPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_electricity_c_per_kwh",
      history
    }),
    pulseCard({
      key: "gas-price",
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

// IETM demand pressure renderer: BEGIN
function renderDemandPressure(data) {
  const target = document.getElementById("demandPressureGrid");
  if (!target) return;

  const pressure = data.demand_pressure || {};
  const cards = pressure.cards || [];

  target.innerHTML = cards.map(card => `
    <article class="demand-pressure-card ${escapeHtml(card.tone || "")}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.subtitle || "")}</small>
      <p>${escapeHtml(card.detail || "")}</p>
      <em>${escapeHtml(card.source || "")}</em>
    </article>
  `).join("");

  const contrast = document.getElementById("demandPressureContrast");
  if (contrast) {
    contrast.textContent = pressure.contrast || "";
  }

  const note = document.getElementById("demandPressureNote");
  if (note) {
    note.innerHTML = `
      <strong>How to read this:</strong> ${escapeHtml(pressure.unit_note || "")}
      <br>
      <strong>Caveat:</strong> ${escapeHtml(pressure.caveat || "")}
    `;
  }
}
// IETM demand pressure renderer: END

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
    renderDemandPressure(data);
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
  const siteUrl = "https://salmonofdoubt.github.io/demo/ietm/";
  const title = "Ireland Energy Transition Monitor";

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

/* v0.12 trajectory chart and KPI readability upgrade */
function iemFmt(value, digits = 1) {
  if (!isNumber(value)) return "n/a";
  return Number(value).toFixed(digits);
}

function iemTrajectoryMetric(label, value, unit, note, tone = "") {
  return `
    <article class="trajectory-metric ${tone}">
      <span class="trajectory-metric-label">${escapeHtml(label)}</span>
      <strong class="trajectory-metric-value">
        ${escapeHtml(value)}${unit ? `<small>${escapeHtml(unit)}</small>` : ""}
      </strong>
      <em class="trajectory-metric-note">${escapeHtml(note || "")}</em>
    </article>
  `;
}

function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory || [];
  if (!rows.length) return;

  const width = 920;
  const height = 330;
  const plotLeft = 56;
  const plotRight = 26;
  const plotTop = 26;
  const plotBottom = 42;
  const plotWidth = width - plotLeft - plotRight;
  const plotHeight = height - plotTop - plotBottom;

  const startYear = Math.min(...rows.map(d => Number(d.year)).filter(isNumber));
  const endYear = Math.max(...rows.map(d => Number(d.year)).filter(isNumber));
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  );

  const yMin = 20;
  const yMax = 85;
  const yTicks = [20, 35, 50, 65, 80];

  const x = year => plotLeft + ((Number(year) - startYear) / (endYear - startYear)) * plotWidth;
  const y = value => plotTop + (1 - ((Number(value) - yMin) / (yMax - yMin))) * plotHeight;

  const pathFrom = (items, key) => items
    .filter(d => d[key] !== null && isNumber(d[key]))
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d[key]).toFixed(2)}`)
    .join(" ");

  const targetPath = pathFrom(rows, "target");
  const actualRows = rows.filter(d => d.actual !== null && isNumber(d.actual));
  const actualPath = pathFrom(actualRows, "actual");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = latest ? rows.find(d => Number(d.year) === Number(latest.year)) : null;
  const gap = sameYear && isNumber(sameYear.target) && isNumber(latest.actual)
    ? Number(sameYear.target) - Number(latest.actual)
    : null;

  if (isNumber(gap)) {
    text("targetGap", `${gap.toFixed(0)} pp path gap`);
  }

  const verticalGrid = years.map(year => {
    const xx = x(year);
    const label = year % 2 === 0 || year === startYear || year === endYear;
    return `
      <line class="trajectory-grid-v" x1="${xx}" y1="${plotTop}" x2="${xx}" y2="${plotTop + plotHeight}"></line>
      <line class="trajectory-tick" x1="${xx}" y1="${plotTop + plotHeight}" x2="${xx}" y2="${plotTop + plotHeight + 5}"></line>
      ${label ? `<text class="trajectory-axis-text" x="${xx}" y="${plotTop + plotHeight + 23}" text-anchor="middle">${year}</text>` : ""}
    `;
  }).join("");

  const horizontalGrid = yTicks.map(tick => {
    const yy = y(tick);
    return `
      <line class="trajectory-grid-h" x1="${plotLeft}" y1="${yy}" x2="${plotLeft + plotWidth}" y2="${yy}"></line>
      <text class="trajectory-axis-text" x="${plotLeft - 12}" y="${yy + 4}" text-anchor="end">${tick}%</text>
    `;
  }).join("");

  const targetDots = rows
    .filter(d => d.target !== null && isNumber(d.target))
    .map(d => `<circle class="trajectory-dot target-dot" cx="${x(d.year)}" cy="${y(d.target)}" r="3"></circle>`)
    .join("");

  const actualDots = actualRows
    .map(d => `<circle class="trajectory-dot actual-dot" cx="${x(d.year)}" cy="${y(d.actual)}" r="4"></circle>`)
    .join("");

  target.innerHTML = `
    <svg class="trajectory-svg-v2" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <rect class="trajectory-plot-bg" x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}"></rect>

      <g class="trajectory-grid">
        ${horizontalGrid}
        ${verticalGrid}
      </g>

      <path class="trajectory-line-required" d="${targetPath}"></path>
      <path class="trajectory-line-observed" d="${actualPath}"></path>

      <g>${targetDots}</g>
      <g>${actualDots}</g>

      <text class="trajectory-legend-text" x="${width - 235}" y="32">Dashed: required path</text>
      <text class="trajectory-legend-text" x="${width - 235}" y="50">Solid: observed path</text>
    </svg>
  `;
}

function renderTargetDrift(data) {
  const target = document.getElementById("targetDriftGrid");
  if (!target) return;

  const drift = data.target_drift || {};
  if (!Object.keys(drift).length) {
    target.innerHTML = "";
    return;
  }

  target.className = "trajectory-metrics";

  const status = String(drift.status_label || "Unknown");
  const statusTone = drift.status === "off" ? "off" : drift.status === "on" ? "on" : "risk";

  target.innerHTML = `
    ${iemTrajectoryMetric(
      "Latest official RES-E",
      iemFmt(drift.latest_value, 1),
      "%",
      String(drift.latest_year || "")
    )}

    ${iemTrajectoryMetric(
      "2030 benchmark",
      iemFmt(drift.target_value, 0),
      "%",
      "Renewable electricity"
    )}

    ${iemTrajectoryMetric(
      "Gap to target",
      iemFmt(drift.gap_to_target_pp, 1),
      "pp",
      `${drift.years_remaining || "—"} years remaining`,
      statusTone
    )}

    ${iemTrajectoryMetric(
      "Required gain",
      iemFmt(drift.required_annual_gain_pp, 2),
      "pp/yr",
      `From ${drift.latest_year || "latest"} to ${drift.target_year || 2030}`,
      statusTone
    )}

    ${iemTrajectoryMetric(
      "Recent gain",
      iemFmt(drift.recent_two_year_gain_pp_per_year, 2),
      "pp/yr",
      "Two-year average",
      statusTone
    )}

    <article class="trajectory-metric trajectory-status ${statusTone}">
      <span class="trajectory-metric-label">Status</span>
      <strong class="trajectory-status-value">${escapeHtml(status)}</strong>
      <em class="trajectory-metric-note">${escapeHtml(drift.caveat || "")}</em>
    </article>
  `;
}

/* v0.16 Daily market price layer */
async function loadMarketPrices() {
  try {
    const response = await fetch("data/source/market_prices.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`market_prices.json ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Daily market price layer unavailable", error);
    return null;
  }
}

function marketStatusClass(status) {
  if (status === "mapped") return "mapped";
  if (status === "not-parsed") return "risk";
  return "missing";
}

function renderMarketPriceCard(item) {
  const cls = marketStatusClass(item.status);
  const stats = item.stats || {};
  const avg = isNumber(stats.daily_average_eur_per_mwh)
    ? `<small>Daily average: ${Number(stats.daily_average_eur_per_mwh).toFixed(2)} €/MWh</small>`
    : "";

  return `
    <article class="market-price-card ${cls}">
      <div class="market-price-top">
        <h3>${escapeHtml(item.label)}</h3>
        <span>${escapeHtml(item.status || "unknown")}</span>
      </div>
      <strong>${escapeHtml(item.value || "n/a")}</strong>
      ${avg}
      <p>${escapeHtml(item.detail || "")}</p>
      <a href="${escapeHtml(item.source_url || "#")}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(item.source || "Source")}
      </a>
    </article>
  `;
}

async function renderMarketPrices() {
  const target = document.getElementById("marketPriceGrid");
  if (!target) return;

  const data = await loadMarketPrices();

  if (!data || !Array.isArray(data.market_prices)) {
    target.innerHTML = `
      <article class="market-price-card missing">
        <div class="market-price-top">
          <h3>Daily market prices</h3>
          <span>missing</span>
        </div>
        <strong>n/a</strong>
        <p>market_prices.json was not available in this build.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = data.market_prices.map(renderMarketPriceCard).join("");
}

document.addEventListener("DOMContentLoaded", renderMarketPrices);

/* v0.17 clearer market/system price rendering */
function iemMarketNumberParts(item) {
  const raw = item?.numeric_value;

  if (!isNumber(raw)) {
    return {
      value: "n/a",
      unit: item?.unit || "",
      unavailable: true
    };
  }

  const unit = item?.unit || "";
  const digits = unit.includes("MWh") ? 2 : 2;

  return {
    value: Number(raw).toLocaleString("en-IE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }),
    unit,
    unavailable: false
  };
}

function iemMarketPlainStatus(item) {
  if (item.status === "mapped") return "System signal";
  if (item.status === "not-parsed") return "Unavailable";
  if (item.status === "planned") return "Planned";
  if (item.status === "missing") return "Unavailable";
  return item.status || "Unknown";
}

function iemMarketCardTitle(item) {
  if ((item.label || "").toLowerCase().includes("gas")) return "Gas balancing price";
  if ((item.label || "").toLowerCase().includes("electricity")) return "Electricity market price";
  return item.label || "Market signal";
}

function renderMarketPriceCard(item) {
  const cls = marketStatusClass(item.status);
  const parts = iemMarketNumberParts(item);
  const status = iemMarketPlainStatus(item);
  const title = iemMarketCardTitle(item);

  const avg = item?.stats && isNumber(item.stats.daily_average_eur_per_mwh)
    ? `<small class="market-price-subnote">Daily average: ${Number(item.stats.daily_average_eur_per_mwh).toFixed(2)} €/MWh</small>`
    : "";

  const source = item?.source || "Source";
  const sourceUrl = item?.source_url || "#";

  const explanation = parts.unavailable
    ? "Installed but not yet producing a trustworthy public value. The monitor shows n/a rather than turning dates, labels or page noise into fake prices."
    : (item.detail || "Short-term market/system signal. Not a household tariff.");

  return `
    <article class="market-price-card ${cls}">
      <div class="market-price-top">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(status)}</span>
      </div>

      <div class="market-price-value-wrap">
        <strong>${escapeHtml(parts.value)}</strong>
        ${parts.unit ? `<small>${escapeHtml(parts.unit)}</small>` : ""}
      </div>

      ${avg}

      <p>${escapeHtml(explanation)}</p>

      <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(source)}
      </a>
    </article>
  `;
}

/* Re-render after the earlier market renderer, so the clearer card wins. */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderMarketPrices, 0);
});

/* v0.19 market price null handling: null is n/a, not 0.00 */
function iemMarketNumberParts(item) {
  const raw = item?.numeric_value;

  if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw))) {
    return {
      value: "n/a",
      unit: item?.unit || "",
      unavailable: true
    };
  }

  const unit = item?.unit || "";
  const digits = unit.includes("MWh") ? 2 : 2;

  return {
    value: Number(raw).toLocaleString("en-IE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }),
    unit,
    unavailable: false
  };
}

/* force final market re-render after all overrides */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderMarketPrices, 80);
});

/* v0.20 hide empty rendered panel shells */
function hideEmptyPanelShells() {
  document.querySelectorAll(".panel, .status-card, .truth-card, .price-card, .market-price-card").forEach(panel => {
    const text = (panel.textContent || "").replace(/\s+/g, " ").trim();
    const hasVisual = panel.querySelector("svg, canvas, img, button, a, input, select, textarea");
    const hasImportantContainer = panel.querySelector("#countyHeatmap, #trajectoryChart, #fuelMixBars, #truthGrid, #marketPriceGrid");

    if (!text && !hasVisual && !hasImportantContainer) {
      panel.classList.add("hidden-empty-panel");
      panel.setAttribute("aria-hidden", "true");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(hideEmptyPanelShells, 120);
  setTimeout(hideEmptyPanelShells, 600);
});

/* v0.31 compact mobile polish for quick links + share */
(function () {
  function byHeadingText(label) {
    const wanted = String(label || "").trim().toLowerCase();
    const candidates = Array.from(document.querySelectorAll("article, section, .panel, .card, .module, .box, div"));
    return candidates.find(el => {
      const heading = el.querySelector("h1, h2, h3, h4, .panel-title, .section-kicker, .eyebrow");
      return heading && heading.textContent.trim().toLowerCase().includes(wanted);
    });
  }

  function makeQuickLinksCompact() {
    const panel = byHeadingText("quick links");
    if (!panel || panel.dataset.quickLinksPolished === "1") return;
    panel.dataset.quickLinksPolished = "1";
    panel.classList.add("quick-links-polished");

    const clickable = Array.from(panel.querySelectorAll("a, button"))
      .filter(el => {
        const t = (el.textContent || "").trim().toLowerCase();
        return t && !t.includes("github") && !t.includes("code") && !t.includes("issues") && !t.includes("discussions");
      });

    const buy = clickable.find(el => /buy me a coffee/i.test(el.textContent || ""));
    const feedback = clickable.find(el => /send feedback|feedback/i.test(el.textContent || ""));

    if (buy && feedback && !panel.querySelector(".quick-links-duo")) {
      const duo = document.createElement("div");
      duo.className = "quick-links-duo";
      buy.parentNode.insertBefore(duo, buy);
      duo.appendChild(buy);
      duo.appendChild(feedback);
    }

    const doiHost = Array.from(panel.querySelectorAll("*")).find(el => {
      const t = (el.textContent || "").trim().toLowerCase();
      return t.includes("archived release") || t.includes("zenodo") || t.includes("doi");
    });

    if (doiHost) {
      const strip = doiHost.closest(".doi-strip, .zenodo-strip, .badge-strip, .meta-strip, .panel, div") || doiHost;
      strip.classList.add("zenodo-strip-compact");
    }
  }

  function makeShareCompact() {
    const panel = byHeadingText("share");
    if (!panel || panel.dataset.sharePolished === "1") return;
    panel.dataset.sharePolished = "1";
    panel.classList.add("share-polished");

    const qr = panel.querySelector("img, canvas, svg");
    const actions = Array.from(panel.querySelectorAll("a, button"))
      .filter(el => !qr || !qr.contains(el));

    if (!panel.querySelector(".share-layout")) {
      const layout = document.createElement("div");
      layout.className = "share-layout";

      const left = document.createElement("div");
      left.className = "share-actions";

      const right = document.createElement("div");
      right.className = "share-qr-box";

      const firstButton = actions[0];
      if (firstButton) {
        firstButton.parentNode.insertBefore(layout, firstButton);
      } else if (qr) {
        qr.parentNode.insertBefore(layout, qr);
      } else {
        panel.appendChild(layout);
      }

      actions.forEach(el => left.appendChild(el));
      if (qr) right.appendChild(qr);

      layout.appendChild(left);
      layout.appendChild(right);
    }
  }

  function polishSecondaryPanels() {
    makeQuickLinksCompact();
    makeShareCompact();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(polishSecondaryPanels, 80);
    setTimeout(polishSecondaryPanels, 500);
  });
})();

/* v0.36 Live electricity source badge */
async function renderElectricityLiveBadge() {
  try {
    const response = await fetch("data/monitor.json", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    const e = data.electricity_now || {};

    const todaySection = document.getElementById("today");
    const head = todaySection?.querySelector(".section-head");
    if (!head || head.querySelector(".electricity-live-badge-row")) return;

    const live = e.smartgrid_live_available === true;
    const source = e.source_label || "Electricity source";
    const when = e.smartgrid_live_harvested_at || e.electricity_datetime || "";

    let timeText = "";
    if (when) {
      try {
        const d = new Date(when);
        if (!Number.isNaN(d.getTime())) {
          timeText = d.toLocaleString("en-IE", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      } catch {
        timeText = "";
      }
    }

    const row = document.createElement("div");
    row.className = "electricity-live-badge-row";
    row.innerHTML = `
      <span class="electricity-live-badge ${live ? "is-live" : "is-fallback"}">
        <i aria-hidden="true"></i>
        ${live ? "Live from Smart Grid Dashboard" : "Fallback electricity source"}
      </span>
      <span class="electricity-live-meta">
        ${escapeHtml(source)}${timeText ? ` · ${escapeHtml(timeText)}` : ""}
      </span>
    `;

    const paragraph = head.querySelector("p:not(.eyebrow)");
    if (paragraph) {
      paragraph.insertAdjacentElement("afterend", row);
    } else {
      head.appendChild(row);
    }
  } catch (error) {
    console.warn("Electricity live badge failed", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderElectricityLiveBadge, 120);
  setTimeout(renderElectricityLiveBadge, 700);
});

/* v0.36 Live electricity source badge */
async function renderElectricityLiveBadge() {
  try {
    const response = await fetch("data/monitor.json", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    const e = data.electricity_now || {};

    const todaySection = document.getElementById("today");
    const head = todaySection?.querySelector(".section-head");
    if (!head || head.querySelector(".electricity-live-badge-row")) return;

    const live = e.smartgrid_live_available === true;
    const source = e.source_label || "Electricity source";
    const when = e.smartgrid_live_harvested_at || e.electricity_datetime || "";

    let timeText = "";
    if (when) {
      try {
        const d = new Date(when);
        if (!Number.isNaN(d.getTime())) {
          timeText = d.toLocaleString("en-IE", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      } catch {
        timeText = "";
      }
    }

    const row = document.createElement("div");
    row.className = "electricity-live-badge-row";
    row.innerHTML = `
      <span class="electricity-live-badge ${live ? "is-live" : "is-fallback"}">
        <i aria-hidden="true"></i>
        ${live ? "Live from Smart Grid Dashboard" : "Fallback electricity source"}
      </span>
      <span class="electricity-live-meta">
        ${escapeHtml(source)}${timeText ? ` · ${escapeHtml(timeText)}` : ""}
      </span>
    `;

    const paragraph = head.querySelector("p:not(.eyebrow)");
    if (paragraph) {
      paragraph.insertAdjacentElement("afterend", row);
    } else {
      head.appendChild(row);
    }
  } catch (error) {
    console.warn("Electricity live badge failed", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderElectricityLiveBadge, 120);
  setTimeout(renderElectricityLiveBadge, 700);
});

/* v0.37 Daily pulse history-note */
async function renderDailyHistoryNote() {
  try {
    const response = await fetch("data/history/daily.json", { cache: "no-store" });
    if (!response.ok) return;

    const history = await response.json();
    const rows = Array.isArray(history.daily) ? history.daily : [];
    const last30 = rows.slice(-30);
    const estimated = last30.filter(row => row.estimated_backfill).length;
    const observed = last30.length - estimated;

    const pulse = document.getElementById("pulse");
    const head = pulse?.querySelector(".section-head");
    if (!head || head.querySelector(".history-note-pill")) return;

    const pill = document.createElement("p");
    pill.className = "history-note-pill";

    if (last30.length >= 30 && estimated > 0) {
      pill.textContent = `30-day sparkline · ${observed} observed · ${estimated} estimated warm-start`;
    } else if (last30.length >= 30) {
      pill.textContent = "30-day sparkline · observed daily snapshots";
    } else {
      pill.textContent = `Building 30-day sparkline · ${last30.length} daily snapshots`;
    }

    const p = head.querySelector("p:not(.eyebrow)");
    if (p) p.insertAdjacentElement("afterend", pill);
    else head.appendChild(pill);
  } catch (error) {
    console.warn("Daily history note failed", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderDailyHistoryNote, 120);
  setTimeout(renderDailyHistoryNote, 700);
});

/* v0.38 pulse display guard: no negative zero, no negative percentages */
function pulseNumber(value, digits = 0) {
  if (!isNumber(value)) return "n/a";

  let n = Number(value);

  // Avoid -0, especially for percentages rounded to 0 decimals.
  if (Math.abs(n) < Math.pow(10, -digits) / 2) {
    n = 0;
  }

  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

/* v0.38 robust daily history note for 30-day warm-start */
async function renderDailyHistoryNote() {
  try {
    const response = await fetch("data/history/daily.json", { cache: "no-store" });
    if (!response.ok) return;

    const history = await response.json();
    const rows = Array.isArray(history.daily) ? history.daily : [];
    const last30 = rows.slice(-30);
    const estimated = last30.filter(row => row.estimated_backfill).length;
    const observed = last30.length - estimated;

    const pulse = document.getElementById("pulse") || document.querySelector(".pulse-section") || document.querySelector("#dailyPulseGrid")?.closest("section");
    if (!pulse) return;

    let anchor =
      pulse.querySelector(".section-head") ||
      pulse.querySelector("h2")?.parentElement ||
      pulse;

    let pill = pulse.querySelector(".history-note-pill");
    if (!pill) {
      pill = document.createElement("p");
      pill.className = "history-note-pill";
    }

    if (last30.length >= 30 && estimated > 0) {
      pill.textContent = `30-day sparkline · ${observed} observed · ${estimated} estimated warm-start`;
    } else if (last30.length >= 30) {
      pill.textContent = "30-day sparkline · observed daily snapshots";
    } else {
      pill.textContent = `Building 30-day sparkline · ${last30.length} daily snapshots`;
    }

    const h = anchor.querySelector("h2, h3");
    if (h && !pill.isConnected) {
      h.insertAdjacentElement("afterend", pill);
    } else if (!pill.isConnected) {
      anchor.prepend(pill);
    }
  } catch (error) {
    console.warn("Daily history note failed", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderDailyHistoryNote, 180);
  setTimeout(renderDailyHistoryNote, 900);
});

/* v0.39 Truth Meter flagship renderer */
function truthSignalWord(status) {
  if (status === "on") return "On track";
  if (status === "off") return "Off track";
  return "At risk";
}

function truthBasisClass(basis) {
  const b = String(basis || "").toLowerCase();
  if (b.includes("live")) return "live";
  if (b.includes("official")) return "official";
  if (b.includes("computed")) return "computed";
  if (b.includes("placeholder") || b.includes("proxy")) return "proxy";
  return "unknown";
}

function renderTruthMeter(data) {
  const target = document.getElementById("truthGrid");
  if (!target) return;

  const items = data.truth_meter || [];
  const summary = data.truth_summary || {};

  const counts = summary.counts || items.reduce((acc, item) => {
    acc[item.status || "risk"] = (acc[item.status || "risk"] || 0) + 1;
    return acc;
  }, { on: 0, risk: 0, off: 0 });

  const overall = summary.overall_status || (
    (counts.off || 0) > 0 ? "risk" : (counts.risk || 0) > 0 ? "risk" : "on"
  );

  const summaryCard = `
    <article class="truth-summary-card ${truthClass(overall)}">
      <div class="truth-summary-main">
        <span>Overall transition signal</span>
        <strong>${escapeHtml(summary.overall_label || truthSignalWord(overall))}</strong>
      </div>
      <div class="truth-summary-counts" aria-label="Truth meter signal counts">
        <span class="on">${counts.on || 0} on track</span>
        <span class="risk">${counts.risk || 0} at risk</span>
        <span class="off">${counts.off || 0} off track</span>
      </div>
      <p>
        Main drag: <strong>${escapeHtml(summary.main_drag || "None")}</strong>.
        Best signal: <strong>${escapeHtml(summary.best_signal || "None")}</strong>.
      </p>
    </article>
  `;

  const legend = `
    <div class="truth-legend-strip" aria-label="Signal scale">
      <span>Signal scale</span>
      <b class="on">On track</b>
      <b class="risk">At risk</b>
      <b class="off">Off track</b>
    </div>
  `;

  const cards = items.map(item => {
    const cls = truthClass(item.status);
    const basisCls = truthBasisClass(item.basis);

    return `
      <article class="truth-card truth-instrument-card ${cls}">
        <div class="truth-card-head">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="truth-status truth-status-${cls}">${escapeHtml(truthSignalWord(item.status))}</span>
        </div>

        <div class="truth-value-row">
          <strong>${escapeHtml(item.value)}</strong>
          <span>${escapeHtml(item.reading || "Current reading")}</span>
        </div>

        <div class="truth-rule-box">
          <span>Rule</span>
          <p>${escapeHtml(item.rule || item.note || "")}</p>
        </div>

        <div class="truth-evidence-row">
          <span class="truth-evidence ${basisCls}">${escapeHtml(item.basis || "Evidence")}</span>
          <span class="truth-confidence">Confidence: ${escapeHtml(item.confidence || "Medium")}</span>
        </div>

        <p class="truth-why"><strong>Why:</strong> ${escapeHtml(item.why || item.note || "")}</p>
        <p class="truth-logic"><strong>Logic:</strong> ${escapeHtml(item.logic || item.note || "")}</p>
      </article>
    `;
  }).join("");

  target.innerHTML = summaryCard + legend + cards;
}

/* v0.40 observed-only pulse deltas and clearer target-gap labelling */
function iemObservedRows(history) {
  return (history || []).filter(row => !row.estimated_backfill);
}

function iemCleanNumber(value, digits = 0) {
  if (!isNumber(value)) return null;
  let n = Number(value);
  if (Math.abs(n) < Math.pow(10, -digits) / 2) n = 0;
  return n;
}

function iemDelta(history, key, options = {}) {
  const {
    digits = 0,
    unit = "",
    goodWhen = "up",
    label = "vs prior observed"
  } = options;

  const rows = iemObservedRows(history).filter(row => isNumber(row[key]));
  if (rows.length < 2) return "";

  const previous = Number(rows[rows.length - 2][key]);
  const current = Number(rows[rows.length - 1][key]);
  let diff = current - previous;

  if (Math.abs(diff) < Math.pow(10, -digits) / 2) diff = 0;

  const sign = diff > 0 ? "+" : "";
  const value = `${sign}${diff.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${unit ? ` ${unit}` : ""}`;

  let tone = "flat";
  if (diff !== 0) {
    if (goodWhen === "down") tone = diff < 0 ? "good" : "bad";
    else if (goodWhen === "neutral") tone = "neutral";
    else tone = diff > 0 ? "good" : "bad";
  }

  return `<small class="pulse-delta ${tone}">Δ ${value} ${escapeHtml(label)}</small>`;
}

function pulseCard({label, value, unit, note, key, history, tone = "", delta = ""}) {
  return `
    <article class="pulse-card ${tone}" data-kpi="${escapeHtml(key || "")}">
      <div class="pulse-card-top">
        <span>${escapeHtml(label)}</span>
        <strong>${value}<small>${escapeHtml(unit || "")}</small></strong>
      </div>
      ${sparkline(pulseSeries(history, key))}
      <p>${escapeHtml(note)}</p>
      ${delta || ""}
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

  const generationGw = isNumber(e.generation_mw) ? Number(e.generation_mw) / 1000 : pulseLast(history, "generation_gw");
  const demandGw = isNumber(e.demand_mw) ? Number(e.demand_mw) / 1000 : pulseLast(history, "demand_gw");
  const renewables = isNumber(e.renewables_percent) ? e.renewables_percent : pulseLast(history, "renewables_percent");
  const co2 = isNumber(e.co2_g_per_kwh) ? e.co2_g_per_kwh : pulseLast(history, "co2_g_per_kwh");

  const importsRaw = isNumber(e.imports_percent) ? Number(e.imports_percent) : pulseLast(history, "imports_percent");
  const imports = iemCleanNumber(Math.max(0, Number(importsRaw || 0)), 0);

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
      key: "demand",
      label: "Generation now",
      value: pulseNumber(demandGw, 2),
      unit: "GW",
      note: "Current production-side signal.",
      key: "demand_gw",
      history,
      delta: iemDelta(history, "demand_gw", { digits: 2, unit: "GW", goodWhen: "neutral" })
    }),
    pulseCard({
      key: "renewables",
      label: "Renewables now",
      value: pulseNumber(renewables, 0),
      unit: "%",
      note: "Wind and solar reported; others calculated from renewable total.",
      key: "renewables_percent",
      history,
      tone: "good",
      delta: iemDelta(history, "renewables_percent", { digits: 1, unit: "pp", goodWhen: "up" })
    }),
    pulseCard({
      key: "co2",
      label: "CO₂ now",
      value: pulseNumber(co2, 0),
      unit: "g/kWh",
      note: co2 ? "Latest Smart Grid Dashboard carbon signal; line shows daily snapshots." : "Not available in this build.",
      key: "co2_g_per_kwh",
      history,
      tone: co2 ? "" : "muted",
      delta: iemDelta(history, "co2_g_per_kwh", { digits: 0, unit: "g/kWh", goodWhen: "down" })
    }),
    pulseCard({
      key: "interconnection",
      label: "Imports",
      value: pulseNumber(imports, 0),
      unit: "%",
      note: "Mapped interconnector import contribution. Exports are not negative imports.",
      key: "imports_percent",
      history,
      delta: iemDelta(history, "imports_percent", { digits: 1, unit: "pp", goodWhen: "neutral" })
    }),
    pulseCard({
      key: "residual",
      label: "Residual supply",
      value: pulseNumber(residual, 0),
      unit: "%",
      note: "Non-renewable generation remainder.",
      key: "residual_percent",
      history,
      tone: "caution",
      delta: iemDelta(history, "residual_percent", { digits: 1, unit: "pp", goodWhen: "down" })
    }),
    pulseCard({
      key: "target-gap",
      label: "2030 target gap",
      value: pulseNumber(gap, 1),
      unit: "pp",
      note: "Official annual gap to 80% renewable electricity, not a live 30-day signal.",
      key: "target_gap_pp",
      history,
      tone: "risk"
    }),
    pulseCard({
      key: "electricity-price",
      label: "Electricity price",
      value: pulseNumber(electricityPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_electricity_c_per_kwh",
      history
    }),
    pulseCard({
      key: "gas-price",
      label: "Gas price",
      value: pulseNumber(gasPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_gas_c_per_kwh",
      history
    })
  ].join("");
}

function iemClarifyGapPills() {
  const targetGap = document.getElementById("targetGap");
  if (targetGap) {
    targetGap.title = "Indicative path gap inside the trajectory chart, not the official 2030 target gap.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(iemClarifyGapPills, 200);
  setTimeout(iemClarifyGapPills, 900);
});

/* v0.41 Trajectory status sidecar: move Off track out of numeric silos */
function renderTargetDrift(data) {
  const target = document.getElementById("targetDriftGrid");
  if (!target) return;

  const drift = data.target_drift || {};
  if (!Object.keys(drift).length) {
    target.innerHTML = "";
    return;
  }

  const statusClass = driftStatusClass(drift.status);
  const latestValue = Number(drift.latest_value);
  const targetValue = Number(drift.target_value);
  const gapValue = Number(drift.gap_to_target_pp);
  const requiredGain = Number(drift.required_annual_gain_pp);
  const recentGain = Number(drift.recent_two_year_gain_pp_per_year);

  target.innerHTML = `
    <article class="target-drift-card">
      <span>Latest official RES-E</span>
      <strong>${targetMetricValue(latestValue.toFixed(1), "%")}</strong>
      <small>${escapeHtml(drift.latest_year)}</small>
    </article>

    <article class="target-drift-card">
      <span>2030 benchmark</span>
      <strong>${targetMetricValue(targetValue.toFixed(0), "%")}</strong>
      <small>Renewable electricity</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>2030 target gap</span>
      <strong>${targetMetricValue(gapValue.toFixed(1), "pp")}</strong>
      <small>${escapeHtml(drift.years_remaining)} years remaining</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Required gain</span>
      <strong>${targetMetricValue(requiredGain.toFixed(2), "pp/yr")}</strong>
      <small>From ${escapeHtml(drift.latest_year)} to ${escapeHtml(drift.target_year)}</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Recent gain</span>
      <strong>${targetMetricValue(recentGain.toFixed(2), "pp/yr")}</strong>
      <small>Two-year average</small>
    </article>
  `;

  renderTargetStatusSidecar(drift);
}

function renderTargetStatusSidecar(drift) {
  const residualSignal = document.getElementById("residualSignal");
  const panel = residualSignal?.closest(".panel");
  if (!panel) return;

  const existing = panel.querySelector(".target-status-sidecar");
  if (existing) existing.remove();

  const statusClass = driftStatusClass(drift.status);
  const requiredGain = Number(drift.required_annual_gain_pp);
  const recentGain = Number(drift.recent_two_year_gain_pp_per_year);
  const gapValue = Number(drift.gap_to_target_pp);

  const sidecar = document.createElement("article");
  sidecar.className = `target-status-sidecar ${statusClass}`;
  sidecar.innerHTML = `
    <div class="target-status-sidecar-top">
      <span>2030 trajectory status</span>
      <strong>${escapeHtml(drift.status_label || "Status")}</strong>
    </div>

    <p>
      Ireland is <strong>${gapValue.toFixed(1)} percentage points</strong> below the
      2030 renewable-electricity benchmark. Recent progress is
      <strong>${recentGain.toFixed(2)} pp/yr</strong>, while the required path is
      <strong>${requiredGain.toFixed(2)} pp/yr</strong>.
    </p>

    <div class="target-status-mini-grid">
      <div>
        <span>Gap</span>
        <strong>${gapValue.toFixed(1)} pp</strong>
      </div>
      <div>
        <span>Speed needed</span>
        <strong>${requiredGain.toFixed(2)} pp/yr</strong>
      </div>
      <div>
        <span>Recent speed</span>
        <strong>${recentGain.toFixed(2)} pp/yr</strong>
      </div>
    </div>

    <small>${escapeHtml(drift.caveat || "Official annual RES-E indicator, not live quarter-hourly electricity mix.")}</small>
  `;

  panel.appendChild(sidecar);
}

/* v0.45 Structural governance: canonical metrics, interconnection and method section */
function iemValue(value, digits = 0) {
  if (!isNumber(value)) return "n/a";
  let n = Number(value);
  if (Math.abs(n) < Math.pow(10, -digits) / 2) n = 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function iemMetricAccent(label) {
  const key = String(label || "").toLowerCase();

  if (key.includes("thermal")) return "thermal";
  if (key.includes("others")) return "others-calculated";
  if (key.includes("renewable")) return "renewables";
  if (key.includes("wind")) return "wind";
  if (key.includes("solar")) return "solar";
  if (key.includes("generation")) return "demand";
  if (key.includes("residual")) return "residual";
  if (key.includes("interconnection")) return "imports";
  if (key.includes("demand")) return "demand";
  if (key.includes("co₂") || key.includes("co2")) return "co2";
  return "neutral";
}

function iemInterconnectionDisplay(e) {
  const signed = Number(e.interconnection_mw ?? e.imports_mw ?? 0);
  if (!isNumber(signed) || Math.abs(signed) < 1) {
    return { value: "Near balanced", note: "Interconnector flow close to zero" };
  }
  if (signed > 0) {
    return { value: `${iemValue(signed, 0)} MW`, note: "Net import" };
  }
  return { value: `${iemValue(Math.abs(signed), 0)} MW`, note: "Net export" };
}

function metricCard(label, value, note, className = "") {
  const accent = iemMetricAccent(label);
  return `
    <article class="metric-card ${className}" data-accent="${accent}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;
  const inter = iemInterconnectionDisplay(e);

  target.innerHTML = [
    metricCard("Demand now", `${iemValue(e.demand_mw, 0)} MW`, "Latest mapped system demand"),
    metricCard("Renewables", percentOrNA(e.renewables_percent), "Wind + solar as share of demand"),
    metricCard("Wind", percentOrNA(e.wind_percent), "Mapped wind generation now"),
    metricCard("Solar", percentOrNA(e.solar_percent), "Mapped solar generation now"),
    metricCard("Residual", percentOrNA(e.residual_percent ?? e.gas_percent), "Not gas: unclassified remainder"),
    metricCard("Interconnection", inter.value, inter.note),
    metricCard(
      "CO₂ intensity",
      co2OrNA(e.co2_g_per_kwh, co2Available),
      co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source",
      co2Available ? "co2-card" : "missing co2-card"
    )
  ].join("");
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

  const generationGw = isNumber(e.generation_mw) ? Number(e.generation_mw) / 1000 : pulseLast(history, "generation_gw");
  const demandGw = isNumber(e.demand_mw) ? Number(e.demand_mw) / 1000 : pulseLast(history, "demand_gw");
  const renewables = isNumber(e.renewables_percent) ? e.renewables_percent : pulseLast(history, "renewables_percent");
  const co2 = isNumber(e.co2_g_per_kwh) ? e.co2_g_per_kwh : pulseLast(history, "co2_g_per_kwh");
  const residual = isNumber(e.residual_percent ?? e.gas_percent)
    ? (e.residual_percent ?? e.gas_percent)
    : pulseLast(history, "residual_percent");

  const signedInterconnection = isNumber(e.interconnection_mw) ? Number(e.interconnection_mw) : Number(e.imports_mw || 0);
  const interValue = Math.abs(signedInterconnection) < 1
    ? "0"
    : iemValue(Math.abs(signedInterconnection), 0);
  const interUnit = Math.abs(signedInterconnection) < 1 ? "MW" : "MW";
  const interNote = Math.abs(signedInterconnection) < 1
    ? "Near-balanced interconnector flow."
    : signedInterconnection > 0
      ? "Net import."
      : "Net export.";

  const gap = isNumber(drift.gap_to_target_pp) ? drift.gap_to_target_pp : pulseLast(history, "target_gap_pp");

  const electricityPriceValue = isNumber(electricityPrice?.ireland_c_per_kwh)
    ? electricityPrice.ireland_c_per_kwh
    : pulseLast(history, "household_electricity_c_per_kwh");

  const gasPriceValue = isNumber(gasPrice?.ireland_c_per_kwh)
    ? gasPrice.ireland_c_per_kwh
    : pulseLast(history, "household_gas_c_per_kwh");

  target.innerHTML = [
    pulseCard({
      key: "generation",
      label: "Generation now",
      value: pulseNumber(generationGw, 2),
      unit: "GW",
      note: "Current production-side signal.",
      key: "generation_gw",
      history
    }),
    ...(demandPassesBalanceCheck(e) ? [pulseCard({
      key: "demand",
      label: "System demand",
      value: pulseNumber(demandGw, 2),
      unit: "GW",
      note: "Current load-side signal.",
      key: "demand_gw",
      history
    })] : []),
    pulseCard({
      key: "renewables",
      label: "Renewables now",
      value: pulseNumber(renewables, 0),
      unit: "%",
      note: "Wind and solar reported; others calculated from renewable total.",
      key: "renewables_percent",
      history,
      tone: "good"
    }),
    pulseCard({
      key: "co2",
      label: "CO₂ now",
      value: pulseNumber(co2, 0),
      unit: "g/kWh",
      note: co2 ? "Latest Smart Grid Dashboard carbon signal; line shows daily snapshots." : "Not available in this build.",
      key: "co2_g_per_kwh",
      history,
      tone: co2 ? "" : "muted"
    }),
    pulseCard({
      key: "interconnection",
      label: "Interconnection",
      value: interValue,
      unit: interUnit,
      note: interNote,
      key: "imports_percent",
      history
    }),
    pulseCard({
      key: "residual",
      label: "Residual supply",
      value: pulseNumber(residual, 0),
      unit: "%",
      note: "Non-renewable generation remainder.",
      key: "residual_percent",
      history,
      tone: "caution"
    }),
    pulseCard({
      key: "target-gap",
      label: "2030 target gap",
      value: pulseNumber(gap, 1),
      unit: "pp",
      note: "Official annual gap to 80% renewable electricity.",
      key: "target_gap_pp",
      history,
      tone: "risk"
    }),
    pulseCard({
      key: "electricity-price",
      label: "Electricity price",
      value: pulseNumber(electricityPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_electricity_c_per_kwh",
      history
    }),
    pulseCard({
      key: "gas-price",
      label: "Gas price",
      value: pulseNumber(gasPriceValue, 2),
      unit: "c/kWh",
      note: "Latest official SEAI semester, not a live tariff.",
      key: "household_gas_c_per_kwh",
      history
    })
  ].join("");
}

function renderMethodDefinitions(data) {
  const target = document.getElementById("methodDefinitions");
  if (!target) return;

  const method = data.method || {};
  const metrics = method.metrics || [];
  const sections = method.sections || [];
  const vocabulary = method.vocabulary || {};

  const metricCards = metrics.map(m => `
    <article class="method-card" data-accent="${escapeHtml(m.accent || "neutral")}">
      <div class="method-card-top">
        <h3>${escapeHtml(m.label)}</h3>
        <span>${escapeHtml(m.evidence_basis)}</span>
      </div>
      <p>${escapeHtml(m.definition)}</p>
      <dl>
        <div><dt>Unit</dt><dd>${escapeHtml(m.unit)}</dd></div>
        <div><dt>Denominator</dt><dd>${escapeHtml(m.denominator)}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(m.confidence)}</dd></div>
      </dl>
      <small>${escapeHtml(m.caveat)}</small>
    </article>
  `).join("");

  const vocab = Object.entries(vocabulary).map(([k, v]) => `
    <li><strong>${escapeHtml(k.replaceAll("_", " "))}</strong><span>${escapeHtml(v)}</span></li>
  `).join("");

  const sectionRows = sections.map(s => `
    <li><strong>${escapeHtml(s.section)}</strong><span>${escapeHtml(s.method_note)}</span></li>
  `).join("");

  target.innerHTML = `
    <div class="method-subgrid">
      ${metricCards}
    </div>
    <article class="method-wide-card">
      <h3>Controlled vocabulary</h3>
      <ul>${vocab}</ul>
    </article>
    <article class="method-wide-card">
      <h3>Section logic</h3>
      <ul>${sectionRows}</ul>
    </article>
  `;
}

/* Call again after the original init has loaded data. */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadMonitor();
    renderMetrics(data);
    renderDailyPulse(data);
    renderMethodDefinitions(data);
  } catch (error) {
    console.warn("v0.45 governance render failed", error);
  }
});

/* v0.47 Question-strip click fallback */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".question-link[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    });
  });
});

/* v0.47 Question-strip click fallback */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".question-link[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    });
  });
});

/* v0.48 Put RES-E verdict back inside the 2030 trajectory card */
function renderTargetStatusSidecar() {
  // Retired in v0.48.
  // The RES-E verdict belongs inside the 2030 trajectory panel because it explains
  // the Truth Meter's "Renewable electricity" signal.
  document.querySelectorAll(".target-status-sidecar").forEach(el => el.remove());
}

function decorateTargetTrajectoryPanel() {
  const target = document.getElementById("targetDriftGrid");
  const panel = target?.closest(".panel");
  const head = panel?.querySelector(".panel-head");
  const h3 = head?.querySelector("h3");
  if (!panel || !head || !h3) return;

  panel.classList.add("target-explainer-panel");

  if (!head.querySelector(".target-explains-pill")) {
    const pill = document.createElement("span");
    pill.className = "pill target-explains-pill";
    pill.textContent = "Explains Truth Meter · Renewable electricity";
    h3.insertAdjacentElement("afterend", pill);
  }

  if (!panel.querySelector(".target-explainer-note")) {
    const note = document.createElement("p");
    note.className = "target-explainer-note";
    note.textContent = "This panel explains the Renewable electricity box in the Truth Meter: the verdict comes from official annual RES-E progress against the 80% 2030 benchmark.";
    const chart = panel.querySelector("#trajectoryChart");
    if (chart) chart.insertAdjacentElement("beforebegin", note);
  }
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
  const statusLabel = drift.status_label || truthSignalLabel(drift.status);

  const latestValue = Number(drift.latest_value);
  const targetValue = Number(drift.target_value);
  const gapValue = Number(drift.gap_to_target_pp);
  const requiredGain = Number(drift.required_annual_gain_pp);
  const recentGain = Number(drift.recent_two_year_gain_pp_per_year);

  target.innerHTML = `
    <article class="target-drift-card">
      <span>Latest official RES-E</span>
      <strong>${targetMetricValue(latestValue.toFixed(1), "%")}</strong>
      <small>${escapeHtml(drift.latest_year)}</small>
    </article>

    <article class="target-drift-card">
      <span>2030 benchmark</span>
      <strong>${targetMetricValue(targetValue.toFixed(0), "%")}</strong>
      <small>Renewable electricity</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>2030 target gap</span>
      <strong>${targetMetricValue(gapValue.toFixed(1), "pp")}</strong>
      <small>${escapeHtml(drift.years_remaining)} years remaining</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Required gain</span>
      <strong>${targetMetricValue(requiredGain.toFixed(2), "pp/yr")}</strong>
      <small>From ${escapeHtml(drift.latest_year)} to ${escapeHtml(drift.target_year)}</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Recent gain</span>
      <strong>${targetMetricValue(recentGain.toFixed(2), "pp/yr")}</strong>
      <small>Two-year average</small>
    </article>

    <article class="target-verdict-card ${statusClass}">
      <div>
        <span>Same verdict as Truth Meter</span>
        <strong>${escapeHtml(statusLabel)}</strong>
      </div>
      <p>
        Renewable electricity is <strong>${gapValue.toFixed(1)} percentage points</strong>
        below the 2030 benchmark. Recent progress is
        <strong>${recentGain.toFixed(2)} pp/yr</strong>, while the required pace is
        <strong>${requiredGain.toFixed(2)} pp/yr</strong>.
      </p>
      <small>${escapeHtml(drift.caveat || "Official annual RES-E indicator, not the live quarter-hourly electricity mix.")}</small>
    </article>
  `;

  decorateTargetTrajectoryPanel();
  renderTargetStatusSidecar();
}

function decorateRenewableTruthCard() {
  const cards = document.querySelectorAll("#truthGrid .truth-card");
  for (const card of cards) {
    const heading = card.querySelector("h3");
    if (!heading) continue;
    if (!/renewable electricity/i.test(heading.textContent || "")) continue;
    if (card.querySelector(".truth-explainer-link")) continue;

    const link = document.createElement("a");
    link.className = "truth-explainer-link";
    link.href = "#target-jump";
    link.textContent = "See 2030 trajectory explanation ↓";
    card.appendChild(link);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(decorateTargetTrajectoryPanel, 250);
  setTimeout(decorateRenewableTruthCard, 350);
  setTimeout(renderTargetStatusSidecar, 450);
  setTimeout(decorateTargetTrajectoryPanel, 1000);
  setTimeout(decorateRenewableTruthCard, 1100);
  setTimeout(renderTargetStatusSidecar, 1200);
});

/* v0.49 Full-width residual explainer and consistent formal signal pills */
function signalPillClass(status) {
  const cls = truthClass(status);
  return `pill panel-signal-pill signal-${cls}`;
}

function setSignalPill(el, status) {
  if (!el) return;
  const cls = truthClass(status);
  el.className = signalPillClass(status);
  el.textContent = truthSignalLabel(status);
}

function truthItemByName(data, pattern) {
  return (data.truth_meter || []).find(item => pattern.test(item.name || ""));
}

function renderResidual(data) {
  const residualTruth = truthItemByName(data, /residual/i);
  const status = residualTruth?.status || truth_status_from_residual_frontend(data);
  const pill = document.getElementById("residualSignal");

  setSignalPill(pill, status);

  const narrative = document.getElementById("residualNarrative");
  if (narrative) {
    narrative.innerHTML = `
      <strong>${escapeHtml(residualTruth?.value || data.gas?.signal || "Residual supply")}</strong>
      is the unclassified remainder after detected wind, solar and net imports.
      It is not measured gas. A later fuel-mix harvester should split this into gas,
      hydro, storage, coal/oil and other sources.
    `;
  }

  const gauge = document.getElementById("residualGauge");
  if (gauge) {
    const value = Number(
      data.electricity_now?.residual_percent ??
      data.electricity_now?.gas_percent ??
      data.gas?.share_percent ??
      0
    );
    gauge.style.setProperty("--value", `${Math.max(0, Math.min(100, value))}%`);
  }
}

function truth_status_from_residual_frontend(data) {
  const value = Number(data.electricity_now?.residual_percent ?? data.electricity_now?.gas_percent);
  if (!Number.isFinite(value)) return "risk";
  if (value <= 20) return "on";
  if (value <= 35) return "risk";
  return "off";
}

function decorateTargetTrajectoryPanelWithSignal(data) {
  const drift = data.target_drift || {};
  const panel = document.querySelector(".target-explainer-panel") || document.getElementById("targetDriftGrid")?.closest(".panel");
  const head = panel?.querySelector(".panel-head");
  if (!panel || !head) return;

  let pill = head.querySelector(".target-signal-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "pill panel-signal-pill target-signal-pill";
    head.appendChild(pill);
  }

  setSignalPill(pill, drift.status || "risk");
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
  const statusLabel = drift.status_label || truthSignalLabel(drift.status);

  const latestValue = Number(drift.latest_value);
  const targetValue = Number(drift.target_value);
  const gapValue = Number(drift.gap_to_target_pp);
  const requiredGain = Number(drift.required_annual_gain_pp);
  const recentGain = Number(drift.recent_two_year_gain_pp_per_year);

  target.innerHTML = `
    <article class="target-drift-card">
      <span>Latest official RES-E</span>
      <strong>${targetMetricValue(latestValue.toFixed(1), "%")}</strong>
      <small>${escapeHtml(drift.latest_year)}</small>
    </article>

    <article class="target-drift-card">
      <span>2030 benchmark</span>
      <strong>${targetMetricValue(targetValue.toFixed(0), "%")}</strong>
      <small>Renewable electricity</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>2030 target gap</span>
      <strong>${targetMetricValue(gapValue.toFixed(1), "pp")}</strong>
      <small>${escapeHtml(drift.years_remaining)} years remaining</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Required gain</span>
      <strong>${targetMetricValue(requiredGain.toFixed(2), "pp/yr")}</strong>
      <small>From ${escapeHtml(drift.latest_year)} to ${escapeHtml(drift.target_year)}</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Recent gain</span>
      <strong>${targetMetricValue(recentGain.toFixed(2), "pp/yr")}</strong>
      <small>Two-year average</small>
    </article>

    <article class="target-verdict-card ${statusClass}">
      <div>
        <span>Same signal as Truth Meter</span>
        <strong>${escapeHtml(statusLabel)}</strong>
      </div>
      <p>
        Renewable electricity is <strong>${gapValue.toFixed(1)} percentage points</strong>
        below the 2030 benchmark. Recent progress is
        <strong>${recentGain.toFixed(2)} pp/yr</strong>, while the required pace is
        <strong>${requiredGain.toFixed(2)} pp/yr</strong>.
      </p>
      <small>${escapeHtml(drift.caveat || "Official annual RES-E indicator, not the live quarter-hourly electricity mix.")}</small>
    </article>
  `;

  decorateTargetTrajectoryPanel();
  decorateTargetTrajectoryPanelWithSignal(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadMonitor();
    decorateTargetTrajectoryPanelWithSignal(data);
    renderResidual(data);
  } catch (error) {
    console.warn("v0.49 signal consistency render failed", error);
  }
});

/* v0.50 Remove duplicate trajectory signal pills */
function dedupeTargetSignalPills() {
  const panel = document.getElementById("targetDriftGrid")?.closest(".panel");
  const head = panel?.querySelector(".panel-head");
  if (!head) return;

  const pills = [...head.querySelectorAll(".target-signal-pill, .panel-signal-pill")]
    .filter(el => /on track|at risk|off track/i.test(el.textContent || ""));

  pills.forEach((pill, index) => {
    if (index > 0) pill.remove();
  });
}

function decorateTargetTrajectoryPanelWithSignal(data) {
  const drift = data.target_drift || {};
  const panel = document.querySelector(".target-explainer-panel") || document.getElementById("targetDriftGrid")?.closest(".panel");
  const head = panel?.querySelector(".panel-head");
  if (!panel || !head) return;

  [...head.querySelectorAll(".target-signal-pill, .panel-signal-pill")]
    .filter(el => /on track|at risk|off track/i.test(el.textContent || ""))
    .forEach(el => el.remove());

  const pill = document.createElement("span");
  pill.className = "pill panel-signal-pill target-signal-pill";
  setSignalPill(pill, drift.status || "risk");
  head.appendChild(pill);
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(dedupeTargetSignalPills, 250);
  setTimeout(dedupeTargetSignalPills, 900);
  setTimeout(dedupeTargetSignalPills, 1500);
});

/* v0.52 Taller RES-E trajectory chart: larger real SVG coordinate system, not stretched */
function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory || [];
  if (!rows.length) {
    target.innerHTML = "";
    return;
  }

  const width = 980;
  const height = 420;

  const padLeft = 54;
  const padRight = 34;
  const padTop = 34;
  const padBottom = 48;

  const years = rows.map(d => Number(d.year)).filter(Number.isFinite);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  // Use a fixed policy-relevant y-domain rather than auto-zooming.
  // This avoids exaggerating small annual movements.
  const minY = 20;
  const maxY = 85;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = year => padLeft + ((Number(year) - minYear) / (maxYear - minYear)) * plotWidth;
  const y = value => padTop + ((maxY - Number(value)) / (maxY - minY)) * plotHeight;

  const targetRows = rows.filter(d => d.target !== null && d.target !== undefined);
  const actualRows = rows.filter(d => d.actual !== null && d.actual !== undefined);

  const pathFrom = (series, key) => series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d[key]).toFixed(2)}`)
    .join(" ");

  const targetPath = pathFrom(targetRows, "target");
  const actualPath = pathFrom(actualRows, "actual");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = latest ? rows.find(d => Number(d.year) === Number(latest.year)) : null;
  const gap = sameYear ? Number(sameYear.target) - Number(latest.actual) : 0;

  text("targetGap", `${gap.toFixed(0)} pp path gap`);

  const gridValues = [80, 65, 50, 35, 20];
  const yearTicks = [];
  for (let yr = minYear; yr <= maxYear; yr += 2) yearTicks.push(yr);

  target.innerHTML = `
    <svg class="trajectory-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>

      ${gridValues.map(v => `
        <line class="grid-line" x1="${padLeft}" y1="${y(v)}" x2="${width - padRight}" y2="${y(v)}"></line>
        <text class="axis-text y-axis-label" x="${padLeft - 12}" y="${y(v) + 4}" text-anchor="end">${v}%</text>
      `).join("")}

      ${yearTicks.map(yr => `
        <line class="grid-line vertical" x1="${x(yr)}" y1="${padTop}" x2="${x(yr)}" y2="${height - padBottom}"></line>
        <text class="axis-text" x="${x(yr)}" y="${height - 15}" text-anchor="middle">${yr}</text>
      `).join("")}

      <path class="line-target" d="${targetPath}"></path>
      <path class="line-actual" d="${actualPath}"></path>

      ${actualRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.actual)}" r="4.2" fill="var(--blue)"></circle>
      `).join("")}

      ${targetRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.target)}" r="3.2" fill="var(--lime)"></circle>
      `).join("")}

      <text class="axis-text chart-key" x="${width - 255}" y="${padTop + 8}">Dashed: required path</text>
      <text class="axis-text chart-key" x="${width - 255}" y="${padTop + 27}">Solid: observed path</text>
    </svg>
  `;
}

/* v0.53 RES-E trajectory: full-width plot, not miniature, not CSS-stretched */
function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory || [];
  if (!rows.length) {
    target.innerHTML = "";
    return;
  }

  const width = 1280;
  const height = 520;

  const padLeft = 68;
  const padRight = 44;
  const padTop = 42;
  const padBottom = 58;

  const years = rows.map(d => Number(d.year)).filter(Number.isFinite);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const minY = 20;
  const maxY = 85;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = year => padLeft + ((Number(year) - minYear) / (maxYear - minYear)) * plotWidth;
  const y = value => padTop + ((maxY - Number(value)) / (maxY - minY)) * plotHeight;

  const targetRows = rows.filter(d => d.target !== null && d.target !== undefined);
  const actualRows = rows.filter(d => d.actual !== null && d.actual !== undefined);

  const pathFrom = (series, key) => series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d[key]).toFixed(2)}`)
    .join(" ");

  const targetPath = pathFrom(targetRows, "target");
  const actualPath = pathFrom(actualRows, "actual");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = latest ? rows.find(d => Number(d.year) === Number(latest.year)) : null;
  const gap = sameYear ? Number(sameYear.target) - Number(latest.actual) : 0;

  text("targetGap", `${gap.toFixed(0)} pp path gap`);

  const gridValues = [80, 65, 50, 35, 20];
  const yearTicks = [];
  for (let yr = minYear; yr <= maxYear; yr += 2) yearTicks.push(yr);

  target.innerHTML = `
    <svg class="trajectory-svg trajectory-svg-large"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="2030 renewable electricity trajectory"
    >
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>

      ${gridValues.map(v => `
        <line class="grid-line" x1="${padLeft}" y1="${y(v)}" x2="${width - padRight}" y2="${y(v)}"></line>
        <text class="axis-text y-axis-label" x="${padLeft - 14}" y="${y(v) + 4}" text-anchor="end">${v}%</text>
      `).join("")}

      ${yearTicks.map(yr => `
        <line class="grid-line vertical" x1="${x(yr)}" y1="${padTop}" x2="${x(yr)}" y2="${height - padBottom}"></line>
        <text class="axis-text" x="${x(yr)}" y="${height - 18}" text-anchor="middle">${yr}</text>
      `).join("")}

      <path class="line-target" d="${targetPath}"></path>
      <path class="line-actual" d="${actualPath}"></path>

      ${actualRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.actual)}" r="5" fill="var(--blue)"></circle>
      `).join("")}

      ${targetRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.target)}" r="3.8" fill="var(--lime)"></circle>
      `).join("")}

      <text class="axis-text chart-key" x="${width - 330}" y="${padTop + 8}">Dashed: required path</text>
      <text class="axis-text chart-key" x="${width - 330}" y="${padTop + 29}">Solid: observed path</text>
    </svg>
  `;
}

/* v0.54 RES-E trajectory trendline + escalating catch-up burden note */

function ietmLinearRegression(points) {
  const clean = (points || []).filter(p =>
    Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
  );

  const n = clean.length;
  if (n < 2) return null;

  const xs = clean.map(p => Number(p.x));
  const ys = clean.map(p => Number(p.y));

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }

  if (denominator === 0) return null;

  const m = numerator / denominator;
  const a = meanY - m * meanX;

  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const yHat = m * xs[i] + a;
    ssRes += (ys[i] - yHat) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }

  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { m, a, r2, n };
}

function ietmAddSystemsNote() {
  const panel = document.getElementById("trajectoryChart")?.closest(".panel");
  if (!panel) return;

  panel.querySelectorAll(".systems-note").forEach(el => el.remove());

  const note = document.createElement("p");
  note.className = "systems-note";
  note.innerHTML = `
    <strong>System reading: escalating catch-up burden.</strong>
    At the current pace, the 2030 gap does not close fast enough, so every slow year raises the annual gain Ireland must deliver later.
  `;

  const explainer = panel.querySelector(".target-explainer-note");
  const chart = panel.querySelector("#trajectoryChart");

  if (explainer) {
    explainer.insertAdjacentElement("afterend", note);
  } else if (chart) {
    chart.insertAdjacentElement("beforebegin", note);
  }
}

function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory || [];
  if (!rows.length) {
    target.innerHTML = "";
    return;
  }

  const width = 1280;
  const height = 520;

  const padLeft = 68;
  const padRight = 44;
  const padTop = 42;
  const padBottom = 58;

  const years = rows.map(d => Number(d.year)).filter(Number.isFinite);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const minY = 20;
  const maxY = 85;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = year => padLeft + ((Number(year) - minYear) / (maxYear - minYear)) * plotWidth;
  const y = value => padTop + ((maxY - Number(value)) / (maxY - minY)) * plotHeight;

  const targetRows = rows.filter(d => d.target !== null && d.target !== undefined);
  const actualRows = rows.filter(d => d.actual !== null && d.actual !== undefined);

  const pathFrom = (series, key) => series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d[key]).toFixed(2)}`)
    .join(" ");

  const targetPath = pathFrom(targetRows, "target");
  const actualPath = pathFrom(actualRows, "actual");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = latest ? rows.find(d => Number(d.year) === Number(latest.year)) : null;
  const gap = sameYear ? Number(sameYear.target) - Number(latest.actual) : 0;

  const targetGap = document.getElementById("targetGap");
  if (targetGap) targetGap.textContent = `${gap.toFixed(0)} pp path gap`;

  /*
    Regression convention:
    t = years since first observed year.
    y = m t + a.
    This avoids a useless large negative intercept from raw calendar years.
  */
  const trendOriginYear = actualRows.length ? Number(actualRows[0].year) : minYear;
  const observedTrendInput = actualRows.map(d => ({
    x: Number(d.year) - trendOriginYear,
    y: Number(d.actual)
  }));

  const regression = ietmLinearRegression(observedTrendInput);

  let trendLine = "";
  let trendLabel = "";
  let trendEndpointLabel = "";

  if (regression) {
    const trendStartYear = minYear;
    const trendEndYear = maxYear;

    const trendStartValue = regression.m * (trendStartYear - trendOriginYear) + regression.a;
    const trendEndValue = regression.m * (trendEndYear - trendOriginYear) + regression.a;

    const clippedStartValue = Math.max(minY, Math.min(maxY, trendStartValue));
    const clippedEndValue = Math.max(minY, Math.min(maxY, trendEndValue));

    const x1 = x(trendStartYear);
    const y1 = y(clippedStartValue);
    const x2 = x(trendEndYear);
    const y2 = y(clippedEndValue);

    const signA = regression.a >= 0 ? "+" : "−";
    const absA = Math.abs(regression.a).toFixed(1);

    trendLabel = `Observed trend: y = ${regression.m.toFixed(2)}t ${signA} ${absA}; R² = ${regression.r2.toFixed(2)}`;
    trendEndpointLabel = `Recent-pace 2030: ${trendEndValue.toFixed(0)}%`;

    trendLine = `
      <line
        class="line-trend"
        x1="${x1.toFixed(2)}"
        y1="${y1.toFixed(2)}"
        x2="${x2.toFixed(2)}"
        y2="${y2.toFixed(2)}"
      ></line>

      <text
        class="trendline-label"
        x="${Math.max(padLeft + 220, x2 - 420).toFixed(2)}"
        y="${Math.max(padTop + 74, y2 - 18).toFixed(2)}"
      >${trendLabel}</text>

      <text
        class="trendline-label trendline-endpoint"
        x="${(x2 - 8).toFixed(2)}"
        y="${(y2 + 22).toFixed(2)}"
        text-anchor="end"
      >${trendEndpointLabel}</text>
    `;
  }

  const gridValues = [80, 65, 50, 35, 20];
  const yearTicks = [];
  for (let yr = minYear; yr <= maxYear; yr += 2) yearTicks.push(yr);

  target.innerHTML = `
    <svg class="trajectory-svg trajectory-svg-large"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="2030 renewable electricity trajectory with observed trendline"
    >
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>

      ${gridValues.map(v => `
        <line class="grid-line" x1="${padLeft}" y1="${y(v)}" x2="${width - padRight}" y2="${y(v)}"></line>
        <text class="axis-text y-axis-label" x="${padLeft - 14}" y="${y(v) + 4}" text-anchor="end">${v}%</text>
      `).join("")}

      ${yearTicks.map(yr => `
        <line class="grid-line vertical" x1="${x(yr)}" y1="${padTop}" x2="${x(yr)}" y2="${height - padBottom}"></line>
        <text class="axis-text" x="${x(yr)}" y="${height - 18}" text-anchor="middle">${yr}</text>
      `).join("")}

      <path class="line-target" d="${targetPath}"></path>
      ${trendLine}
      <path class="line-actual" d="${actualPath}"></path>

      ${actualRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.actual)}" r="5" fill="var(--blue)"></circle>
      `).join("")}

      ${targetRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.target)}" r="3.8" fill="var(--lime)"></circle>
      `).join("")}

      <text class="axis-text chart-key" x="${width - 355}" y="${padTop + 8}">Dashed green: required path</text>
      <text class="axis-text chart-key" x="${width - 355}" y="${padTop + 29}">Blue: observed path</text>
      <text class="axis-text chart-key" x="${width - 355}" y="${padTop + 50}">Thin white: observed trend</text>
    </svg>
  `;

  ietmAddSystemsNote();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(ietmAddSystemsNote, 300);
  setTimeout(ietmAddSystemsNote, 1100);
});

/* v0.56 Mobile solution: scrollable plot area, readable labels, formula outside SVG */
function renderTrajectory(data) {
  const target = document.getElementById("trajectoryChart");
  if (!target) return;

  const rows = data.target_trajectory || [];
  if (!rows.length) {
    target.innerHTML = "";
    return;
  }

  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  /*
    Mobile principle:
    Do not squeeze the plot into the phone width.
    Give the SVG a readable minimum width and let the user pan horizontally.
  */
  const width = isMobile ? 980 : 1280;
  const height = isMobile ? 520 : 520;

  const padLeft = isMobile ? 78 : 68;
  const padRight = isMobile ? 48 : 44;
  const padTop = isMobile ? 48 : 42;
  const padBottom = isMobile ? 70 : 58;

  const years = rows.map(d => Number(d.year)).filter(Number.isFinite);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const minY = 20;
  const maxY = 85;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = year => padLeft + ((Number(year) - minYear) / (maxYear - minYear)) * plotWidth;
  const y = value => padTop + ((maxY - Number(value)) / (maxY - minY)) * plotHeight;

  const targetRows = rows.filter(d => d.target !== null && d.target !== undefined);
  const actualRows = rows.filter(d => d.actual !== null && d.actual !== undefined);

  const pathFrom = (series, key) => series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year).toFixed(2)} ${y(d[key]).toFixed(2)}`)
    .join(" ");

  const targetPath = pathFrom(targetRows, "target");
  const actualPath = pathFrom(actualRows, "actual");

  const latest = actualRows[actualRows.length - 1];
  const sameYear = latest ? rows.find(d => Number(d.year) === Number(latest.year)) : null;
  const gap = sameYear ? Number(sameYear.target) - Number(latest.actual) : 0;

  const targetGap = document.getElementById("targetGap");
  if (targetGap) targetGap.textContent = `${gap.toFixed(0)} pp path gap`;

  const trendOriginYear = actualRows.length ? Number(actualRows[0].year) : minYear;
  const observedTrendInput = actualRows.map(d => ({
    x: Number(d.year) - trendOriginYear,
    y: Number(d.actual)
  }));

  const regression = ietmLinearRegression(observedTrendInput);

  let trendLine = "";
  let formulaText = "";
  let endpointText = "";

  if (regression) {
    const trendStartYear = minYear;
    const trendEndYear = maxYear;

    const trendStartValue = regression.m * (trendStartYear - trendOriginYear) + regression.a;
    const trendEndValue = regression.m * (trendEndYear - trendOriginYear) + regression.a;

    const clippedStartValue = Math.max(minY, Math.min(maxY, trendStartValue));
    const clippedEndValue = Math.max(minY, Math.min(maxY, trendEndValue));

    const x1 = x(trendStartYear);
    const y1 = y(clippedStartValue);
    const x2 = x(trendEndYear);
    const y2 = y(clippedEndValue);

    const signA = regression.a >= 0 ? "+" : "−";
    const absA = Math.abs(regression.a).toFixed(1);

    formulaText = `Observed trend: y = ${regression.m.toFixed(2)}t ${signA} ${absA}; R² = ${regression.r2.toFixed(2)}`;
    endpointText = `Recent-pace 2030: ${trendEndValue.toFixed(0)}%`;

    trendLine = `
      <line
        class="line-trend"
        x1="${x1.toFixed(2)}"
        y1="${y1.toFixed(2)}"
        x2="${x2.toFixed(2)}"
        y2="${y2.toFixed(2)}"
      ></line>

      ${!isMobile ? `
        <text
          class="trendline-label"
          x="${Math.max(padLeft + 220, x2 - 420).toFixed(2)}"
          y="${Math.max(padTop + 74, y2 - 18).toFixed(2)}"
        >${escapeHtml(formulaText)}</text>

        <text
          class="trendline-label trendline-endpoint"
          x="${(x2 - 8).toFixed(2)}"
          y="${(y2 + 22).toFixed(2)}"
          text-anchor="end"
        >${escapeHtml(endpointText)}</text>
      ` : ""}
    `;
  }

  const gridValues = isMobile ? [80, 65, 50, 35, 20] : [80, 65, 50, 35, 20];
  const yearTicks = isMobile
    ? [2020, 2022, 2024, 2026, 2028, 2030]
    : [2020, 2022, 2024, 2026, 2028, 2030];

  const svg = `
    <svg class="trajectory-svg trajectory-svg-large ${isMobile ? "trajectory-mobile-scroll-svg" : "trajectory-desktop-svg"}"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="2030 renewable electricity trajectory with observed trendline"
    >
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>

      ${gridValues.map(v => `
        <line class="grid-line" x1="${padLeft}" y1="${y(v)}" x2="${width - padRight}" y2="${y(v)}"></line>
        <text class="axis-text y-axis-label" x="${padLeft - 16}" y="${y(v) + 6}" text-anchor="end">${v}%</text>
      `).join("")}

      ${yearTicks.map(yr => `
        <line class="grid-line vertical" x1="${x(yr)}" y1="${padTop}" x2="${x(yr)}" y2="${height - padBottom}"></line>
        <text class="axis-text x-axis-label" x="${x(yr)}" y="${height - 24}" text-anchor="middle">${yr}</text>
      `).join("")}

      <path class="line-target" d="${targetPath}"></path>
      ${trendLine}
      <path class="line-actual" d="${actualPath}"></path>

      ${actualRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.actual)}" r="${isMobile ? 6.5 : 5}" fill="var(--blue)"></circle>
      `).join("")}

      ${targetRows.map(d => `
        <circle cx="${x(d.year)}" cy="${y(d.target)}" r="${isMobile ? 4.8 : 3.8}" fill="var(--lime)"></circle>
      `).join("")}

      <text class="axis-text chart-key" x="${width - 360}" y="${padTop + 8}">Dashed green: required path</text>
      <text class="axis-text chart-key" x="${width - 360}" y="${padTop + 31}">Blue: observed · white: trend</text>
    </svg>
  `;

  target.innerHTML = `
    <div class="trajectory-scroll-wrap" tabindex="0" aria-label="Scrollable trajectory chart">
      ${svg}
    </div>

    <div class="trajectory-mobile-readout" aria-label="Trendline formula and interpretation">
      <span>${escapeHtml(formulaText || "Observed trend unavailable")}</span>
      <strong>${escapeHtml(endpointText || "")}</strong>
      <em>Swipe chart sideways to inspect years.</em>
    </div>
  `;

  const scrollWrap = target.querySelector(".trajectory-scroll-wrap");
  if (scrollWrap && isMobile) {
    scrollWrap.scrollLeft = 0;
  }

  ietmAddSystemsNote();
}

let ietmTrajectoryResizeTimerV56 = null;
window.addEventListener("resize", () => {
  clearTimeout(ietmTrajectoryResizeTimerV56);
  ietmTrajectoryResizeTimerV56 = setTimeout(async () => {
    try {
      const data = await loadMonitor();
      renderTrajectory(data);
    } catch {
      /* no action */
    }
  }, 180);
});

/* v0.58 Market price interpretation layer */
function marketSignalElectricity(eurPerMwh) {
  const n = Number(eurPerMwh);
  if (!Number.isFinite(n)) return { label: "Unavailable", cls: "missing", meaning: "No trustworthy live value parsed." };

  if (n < 0) {
    return {
      label: "Negative",
      cls: "good",
      meaning: "Very high supply or low demand can push the system price below zero."
    };
  }

  if (n < 75) {
    return {
      label: "Low",
      cls: "good",
      meaning: "Low system price signal. Usually easier conditions for electricity buyers."
    };
  }

  if (n < 150) {
    return {
      label: "Moderate",
      cls: "watch",
      meaning: "Ordinary to moderate system price signal."
    };
  }

  if (n < 250) {
    return {
      label: "Elevated",
      cls: "risk",
      meaning: "Elevated system price signal. This suggests tighter or more expensive system conditions."
    };
  }

  return {
    label: "Stressed",
    cls: "off",
    meaning: "High system price signal. This usually indicates material market/system pressure."
  };
}

function marketSignalGas(cPerKwh) {
  const n = Number(cPerKwh);
  if (!Number.isFinite(n)) return { label: "Unavailable", cls: "missing", meaning: "No trustworthy GNI SAP value parsed." };

  if (n < 2.5) {
    return {
      label: "Low",
      cls: "good",
      meaning: "Low gas balancing signal."
    };
  }

  if (n < 6) {
    return {
      label: "Moderate",
      cls: "watch",
      meaning: "Moderate gas balancing signal. Not a household tariff."
    };
  }

  if (n < 10) {
    return {
      label: "Elevated",
      cls: "risk",
      meaning: "Elevated gas balancing signal. System gas cost pressure is visible."
    };
  }

  return {
    label: "Stressed",
    cls: "off",
    meaning: "High gas balancing signal. This points to material gas-system price pressure."
  };
}

function marketObservedRows(history, key) {
  return (history || [])
    .filter(row => !row.estimated_backfill && Number.isFinite(Number(row[key])))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function marketDelta(history, key, unit, goodWhen = "down") {
  const rows = marketObservedRows(history, key);
  if (rows.length < 2) {
    return {
      html: `<span class="market-trend neutral">Trend building · needs another observed day</span>`,
      value: null
    };
  }

  const prev = Number(rows[rows.length - 2][key]);
  const curr = Number(rows[rows.length - 1][key]);
  const diff = curr - prev;

  const sign = diff > 0 ? "+" : "";
  const tone = Math.abs(diff) < 0.005
    ? "neutral"
    : goodWhen === "down"
      ? (diff < 0 ? "good" : "bad")
      : (diff > 0 ? "good" : "bad");

  return {
    value: diff,
    html: `<span class="market-trend ${tone}">Δ ${sign}${diff.toFixed(2)} ${unit} vs prior observed day</span>`
  };
}

function marketItem(data, labelRegex) {
  return (data.market_prices || []).find(item => labelRegex.test(item.label || "")) || null;
}

function renderMarketPrices(data) {
  const target = document.getElementById("marketPriceGrid");
  if (!target) return;

  const history = data.daily_history || [];
  const electricity = marketItem(data, /electricity/i);
  const gas = marketItem(data, /gas/i);

  const eValue = Number(electricity?.numeric_value);
  const eSignal = marketSignalElectricity(eValue);
  const eDelta = marketDelta(history, "electricity_system_price_eur_per_mwh", "€/MWh", "down");

  const gasValue = Number(gas?.numeric_value);
  const gasSignal = marketSignalGas(gasValue);
  const gasDelta = marketDelta(history, "gas_balancing_price_c_per_kwh", "c/kWh", "down");

  const electricityEquivalent = electricity?.equivalent_value
    ? `<span class="market-equivalent">${escapeHtml(electricity.equivalent_value)} equivalent</span>`
    : "";

  target.innerHTML = `
    <article class="market-price-card interpreted ${escapeHtml(eSignal.cls)}">
      <div class="market-card-head">
        <h3>${escapeHtml(electricity?.label || "Electricity system price")}</h3>
        <span class="market-signal ${escapeHtml(eSignal.cls)}">${escapeHtml(eSignal.label)}</span>
      </div>

      <div class="market-value-line">
        <strong>${escapeHtml(electricity?.value || "n/a")}</strong>
        ${electricityEquivalent}
      </div>

      ${eDelta.html}

      <p class="market-meaning">${escapeHtml(eSignal.meaning)}</p>

      <p class="market-detail">
        ${escapeHtml(electricity?.detail || "System price signal, not a household tariff.")}
      </p>

      <a href="${escapeHtml(electricity?.source_url || "#")}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(electricity?.source || "Electricity market source")}
      </a>
    </article>

    <article class="market-price-card interpreted ${escapeHtml(gasSignal.cls)}">
      <div class="market-card-head">
        <h3>${escapeHtml(gas?.label || "Gas balancing price")}</h3>
        <span class="market-signal ${escapeHtml(gasSignal.cls)}">${escapeHtml(gasSignal.label)}</span>
      </div>

      <div class="market-value-line">
        <strong>${escapeHtml(gas?.value || "n/a")}</strong>
      </div>

      ${gasDelta.html}

      <p class="market-meaning">${escapeHtml(gasSignal.meaning)}</p>

      <p class="market-detail">
        ${escapeHtml(gas?.detail || "Gas-system balancing signal, not a household tariff.")}
      </p>

      <a href="${escapeHtml(gas?.source_url || "#")}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(gas?.source || "Gas balancing source")}
      </a>
    </article>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadMonitor();
    renderMarketPrices(data);
  } catch (error) {
    console.warn("v0.58 market interpretation render failed", error);
  }
});

/* v0.59 Electricity Now consistency: renewables output can exceed demand */
function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;
  const inter = iemInterconnectionDisplay(e);

  const renewableNote = Number(e.renewables_percent) > 100
    ? "Wind + solar output exceeds current demand"
    : "Wind + solar output vs demand";

  const residualNote = Number(e.renewables_percent) > 100
    ? "Computed residual is zero when renewables exceed demand"
    : "Computed after wind, solar and net imports";

  target.innerHTML = [
    metricCard("Demand now", `${iemValue(e.demand_mw, 0)} MW`, "Latest mapped system demand"),
    metricCard("Renewables", percentOrNA(e.renewables_percent), renewableNote),
    metricCard("Wind", percentOrNA(e.wind_percent), "Wind output vs demand"),
    metricCard("Solar", percentOrNA(e.solar_percent), "Solar output vs demand"),
    metricCard("Residual", percentOrNA(e.residual_percent ?? e.gas_percent), residualNote),
    metricCard("Interconnection", inter.value, inter.note),
    metricCard(
      "CO₂ intensity",
      co2OrNA(e.co2_g_per_kwh, co2Available),
      co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source",
      co2Available ? "co2-card" : "missing co2-card"
    )
  ].join("");
}

/* v0.60 Correct public renewable wording: contribution, not raw output */
function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;
  const inter = iemInterconnectionDisplay(e);

  const normalised = Boolean(e.renewables_normalised);
  const surplus = Number(e.renewable_surplus_percent || 0);

  const renewableNote = normalised
    ? `Domestic contribution capped; raw output exceeded demand by ${pulseNumber(surplus, 0)} pp`
    : "Estimated wind + solar contribution to demand";

  const windNote = normalised
    ? "Normalised contribution to Irish demand"
    : "Wind contribution to Irish demand";

  const solarNote = normalised
    ? "Normalised contribution to Irish demand"
    : "Solar contribution to Irish demand";

  const residualNote = "Computed remainder after renewables and net imports";

  target.innerHTML = [
    metricCard("Demand now", `${iemValue(e.demand_mw, 0)} MW`, "Latest mapped system demand"),
    metricCard("Renewables", percentOrNA(e.renewables_percent), renewableNote),
    metricCard("Wind", percentOrNA(e.wind_percent), windNote),
    metricCard("Solar", percentOrNA(e.solar_percent), solarNote),
    metricCard("Residual", percentOrNA(e.residual_percent ?? e.gas_percent), residualNote),
    metricCard("Interconnection", inter.value, inter.note),
    metricCard(
      "CO₂ intensity",
      co2OrNA(e.co2_g_per_kwh, co2Available),
      co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source",
      co2Available ? "co2-card" : "missing co2-card"
    )
  ].join("");
}

/* v0.62 Rename top-row renewables to renewable cover, not total system mix */
function iemMetricAccent(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("renewable")) return "renewables";
  if (key.includes("wind")) return "wind";
  if (key.includes("solar")) return "solar";
  if (key.includes("generation")) return "demand";
  if (key.includes("residual") || key.includes("uncovered")) return "residual";
  if (key.includes("interconnection")) return "imports";
  if (key.includes("demand")) return "demand";
  if (key.includes("co₂") || key.includes("co2")) return "co2";
  return "neutral";
}

function renderElectricityCoverageNote(data) {
  const grid = document.getElementById("metricGrid");
  if (!grid) return;

  let note = document.getElementById("electricityCoverageNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "electricityCoverageNote";
    note.className = "electricity-coverage-note";
    grid.insertAdjacentElement("afterend", note);
  }

  const e = data.electricity_now || {};
  const normalised = Boolean(e.renewables_normalised);
  const surplus = Number(e.renewable_surplus_percent || 0);
  const output = Number(e.renewables_output_percent || e.renewables_percent || 0);
  const inter = iemInterconnectionDisplay(e);

  if (normalised) {
    note.innerHTML = `
      <strong>Generation view, not full fuel mix.</strong>
      Wind + solar output is estimated at <b>${pulseNumber(output, 0)}%</b> of current demand.
      The public cover cards are capped at 100% because domestic demand cannot be more than fully covered.
      Surplus/output above demand is shown separately and may coincide with exports, curtailment or model uncertainty.
      Current interconnection signal: <b>${escapeHtml(inter.note.toLowerCase())}</b>.
    `;
  } else {
    note.innerHTML = `
      <strong>Generation view.</strong>
      Percentages estimate the current generation split between renewable generation, thermal/other generation and interconnection.
      The thermal/other card is a computed remainder, not measured gas or a complete fuel mix.
    `;
  }
}

function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;
  const inter = iemInterconnectionDisplay(e);

  const normalised = Boolean(e.renewables_normalised);
  const surplus = Number(e.renewable_surplus_percent || 0);

  const renewableNote = normalised
    ? `Capped domestic cover; raw output exceeded demand by ${pulseNumber(surplus, 0)} pp`
    : "Estimated wind + solar cover of demand";

  const windNote = normalised
    ? "Normalised share of domestic renewable cover"
    : "Wind cover of current demand";

  const solarNote = normalised
    ? "Normalised share of domestic renewable cover"
    : "Solar cover of current demand";

  target.innerHTML = [
    metricCard("Demand now", `${iemValue(e.demand_mw, 0)} MW`, "Latest mapped system demand"),
    metricCard("Renewable cover", percentOrNA(e.renewables_percent), renewableNote),
    metricCard("Wind cover", percentOrNA(e.wind_percent), windNote),
    metricCard("Solar cover", percentOrNA(e.solar_percent), solarNote),
    metricCard("Uncovered", percentOrNA(e.residual_percent ?? e.gas_percent), "Computed remainder; not measured gas"),
    metricCard("Interconnection", inter.value, inter.note),
    metricCard(
      "CO₂ intensity",
      co2OrNA(e.co2_g_per_kwh, co2Available),
      co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source",
      co2Available ? "co2-card" : "missing co2-card"
    )
  ].join("");

  renderElectricityCoverageNote(data);
}

/* v0.64 Honest source badge for workbook-derived core grid values */
function renderElectricitySourceBadge(data) {
  const e = data.electricity_now || {};
  const sourceLabel = e.source_label || "EirGrid mapped source";
  const stamp = e.electricity_datetime || e.smartgrid_live_harvested_at || data.meta?.generated_at || "";

  const candidates = [
    document.getElementById("sourceBadge"),
    document.querySelector(".source-badge"),
    document.querySelector(".live-badge"),
    document.querySelector(".status-pill"),
    document.querySelector(".hero .pill")
  ].filter(Boolean);

  const badge = candidates[0];
  if (!badge) return;

  const isWorkbook = /workbook|quarter-hourly/i.test(sourceLabel);

  badge.classList.toggle("workbook-source", isWorkbook);
  badge.classList.toggle("live-source", !isWorkbook);

  badge.textContent = isWorkbook
    ? "Mapped from EirGrid workbook"
    : "Live from Smart Grid Dashboard";

  const sourceLine = document.querySelector(".source-line, .data-source-line, .hero-source-line");
  if (sourceLine) {
    sourceLine.textContent = `${sourceLabel}${stamp ? " · latest mapped interval " + stamp : ""}`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadMonitor();
    renderElectricitySourceBadge(data);
  } catch (error) {
    console.warn("v0.64 source badge render failed", error);
  }
});

/* v0.65 Source-model governance and freshness gates */
function ietmSourceGate(data) {
  const gate = data.electricity_source_model || data.source_model?.electricity || {};
  return {
    status: gate.status || "unknown",
    valuesAreLive: Boolean(gate.values_are_live),
    valuesAreCurrent: Boolean(gate.values_are_current),
    publicBadge: gate.public_badge || "Source status unknown",
    publicTitle: gate.public_title || "Mapped electricity signal",
    publicCaveat: gate.public_caveat || "Source freshness could not be verified.",
    ageHours: gate.age_hours,
    latestInterval: gate.latest_interval,
    selectedSource: gate.selected_source || "Mapped electricity source"
  };
}

function renderSourceGovernance(data) {
  const gate = ietmSourceGate(data);

  const today = document.getElementById("today") || document.querySelector(".today-section");
  const title = today?.querySelector("h1, h2");
  const eyebrow = today?.querySelector(".eyebrow");

  if (title) title.textContent = gate.publicTitle;
  if (eyebrow) eyebrow.textContent = gate.valuesAreLive ? "Electricity now" : "Electricity snapshot";

  const badge =
    document.getElementById("sourceBadge") ||
    document.querySelector(".source-badge") ||
    document.querySelector(".live-badge") ||
    document.querySelector("#today .pill");

  if (badge) {
    badge.textContent = gate.publicBadge;
    badge.classList.toggle("live-source", gate.valuesAreLive);
    badge.classList.toggle("workbook-source", !gate.valuesAreLive);
  }

  const sourceText =
    document.querySelector(".source-line") ||
    document.querySelector(".data-source-line") ||
    document.querySelector("#today .source-meta") ||
    document.querySelector("#today .micro-note");

  if (sourceText) {
    const age = Number.isFinite(Number(gate.ageHours))
      ? ` · age ${Number(gate.ageHours).toFixed(1)} h`
      : "";
    const interval = gate.latestInterval ? ` · latest interval ${gate.latestInterval}` : "";
    sourceText.textContent = `${gate.selectedSource}${interval}${age}`;
  }

  const grid = document.getElementById("metricGrid");
  if (grid) {
    let note = document.getElementById("sourceFreshnessNote");
    if (!note) {
      note = document.createElement("div");
      note.id = "sourceFreshnessNote";
      note.className = "source-freshness-note";
      grid.insertAdjacentElement("beforebegin", note);
    }

    note.innerHTML = `
      <strong>${escapeHtml(gate.publicBadge)}.</strong>
      ${escapeHtml(gate.publicCaveat)}
    `;
  }
}

function renderMetrics(data) {
  const e = data.electricity_now || {};
  const target = document.getElementById("metricGrid");
  if (!target) return;

  const gate = ietmSourceGate(data);
  const co2Available = e.co2_available !== false && isNumber(e.co2_g_per_kwh) && Number(e.co2_g_per_kwh) > 0;
  const inter = iemInterconnectionDisplay(e);

  const demandLabel = gate.valuesAreLive ? "Demand now" : "Demand snapshot";
  const renewableLabel = "Renewable cover";
  const uncoveredLabel = "Uncovered";

  const normalised = Boolean(e.renewables_normalised);
  const surplus = Number(e.renewable_surplus_percent || 0);

  const renewableNote = normalised
    ? `Capped domestic cover; raw output exceeded demand by ${pulseNumber(surplus, 0)} pp`
    : "Estimated wind + solar cover of demand";

  target.innerHTML = [
    metricCard(demandLabel, `${iemValue(e.demand_mw, 0)} MW`, gate.valuesAreLive ? "Current mapped system demand" : "Latest fallback interval"),
    metricCard(renewableLabel, percentOrNA(e.renewables_percent), renewableNote),
    metricCard("Wind cover", percentOrNA(e.wind_percent), "Wind cover of current demand"),
    metricCard("Solar cover", percentOrNA(e.solar_percent), "Solar cover of current demand"),
    metricCard(uncoveredLabel, percentOrNA(e.residual_percent ?? e.gas_percent), "Computed remainder; not measured gas"),
    metricCard("Interconnection", inter.value, inter.note),
    metricCard(
      "CO₂ intensity",
      co2OrNA(e.co2_g_per_kwh, co2Available),
      co2Available ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}` : "Not mapped in current source",
      co2Available ? "co2-card" : "missing co2-card"
    )
  ].join("");

  renderSourceGovernance(data);
  renderElectricityCoverageNote(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadMonitor();
    renderSourceGovernance(data);
    renderMetrics(data);
  } catch (error) {
    console.warn("v0.65 source governance render failed", error);
  }
});

/* v0.71 Do not pretend interconnection is mapped when API endpoint is absent */
function iemInterconnectionDisplay(e) {
  if (e && e.interconnection_available === false) {
    return {
      value: "Not mapped",
      note: "Interconnection API endpoint pending"
    };
  }

  const mw = Number(e?.interconnection_mw);

  if (!Number.isFinite(mw) || Math.abs(mw) < 1) {
    return {
      value: "Near balanced",
      note: "Interconnector flow close to zero"
    };
  }

  if (mw > 0) {
    return {
      value: `${iemValue(mw, 0)} MW`,
      note: "Net import"
    };
  }

  return {
    value: `${iemValue(Math.abs(mw), 0)} MW`,
    note: "Net export"
  };
}

/* v0.73 Interconnection direction arrow badge */
function ietmFlowMeta(direction) {
  const d = String(direction || "").toLowerCase();

  if (d.includes("export")) {
    return {
      cls: "export",
      arrow: "",
      text: "Net export"
    };
  }

  if (d.includes("import")) {
    return {
      cls: "import",
      arrow: "",
      text: "Net import"
    };
  }

  if (d.includes("balanc")) {
    return {
      cls: "balanced",
      arrow: "↔",
      text: "Near balanced"
    };
  }

  return {
    cls: "unknown",
    arrow: "•",
    text: "Not mapped"
  };
}

function ietmFlowBadge(direction) {
  const meta = ietmFlowMeta(direction);
  return `
    <span class="flow-indicator ${meta.cls}">
      <span class="flow-indicator-arrow" aria-hidden="true">${meta.arrow}</span>
      <span>${meta.text}</span>
    </span>
  `;
}

/*
  Override the interconnection display helper.
  Existing renderMetrics() already calls iemInterconnectionDisplay(e),
  so this is enough to upgrade the card note everywhere.
*/
function iemInterconnectionDisplay(e) {
  if (e && e.interconnection_available === false) {
    return {
      value: "Not mapped",
      note: ietmFlowBadge("unknown")
    };
  }

  const mw = Number(e?.interconnection_mw);
  const direction = String(e?.interconnection_direction || "");

  if (!Number.isFinite(mw)) {
    return {
      value: "Not mapped",
      note: ietmFlowBadge("unknown")
    };
  }

  if (Math.abs(mw) < 1) {
    return {
      value: "Near balanced",
      note: ietmFlowBadge("near balanced")
    };
  }

  if (mw > 0) {
    return {
      value: `${iemValue(mw, 0)} MW`,
      note: ietmFlowBadge("importing")
    };
  }

  return {
    value: `${iemValue(Math.abs(mw), 0)} MW`,
    note: ietmFlowBadge("exporting")
  };
}

/* v0.74 Render interconnection arrow badge safely after metric cards render */
function ietmPlainFlowMeta(direction) {
  const d = String(direction || "").toLowerCase();

  if (d.includes("export")) {
    return { cls: "export", arrow: "", text: "Net export" };
  }

  if (d.includes("import")) {
    return { cls: "import", arrow: "", text: "Net import" };
  }

  if (d.includes("balanc")) {
    return { cls: "balanced", arrow: "↔", text: "Near balanced" };
  }

  return { cls: "unknown", arrow: "•", text: "Not mapped" };
}

/* Override again: metricCard note is plain text, not HTML. */
function iemInterconnectionDisplay(e) {
  if (e && e.interconnection_available === false) {
    const meta = ietmPlainFlowMeta("unknown");
    return {
      value: "Not mapped",
      note: `${meta.arrow} ${meta.text}`
    };
  }

  const mw = Number(e?.interconnection_mw);

  if (!Number.isFinite(mw)) {
    const meta = ietmPlainFlowMeta("unknown");
    return {
      value: "Not mapped",
      note: `${meta.arrow} ${meta.text}`
    };
  }

  if (Math.abs(mw) < 1) {
    const meta = ietmPlainFlowMeta("near balanced");
    return {
      value: "Near balanced",
      note: `${meta.arrow} ${meta.text}`
    };
  }

  if (mw > 0) {
    const meta = ietmPlainFlowMeta("importing");
    return {
      value: `${iemValue(mw, 0)} MW`,
      note: `${meta.arrow} ${meta.text}`
    };
  }

  const meta = ietmPlainFlowMeta("exporting");
  return {
    value: `${iemValue(Math.abs(mw), 0)} MW`,
    note: `${meta.arrow} ${meta.text}`
  };
}

function ietmDecorateInterconnectionCard(data) {
  const e = data?.electricity_now || {};
  const meta = ietmPlainFlowMeta(e.interconnection_direction);

  const cards = Array.from(document.querySelectorAll(".metric-card"));
  const card = cards.find(el =>
    String(el.textContent || "").toLowerCase().includes("interconnection")
  );

  if (!card) return;

  const note = card.querySelector("small");
  if (!note) return;

  note.classList.add("flow-note");
  note.innerHTML = `
    <span class="flow-indicator ${meta.cls}">
      <span class="flow-indicator-arrow" aria-hidden="true">${meta.arrow}</span>
      <span>${meta.text}</span>
    </span>
  `;
}

/* v0.75 Force clean interconnection badge labels */
function ietmPlainFlowMeta(direction) {
  const d = String(direction || "").toLowerCase();

  if (d.includes("export")) {
    return { cls: "export", arrow: "", text: "Net export" };
  }

  if (d.includes("import")) {
    return { cls: "import", arrow: "", text: "Net import" };
  }

  if (d.includes("balanc")) {
    return { cls: "balanced", arrow: "↔", text: "Near balanced" };
  }

  return { cls: "unknown", arrow: "•", text: "Not mapped" };
}

function ietmDecorateInterconnectionCard(data) {
  const e = data?.electricity_now || {};
  const meta = ietmPlainFlowMeta(e.interconnection_direction);

  const cards = Array.from(document.querySelectorAll(".metric-card"));
  const card = cards.find(el =>
    String(el.textContent || "").toLowerCase().includes("interconnection")
  );

  if (!card) return;

  const note = card.querySelector("small");
  if (!note) return;

  note.className = "flow-note";
  note.innerHTML = `
    <span class="flow-indicator ${meta.cls}">
      <span class="flow-indicator-arrow" aria-hidden="true">${meta.arrow}</span>
      <span>${meta.text}</span>
    </span>
  `;
}

/* v0.76 Make Renewable cover visibly parent of Wind + Solar */
function ietmFindMetricCard(labelText) {
  const cards = Array.from(document.querySelectorAll(".metric-card"));
  const needle = String(labelText || "").toLowerCase();

  return cards.find(card => {
    const firstLabel = card.querySelector("span, .metric-label");
    const text = firstLabel ? firstLabel.textContent : card.textContent;
    return String(text || "").toLowerCase().includes(needle);
  });
}

function ietmDecorateRenewableHierarchy(data) {
  const e = data?.electricity_now || {};

  const renewableCard = ietmFindMetricCard("renewable cover");
  const windCard = ietmFindMetricCard("wind cover");
  const solarCard = ietmFindMetricCard("solar cover");

  if (!renewableCard || !windCard || !solarCard) return;

  renewableCard.classList.add("renewable-parent-card");
  windCard.classList.add("renewable-child-card", "wind-child-card");
  solarCard.classList.add("renewable-child-card", "solar-child-card");

  const wind = Number(e.wind_percent || 0);
  const solar = Number(e.solar_percent || 0);
  const total = Number(e.renewables_percent || 0);

  const windShareOfRenewable = total > 0 ? Math.max(0, Math.min(100, wind / total * 100)) : 0;
  const solarShareOfRenewable = total > 0 ? Math.max(0, Math.min(100, solar / total * 100)) : 0;

  let component = renewableCard.querySelector(".renewable-components");
  if (!component) {
    component = document.createElement("div");
    component.className = "renewable-components";
    renewableCard.appendChild(component);
  }

  component.innerHTML = `
    <div class="renewable-components-label">Wind + solar cover</div>
    <div class="renewable-component-bar" aria-hidden="true">
      <span class="wind-part" style="width:${windShareOfRenewable}%"></span>
      <span class="solar-part" style="width:${solarShareOfRenewable}%"></span>
    </div>
    <div class="renewable-component-values">
      <span><b>Wind</b> ${Math.round(wind)}%</span>
      <span><b>Solar</b> ${Math.round(solar)}%</span>
    </div>
  `;
}

// IETM trajectory fit label override: BEGIN
(function () {
  const previousRenderTrajectory = renderTrajectory;

  renderTrajectory = function refinedRenderTrajectory(data) {
    previousRenderTrajectory(data);

    const target = document.getElementById("trajectoryChart");
    if (!target) return;

    const rows = (data.target_trajectory || [])
      .filter(row => row.actual !== null && row.actual !== undefined && Number.isFinite(Number(row.actual)));

    if (rows.length < 2) return;

    const xs = rows.map(row => Number(row.year));
    const ys = rows.map(row => Number(row.actual));

    const n = rows.length;
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;

    const ssX = xs.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);
    if (!ssX) return;

    const slope = xs.reduce((sum, x, i) => sum + ((x - xMean) * (ys[i] - yMean)), 0) / ssX;
    const intercept = yMean - slope * xMean;

    const fitted = xs.map(x => intercept + slope * x);
    const ssRes = ys.reduce((sum, y, i) => sum + Math.pow(y - fitted[i], 2), 0);
    const ssTot = ys.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const r2 = ssTot ? 1 - (ssRes / ssTot) : 0;

    const fitStrength =
      n < 6 ? "weak" :
      r2 >= 0.70 ? "strong" :
      r2 >= 0.50 ? "moderate" :
      "weak";

    const slopeText = `${slope >= 0 ? "+" : "−"}${Math.abs(slope).toFixed(1)}`;

    const svg = target.querySelector("svg");
    if (!svg) return;

    const trendText = Array.from(svg.querySelectorAll("text"))
      .find(el => el.textContent && el.textContent.includes("Observed trend"));

    if (!trendText) return;

    const x = trendText.getAttribute("x") || "0";
    const y = trendText.getAttribute("y") || "0";

    trendText.textContent = "";

    const ns = "http://www.w3.org/2000/svg";

    const line1 = document.createElementNS(ns, "tspan");
    line1.setAttribute("x", x);
    line1.setAttribute("y", y);
    line1.textContent = `Observed trend: ${slopeText} percentage points/year`;

    const line2 = document.createElementNS(ns, "tspan");
    line2.setAttribute("x", x);
    line2.setAttribute("dy", "14");
    line2.textContent = `Fit: ${fitStrength}, based on ${n} annual points`;

    trendText.appendChild(line1);
    trendText.appendChild(line2);

    target.setAttribute(
      "aria-label",
      `Renewable electricity trajectory. Observed trend ${slopeText} percentage points per year. Fit ${fitStrength}, based on ${n} annual points.`
    );
  };
})();
// IETM trajectory fit label override: END

// IETM demand-now GW override: BEGIN
function iemFormatPowerMw(value, options = {}) {
  const mw = Number(value);
  if (!Number.isFinite(mw)) return "n/a";

  const forceGw = options.forceGw === true;
  const absMw = Math.abs(mw);

  if (forceGw || absMw >= 1000) {
    return `${(mw / 1000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} GW`;
  }

  return `${mw.toLocaleString(undefined, {
    maximumFractionDigits: 0
  })} MW`;
}

// IETM demand-now GW override: END

// IETM generation-basis live metric renderer: BEGIN
function iemPowerForLiveCards(value, options = {}) {
  const mw = Number(value);
  if (!Number.isFinite(mw)) return "n/a";

  const forceGw = options.forceGw === true;
  const absMw = Math.abs(mw);

  if (forceGw || absMw >= 1000) {
    return `${(mw / 1000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} GW`;
  }

  return `${mw.toLocaleString(undefined, {
    maximumFractionDigits: 0
  })} MW`;
}

(function () {
  renderMetrics = function renderGenerationBasedMetrics(data) {
    const e = data.electricity_now || {};
    const target = document.getElementById("metricGrid");
    if (!target) return;

    const generationMw = (
      isNumber(e.generation_mw)
        ? Number(e.generation_mw)
        : Number(e.demand_mw || 0)
    );

    const interconnectionMw = isNumber(e.interconnection_mw)
      ? Number(e.interconnection_mw)
      : (
          isNumber(e.exports_mw) && Number(e.exports_mw) > 0
            ? -Number(e.exports_mw)
            : Number(e.imports_mw || 0)
        );

    const interconnectionDirection = String(e.interconnection_direction || "").toLowerCase();
    const isExporting = interconnectionMw < 0 || interconnectionDirection.includes("export");
    const isImporting = interconnectionMw > 0 || interconnectionDirection.includes("import");

    const interconnectionNote = isExporting ? "Net export" : isImporting ? "Net import" : "Near balanced";

    const co2Available =
      e.co2_available !== false &&
      isNumber(e.co2_g_per_kwh) &&
      Number(e.co2_g_per_kwh) > 0;

    target.innerHTML = [
      metricCard(
        "Generation now",
        iemPowerForLiveCards(generationMw, { forceGw: true }),
        isNumber(e.generation_mw)
          ? "Latest mapped system generation"
          : "Fallback: mapped system demand"
      ),
      metricCard(
        "Renewable generation",
        percentOrNA(e.renewables_percent),
        "SmartGrid renewable total; wind and solar reported separately"
      ),
      metricCard(
        "Wind generation",
        percentOrNA(e.wind_percent),
        "Wind share of current generation"
      ),
      metricCard(
        "Solar generation",
        percentOrNA(e.solar_percent),
        "Solar share of current generation"
      ),
      metricCard(
        "Others (calculated)",
        percentOrNA(iemGenerationMixParts(e).otherRenewables),
        "Renewable total minus reported wind and solar",
        "others-calculated-card"
      ),
      metricCard(
        "Thermal/other",
        percentOrNA(iemGenerationMixParts(e).thermalOther),
        "Non-renewable generation remainder",
        "thermal-other-card"
      ),
      metricCard(
        "Interconnection",
        iemPowerForLiveCards(Math.abs(interconnectionMw)),
        interconnectionNote
      ),
      metricCard(
        "CO₂ intensity",
        co2OrNA(e.co2_g_per_kwh, co2Available),
        co2Available
          ? `${e.co2_source || "Mapped"} · ${e.co2_unit || "g/kWh"}`
          : "Not mapped in current source",
        co2Available ? "co2-card" : "missing co2-card"
      )
    ].join("");
  };
})();
// IETM generation-basis live metric renderer: END

// IETM post-render interconnection arrow: BEGIN
(function () {
  function patchInterconnectionArrow() {
    const cards = document.querySelectorAll("#metricGrid .metric-card");

    for (const card of cards) {
      const label = card.querySelector("span");
      const note = card.querySelector("small");

      if (!label || !note) continue;
      if (label.textContent.trim().toLowerCase() !== "interconnection") continue;

      let text = note.textContent
        .replace(/[↗↘•]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) text = "Net export";

      const lower = text.toLowerCase();
      const arrow = lower.includes("export")
        ? "↗"
        : lower.includes("import")
          ? "↘"
          : "•";

      note.textContent = `${arrow} ${text}`;
      note.style.whiteSpace = "nowrap";
      note.style.color = "var(--green)";
      note.style.fontWeight = "850";
      card.setAttribute("data-accent", "interconnection");
      break;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    patchInterconnectionArrow();
    requestAnimationFrame(patchInterconnectionArrow);
    setTimeout(patchInterconnectionArrow, 50);
    setTimeout(patchInterconnectionArrow, 250);
    setTimeout(patchInterconnectionArrow, 750);
    setTimeout(patchInterconnectionArrow, 1500);
  });
})();
// IETM post-render interconnection arrow: END

// IETM demand pressure fallback renderer: BEGIN
const IEM_DEMAND_PRESSURE_FALLBACK = {
  title: "Emerging demand pressure",
  unit_note:
    "The live grid cards show instantaneous MW/GW. This panel converts annual demand into average load equivalents so the scale is comparable. Rule of thumb: 1 TWh/yr ≈ 114 MW continuous average demand.",
  caveat:
    "Data-centre demand is a current forecast layer. Large energy users and standalone EV charging are latest measured annual CSO layers. EV fleet electricity is modelled, not directly metered.",
  contrast:
    "Data centres are already roughly gigawatt-scale average demand. EV electricity is growing, but from a much smaller base. Read this as load pressure, not live dispatch.",
  cards: [
    {
      label: "Data centres",
      value: "~1.07 GW",
      subtitle: "Average load equivalent",
      detail: "9.4 TWh/yr forecast annual electricity use for 2025. Forecast demand, not live metered consumption.",
      source: "CRU / EirGrid",
      tone: "pressure",
      acceleration: "Fast growth: 6.97 TWh measured in 2024 to ~9.4 TWh forecast in 2025"
    },
    {
      label: "Large energy users",
      value: "~1.13 GW",
      subtitle: "Average load equivalent",
      detail: "9.9 TWh/yr measured in 2024, equal to 31% of metered electricity. Includes major data centres and other very large users.",
      source: "CSO",
      tone: "measured",
      acceleration: "Measured annual grid-pressure proxy"
    },
    {
      label: "EV fleet electricity",
      value: "~51 MW",
      subtitle: "Average load equivalent",
      detail: "~0.45 TWh/yr modelled from 196,000 EVs × 13,500 km/year × 0.17 kWh/km. Not a metered national EV feed.",
      source: "ZEVI / Department of Transport + transparent model",
      tone: "modelled",
      acceleration: "Growing fleet, still much smaller than data-centre load"
    },
    {
      label: "Standalone EV charging",
      value: "~3.8 MW",
      subtitle: "Average load equivalent",
      detail: "33 GWh/yr measured at standalone EV charge-point meters in 2024. Excludes home, workplace and depot charging.",
      source: "CSO",
      tone: "measured",
      acceleration: "+43% from 2023 to 2024, partial coverage only"
    }
  ]
};

(function () {
  renderDemandPressure = function renderDemandPressureWithFallback(data) {
    const target = document.getElementById("demandPressureGrid");
    if (!target) return;

    const supplied = data && data.demand_pressure ? data.demand_pressure : {};
    const pressure = Array.isArray(supplied.cards) && supplied.cards.length
      ? supplied
      : IEM_DEMAND_PRESSURE_FALLBACK;

    const cards = pressure.cards || [];

    target.innerHTML = cards.map(card => `
      <article class="demand-pressure-card ${escapeHtml(card.tone || "")}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.subtitle || "")}</small>
        <p>${escapeHtml(card.detail || "")}</p>
        ${card.acceleration ? `<b class="demand-acceleration">${escapeHtml(card.acceleration)}</b>` : ""}
        <em>${escapeHtml(card.source || "")}</em>
      </article>
    `).join("");

    const contrast = document.getElementById("demandPressureContrast");
    if (contrast) {
      contrast.textContent = pressure.contrast || IEM_DEMAND_PRESSURE_FALLBACK.contrast;
    }

    const note = document.getElementById("demandPressureNote");
    if (note) {
      note.innerHTML = `
        <strong>How to read this:</strong> ${escapeHtml(pressure.unit_note || IEM_DEMAND_PRESSURE_FALLBACK.unit_note)}
        <br>
        <strong>Caveat:</strong> ${escapeHtml(pressure.caveat || IEM_DEMAND_PRESSURE_FALLBACK.caveat)}
      `;
    }
  };
})();
// IETM demand pressure fallback renderer: END

// IETM live mix bars from electricity_now: BEGIN
(function () {
  renderMix = function renderLiveGenerationMixFromElectricityNow(data) {
    const target = document.getElementById("mixBars");
    if (!target) return;

    const e = data.electricity_now || {};
    const mix = iemGenerationMixParts(e);

    const generationRows = [
      { label: "Wind", class: "wind", percent: mix.wind, available: true },
      { label: "Solar", class: "solar", percent: mix.solar, available: true },
      { label: "Others (calculated)", class: "other-renewables", percent: mix.otherRenewables, available: mix.otherRenewables > 0 },
      { label: "Thermal/other", class: "thermal", percent: mix.thermalOther, available: true }
    ];

    const visibleRows = generationRows.filter(row => row.available !== false);

    const dominant = [...visibleRows].sort((a, b) => Number(b.percent || 0) - Number(a.percent || 0))[0];
    text("dominantFuel", dominant ? `${dominant.label} dominant` : "No mapped data");

    const generationHtml = visibleRows.map(item => {
      const width = Math.max(0, Math.min(100, Number(item.percent || 0)));
      const value = percent(item.percent);

      return `
        <div class="mix-row ${item.class}">
          <label>${item.label}</label>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <strong>${value}</strong>
        </div>
      `;
    }).join("");

    const netPct = Number(e.net_import_percent ?? e.interconnection_percent);
    const interconnectionMw = Number(e.interconnection_mw);
    const exportsMw = Number(e.exports_mw);
    const importsMw = Number(e.imports_mw);

    let flowMw = Number.isFinite(interconnectionMw)
      ? interconnectionMw
      : Number.isFinite(exportsMw) && exportsMw > 0
        ? -exportsMw
        : Number.isFinite(importsMw) && importsMw > 0
          ? importsMw
          : 0;

    const isExport = flowMw < -0.5 || (Number.isFinite(netPct) && netPct < -0.005);
    const isImport = flowMw > 0.5 || (Number.isFinite(netPct) && netPct > 0.005);

    const flowPct = Number.isFinite(netPct) ? netPct : 0;
    const scaleMax = 30;
    const clampedPct = Math.max(-scaleMax, Math.min(scaleMax, flowPct));
    const scaledWidth = Math.abs(clampedPct) / scaleMax * 50;
    const flowLeft = clampedPct < 0 ? 50 - scaledWidth : 50;
    const flowClass = isExport ? "export" : isImport ? "import" : "balanced";

    const flowLabel = isExport
      ? "↗ Net export"
      : isImport
        ? "↘ Net import"
        : "Near balanced";

    const absFlowMw = Math.abs(flowMw);
    const flowValue = absFlowMw >= 1000
      ? `${(absFlowMw / 1000).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} GW`
      : `${absFlowMw.toLocaleString(undefined, {
          maximumFractionDigits: 0
        })} MW`;

    const pctText = Number.isFinite(netPct) && Math.abs(netPct) > 0.005
      ? `${Math.abs(netPct).toFixed(2)}% visible net-flow signal`
      : "Live net-flow signal";

    const flowHtml = `
      <div class="mix-flow-separator" role="presentation"></div>

      <div class="mix-flow-card ${flowClass}">
        <div class="mix-flow-copy">
          <span>Cross-border flow</span>
          <strong>${flowLabel}</strong>
          <small>${pctText}</small>
        </div>

        <div class="mix-flow-meter">
          <b>${flowValue}</b>

          <div class="mix-flow-scale" aria-label="Cross-border flow scale from 30 percent export to 30 percent import">
            <div class="mix-flow-axis"></div>
            <div class="mix-flow-zero"></div>
            <div
              class="mix-flow-fill ${flowClass}"
              style="left:${flowLeft}%; width:${scaledWidth}%"
            ></div>
          </div>

          <div class="mix-flow-scale-labels" aria-hidden="true">
            <span>-30% export</span>
            <span>0</span>
            <span>+30% import</span>
          </div>
        </div>
      </div>
    `;

    target.innerHTML = generationHtml + flowHtml;
  };
})();
// IETM live mix bars from electricity_now: END

// IETM demand balance warning renderer: BEGIN
(function () {
  const previousRenderDataQuality = renderDataQuality;

  renderDataQuality = function renderDataQualityWithDemandBalance(data) {
    previousRenderDataQuality(data);

    const target = document.getElementById("dataQualityList");
    if (!target) return;

    const e = data.electricity_now || {};
    if (demandPassesBalanceCheck(e)) return;

    const gap = demandBalanceGapMw(e);
    const gapText = Number.isFinite(gap)
      ? `${Math.round(gap).toLocaleString()} MW`
      : "unknown gap";

    target.insertAdjacentHTML("afterbegin", `
      <div class="quality-item missing">
        <span class="quality-badge">withheld</span>
        <strong>System demand</strong>
        <small>Demand feed is not shown in the top cards because it fails the generation + net-flow balance check. Gap: ${gapText}.</small>
      </div>
    `);
  };
})();
// IETM demand balance warning renderer: END

// IETM force residual sparkline purple: BEGIN
(function () {
  function forceResidualSparklinePurple() {
    for (const card of document.querySelectorAll("#dailyPulseGrid .pulse-card")) {
      const label = card.querySelector("span");
      if (!label) continue;

      if (label.textContent.trim().toLowerCase() !== "residual supply") continue;

      card.classList.add("residual-card", "thermal");
      card.classList.remove("caution");

      const purple = "#5b3a96";
      const purpleSoft = "rgba(91, 58, 150, 0.78)";
      const purpleFaint = "rgba(91, 58, 150, 0.28)";

      for (const el of card.querySelectorAll("svg path, svg polyline, svg line, .pulse-sparkline path, .pulse-sparkline polyline, .pulse-sparkline line")) {
        if (el.tagName.toLowerCase() === "line") {
          el.style.stroke = purpleFaint;
        } else {
          el.style.stroke = purpleSoft;
        }
      }

      // Fallback if colour is inherited through currentColor.
      for (const el of card.querySelectorAll("svg, .pulse-sparkline")) {
        el.style.color = purple;
      }

      break;
    }
  }

  const previousRenderDailyPulse = renderDailyPulse;

  renderDailyPulse = function renderDailyPulseWithPurpleResidual(data) {
    previousRenderDailyPulse(data);
    forceResidualSparklinePurple();
    setTimeout(forceResidualSparklinePurple, 0);
    setTimeout(forceResidualSparklinePurple, 120);
  };

  document.addEventListener("DOMContentLoaded", () => {
    forceResidualSparklinePurple();
    setTimeout(forceResidualSparklinePurple, 0);
    setTimeout(forceResidualSparklinePurple, 250);
  });
})();
// IETM force residual sparkline purple: END
