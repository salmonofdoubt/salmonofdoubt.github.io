import { prettyNumber, safeText } from "./format.js";
import {
  ALL_LOCATIONS,
  buildCqResult,
  classifySites,
  parameterOptions,
  r2Caution,
  siteOptions,
  slopeInterpretation
} from "./cqEngine.js";

function fillParameterOptions(select, records) {
  if (!select) return;

  const current = select.value || "po4_p";
  const options = parameterOptions(records);

  select.innerHTML = options.map(parameter => `
    <option value="${parameter.key}" ${parameter.available ? "" : "disabled"}>${parameter.label}</option>
  `).join("");

  select.value = options.some(parameter => parameter.key === current && parameter.available)
    ? current
    : (options.find(parameter => parameter.available)?.key || "po4_p");
}

function fillLocationOptions(select, records, focusAreas, focusAreaId) {
  if (!select) return;

  const current = select.value || ALL_LOCATIONS;
  const sites = siteOptions(records, focusAreas, focusAreaId);

  select.innerHTML = [
    `<option value="${ALL_LOCATIONS}">All focus samples — screening only</option>`,
    ...sites.map(site => `<option value="${site.key}">${site.label} (${site.count})</option>`)
  ].join("");

  select.value = sites.some(site => site.key === current) ? current : ALL_LOCATIONS;
}

function metric(title, value, text) {
  return `
    <article class="cq-metric">
      <b>${value}</b>
      <strong>${title}</strong>
      <p>${text}</p>
    </article>
  `;
}

function statusPanel(result, options) {
  const regression = result.regression;
  const slope = slopeInterpretation(regression);
  const screening = result.locationMode === "screening";

  return `
    <article class="cq-status-panel">
      <div>
        <p class="eyebrow mini">Mode</p>
        <h3>${screening ? "Screening view" : "Single-location view"}</h3>
        <p>${screening
          ? "Multiple chemistry locations are shown. Pooled regression is intentionally suppressed."
          : "One chemistry location is selected. Regression is allowed only when enough Q variation exists."
        }</p>
      </div>
      <div>
        <p class="eyebrow mini">Slope interpretation</p>
        <h3 class="${slope.className}">${slope.label}</h3>
        <p>${slope.text}</p>
      </div>
      <div>
        <p class="eyebrow mini">Pairing</p>
        <h3>${options.pairing === "imported_q" ? "Imported Q" : "Candidate Q"}</h3>
        <p>${options.pairing === "imported_q"
          ? "Using imported q_proxy_m3_s from the chemistry CSV for Q."
          : "Using OPW candidate Q. Treat as exploratory unless station and time matching are defensible."
        }</p>
      </div>
      <div>
        <p class="eyebrow mini">R² caution</p>
        <h3>${regression.ok ? `R² ${prettyNumber(regression.r2, 3)}` : "Not fitted"}</h3>
        <p>${r2Caution(regression, options.pairing)}</p>
      </div>
    </article>
  `;
}

function renderSummary(target, result, options) {
  if (!target) return;

  const regression = result.regression;

  target.innerHTML = `
    ${statusPanel(result, options)}
    <div class="cq-metric-row">
      ${metric("Chemistry samples", result.chemistry.length.toLocaleString("en-IE"), "Filtered C records for this parameter, period and location.")}
      ${metric("C-Q pairs", result.pairs.length.toLocaleString("en-IE"), `${options.pairing.replace(/_/g, " ")} · ${options.timeRule.replace(/_/g, " ")}`)}
      ${metric("Q variety", regression.distinctX || 0, regression.distinctX < 3 ? "Too few distinct Q values for a meaningful fit." : "Enough distinct Q values for exploratory fitting.")}
      ${metric("Regression", regression.ok ? `β ${prettyNumber(regression.slope, 3)}` : "Not fitted", regression.ok ? `R² ${prettyNumber(regression.r2, 3)} · n ${regression.n}` : regression.reason)}
    </div>
  `;
}

