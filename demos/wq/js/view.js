import { TYPE_LABELS } from "./config.js";
import { convertParameter } from "./units.js";
import { evaluateThreshold } from "./thresholds.js";
import { formatDate, prettyNumber, safeText } from "./format.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlText(value, fallback = "not reported") {
  return escapeHtml(safeText(value, fallback));
}

function jsonHtml(value) {
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

function coordinateText(record) {
  const lat = Number(record.lat);
  const lon = Number(record.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "not mapped";
  }

  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function metaItem(label, value) {
  if (value === null || value === undefined || value === "") return "";

  return `
    <div>
      <strong>${htmlText(label)}</strong><br>${htmlText(value)}
    </div>
  `;
}

function sourceLink(record) {
  if (!record.url) return "";

  return `
    <p>
      <a href="${escapeHtml(record.url)}" target="_blank" rel="noopener">
        Open official/source page
      </a>
    </p>
  `;
}

export function parameterHtml(parameter, context) {
  const converted = convertParameter(parameter, context.unitMode);
  const threshold = evaluateThreshold(parameter, context.thresholds);

  return `
    <div class="parameter-row">
      <strong>${htmlText(converted.label || converted.key, "Parameter")}</strong>
      <span>${htmlText(prettyNumber(converted.value))} ${htmlText(converted.unit, "")}</span>
      ${converted.converted_from ? `<small>Converted from ${htmlText(converted.converted_from)}</small>` : ""}
      ${converted.basis ? `<small>Basis: ${htmlText(converted.basis)}</small>` : ""}
      <span class="threshold-pill ${htmlText(threshold.className)}">${htmlText(threshold.label)}</span>
      <small>${htmlText(threshold.detail)}</small>
    </div>
  `;
}

export function popupHtml(record, context) {
  const parameters = record.parameters || [];
  const params = parameters.slice(0, 3).map(parameter => parameterHtml(parameter, context)).join("");
  const more = parameters.length > 3
    ? `<p class="parameter-count-note">${parameters.length.toLocaleString("en-IE")} parameters available. Click marker for full record.</p>`
    : "";

  return `
    <div class="water-popup">
      <h3>${htmlText(record.name, "Water signal")}</h3>
      <p><strong>${htmlText(TYPE_LABELS[record.type] || record.type, "record")}</strong></p>
      <p>${htmlText(record.source_label || record.source)}</p>
      <p>${htmlText(formatDate(record.observed_at || record.generated_at))}</p>
      ${params}
      ${more}
    </div>
  `;
}

export function selectedHtml(record, context) {
  const parameters = record.parameters || [];
  const params = parameters.map(parameter => parameterHtml(parameter, context)).join("");
  const focusAreas = (record.focus_area_ids || []).length ? record.focus_area_ids.join(", ") : "";
  const typeLabel = TYPE_LABELS[record.type] || record.type || "record";

  const meta = [
    metaItem("Record ID", record.id),
    metaItem("Type", typeLabel),
    metaItem("Source", record.source_label || record.source),
    metaItem("Source ID", record.source),
    metaItem("Freshness", record.freshness || "context"),
    metaItem("Observed", formatDate(record.observed_at || record.generated_at)),
    metaItem("Generated", record.generated_at ? formatDate(record.generated_at) : ""),
    metaItem("Status", record.status || "not classified"),
    metaItem("Coordinates", coordinateText(record)),
    metaItem("Focus areas", focusAreas),
  ].join("");

  const rawBlock = record.raw
    ? `
      <details class="record-raw-details">
        <summary>Original source fields</summary>
        <pre class="record-json"><code>${jsonHtml(record.raw)}</code></pre>
      </details>
    `
    : "";

  return `
    <h2>${htmlText(record.name, "Water signal")}</h2>
    <p>${htmlText(typeLabel)}</p>

    <div class="record-meta">
      ${meta}
    </div>

    <h3 class="record-section-title">All normalised parameters</h3>
    ${
      params
        ? params
        : "<p>No numeric or text parameters were normalised for this record yet.</p>"
    }

    ${record.description ? `<p>${htmlText(record.description)}</p>` : ""}
    ${sourceLink(record)}

    ${rawBlock}

    <details class="record-raw-details">
      <summary>Full normalised record JSON</summary>
      <pre class="record-json"><code>${jsonHtml(record)}</code></pre>
    </details>
  `;
}
