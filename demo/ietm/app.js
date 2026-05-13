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


function metricAccentKey(label) {
  const key = String(label || "").toLowerCase();

  if (key.includes("renewable")) return "renewables";
  if (key.includes("wind")) return "wind";
  if (key.includes("solar")) return "solar";
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
      label: "2030 target gap",
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
    <article class="pulse-card ${tone}">
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
      label: "Electricity demand",
      value: pulseNumber(demandGw, 2),
      unit: "GW",
      note: "Latest mapped system demand.",
      key: "demand_gw",
      history,
      delta: iemDelta(history, "demand_gw", { digits: 2, unit: "GW", goodWhen: "neutral" })
    }),
    pulseCard({
      label: "Renewables now",
      value: pulseNumber(renewables, 0),
      unit: "%",
      note: "Wind and solar in the latest mapped interval.",
      key: "renewables_percent",
      history,
      tone: "good",
      delta: iemDelta(history, "renewables_percent", { digits: 1, unit: "pp", goodWhen: "up" })
    }),
    pulseCard({
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
      label: "Imports",
      value: pulseNumber(imports, 0),
      unit: "%",
      note: "Mapped interconnector import contribution. Exports are not negative imports.",
      key: "imports_percent",
      history,
      delta: iemDelta(history, "imports_percent", { digits: 1, unit: "pp", goodWhen: "neutral" })
    }),
    pulseCard({
      label: "Residual supply",
      value: pulseNumber(residual, 0),
      unit: "%",
      note: "Computed remainder, not measured gas.",
      key: "residual_percent",
      history,
      tone: "caution",
      delta: iemDelta(history, "residual_percent", { digits: 1, unit: "pp", goodWhen: "down" })
    }),
    pulseCard({
      label: "2030 target gap",
      value: pulseNumber(gap, 1),
      unit: "pp",
      note: "Official annual gap to 80% renewable electricity, not a live 30-day signal.",
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
