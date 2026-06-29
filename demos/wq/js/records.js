import { recordMatchesSourceScope } from "./sourceScope.js";
export function hasCoordinates(record) {
  const lat = Number(record?.lat);
  const lon = Number(record?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function activeFocusArea(focusAreas, focusAreaId) {
  const areas = focusAreas?.areas || [];
  return areas.find(area => area.id === focusAreaId) || areas[0] || null;
}

export function recordWithinArea(record, area) {
  if (!area || !hasCoordinates(record)) return false;
  const [[south, west], [north, east]] = area.bounds;
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

export function recordMatches(record, filters) {
  const layer = filters.layer || "all";
  const query = String(filters.query || "").trim().toLowerCase();
  const sourceScope = filters.sourceScope || "all";
  const sourceIndex = filters.sourceIndex || filters.sources || [];

  if (layer !== "all" && record.type !== layer) return false;
  if (!recordMatchesSourceScope(record, sourceScope, sourceIndex)) return false;
  if (!query) return true;

  const haystack = [
    record.id,
    record.name,
    record.type,
    record.source,
    record.freshness,
    record.status,
    record.description,
    ...(record.focus_area_ids || []),
    ...(record.parameters || []).map(parameter => `${parameter.key} ${parameter.label} ${parameter.value} ${parameter.unit}`)
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

export function focusRecordCount(records, area) {
  if (!area) return 0;
  return records.filter(record =>
    recordWithinArea(record, area) || (record.focus_area_ids || []).includes(area.id)
  ).length;
}
