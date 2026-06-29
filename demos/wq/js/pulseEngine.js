const NUTRIENT_PATTERN = /(phosphate|po4|orthophosphate|phosphorus|nitrate|no3|nitrite|no2|ammonium|nh4|ton|nitrogen)/i;

function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "–";

  return value.toLocaleString("en-IE", {
    maximumFractionDigits,
  });
}

function formatMm(value) {
  if (!Number.isFinite(value)) return "No value";

  return `${formatNumber(value, value < 1 ? 2 : 1)} mm`;
}

function parameterValue(record, keys) {
  const wanted = new Set(keys.map(key => key.toLowerCase()));

  for (const parameter of record.parameters || []) {
    const key = String(parameter.key || parameter.label || "").toLowerCase();

    if (wanted.has(key)) {
      return finiteNumber(parameter.value);
    }
  }

  return null;
}

function hasNutrientLikeParameter(record) {
  return (record.parameters || []).some(parameter => {
    const text = `${parameter.key || ""} ${parameter.label || ""} ${parameter.unit || ""}`;
    return NUTRIENT_PATTERN.test(text);
  });
}

function byNewestThenName(a, b) {
  const dateA = Date.parse(a.observed_at || "");
  const dateB = Date.parse(b.observed_at || "");

  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) {
    return dateB - dateA;
  }

  return String(a.name || "").localeCompare(String(b.name || ""));
}

function rainValue(record) {
  return parameterValue(record, ["rainfall", "rain", "precipitation"]);
}

export function summariseRainfall(records) {
  const rainRecords = records
    .filter(record => record.type === "rainfall_observation" || record.source === "met_eireann_observations")
    .map(record => ({ record, value: rainValue(record) }))
    .filter(item => item.value !== null)
    .sort((a, b) => b.value - a.value || byNewestThenName(a.record, b.record));

  const values = rainRecords.map(item => item.value);
  const max = values.length ? Math.max(...values) : null;
  const total = values.reduce((sum, value) => sum + value, 0);
  const wetStations = rainRecords.filter(item => item.value >= 0.2);
  const triggerStations = rainRecords.filter(item => item.value >= 2);
  const heavyStations = rainRecords.filter(item => item.value >= 5);

  let state = "missing";
  let label = "No rain feed";
  let text = "No near-live rainfall station records are currently available in this payload.";

  if (rainRecords.length) {
    if (heavyStations.length) {
      state = "heavy";
      label = `${heavyStations.length} heavy`;
      text = `${heavyStations.length} station${heavyStations.length === 1 ? "" : "s"} at or above 5 mm; max ${formatMm(max)}.`;
    } else if (triggerStations.length) {
      state = "trigger";
      label = `${triggerStations.length} trigger`;
      text = `${triggerStations.length} station${triggerStations.length === 1 ? "" : "s"} at or above 2 mm; max ${formatMm(max)}.`;
    } else if (wetStations.length) {
      state = "wet";
      label = `${wetStations.length}/${rainRecords.length} wet`;
      text = `${wetStations.length} station${wetStations.length === 1 ? "" : "s"} reporting light rainfall; max ${formatMm(max)}.`;
    } else {
      state = "dry";
      label = "Dry";
      text = `${rainRecords.length} rainfall station${rainRecords.length === 1 ? "" : "s"} currently below the event threshold; max ${formatMm(max)}.`;
    }
  }

  return {
    state,
    label,
    text,
    records: rainRecords.length,
    max,
    total,
    wetStations: wetStations.length,
    triggerStations: triggerStations.length,
    heavyStations: heavyStations.length,
    top: rainRecords[0] || null,
  };
}