function renderSiteClassifier(target, options) {
  if (!target) return;

  const rows = classifySites(options);

  if (!rows.length) {
    target.innerHTML = `
      <section class="cq-site-classifier">
        <div class="section-heading compact">
          <p class="eyebrow mini">Site classifier</p>
          <h3>No chemistry sites to classify</h3>
          <p>Import chemistry records with a site or station column to classify C-Q behaviour by location.</p>
        </div>
      </section>
    `;
    return;
  }

  target.innerHTML = `
    <section class="cq-site-classifier">
      <div class="section-heading compact">
        <p class="eyebrow mini">Site classifier</p>
        <h3>Activation, dilution, or weak response by C location</h3>
        <p>Each row is fitted separately using the current parameter, period and pairing rule.</p>
      </div>

      <div class="cq-classifier-table-wrap">
        <table class="cq-classifier-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Class</th>
              <th>β</th>
              <th>R²</th>
              <th>n</th>
              <th>Q variety</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><strong>${row.site.label}</strong><small>${row.site.count} chemistry samples</small></td>
                <td><span class="cq-class-pill ${row.interpretation.className}">${row.interpretation.label}</span></td>
                <td>${row.regression.ok ? prettyNumber(row.regression.slope, 3) : "—"}</td>
                <td>${row.regression.ok ? prettyNumber(row.regression.r2, 3) : "—"}</td>
                <td>${row.n}</td>
                <td>${row.qVariety}</td>
                <td><button type="button" class="cq-open-site" data-site="${row.site.key}">View</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  target.querySelectorAll(".cq-open-site").forEach(button => {
    button.addEventListener("click", () => {
      if (!options.locationSelect) return;
      options.locationSelect.value = button.dataset.site;
      options.locationSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function renderPairTable(target, pairs) {
  if (!target) return;

  if (!pairs.length) {
    target.innerHTML = `
      <tr>
        <td colspan="9">No candidate pairs under the current rules. Choose Imported Q from CSV if your file has q_proxy_m3_s.</td>
      </tr>
    `;
    return;
  }

  target.innerHTML = pairs.slice(0, 80).map(pair => `
    <tr>
      <td>${safeText(pair.siteLabel)}</td>
      <td><strong>${safeText(pair.chemRecord.name)}</strong><small>${safeText(pair.chemRecord.observed_at, "unknown date")}</small></td>
      <td>${safeText(pair.parameter.label || pair.parameter.key)}</td>
      <td>${prettyNumber(pair.concentration)} ${safeText(pair.parameter.unit, "")}</td>
      <td><strong>${safeText(pair.hydroRecord.name)}</strong><small>${safeText(pair.hydroRecord.observed_at, "latest/unknown")}</small></td>
      <td>${prettyNumber(pair.q)} ${safeText(pair.qUnit, "")}</td>
      <td>${Number.isFinite(pair.distanceKm) ? `${prettyNumber(pair.distanceKm, 2)} km` : "—"}</td>
      <td>${pair.quality}</td>
      <td>${pair.reason}</td>
    </tr>
  `).join("");
}

function drawEmpty(ctx, width, height, message, detail) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#061816";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#9ccbc4";
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(message, 42, 92);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(detail, 42, 128);
}

function drawScatter(canvas, caption, result, pairing) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pairs = result.pairs;
  const regression = result.regression;

  if (!pairs.length) {
    drawEmpty(ctx, width, height, "No C-Q candidate pairs under current rules.", "Use Imported Q from CSV if the file has q_proxy_m3_s.");
    if (caption) caption.textContent = "C-Q needs both concentration C and hydrometric Q.";
    return;
  }

  const values = pairs
    .filter(pair => Number(pair.q) > 0 && Number(pair.concentration) > 0)
    .map(pair => ({ x: Math.log10(Number(pair.q)), y: Math.log10(Number(pair.concentration)), pair }));

  if (!values.length) {
    drawEmpty(ctx, width, height, "Pairs found, but not plottable on log scale.", "Q and concentration must both be positive.");
    return;
  }

  const xMin = Math.min(...values.map(item => item.x));
  const xMax = Math.max(...values.map(item => item.x));
  const yMin = Math.min(...values.map(item => item.y));
  const yMax = Math.max(...values.map(item => item.y));
  const regressionY = regression.ok ? [regression.intercept + regression.slope * xMin, regression.intercept + regression.slope * xMax] : [];
  const plottedYMin = regression.ok ? Math.min(yMin, ...regressionY) : yMin;
  const plottedYMax = regression.ok ? Math.max(yMax, ...regressionY) : yMax;
  const pad = 58;

  function sx(value) {
    if (xMax === xMin) return width / 2;
    return pad + ((value - xMin) / (xMax - xMin)) * (width - pad * 1.7);
  }

  function sy(value) {
    if (plottedYMax === plottedYMin) return height / 2;
    return height - pad - ((value - plottedYMin) / (plottedYMax - plottedYMin)) * (height - pad * 1.7);
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#061816";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(156, 203, 196, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 24);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - 24, height - pad);
  ctx.stroke();

  if (regression.ok && xMax !== xMin) {
    ctx.strokeStyle = "rgba(253, 230, 138, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(xMin), sy(regression.intercept + regression.slope * xMin));
    ctx.lineTo(sx(xMax), sy(regression.intercept + regression.slope * xMax));
    ctx.stroke();

    ctx.fillStyle = "#fde68a";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText(`β = ${prettyNumber(regression.slope, 3)} · R² = ${prettyNumber(regression.r2, 3)} · n = ${regression.n}`, pad + 8, 36);
  }

  ctx.fillStyle = "#5eead4";
  values.forEach(item => {
    ctx.beginPath();
    ctx.arc(sx(item.x), sy(item.y), 5.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#ecfffb";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText("log₁₀(Q)", pad, height - 20);

  ctx.save();
  ctx.translate(20, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("log₁₀(C)", 0, 0);
  ctx.restore();

  const slope = slopeInterpretation(regression);
  if (caption) {
    caption.textContent = regression.ok
      ? `${pairs.length} single-location C-Q pairs. ${slope.label}: β = ${prettyNumber(regression.slope, 3)}, R² = ${prettyNumber(regression.r2, 3)}. ${r2Caution(regression, pairing)}`
      : `${pairs.length} candidate C-Q pairs shown. Regression not fitted: ${regression.reason}`;
  }
}

export function drawCqChart(options) {
  if (!options?.canvas) return;

  fillParameterOptions(options.parameterSelect, options.records || []);
  fillLocationOptions(options.locationSelect, options.records || [], options.focusAreas, options.focusAreaId);

  const parameter = options.parameterSelect?.value || options.parameter || "po4_p";
  const location = options.locationSelect?.value || ALL_LOCATIONS;
  const result = buildCqResult({ ...options, parameter, location });

  renderSiteClassifier(options.classifierTarget, { ...options, parameter, location });
  renderSummary(options.summary, result, { ...options, parameter, location });
  renderPairTable(options.pairTableBody, result.pairs);
  drawScatter(options.canvas, options.caption, result, options.pairing);
}
