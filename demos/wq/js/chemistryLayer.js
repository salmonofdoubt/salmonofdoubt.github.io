const STORAGE_KEY = "catchment-pulse-local-chemistry-v1";

const WIDE_PARAMETER_COLUMNS = [
  { key: "po4_p", label: "PO₄-P", aliases: ["po4_p", "po4-p", "phosphate_p", "phosphate-p", "orthophosphate", "orthophosphate_p"], unit: "mg P/L" },
  { key: "no3_n", label: "NO₃-N", aliases: ["no3_n", "no3-n", "nitrate_n", "nitrate-n", "nitrate"], unit: "mg N/L" },
  { key: "nh4_n", label: "NH₄-N", aliases: ["nh4_n", "nh4-n", "ammonium_n", "ammonium-n", "ammonium"], unit: "mg N/L" },
  { key: "no2_n", label: "NO₂-N", aliases: ["no2_n", "no2-n", "nitrite_n", "nitrite-n", "nitrite"], unit: "mg N/L" },
  { key: "ton_n", label: "TON-N", aliases: ["ton", "ton_n", "ton-n", "total_oxidised_nitrogen"], unit: "mg N/L" }
];

function normaliseHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(",", "").trim());
  return Number.isFinite(num) ? num : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(value => value !== "")) rows.push(row);

  return rows;
}

function rowObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normaliseHeader);

  return rows.slice(1).map(raw => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = raw[index] ?? "";
    });
    return obj;
  });
}

function first(row, names, fallback = "") {
  for (const name of names) {
    const key = normaliseHeader(name);
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return fallback;
}

function locationName(row, index) {
  return first(row, ["name", "site", "station", "sample_location", "sample location", "location"], `Chemistry sample ${index + 1}`);
}

function coordinates(row) {
  const lat = parseNumber(first(row, ["lat", "latitude", "y"]));
  const lon = parseNumber(first(row, ["lon", "lng", "long", "longitude", "x"]));

  if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return { lat, lon };
  }

  return { lat: null, lon: null };
}

function observedAt(row) {
  return first(row, ["observed_at", "sample_date", "date", "datetime", "time"], null);
}

function sourceRowId(row, index) {
  return first(row, ["id", "sample_id", "sample", "code"], `row_${index + 1}`);
}

function longFormatRecords(rows) {
  const records = [];

  rows.forEach((row, index) => {
    const parameterName = first(row, ["parameter", "analyte", "determinant", "variable"], "");
    const value = parseNumber(first(row, ["value", "result", "concentration"], ""));

    if (!parameterName || value === null) return;

    const key = normaliseHeader(parameterName);
    const { lat, lon } = coordinates(row);
    const name = locationName(row, index);
    const unit = first(row, ["unit", "units"], "");

    records.push({
      id: `local-chem:${sourceRowId(row, index)}:${key}`,
      source: "local_chemistry_import",
      source_label: "Local chemistry import",
      type: "chemistry_sample",
      freshness: "local",
      name,
      lat,
      lon,
      observed_at: observedAt(row),
      generated_at: new Date().toISOString(),
      status: "imported",
      description: "User-imported chemistry evidence stored in this browser only.",
      url: "",
      focus_area_ids: [],
      parameters: [{
        key,
        label: parameterName,
        value,
        unit,
        basis: "local CSV import"
      }],
      raw: row
    });
  });

  return records;
}

function wideFormatRecords(rows) {
  const records = [];

  rows.forEach((row, index) => {
    const { lat, lon } = coordinates(row);
    const name = locationName(row, index);
    const date = observedAt(row);
    const rowId = sourceRowId(row, index);
    const parameters = [];

    WIDE_PARAMETER_COLUMNS.forEach(parameter => {
      const foundAlias = parameter.aliases.find(alias => row[normaliseHeader(alias)] !== undefined && row[normaliseHeader(alias)] !== "");
      if (!foundAlias) return;

      const value = parseNumber(row[normaliseHeader(foundAlias)]);
      if (value === null) return;

      const unit = first(row, [`${foundAlias}_unit`, `${parameter.key}_unit`, "unit", "units"], parameter.unit);

      parameters.push({
        key: parameter.key,
        label: parameter.label,
        value,
        unit,
        basis: "local CSV import"
      });
    });

    if (!parameters.length) return;

    records.push({
      id: `local-chem:${rowId}`,
      source: "local_chemistry_import",
      source_label: "Local chemistry import",
      type: "chemistry_sample",
      freshness: "local",
      name,
      lat,
      lon,
      observed_at: date,
      generated_at: new Date().toISOString(),
      status: "imported",
      description: "User-imported nutrient chemistry evidence stored in this browser only.",
      url: "",
      focus_area_ids: [],
      parameters,
      raw: row
    });
  });

  return records;
}
export function parseChemistryCsv(text) {
  const rows = rowObjects(text);
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const hasLongFormat = headers.includes("parameter") || headers.includes("analyte") || headers.includes("determinant");

  const records = hasLongFormat ? longFormatRecords(rows) : wideFormatRecords(rows);

  const seen = new Set();
  return records.filter(record => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function loadImportedChemistryRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function saveImportedChemistryRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearImportedChemistryRecords() {
  localStorage.removeItem(STORAGE_KEY);
}

function summary(records) {
  const mapped = records.filter(record => Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lon))).length;
  const parameterCounts = {};

  records.forEach(record => {
    (record.parameters || []).forEach(parameter => {
      const key = parameter.label || parameter.key || "parameter";
      parameterCounts[key] = (parameterCounts[key] || 0) + 1;
    });
  });

  const params = Object.entries(parameterCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}: ${count}`)
    .join("; ");

  return {
    total: records.length,
    mapped,
    params: params || "No parameters imported"
  };
}

export function renderChemistryImport(elements, records) {
  if (!elements.chemistryStatus || !elements.chemistrySummary) return;

  const info = summary(records || []);
  elements.chemistryStatus.textContent = records?.length
    ? `${info.total.toLocaleString("en-IE")} imported chemistry record${info.total === 1 ? "" : "s"} active in this browser.`
    : "No local chemistry records imported yet.";

  elements.chemistrySummary.innerHTML = `
    <article><span>${info.total.toLocaleString("en-IE")}</span><strong>chemistry records</strong></article>
    <article><span>${info.mapped.toLocaleString("en-IE")}</span><strong>mapped records</strong></article>
    <article><span>${info.params}</span><strong>parameters</strong></article>
  `;
}

export function installChemistryImport(elements, onChange) {
  if (!elements.chemistryFile || !elements.clearChemistry) return;

  elements.chemistryFile.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const records = parseChemistryCsv(text);
      saveImportedChemistryRecords(records);
      renderChemistryImport(elements, records);
      onChange(records);
      elements.chemistryStatus.textContent = `${records.length.toLocaleString("en-IE")} chemistry records imported from ${file.name}.`;
    } catch (error) {
      elements.chemistryStatus.textContent = `Import failed: ${error.message}`;
    } finally {
      elements.chemistryFile.value = "";
    }
  });

  elements.clearChemistry.addEventListener("click", () => {
    clearImportedChemistryRecords();
    renderChemistryImport(elements, []);
    onChange([]);
  });

  renderChemistryImport(elements, loadImportedChemistryRecords());
}
