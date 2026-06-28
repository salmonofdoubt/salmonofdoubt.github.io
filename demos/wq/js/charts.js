import { activeFocusArea, hasCoordinates, recordWithinArea } from "./records.js";
import { prettyNumber, safeText, normaliseKey } from "./format.js";

const ALL_LOCATIONS = "__all__";

const PARAMETERS = [
  { key: "po4_p", label: "PO₄-P", aliases: ["po4_p", "po4-p", "phosphate_p", "orthophosphate"] },
  { key: "no3_n", label: "NO₃-N", aliases: ["no3_n", "no3-n", "nitrate_n", "nitrate"] },
  { key: "nh4_n", label: "NH₄-N", aliases: ["nh4_n", "nh4-n", "ammonium_n", "ammonium"] },
  { key: "no2_n", label: "NO₂-N", aliases: ["no2_n", "no2-n", "nitrite_n", "nitrite"] },
  { key: "ton_n", label: "TON-N", aliases: ["ton_n", "ton-n", "ton", "total_oxidised_nitrogen"] }
];

const DIRECT_Q_KEYS = [
  "q_proxy_m3_s",
  "q_proxy",
  "flow_m3_s",
  "flow",
  "discharge_m3_s",
  "discharge",
  "q"
];

const HYDRO_VALUE_PATTERN = /(flow|discharge|level|waterlevel|water level|stage|value)/i;
const HYDRO_IGNORE_PATTERN = /(sensor|region|err|error|code|id|ref)/i;

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / 86400000;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(",", "").trim());
  return Number.isFinite(num) ? num : null;
}

