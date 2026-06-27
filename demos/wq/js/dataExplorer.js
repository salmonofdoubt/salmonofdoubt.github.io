import { TYPE_LABELS } from "./config.js";
import { formatDate, prettyNumber, safeText } from "./format.js";
import { activeFocusArea, hasCoordinates, recordWithinArea } from "./records.js";

function parameterSummary(record) {
  const params = record.parameters || [];

  if (!params.length) {
    return "—";
  }

  return params.slice(0, 4).map(parameter => {
    const label = parameter.label || parameter.key || "parameter";
    const value = typeof parameter.value === "number" ? prettyNumber(parameter.value) : safeText(parameter.value, "");
    const unit = parameter.unit ? ` ${parameter.unit}` : "";
    return `${label}: ${value}${unit}`;
  }).join("; ");
}

function focusLabel(record, focusAreas) {
  if (record.focus_area_ids?.length) {
    const names = record.focus_area_ids.map(id => {
      const area = (focusAreas?.areas || []).find(item => item.id === id);
      return area?.name || id;
    });
    return names.join(", ");
  }

  return "—";
}

function matchesSearch(record, query) {
  if (!query) return true;

  const text = [
    record.id,
    record.name,
    record.type,
    record.source,
    record.status,
    record.freshness,
    record.description,
    ...(record.focus_area_ids || []),
    ...(record.parameters || []).map(parameter => `${parameter.key} ${parameter.label} ${parameter.value} ${parameter.unit}`)
  ].join(" ").toLowerCase();

  return text.includes(query.toLowerCase());
}

function scopedRecords(records, focusAreas, focusAreaId, scope) {
  const area = activeFocusArea(focusAreas, focusAreaId);

  if (scope === "focus") {
    return records.filter(record =>
      record.focus_area_ids?.includes(area?.id) || recordWithinArea(record, area)
    );
  }

  if (scope === "mapped") {
    return records.filter(hasCoordinates);
  }

  if (scope === "unmapped") {
    return records.filter(record => !hasCoordinates(record));
  }

  return records;
}

function fillTypeFilter(select, records) {
  if (!select || select.dataset.ready === "true") return;

  const types = [...new Set(records.map(record => record.type).filter(Boolean))].sort();

  select.innerHTML = [
    `<option value="all">All record types</option>`,
    ...types.map(type => `<option value="${type}">${TYPE_LABELS[type] || type}</option>`)
  ].join("");

  select.dataset.ready = "true";
}

export function installDataExplorer(elements, getState) {
  [elements.dataTypeFilter, elements.dataScopeFilter, elements.dataSearchBox].forEach(control => {
    control?.addEventListener("input", () => renderDataExplorer(elements, getState()));
    control?.addEventListener("change", () => renderDataExplorer(elements, getState()));
  });
}

export function renderDataExplorer(elements, state) {
  if (!elements.dataTableBody) return;

  const records = state.records || [];
  const focusAreas = state.focusAreas;
  const focusAreaId = state.focusAreaId;

  fillTypeFilter(elements.dataTypeFilter, records);

  const type = elements.dataTypeFilter?.value || "all";
  const scope = elements.dataScopeFilter?.value || "focus";
  const query = elements.dataSearchBox?.value || "";

  let visible = scopedRecords(records, focusAreas, focusAreaId, scope)
    .filter(record => type === "all" || record.type === type)
    .filter(record => matchesSearch(record, query));

  const total = records.length;
  const mapped = records.filter(hasCoordinates).length;
  const visibleMapped = visible.filter(hasCoordinates).length;

  if (elements.dataSummaryStrip) {
    elements.dataSummaryStrip.innerHTML = `
      <article>
        <span>${visible.length.toLocaleString("en-IE")}</span>
        <strong>visible records</strong>
      </article>
      <article>
        <span>${visibleMapped.toLocaleString("en-IE")}</span>
        <strong>visible mapped</strong>
      </article>
      <article>
        <span>${mapped.toLocaleString("en-IE")}</span>
        <strong>mapped total</strong>
      </article>
      <article>
        <span>${total.toLocaleString("en-IE")}</span>
        <strong>all records</strong>
      </article>
    `;
  }

  visible = visible.slice(0, 500);

  elements.dataTableBody.innerHTML = visible.map(record => `
    <tr>
      <td>
        <strong>${safeText(record.name, "Unnamed record")}</strong>
        <small>${safeText(record.id, "")}</small>
      </td>
      <td>${TYPE_LABELS[record.type] || safeText(record.type)}</td>
      <td>${safeText(record.source_label || record.source)}</td>
      <td>${safeText(record.status, "—")}</td>
      <td>${formatDate(record.observed_at || record.generated_at)}</td>
      <td>${hasCoordinates(record) ? `${prettyNumber(record.lat, 5)}, ${prettyNumber(record.lon, 5)}` : "—"}</td>
      <td>${parameterSummary(record)}</td>
      <td>${focusLabel(record, focusAreas)}</td>
    </tr>
  `).join("");

  if (!visible.length) {
    elements.dataTableBody.innerHTML = `
      <tr>
        <td colspan="8">No records match the current filters.</td>
      </tr>
    `;
  }

  if (elements.dataLimitNote) {
    elements.dataLimitNote.textContent = visible.length >= 500
      ? "Showing first 500 matching records. Narrow the filters or search term for a smaller view."
      : "Showing all matching records.";
  }
}
