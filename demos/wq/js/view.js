import { TYPE_LABELS } from "./config.js";
import { convertParameter } from "./units.js";
import { evaluateThreshold } from "./thresholds.js";
import { formatDate, numberValue, prettyNumber, safeText } from "./format.js";

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

function parameterValue(record, keys) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));

  for (const parameter of record.parameters || []) {
    const key = String(parameter.key || "").toLowerCase();
    const label = String(parameter.label || "").toLowerCase();

    if (wanted.has(key) || wanted.has(label)) {
      return parameter.value;
    }
  }

  return "";
}

function isOfficialWqRecord(record) {
  return (
    record?.source === "epa_official_wq" ||
    String(record?.type || "").startsWith("official_wq_")
  );
}

function officialWqEvidenceHtml(record) {
  if (!isOfficialWqRecord(record)) return "";

  const isStation = record.type === "official_wq_station";
  const waterbodyName = parameterValue(record, ["waterbody_name", "Waterbody name"]);
  const waterbodyCode = parameterValue(record, ["waterbody_code", "Waterbody code"]);
  const waterbodyType = parameterValue(record, ["waterbody_type", "Waterbody type"]);
  const subcatchment = parameterValue(record, ["focus_subcatchment", "Focus subcatchment"]);
  const stationName = parameterValue(record, ["station_name", "Monitoring station name"]);
  const stationCode = parameterValue(record, ["station_code", "Monitoring station code"]);
  const iteration = parameterValue(record, ["programme_iteration", "Programme iteration"]);

  const title = isStation ? "Official monitoring station" : "Official WFD status record";
  const proof = isStation
    ? "This proves that the EPA/WFD monitoring programme has an official station associated with this waterbody. It does not by itself show today’s nutrient concentration."
    : "This proves the official WFD waterbody identity, type and assessed status. It is not a live nitrate, phosphate, ammonium or E. coli reading.";

  const facts = [
    metaItem("Official status", record.status),
    metaItem("Waterbody", waterbodyName),
    metaItem("Waterbody code", waterbodyCode),
    metaItem("Waterbody type", waterbodyType),
    metaItem("Monitoring station", stationName),
    metaItem("Station code", stationCode),
    metaItem("Programme", iteration),
    metaItem("Focus subcatchment", subcatchment),
  ].join("");

  return `
    <article class="record-raw-details">
      <h3>${htmlText(title)}</h3>
      <p>${htmlText(proof)}</p>
      <div class="record-meta">
        ${facts}
      </div>
    </article>
  `;
}

function officialPopupHtml(record) {
  if (!isOfficialWqRecord(record)) return "";

  const waterbodyName = parameterValue(record, ["waterbody_name", "Waterbody name"]);
  const waterbodyCode = parameterValue(record, ["waterbody_code", "Waterbody code"]);
  const waterbodyType = parameterValue(record, ["waterbody_type", "Waterbody type"]);
  const stationName = parameterValue(record, ["station_name", "Monitoring station name"]);
  const subcatchment = parameterValue(record, ["focus_subcatchment", "Focus subcatchment"]);

  return `
    <div class="official-wq-popup">
      ${record.status ? `<p><strong>Status:</strong> ${htmlText(record.status)}</p>` : ""}
      ${waterbodyName ? `<p><strong>Waterbody:</strong> ${htmlText(waterbodyName)}</p>` : ""}
      ${waterbodyCode ? `<p><strong>Code:</strong> ${htmlText(waterbodyCode)}</p>` : ""}
      ${waterbodyType ? `<p><strong>Type:</strong> ${htmlText(waterbodyType)}</p>` : ""}
      ${stationName ? `<p><strong>Station:</strong> ${htmlText(stationName)}</p>` : ""}
      ${subcatchment ? `<p><strong>Subcatchment:</strong> ${htmlText(subcatchment)}</p>` : ""}
      <p class="parameter-count-note">Click marker for full official record.</p>
    </div>
  `;
}

export function parameterHtml(parameter, context) {
  const converted = convertParameter(parameter, context.unitMode);
  const numericValue = numberValue(converted.value);
  const valueText = converted.value === null || converted.value === undefined || converted.value === ""
    ? "not reported"
    : prettyNumber(converted.value);
  const threshold = numericValue === null ? null : evaluateThreshold(parameter, context.thresholds);

  return `
    <div class="parameter-row">
      <strong>${htmlText(converted.label || converted.key, "Parameter")}</strong>
      <span>${htmlText(valueText)}${converted.unit ? ` ${htmlText(converted.unit, "")}` : ""}</span>
      ${converted.converted_from ? `<small>Converted from ${htmlText(converted.converted_from)}</small>` : ""}
      ${converted.basis ? `<small>Basis: ${htmlText(converted.basis)}</small>` : ""}
      ${threshold ? `<span class="threshold-pill ${htmlText(threshold.className)}">${htmlText(threshold.label)}</span>` : ""}
      ${threshold ? `<small>${htmlText(threshold.detail)}</small>` : ""}
    </div>
  `;
}

export function popupHtml(record, context) {
  const parameters = record.parameters || [];
  const official = officialPopupHtml(record);
  const params = official || parameters.slice(0, 3).map(parameter => parameterHtml(parameter, context)).join("");
  const more = !official && parameters.length > 3
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
    metaItem("Observed / cycle", formatDate(record.observed_at || record.generated_at)),
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

    ${officialWqEvidenceHtml(record)}

    <div class="record-meta">
      ${meta}
    </div>

    <h3 class="record-section-title">Normalised evidence fields</h3>
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