function haversineKm(a, b) {
  if (!hasCoordinates(a) || !hasCoordinates(b)) return Infinity;

  const r = 6371;
  const lat1 = Number(a.lat) * Math.PI / 180;
  const lat2 = Number(b.lat) * Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180;
  const dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

function focusRecords(records, focusAreas, focusAreaId) {
  const area = activeFocusArea(focusAreas, focusAreaId);
  if (!area) return records;

  return records.filter(record =>
    record.focus_area_ids?.includes(area.id) || recordWithinArea(record, area)
  );
}

function cleanSiteName(name) {
  return String(name || "Unknown chemistry location")
    .replace(/\b(sample|chemistry|nutrient)\b/gi, "")
    .replace(/\b(low[- ]?flow|baseline|post[- ]?rainfall|post[- ]?rain|post[- ]?event|rising[- ]?limb|falling[- ]?limb|recession|storm[- ]?peak|peak|runoff[- ]?response|runoff|pulse|early[- ]?rise|recovery)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chemistrySiteLabel(record) {
  const raw = record.raw || {};
  const explicit = raw.site_id || raw.site || raw.station_id || raw.station || raw.location_id || raw.location_group || raw.reach;
  return explicit ? String(explicit).trim() : cleanSiteName(record.name);
}

function chemistrySiteKey(record) {
  return normaliseKey(chemistrySiteLabel(record));
}

function parameterMatches(parameter, requestedKey) {
  const pkey = normaliseKey(parameter.key || parameter.label);
  const rule = PARAMETERS.find(item => item.key === requestedKey);
  if (!rule) return pkey === requestedKey;
  return rule.aliases.some(alias => normaliseKey(alias) === pkey) || pkey === requestedKey;
}

function directQFromChemistryRecord(record) {
  const raw = record.raw || {};

  for (const key of DIRECT_Q_KEYS) {
    const direct = numberValue(raw[key] ?? raw[normaliseKey(key)]);
    if (direct !== null && direct > 0) {
      return {
        value: direct,
        label: key === "q_proxy_m3_s" ? "Imported Q proxy" : key.replace(/_/g, " "),
        unit: key.includes("m3") || key.includes("m_3") ? "m³/s" : ""
      };
    }
  }

  for (const parameter of record.parameters || []) {
    const key = normaliseKey(parameter.key || parameter.label);
    if (!DIRECT_Q_KEYS.includes(key)) continue;

    const value = numberValue(parameter.value);
    if (value !== null && value > 0) {
      return {
        value,
        label: parameter.label || parameter.key || "Imported Q proxy",
        unit: parameter.unit || ""
      };
    }
  }

  return null;
}

function chemistryRecords(records, parameterKey, locationKey = ALL_LOCATIONS) {
  return records
    .filter(record => record.type === "chemistry_sample")
    .filter(record => locationKey === ALL_LOCATIONS || chemistrySiteKey(record) === locationKey)
    .map(record => {
      const parameter = (record.parameters || []).find(item => parameterMatches(item, parameterKey));
      if (!parameter) return null;

      const concentration = Number(parameter.value);
      if (!Number.isFinite(concentration)) return null;

      return {
        record,
        parameter,
        concentration,
        directQ: directQFromChemistryRecord(record),
        siteKey: chemistrySiteKey(record),
        siteLabel: chemistrySiteLabel(record),
        observedDate: toDate(record.observed_at || record.generated_at)
      };
    })
    .filter(Boolean);
}

function hydrometricValue(record) {
  const useful = (record.parameters || []).find(parameter => {
    const label = `${parameter.key || ""} ${parameter.label || ""}`;
    const value = Number(parameter.value);
    return Number.isFinite(value) && HYDRO_VALUE_PATTERN.test(label) && !HYDRO_IGNORE_PATTERN.test(label);
  });

  if (useful) {
    return {
      value: Number(useful.value),
      label: useful.label || useful.key || "hydrometric value",
      unit: useful.unit || ""
    };
  }

  const fallback = (record.parameters || []).find(parameter => {
    const key = normaliseKey(parameter.key || parameter.label);
    const value = Number(parameter.value);
    return Number.isFinite(value) && key === "value";
  });

  if (!fallback) return null;

  return {
    value: Number(fallback.value),
    label: "hydrometric value",
    unit: fallback.unit || ""
  };
}

function hydroRecords(records) {
  return records
    .filter(record => record.type === "water_level")
    .map(record => {
      const q = hydrometricValue(record);
      if (!q) return null;

      return {
        record,
        q,
        observedDate: toDate(record.observed_at || record.generated_at)
      };
    })
    .filter(Boolean);
}

function periodFilter(items, period, start, end) {
  if (period === "all") return items;

  if (period === "custom") {
    const startDate = start ? new Date(start + "T00:00:00") : null;
    const endDate = end ? new Date(end + "T23:59:59") : null;

    return items.filter(item => {
      if (!item.observedDate) return false;
      if (startDate && item.observedDate < startDate) return false;
      if (endDate && item.observedDate > endDate) return false;
      return true;
    });
  }

  const days = Number(period);
  if (!Number.isFinite(days)) return items;

  const now = new Date();
  return items.filter(item => item.observedDate && daysBetween(now, item.observedDate) <= days);
}

function nearestMatch(chem, hydros, maxKm = Infinity) {
  return hydros
    .map(hydro => ({ hydro, distance: haversineKm(chem.record, hydro.record) }))
    .filter(item => item.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function timeRuleAllows(chem, hydro, timeRule) {
  if (timeRule === "latest") return { ok: true, quality: "Weak candidate", reason: "latest Q only" };

  const diff = daysBetween(chem.observedDate, hydro.observedDate);
  if (diff === null) return { ok: false, quality: "Not pairable", reason: "missing chemistry or hydrometry timestamp" };

  if (timeRule === "same_day" && diff <= 0.5) return { ok: true, quality: "Defensible candidate", reason: "same-day timestamp window" };
  if (timeRule === "24h" && diff <= 1) return { ok: true, quality: "Candidate pair", reason: "±24 h timestamp window" };
  if (timeRule === "72h" && diff <= 3) return { ok: true, quality: "Weak candidate", reason: "±72 h timestamp window" };

  return { ok: false, quality: "Not pairable", reason: `outside ${timeRule} time rule` };
}

function buildPairs(options) {
  const scoped = focusRecords(options.records, options.focusAreas, options.focusAreaId);
  const locationMode = options.location === ALL_LOCATIONS ? "screening" : "single_location";
  const chemistry = periodFilter(
    chemistryRecords(scoped, options.parameter, options.location),
    options.period,
    options.start,
    options.end
  );
  const hydros = hydroRecords(scoped);
  const maxKm = Number(options.distanceKm || 10);
  const pairs = [];

  chemistry.forEach(chem => {
    if (options.pairing === "imported_q") {
      if (!chem.directQ) return;

      pairs.push({
        chemRecord: chem.record,
        hydroRecord: {
          name: "Imported Q from chemistry CSV",
          observed_at: chem.record.observed_at || chem.record.generated_at
        },
        siteLabel: chem.siteLabel,
        parameter: chem.parameter,
        concentration: chem.concentration,
        q: chem.directQ.value,
        qLabel: chem.directQ.label,
        qUnit: chem.directQ.unit,
        distanceKm: 0,
        quality: "Imported Q candidate",
        reason: "q_proxy_m3_s from chemistry CSV",
        chemDate: chem.observedDate,
        hydroDate: chem.observedDate
      });
      return;
    }

    let candidate = null;

    if (options.pairing === "same_station") {
      const cname = normaliseKey(chem.record.name);
      const hydro = hydros.find(item => normaliseKey(item.record.name) === cname);
      if (hydro) candidate = { hydro, distance: haversineKm(chem.record, hydro.record) };
    } else if (options.pairing === "same_focus") {
      candidate = nearestMatch(chem, hydros, Infinity);
    } else if (options.pairing === "within_km") {
      candidate = nearestMatch(chem, hydros, maxKm);
    } else {
      candidate = nearestMatch(chem, hydros, maxKm);
    }

    if (!candidate) return;

    const time = timeRuleAllows(chem, candidate.hydro, options.timeRule);
    if (!time.ok) return;

    pairs.push({
      chemRecord: chem.record,
      hydroRecord: candidate.hydro.record,
      siteLabel: chem.siteLabel,
      parameter: chem.parameter,
      concentration: chem.concentration,
      q: candidate.hydro.q.value,
      qLabel: candidate.hydro.q.label,
      qUnit: candidate.hydro.q.unit,
      distanceKm: candidate.distance,
      quality: time.quality,
      reason: time.reason,
      chemDate: chem.observedDate,
      hydroDate: candidate.hydro.observedDate
    });
  });

  return { scoped, chemistry, hydros, pairs, locationMode };
}

function fillParameterOptions(select, records) {
  if (!select) return;

  const current = select.value || "po4_p";
  const available = new Set();

  records
    .filter(record => record.type === "chemistry_sample")
    .forEach(record => {
      (record.parameters || []).forEach(parameter => {
        PARAMETERS.forEach(rule => {
          if (parameterMatches(parameter, rule.key)) available.add(rule.key);
        });
      });
    });

  select.innerHTML = PARAMETERS.map(parameter => {
    const disabled = available.size && !available.has(parameter.key) ? "disabled" : "";
    return `<option value="${parameter.key}" ${disabled}>${parameter.label}</option>`;
  }).join("");

  select.value = available.has(current) || !available.size ? current : [...available][0];
}

function fillLocationOptions(select, records, focusAreas, focusAreaId) {
  if (!select) return;

  const current = select.value || ALL_LOCATIONS;
  const scoped = focusRecords(records || [], focusAreas, focusAreaId);
  const sites = new Map();

  scoped
    .filter(record => record.type === "chemistry_sample")
    .forEach(record => {
      const key = chemistrySiteKey(record);
      const label = chemistrySiteLabel(record);
      if (!sites.has(key)) sites.set(key, { key, label, count: 0 });
      sites.get(key).count += 1;
    });

  select.innerHTML = [
    `<option value="${ALL_LOCATIONS}">All focus samples — screening only</option>`,
    ...[...sites.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(site => `<option value="${site.key}">${site.label} (${site.count})</option>`)
  ].join("");

  select.value = sites.has(current) ? current : ALL_LOCATIONS;
}

function regressionStats(pairs, locationMode) {
  if (locationMode !== "single_location") {
    return {
      ok: false,
      n: pairs.length,
      distinctX: 0,
      slope: null,
      intercept: null,
      r2: null,
      reason: "Screening view pools multiple C locations; pooled regression is suppressed."
    };
  }

  const points = pairs
    .filter(pair => Number(pair.q) > 0 && Number(pair.concentration) > 0)
    .map(pair => ({ x: Math.log10(Number(pair.q)), y: Math.log10(Number(pair.concentration)) }));

  const distinctX = new Set(points.map(point => point.x.toFixed(6))).size;

  if (points.length < 3 || distinctX < 3) {
    return {
      ok: false,
      n: points.length,
      distinctX,
      slope: null,
      intercept: null,
      r2: null,
      reason: points.length < 3
        ? "Need at least three positive C-Q pairs for one location."
        : `Need at least three distinct Q values for one location; current pairing has ${distinctX}.`
    };
  }

  const n = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
  const ssX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const ssY = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const ssXY = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);

  if (ssX === 0 || ssY === 0) {
    return { ok: false, n, distinctX, slope: null, intercept: null, r2: null, reason: "No variation in Q or C." };
  }

  const slope = ssXY / ssX;
  const intercept = meanY - slope * meanX;
  const r = ssXY / Math.sqrt(ssX * ssY);

  return {
    ok: true,
    n,
    distinctX,
    slope,
    intercept,
    r2: r ** 2,
    reason: "Single-location exploratory log-log ordinary least squares fit."
  };
}

function slopeInterpretation(regression) {
  if (!regression.ok) return { label: "Not fitted", text: regression.reason };

  if (regression.slope > 0.25) {
    return {
      label: "Activation",
      text: "Positive β: concentration rises with Q, suggesting mobilisation, flushing, runoff connection, or source activation."
    };
  }

  if (regression.slope < -0.25) {
    return {
      label: "Dilution",
      text: "Negative β: concentration falls with Q, suggesting dilution, source exhaustion, or weak source connection."
    };
  }

  return {
    label: "Weak / chemostatic",
    text: "β is close to zero. Concentration changes little with Q, or the signal is too weak/noisy."
  };
}

function r2Caution(regression, pairing) {
  if (!regression.ok) return regression.reason;
  if (regression.r2 >= 0.9 && pairing === "imported_q") return "Very high R² from imported/synthetic Q; useful for teaching, not evidence unless values are real paired field observations.";
  if (regression.r2 >= 0.7) return "Strong exploratory fit. Check event phase, independence and pairing before interpretation.";
  if (regression.r2 >= 0.3) return "Moderate fit. Direction may be useful, but scatter and event phase matter.";
  return "Weak fit. Direction is uncertain.";
}

function statusPanel(result, options, regression) {
  const slope = slopeInterpretation(regression);
  const screening = result.locationMode === "screening";

  const modeTitle = screening ? "Screening view" : "Single-location view";
  const modeText = screening
    ? "Multiple chemistry locations are shown. Pooled regression is intentionally suppressed."
    : "One chemistry location is selected. Regression is allowed only when enough Q variation exists.";

  const pairText = options.pairing === "imported_q"
    ? "Using imported q_proxy_m3_s from the chemistry CSV for Q."
    : "Using OPW candidate Q. Treat as exploratory unless station and time matching are defensible.";

  return `
    <article class="cq-status-panel">
      <div>
        <p class="eyebrow mini">Mode</p>
        <h3>${modeTitle}</h3>
        <p>${modeText}</p>
      </div>
      <div>
        <p class="eyebrow mini">Slope interpretation</p>
        <h3>${slope.label}</h3>
        <p>${slope.text}</p>
      </div>
      <div>
        <p class="eyebrow mini">Pairing</p>
        <h3>${options.pairing === "imported_q" ? "Imported Q" : "Candidate Q"}</h3>
        <p>${pairText}</p>
      </div>
      <div>
        <p class="eyebrow mini">R² caution</p>
        <h3>${regression.ok ? `R² ${prettyNumber(regression.r2, 3)}` : "Not fitted"}</h3>
        <p>${r2Caution(regression, options.pairing)}</p>
      </div>
    </article>
  `;
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

function renderSummary(target, result, options) {
  if (!target) return;

  const regression = regressionStats(result.pairs, result.locationMode);

  target.innerHTML = `
    ${statusPanel(result, options, regression)}
    <div class="cq-metric-row">
      ${metric("Chemistry samples", result.chemistry.length.toLocaleString("en-IE"), "Filtered C records for this parameter, period and location.")}
      ${metric("C-Q pairs", result.pairs.length.toLocaleString("en-IE"), `${options.pairing.replace(/_/g, " ")} · ${options.timeRule.replace(/_/g, " ")}`)}
      ${metric("Q variety", regression.distinctX || 0, regression.distinctX < 3 ? "Too few distinct Q values for a meaningful fit." : "Enough distinct Q values for exploratory fitting.")}
      ${metric("Regression", regression.ok ? `β ${prettyNumber(regression.slope, 3)}` : "Not fitted", regression.ok ? `R² ${prettyNumber(regression.r2, 3)} · n ${regression.n}` : regression.reason)}
    </div>
  `;
}

function renderTable(target, pairs) {
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

function drawScatter(canvas, caption, pairs, locationMode, pairing) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const regression = regressionStats(pairs, locationMode);

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

  if (caption) {
    caption.textContent = regression.ok
      ? `${pairs.length} single-location C-Q pairs. ${slopeInterpretation(regression).label}: β = ${prettyNumber(regression.slope, 3)}, R² = ${prettyNumber(regression.r2, 3)}. ${r2Caution(regression, pairing)}`
      : `${pairs.length} candidate C-Q pairs shown. Regression not fitted: ${regression.reason}`;
  }
}

export function drawCqChart(options) {
  if (!options?.canvas) return;

  fillParameterOptions(options.parameterSelect, options.records || []);
  fillLocationOptions(options.locationSelect, options.records || [], options.focusAreas, options.focusAreaId);

  const parameter = options.parameterSelect?.value || options.parameter || "po4_p";
  const location = options.locationSelect?.value || ALL_LOCATIONS;
  const result = buildPairs({ ...options, parameter, location });

  renderSummary(options.summary, result, { ...options, parameter, location });
  renderTable(options.pairTableBody, result.pairs);
  drawScatter(options.canvas, options.caption, result.pairs, result.locationMode, options.pairing);
}
