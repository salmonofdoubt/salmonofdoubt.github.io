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
      <strong>${Number(drift.latest_value).toFixed(1)}%</strong>
      <small>${drift.latest_year}</small>
    </article>

    <article class="target-drift-card">
      <span>2030 benchmark</span>
      <strong>${Number(drift.target_value).toFixed(0)}%</strong>
      <small>Renewable electricity</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Gap to target</span>
      <strong>${Number(drift.gap_to_target_pp).toFixed(1)} pp</strong>
      <small>${drift.years_remaining} years remaining</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Required gain</span>
      <strong>${Number(drift.required_annual_gain_pp).toFixed(2)} pp/yr</strong>
      <small>From ${drift.latest_year} to ${drift.target_year}</small>
    </article>

    <article class="target-drift-card ${statusClass}">
      <span>Recent gain</span>
      <strong>${Number(drift.recent_two_year_gain_pp_per_year).toFixed(2)} pp/yr</strong>
      <small>Two-year average</small>
    </article>

    <article class="target-drift-card ${statusClass}">
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
