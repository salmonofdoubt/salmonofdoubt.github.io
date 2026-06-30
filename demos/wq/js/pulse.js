import { TYPE_LABELS } from "./config.js";
import { prettyNumber, safeText } from "./format.js";
import { activeFocusArea, hasCoordinates, recordWithinArea } from "./records.js";
import { summariseEventPulse } from "./pulseEngine.js";

const NUTRIENT_PATTERN = /(phosphate|po4|orthophosphate|phosphorus|nitrate|no3|nitrite|no2|ammonium|nh4|ton|nitrogen)/i;
const IGNORE_PARAMETER_PATTERN = /(sensor|region|err|error|station_ref|station ref|objectid|id$|code$)/i;

function localRecords(records, focusAreas, focusAreaId) {
  const area = activeFocusArea(focusAreas, focusAreaId);
  if (!area) return records;
  return records.filter(record => record.focus_area_ids?.includes(area.id) || recordWithinArea(record, area));
}

function countBy(records, key) {
  const out = {};
  for (const record of records) {
    const value = record[key] || "unknown";
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

function hasNutrientLikeParameter(record) {
  return (record.parameters || []).some(parameter => {
    const text = `${parameter.key || ""} ${parameter.label || ""} ${parameter.unit || ""}`;
    return NUTRIENT_PATTERN.test(text);
  });
}

function meaningfulParameters(record) {
  const params = record.parameters || [];

  const useful = params.filter(parameter => {
    const label = `${parameter.key || ""} ${parameter.label || ""}`;
    return !IGNORE_PARAMETER_PATTERN.test(label);
  });

  if (useful.length) return useful;

  const valueParam = params.find(parameter => String(parameter.key || parameter.label || "").toLowerCase() === "value");
  if (valueParam) {
    return [{
      ...valueParam,
      label: record.type === "water_level" ? "Latest hydrometric reading" : "Latest source value"
    }];
  }

  return [];
}

function parameterSummary(record) {
  const params = meaningfulParameters(record);

  if (!params.length) {
    if (record.type === "water_level") return "Live hydrometric station record. Source exposes no clean level/flow label yet.";
    return "No normalised scientific parameter yet.";
  }

  return params.slice(0, 3).map(parameter => {
    const label = parameter.label || parameter.key || "parameter";
    const value = typeof parameter.value === "number" ? prettyNumber(parameter.value) : safeText(parameter.value, "");
    const unit = parameter.unit ? ` ${parameter.unit}` : "";
    return `${label}: ${value}${unit}`;
  }).join("; ");
}

function evidenceState(scoped) {
  const alerts = scoped.filter(record => record.type === "bathing_alert");
  const samples = scoped.filter(record => record.type === "bathing_measurement");
  const hydro = scoped.filter(record => record.type === "water_level");
  const nutrients = scoped.filter(hasNutrientLikeParameter);
  const context = scoped.filter(record => ["wfd_context", "groundwater_context", "marine_context"].includes(record.type));

  if (alerts.length) {
    return {
      label: "Alert",
      text: `${alerts.length} bathing alert record${alerts.length === 1 ? "" : "s"} in the focus evidence set.`,
      alerts,
      samples,
      hydro,
      nutrients,
      context
    };
  }

  if (hydro.length && nutrients.length) {
    return {
      label: "C-Q candidate",
      text: "Movement and nutrient-like concentration evidence are both present. Station/waterbody matching is the next test.",
      alerts,
      samples,
      hydro,
      nutrients,
      context
    };
  }

  if (hydro.length && !nutrients.length) {
    return {
      label: "Flow-only",
      text: "Movement evidence exists, but nutrient concentration is still missing.",
      alerts,
      samples,
      hydro,
      nutrients,
      context
    };
  }

  if (samples.length) {
    return {
      label: "Bathing signal",
      text: "Bathing-water microbiology exists, but this is not nutrient-loading evidence.",
      alerts,
      samples,
      hydro,
      nutrients,
      context
    };
  }

  return {
    label: "Context",
    text: "The focus view currently contains context more than interpretable water-quality dynamics.",
    alerts,
    samples,
    hydro,
    nutrients,
    context
  };
}

function dominantSource(records) {
  const entries = Object.entries(countBy(records, "source")).sort((a, b) => b[1] - a[1]);
  return entries[0] || ["none", 0];
}

function sourceLabel(source) {
  if (source === "opw_waterlevel") return "OPW";
  if (source?.startsWith("epa_")) return "EPA";
  if (source?.startsWith("marine_")) return "Marine";
  return source ? source.replace(/_/g, " ") : "none";
}

function sourceDetail(source) {
  if (source === "opw_waterlevel") return "waterlevel.ie hydrometry";
  if (source === "epa_bathing_measurements") return "bathing-water measurements";
  if (source === "epa_bathing_alerts") return "bathing-water alerts";
  if (source === "epa_wfd") return "WFD context";
  if (source === "epa_geoportal_context") return "geoportal context";
  return source ? source.replace(/_/g, " ") : "No dominant source";
}

function topSignals(state) {
  const signals = [];

  state.alerts.slice(0, 4).forEach(record => {
    signals.push({
      level: "attention",
      title: safeText(record.name, "Bathing alert"),
      body: `${safeText(record.status, "alert")} · ${safeText(record.description, "Current bathing-water alert or restriction.")}`
    });
  });

  state.nutrients.slice(0, 4).forEach(record => {
    signals.push({
      level: "nutrient",
      title: safeText(record.name, "Nutrient record"),
      body: parameterSummary(record)
    });
  });

  state.samples.filter(record => (record.parameters || []).length).slice(0, 4).forEach(record => {
    signals.push({
      level: "sample",
      title: safeText(record.name, "Bathing sample"),
      body: parameterSummary(record)
    });
  });

  state.hydro.slice(0, 6).forEach(record => {
    signals.push({
      level: "flow",
      title: safeText(record.name, "Hydrometric station"),
      body: parameterSummary(record)
    });
  });

  return signals.slice(0, 10);
}

function evidenceGaps(state, eventPulse) {
  const gaps = [];

  if (eventPulse.event === "high_mobilisation_watch" || eventPulse.event === "mobilisation_watch") {
    if (!state.nutrients.length) {
      gaps.push({
        title: "Event signal without chemistry",
        body: "Rainfall and hydrometry suggest a live pulse, but there is no concentration evidence yet. This is a sampling opportunity, not proof of nutrient mobilisation."
      });
    }
  }

  if (eventPulse.rainfall.state === "missing") {
    gaps.push({
      title: "Rainfall driver missing",
      body: "The pulse interpretation cannot test event response properly without near-live rainfall context."
    });
  }

  if (!state.nutrients.length) {
    gaps.push({
      title: "Missing nutrient concentration",
      body: "The current focus view has no phosphorus or nitrogen chemistry. Without concentration, there is no nutrient-load story yet."
    });
  }

  if (state.hydro.length && !state.nutrients.length) {
    gaps.push({
      title: "C-Q chain is incomplete",
      body: "OPW provides movement evidence. The next scientific layer is defensible chemistry matching, not more map markers."
    });
  }

  if (!state.samples.length) {
    gaps.push({
      title: "No bathing sample in this focus view",
      body: "That may be normal outside bathing locations or outside season. Absence of samples is not evidence of clean or unsafe water."
    });
  }

  if (state.context.length < 2) {
    gaps.push({
      title: "Pressure context is thin",
      body: "Land use, wastewater, WFD pressures, rainfall and tide/event context are needed to explain why a signal exists."
    });
  }

  return gaps;
}

function metricCard(title, value, text) {
  return `
    <article class="pulse-metric">
      <b class="metric-value">${value}</b>
      <strong>${title}</strong>
      <p>${text}</p>
    </article>
  `;
}

function smallCard(className, title, body) {
  return `
    <article class="${className}">
      <strong>${title}</strong>
      <p>${body}</p>
    </article>
  `;
}

export function renderPulse(elements, state) {
  if (!elements.pulseHeroGrid || !elements.pulseStory || !elements.pulseSignals || !elements.pulseGaps) return;

  const records = state.records || [];
  const focusAreas = state.focusAreas || { areas: [] };
  const area = activeFocusArea(focusAreas, state.focusAreaId);
  const scoped = localRecords(records, focusAreas, state.focusAreaId);
  const mapped = scoped.filter(hasCoordinates);
  const evidence = evidenceState(scoped);
  const eventPulse = summariseEventPulse(records, area);
  const [source, sourceCount] = dominantSource(scoped);

  const typeSummary = Object.entries(countBy(scoped, "type"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${TYPE_LABELS[type] || type}: ${count.toLocaleString("en-IE")}`)
    .join("; ");

  elements.pulseHeroGrid.innerHTML = [
    metricCard("Event pulse", eventPulse.label, eventPulse.summary),
    metricCard("Rainfall trigger", eventPulse.rainfall.label, eventPulse.rainfall.text),
    metricCard("OPW hydrology", eventPulse.hydrology.label, eventPulse.hydrology.text),
    metricCard("Chemistry evidence", eventPulse.nutrients.label, eventPulse.nutrients.text)
  ].join("");

  elements.pulseStory.innerHTML = `
    <p>
      <strong>${safeText(area?.name, "Ireland")}</strong> currently has
      <strong>${scoped.length.toLocaleString("en-IE")}</strong> records in this focus view.
      Evidence mix: ${safeText(typeSummary, "no typed records yet")}.
    </p>

    <p>
      Event interpretation: <strong>${eventPulse.label}</strong>. ${eventPulse.summary}
    </p>

    <p>
      Evidence interpretation: <strong>${evidence.label}</strong>. ${evidence.text}
      Dominant source: <strong>${sourceLabel(source)}</strong> (${sourceDetail(source)} · ${sourceCount.toLocaleString("en-IE")} records).
    </p>

    <p>
      The app connects <strong>source → pathway → event → concentration → ecological or public-health meaning</strong>.
      Rainfall and hydrology can identify a plausible pulse window, but chemistry is still required before making
      nutrient-load claims.
    </p>
  `;

  if (elements.pulseConfidence) {
    elements.pulseConfidence.innerHTML = (eventPulse.evidenceLadder || [])
      .map(step => smallCard(`pulse-confidence ${step.level}`, step.title, step.body))
      .join("");
  }

  const signals = [...eventPulse.signalCards, ...topSignals(evidence)].slice(0, 10);
  elements.pulseSignals.innerHTML = signals.length
    ? signals.map(signal => smallCard(`pulse-signal ${signal.level}`, signal.title, signal.body)).join("")
    : smallCard("pulse-signal", "No focused signals yet", "The active focus area has no high-salience records under the current data contract.");

  const gaps = evidenceGaps(evidence, eventPulse);
  elements.pulseGaps.innerHTML = gaps.map(gap => smallCard("pulse-gap", gap.title, gap.body)).join("");
}
