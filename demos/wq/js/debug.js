import { loadAppData } from "./api.js";
import { hasCoordinates, recordWithinArea } from "./records.js";
import { safeText } from "./format.js";

const summary = document.getElementById("debugSummary");
const details = document.getElementById("debugDetails");

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function rowsFromObject(obj, keyName, valueName) {
  return Object.entries(obj).map(([key, value]) => ({ [keyName]: key, [valueName]: value }));
}

function table(title, rows, columns) {
  return `
    <section class="debug-table-wrap">
      <h3>${title}</h3>
      <table class="debug-table">
        <thead>
          <tr>${columns.map(col => `<th>${col.label}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${columns.map(col => `<td>${safeText(row[col.key], "")}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function keyValue(title, value, text = "") {
  return `
    <article class="signal-card">
      <p class="eyebrow mini">${title}</p>
      <h3>${value}</h3>
      ${text ? `<p>${text}</p>` : ""}
    </article>
  `;
}

function buildDiagnostics(payload, focusAreas) {
  const records = payload.records || [];
  const sources = payload.sources || [];

  const mappedRecords = records.filter(hasCoordinates);
  const bySource = countBy(records, r => r.source);
  const byType = countBy(records, r => r.type);
  const mappedBySource = countBy(mappedRecords, r => r.source);
  const mappedByType = countBy(mappedRecords, r => r.type);

  const parameterKeys = {};
  for (const record of records) {
    for (const parameter of record.parameters || []) {
      const key = parameter.key || parameter.label || "unknown";
      parameterKeys[key] = (parameterKeys[key] || 0) + 1;
    }
  }

  const focusRows = (focusAreas.areas || []).map(area => ({
    focus_area: area.name,
    hits: records.filter(record => recordWithinArea(record, area)).length
  }));

  const unmapped = records.filter(record => !hasCoordinates(record)).slice(0, 40).map(record => ({
    source: record.source,
    type: record.type,
    name: record.name
  }));

  return {
    records,
    sources,
    mappedRecords,
    sourceRows: rowsFromObject(bySource, "source", "records").map(row => ({ ...row, mapped: mappedBySource[row.source] || 0 })),
    typeRows: rowsFromObject(byType, "type", "records").map(row => ({ ...row, mapped: mappedByType[row.type] || 0 })),
    parameterRows: rowsFromObject(parameterKeys, "parameter", "count").sort((a, b) => b.count - a.count).slice(0, 80),
    focusRows,
    unmapped
  };
}

function render(data) {
  const payload = data.payload;
  const diag = buildDiagnostics(payload, data.focusAreas);

  summary.innerHTML = [
    keyValue("Generated", safeText(payload.generated_at_utc, "seed")),
    keyValue("Records", diag.records.length.toLocaleString("en-IE")),
    keyValue("Mapped", diag.mappedRecords.length.toLocaleString("en-IE")),
    keyValue("Sources", diag.sources.length.toLocaleString("en-IE"))
  ].join("");

  const sourceHealthRows = diag.sources.map(source => ({
    id: source.id,
    status: source.status,
    records: source.records,
    error: source.error || ""
  }));

  details.innerHTML = [
    table("Source health", sourceHealthRows, [
      { key: "id", label: "Source" },
      { key: "status", label: "Status" },
      { key: "records", label: "Records" },
      { key: "error", label: "Error" }
    ]),
    table("Records by source", diag.sourceRows, [
      { key: "source", label: "Source" },
      { key: "records", label: "Records" },
      { key: "mapped", label: "Mapped" }
    ]),
    table("Records by type", diag.typeRows, [
      { key: "type", label: "Type" },
      { key: "records", label: "Records" },
      { key: "mapped", label: "Mapped" }
    ]),
    table("Focus-area hits", diag.focusRows, [
      { key: "focus_area", label: "Focus area" },
      { key: "hits", label: "Mapped hits" }
    ]),
    table("Parameter keys", diag.parameterRows, [
      { key: "parameter", label: "Parameter" },
      { key: "count", label: "Count" }
    ]),
    table("Unmapped examples", diag.unmapped, [
      { key: "source", label: "Source" },
      { key: "type", label: "Type" },
      { key: "name", label: "Name" }
    ])
  ].join("");
}

loadAppData().then(render).catch(error => {
  details.innerHTML = `<p>${error.message}</p>`;
});
