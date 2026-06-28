import { activeFocusArea, hasCoordinates, recordWithinArea } from "./records.js";
import { normaliseKey } from "./format.js";

export const ALL_LOCATIONS = "__all__";

export const PARAMETERS = [
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

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(",", "").trim());
  return Number.isFinite(num) ? num : null;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / 86400000;
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

export function focusRecords(records, focusAreas, focusAreaId) {
  const area = activeFocusArea(focusAreas, focusAreaId);
  if (!area) return records || [];

  return (records || []).filter(record =>
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

export function chemistrySiteLabel(record) {
  const raw = record.raw || {};
  const explicit = raw.site_id || raw.site || raw.station_id || raw.station || raw.location_id || raw.location_group || raw.reach;
  return explicit ? String(explicit).trim() : cleanSiteName(record.name);
}

export function chemistrySiteKey(record) {
  return normaliseKey(chemistrySiteLabel(record));
}

export function parameterMatches(parameter, requestedKey) {
  const pkey = normaliseKey(parameter.key || parameter.label);
  const rule = PARAMETERS.find(item => item.key === requestedKey);
  if (!rule) return pkey === requestedKey;
  return rule.aliases.some(alias => normaliseKey(alias) === pkey) || pkey === requestedKey;
}

export function directQFromChemistryRecord(record) {
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

export function chemistryRecords(records, parameterKey, locationKey = ALL_LOCATIONS) {
  return (records || [])
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

export function hydroRecords(records) {
  return (records || [])
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

export function buildCqResult(options) {
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

  const regression = regressionStats(pairs, locationMode);
  return { scoped, chemistry, hydros, pairs, locationMode, regression };
}

export function siteOptions(records, focusAreas, focusAreaId) {
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

  return [...sites.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function parameterOptions(records) {
  const available = new Set();

  (records || [])
    .filter(record => record.type === "chemistry_sample")
    .forEach(record => {
      (record.parameters || []).forEach(parameter => {
        PARAMETERS.forEach(rule => {
          if (parameterMatches(parameter, rule.key)) available.add(rule.key);
        });
      });
    });

  return PARAMETERS.map(parameter => ({
    ...parameter,
    available: !available.size || available.has(parameter.key)
  }));
}

export function regressionStats(pairs, locationMode) {
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

export function slopeInterpretation(regression) {
  if (!regression.ok) return { label: "Not fitted", className: "not-fitted", text: regression.reason };

  if (regression.slope > 0.25) {
    return {
      label: "Activation",
      className: "activation",
      text: "Positive β: concentration rises with Q, suggesting mobilisation, flushing, runoff connection, or source activation."
    };
  }

  if (regression.slope < -0.25) {
    return {
      label: "Dilution",
      className: "dilution",
      text: "Negative β: concentration falls with Q, suggesting dilution, source exhaustion, or weak source connection."
    };
  }

  return {
    label: "Weak / chemostatic",
    className: "weak",
    text: "β is close to zero. Concentration changes little with Q, or the signal is too weak/noisy."
  };
}

export function r2Caution(regression, pairing) {
  if (!regression.ok) return regression.reason;
  if (regression.r2 >= 0.9 && pairing === "imported_q") return "Very high R² from imported/synthetic Q; useful for teaching, not evidence unless values are real paired field observations.";
  if (regression.r2 >= 0.7) return "Strong exploratory fit. Check event phase, independence and pairing before interpretation.";
  if (regression.r2 >= 0.3) return "Moderate fit. Direction may be useful, but scatter and event phase matter.";
  return "Weak fit. Direction is uncertain.";
}

export function classifySites(options) {
  return siteOptions(options.records, options.focusAreas, options.focusAreaId).map(site => {
    const result = buildCqResult({ ...options, location: site.key });
    const interpretation = slopeInterpretation(result.regression);

    return {
      site,
      result,
      interpretation,
      regression: result.regression,
      n: result.pairs.length,
      qVariety: result.regression.distinctX || 0
    };
  });
}