export function summariseEventPulse(records) {
  const rainfall = summariseRainfall(records);
  const hydrologyRecords = records.filter(record => record.type === "water_level" || record.source === "opw_waterlevel");
  const marineRecords = records.filter(record => record.type === "marine_observation" || record.source === "marine_institute_weather_buoys");
  const nutrientRecords = records.filter(hasNutrientLikeParameter);

  let event = "context_only";
  let label = "Context";
  let summary = "The active view has context, but no combined rainfall/hydrology event signal yet.";
  let action = "Use this as background context. Do not infer water-quality change from context alone.";

  if (rainfall.heavyStations && hydrologyRecords.length) {
    event = "high_mobilisation_watch";
    label = "High mobilisation watch";
    summary = "Heavy rainfall and live hydrometric evidence are present. Mobilisation, runoff connectivity and dilution may all be active.";
    action = "Prioritise event sampling and check nearby OPW hydrographs before interpreting chemistry.";
  } else if (rainfall.triggerStations && hydrologyRecords.length) {
    event = "mobilisation_watch";
    label = "Mobilisation watch";
    summary = "Rainfall trigger and live hydrometric evidence are both present. This is a plausible sampling window.";
    action = "Look for rising stage, concentration response and travel-time mismatch before claiming source mobilisation.";
  } else if (rainfall.wetStations && hydrologyRecords.length) {
    event = "sampling_opportunity";
    label = "Sampling opportunity";
    summary = "Light rainfall and hydrometric evidence are present. This may be an early or weak event window.";
    action = "Useful for opportunistic field checks, but do not over-interpret without chemistry.";
  } else if (rainfall.wetStations) {
    event = "rain_context_only";
    label = "Rain context";
    summary = "Rainfall is present, but no local hydrometric evidence is visible in the focus view.";
    action = "Treat rainfall as a driver proxy. Check whether the relevant OPW station lies outside this focus area.";
  } else if (rainfall.records && hydrologyRecords.length) {
    event = "dry_baseline";
    label = "Dry baseline";
    summary = "Rainfall stations are mostly dry while hydrometric records are present. This is closer to a baseline/movement-only view.";
    action = "Useful for baseline contrast; event-load claims need wet-period chemistry.";
  } else if (hydrologyRecords.length) {
    event = "flow_only";
    label = "Flow-only";
    summary = "Hydrometric evidence is present, but rainfall context is missing or outside the focus view.";
    action = "Use as movement evidence only. Add rainfall and concentration before making a catchment-pulse claim.";
  }

  const signalCards = [];

  if (rainfall.top) {
    signalCards.push({
      level: rainfall.state === "dry" ? "rain dry" : "rain",
      title: rainfall.top.record.name || "Rainfall observation",
      body: `Rainfall: ${formatMm(rainfall.top.value)} · ${rainfall.top.record.status || "observation"} · ${rainfall.top.record.observed_at || "latest"}`,
    });
  }

  if (hydrologyRecords.length) {
    const latestHydro = [...hydrologyRecords].sort(byNewestThenName)[0];
    signalCards.push({
      level: "flow",
      title: latestHydro?.name || "Hydrometric signal",
      body: `${hydrologyRecords.length.toLocaleString("en-IE")} OPW hydrometric record${hydrologyRecords.length === 1 ? "" : "s"} in this view. Hydrology is movement evidence, not chemistry.`,
    });
  }

  if (marineRecords.length) {
    const latestMarine = [...marineRecords].sort(byNewestThenName)[0];
    signalCards.push({
      level: "marine",
      title: latestMarine?.name || "Marine buoy context",
      body: `${marineRecords.length.toLocaleString("en-IE")} near-live marine buoy record${marineRecords.length === 1 ? "" : "s"} for coastal met-ocean context.`,
    });
  }

  signalCards.push({
    level: "action",
    title: "Recommended next move",
    body: action,
  });

  return {
    event,
    label,
    summary,
    action,
    rainfall,
    hydrology: {
      count: hydrologyRecords.length,
      label: hydrologyRecords.length.toLocaleString("en-IE"),
      text: hydrologyRecords.length
        ? "Live OPW hydrometric evidence is available for movement/context."
        : "No OPW hydrometric record is visible in this focus view.",
    },
    marine: {
      count: marineRecords.length,
      label: marineRecords.length.toLocaleString("en-IE"),
      text: marineRecords.length
        ? "Near-live Marine Institute buoy context is available."
        : "No Marine Institute buoy context is visible in this focus view.",
    },
    nutrients: {
      count: nutrientRecords.length,
      label: nutrientRecords.length.toLocaleString("en-IE"),
      text: nutrientRecords.length
        ? "Nutrient-like concentration evidence is present."
        : "No nutrient concentration evidence is present yet.",
    },
    signalCards,
  };
}
