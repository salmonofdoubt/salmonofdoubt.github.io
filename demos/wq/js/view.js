import { TYPE_LABELS } from "./config.js";
import { convertParameter } from "./units.js";
import { evaluateThreshold } from "./thresholds.js";
import { formatDate, prettyNumber, safeText } from "./format.js";

export function parameterHtml(parameter, context) {
  const converted = convertParameter(parameter, context.unitMode);
  const threshold = evaluateThreshold(parameter, context.thresholds);

  return `
    <div class="parameter-row">
      <strong>${safeText(converted.label || converted.key, "Parameter")}</strong>
      <span>${prettyNumber(converted.value)} ${safeText(converted.unit, "")}</span>
      ${converted.converted_from ? `<small>Converted from ${converted.converted_from}</small>` : ""}
      ${converted.basis ? `<small>Basis: ${converted.basis}</small>` : ""}
      <span class="threshold-pill ${threshold.className}">${threshold.label}</span>
      <small>${threshold.detail}</small>
    </div>
  `;
}

export function popupHtml(record, context) {
  const params = (record.parameters || []).slice(0, 3).map(parameter => parameterHtml(parameter, context)).join("");

  return `
    <div class="water-popup">
      <h3>${safeText(record.name, "Water signal")}</h3>
      <p><strong>${TYPE_LABELS[record.type] || record.type}</strong></p>
      <p>${safeText(record.source_label || record.source)}</p>
      <p>${formatDate(record.observed_at || record.generated_at)}</p>
      ${params}
    </div>
  `;
}

export function selectedHtml(record, context) {
  const params = (record.parameters || []).map(parameter => parameterHtml(parameter, context)).join("");
  const focus = (record.focus_area_ids || []).length
    ? `<div><strong>Focus areas</strong><br>${record.focus_area_ids.join(", ")}</div>`
    : "";

  return `
    <h2>${safeText(record.name, "Water signal")}</h2>
    <p>${TYPE_LABELS[record.type] || record.type}</p>

    <div class="record-meta">
      <div><strong>Source</strong><br>${safeText(record.source_label || record.source)}</div>
      <div><strong>Freshness</strong><br>${safeText(record.freshness, "context")}</div>
      <div><strong>Observed</strong><br>${formatDate(record.observed_at || record.generated_at)}</div>
      <div><strong>Status</strong><br>${safeText(record.status, "not classified")}</div>
      ${focus}
    </div>

    ${params || "<p>No numeric parameters were normalised for this record yet.</p>"}

    ${record.description ? `<p>${record.description}</p>` : ""}
    ${record.url ? `<p><a href="${record.url}" target="_blank" rel="noopener">Open official/source page</a></p>` : ""}
  `;
}
