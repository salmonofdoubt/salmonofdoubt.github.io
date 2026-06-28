import { activeFocusArea, focusRecordCount, hasCoordinates } from "./records.js";
import { formatDate, safeText } from "./format.js";

export function renderFocusOptions(select, focusAreas, focusAreaId) {
  if (!select) return;

  const areas = focusAreas?.areas || [];

  select.innerHTML = areas.map(area => `
    <option value="${area.id}">${area.name}</option>
  `).join("");

  select.value = focusAreaId;
}

function liveSourceCount(payload, records) {
  const publicSources = new Set((payload?.sources || []).map(source => source.id));
  const recordSources = new Set((records || []).map(record => record.source).filter(Boolean));

  for (const source of recordSources) {
    publicSources.add(source);
  }

  return publicSources.size;
}

export function renderStats(elements, payload, records) {
  const liveRecords = records || [];
  const mappedCount = liveRecords.filter(hasCoordinates).length;
  const alertCount = liveRecords.filter(record => record.type === "bathing_alert").length;
  const sourceCount = liveSourceCount(payload, liveRecords);

  elements.records.textContent = mappedCount.toLocaleString("en-IE");
  elements.sources.textContent = sourceCount.toLocaleString("en-IE");
  elements.alerts.textContent = alertCount.toLocaleString("en-IE");
  elements.updated.textContent = payload?.generated_at_utc
    ? new Date(payload.generated_at_utc).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })
    : "seed";
}

export function renderSignals(container, payload, records, focusAreas, focusAreaId) {
  const area = activeFocusArea(focusAreas, focusAreaId);
  const focusCount = focusRecordCount(records, area);
  const nationalAlerts = records.filter(record => record.type === "bathing_alert");
  const bathingMeasurements = records.filter(record => record.type === "bathing_measurement");
  const hydro = records.filter(record => record.type === "water_level");
  const chemistry = records.filter(record => record.type === "chemistry_sample");
  const contexts = records.filter(record => ["wfd_context", "groundwater_context", "marine_context"].includes(record.type));

  const cards = [
    {
      title: "Active focus records",
      value: focusCount,
      text: area ? `Records associated with ${area.name}.` : "No focus area selected."
    },
    {
      title: "Imported chemistry",
      value: chemistry.length,
      text: "Local nutrient chemistry records currently active in this browser."
    },
    {
      title: "Current bathing alerts",
      value: nationalAlerts.length,
      text: "Active EPA bathing-water alerts or restrictions returned by the public API."
    },
    {
      title: "Latest bathing samples",
      value: bathingMeasurements.length,
      text: "Recent E. coli and intestinal enterococci sample records harvested from the EPA Bathing Water API."
    },
    {
      title: "Hydrometric stations",
      value: hydro.length,
      text: "OPW live/latest station readings with coordinates."
    },
    {
      title: "Context records",
      value: contexts.length,
      text: "WFD, groundwater and marine context entries. Historical chemistry joins will extend this panel."
    },
    {
      title: "C-Q readiness",
      value: payload?.analysis?.cq_pairs?.length || 0,
      text: "Formal paired flow-concentration records ready for log-log analysis."
    }
  ];

  container.innerHTML = cards.map(card => `
    <article class="signal-card">
      <p class="eyebrow mini">${card.title}</p>
      <h3>${Number(card.value).toLocaleString("en-IE")}</h3>
      <p>${card.text}</p>
    </article>
  `).join("");
}

export function renderSources(container, sources) {
  container.innerHTML = (sources || []).map(source => `
    <article class="source-card">
      <p class="eyebrow mini">${safeText(source.freshness_class, "source")}</p>
      <h3>${safeText(source.name, source.id)}</h3>
      <span class="status-pill ${source.status || "planned"}">${safeText(source.status, "planned")}</span>
      <dl>
        <div><dt>Records</dt><dd>${Number(source.records || 0).toLocaleString("en-IE")}</dd></div>
        <div><dt>Licence</dt><dd>${safeText(source.licence, "check source")}</dd></div>
        <div><dt>Fetched</dt><dd>${formatDate(source.fetched_at_utc)}</dd></div>
        <div><dt>Caveat</dt><dd>${safeText(source.caveat, "No caveat supplied.")}</dd></div>
        ${source.error ? `<div><dt>Error</dt><dd>${source.error}</dd></div>` : ""}
      </dl>
    </article>
  `).join("");
}
