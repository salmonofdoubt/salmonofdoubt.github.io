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

function formatKm(value) {
  if (!Number.isFinite(value)) return "unknown distance";

  if (value < 1) return `${formatNumber(value * 1000, 0)} m`;

  return `${formatNumber(value, value < 10 ? 1 : 0)} km`;
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

function pointFromRecord(record) {
  const lat = finiteNumber(record.lat);
  const lon = finiteNumber(record.lon);

  if (lat === null || lon === null) return null;

  return { lat, lon };
}

function pointFromArea(area) {
  const centre = area?.centre;

  if (Array.isArray(centre) && centre.length >= 2) {
    const lat = finiteNumber(centre[0]);
    const lon = finiteNumber(centre[1]);

    if (lat !== null && lon !== null) {
      return { lat, lon };
    }
  }

  const bounds = area?.bounds;

  if (Array.isArray(bounds) && bounds.length >= 2) {
    const lat1 = finiteNumber(bounds[0]?.[0]);
    const lon1 = finiteNumber(bounds[0]?.[1]);
    const lat2 = finiteNumber(bounds[1]?.[0]);
    const lon2 = finiteNumber(bounds[1]?.[1]);

    if (lat1 !== null && lon1 !== null && lat2 !== null && lon2 !== null) {
      return {
        lat: (lat1 + lat2) / 2,
        lon: (lon1 + lon2) / 2,
      };
    }
  }

  return null;
}

function distanceKm(a, b) {
  const radiusKm = 6371;
  const toRad = degrees => degrees * Math.PI / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function confidenceForDistance(distance, layer) {
  const thresholds = {
    rainfall: [35, 75, 150],
    hydrology: [20, 50, 100],
    marine: [50, 120, 250],
  }[layer] || [25, 75, 150];

  if (!Number.isFinite(distance)) return "unknown";
  if (distance <= thresholds[0]) return "local";
  if (distance <= thresholds[1]) return "nearby";
  if (distance <= thresholds[2]) return "regional";
  return "distant";
}

function nearestRecord(records, predicate, focusPoint, layer) {
  if (!focusPoint) return null;

  const candidates = records
    .filter(predicate)
    .map(record => {
      const point = pointFromRecord(record);
      if (!point) return null;

      const km = distanceKm(focusPoint, point);

      return {
        record,
        distanceKm: km,
        confidence: confidenceForDistance(km, layer),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm || byNewestThenName(a.record, b.record));

  return candidates[0] || null;
}

function rainfallStateForValue(value) {
  if (value === null) return "missing";
  if (value >= 5) return "heavy";
  if (value >= 2) return "trigger";
  if (value >= 0.2) return "wet";
  return "dry";
}

function rainfallCountsFromNearest(value) {
  const state = rainfallStateForValue(value);

  return {
    state,
    wetStations: value !== null && value >= 0.2 ? 1 : 0,
    triggerStations: value !== null && value >= 2 ? 1 : 0,
    heavyStations: value !== null && value >= 5 ? 1 : 0,
  };
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

export function summariseSpatialContext(records, area = null) {
  const focusPoint = pointFromArea(area);

  const rainfall = nearestRecord(
    records,
    record => record.type === "rainfall_observation" || record.source === "met_eireann_observations",
    focusPoint,
    "rainfall",
  );

  const hydrology = nearestRecord(
    records,
    record => record.type === "water_level" || record.source === "opw_waterlevel",
    focusPoint,
    "hydrology",
  );

  const marine = nearestRecord(
    records,
    record => record.type === "marine_observation" || record.source === "marine_institute_weather_buoys",
    focusPoint,
    "marine",
  );

  if (rainfall) {
    rainfall.rainfall = rainValue(rainfall.record);
  }

  return {
    focusPoint,
    rainfall,
    hydrology,
    marine,
  };
}


function buildEvidenceLadder({ rainfall, hydrologyAvailable, marineAvailable, nutrientRecords, event }) {
  const hasRainDriver = rainfall.state !== "missing";
  const wetRainDriver = rainfall.wetStations > 0;
  const hasChemistry = nutrientRecords.length > 0;

  const driverLevel = !hasRainDriver ? "missing" : wetRainDriver ? "available" : "context";
  const movementLevel = hydrologyAvailable ? "available" : "missing";
  const marineLevel = marineAvailable ? "context" : "missing";
  const chemistryLevel = hasChemistry ? "available" : "missing";

  let posture = "Context only";
  let postureLevel = "context";
  let postureBody = "Use the current view as background evidence. Do not infer a water-quality event from context alone.";

  if ((event === "high_mobilisation_watch" || event === "mobilisation_watch") && !hasChemistry) {
    posture = "Test first";
    postureLevel = "test";
    postureBody = "Rainfall and hydrology create a plausible pulse hypothesis, but chemistry is required before claiming nutrient mobilisation.";
  } else if ((event === "high_mobilisation_watch" || event === "mobilisation_watch") && hasChemistry) {
    posture = "Analyse carefully";
    postureLevel = "available";
    postureBody = "Driver, movement and concentration evidence are all present. Check timing, distance, source pathway and confounders before making a claim.";
  } else if (event === "dry_baseline") {
    posture = "Baseline contrast";
    postureLevel = "context";
    postureBody = "Dry-period context can help define contrast, but event-load claims need wet-period concentration evidence.";
  }

  return [
    {
      level: driverLevel,
      title: "Driver signal",
      body: hasRainDriver
        ? `Rainfall context is available: ${rainfall.text}`
        : "Rainfall driver evidence is missing. No event-response claim should be made."
    },
    {
      level: movementLevel,
      title: "Movement evidence",
      body: hydrologyAvailable
        ? "OPW hydrometric evidence is available as movement/context. It is not chemistry."
        : "No usable hydrometric movement evidence is visible for this focus."
    },
    {
      level: marineLevel,
      title: "Coastal context",
      body: marineAvailable
        ? "Marine buoy evidence provides coastal met-ocean context. It does not prove inland nutrient transport."
        : "No near-live marine/coastal context is visible for this focus."
    },
    {
      level: chemistryLevel,
      title: "Concentration evidence",
      body: hasChemistry
        ? `${nutrientRecords.length.toLocaleString("en-IE")} nutrient-like concentration record${nutrientRecords.length === 1 ? "" : "s"} detected.`
        : "No nutrient concentration evidence is present. This is the main scientific gap."
    },
    {
      level: "not-proven",
      title: "Impact claim",
      body: "Ecological or public-health impact is not proven by driver/context data alone. It needs concentration, exposure and biological or regulatory interpretation."
    },
    {
      level: postureLevel,
      title: `Decision posture: ${posture}`,
      body: postureBody
    }
  ];
}

function summariseFocusRainfall(records, spatial) {
  const national = summariseRainfall(records);

  if (!spatial.rainfall) {
    return national;
  }

  const value = spatial.rainfall.rainfall;
  const counts = rainfallCountsFromNearest(value);
  const name = spatial.rainfall.record.name || "nearest rainfall station";
  const distance = formatKm(spatial.rainfall.distanceKm);
  const confidence = spatial.rainfall.confidence;

  let label = formatMm(value);
  let text = `Nearest rainfall station: ${name}, ${distance} from focus centre (${confidence}).`;

  if (counts.state === "heavy") {
    label = `${formatMm(value)} heavy`;
    text += " This is a strong event trigger.";
  } else if (counts.state === "trigger") {
    label = `${formatMm(value)} trigger`;
    text += " This is a plausible mobilisation trigger.";
  } else if (counts.state === "wet") {
    label = `${formatMm(value)} light`;
    text += " This is a weak/early event signal.";
  } else if (counts.state === "dry") {
    label = "Dry nearby";
    text += " No rainfall trigger at the nearest station.";
  }

  return {
    ...national,
    ...counts,
    label,
    text,
    max: value,
    top: {
      record: spatial.rainfall.record,
      value,
    },
  };
}

export function summariseEventPulse(records, area = null) {
  const spatial = summariseSpatialContext(records, area);
  const rainfall = summariseFocusRainfall(records, spatial);

  const hydrologyRecords = records.filter(record => record.type === "water_level" || record.source === "opw_waterlevel");
  const marineRecords = records.filter(record => record.type === "marine_observation" || record.source === "marine_institute_weather_buoys");
  const nutrientRecords = records.filter(hasNutrientLikeParameter);

  const hydrologyAvailable = Boolean(spatial.hydrology) || hydrologyRecords.length > 0;

  let event = "context_only";
  let label = "Context";
  let summary = "The active view has context, but no combined rainfall/hydrology event signal yet.";
  let action = "Use this as background context. Do not infer water-quality change from context alone.";

  if (rainfall.heavyStations && hydrologyAvailable) {
    event = "high_mobilisation_watch";
    label = "High mobilisation watch";
    summary = "Heavy rainfall and hydrometric evidence are present. Mobilisation, runoff connectivity and dilution may all be active.";
    action = "Prioritise event sampling and check nearby OPW hydrographs before interpreting chemistry.";
  } else if (rainfall.triggerStations && hydrologyAvailable) {
    event = "mobilisation_watch";
    label = "Mobilisation watch";
    summary = "Rainfall trigger and hydrometric evidence are both present. This is a plausible sampling window.";
    action = "Look for rising stage, concentration response and travel-time mismatch before claiming source mobilisation.";
  } else if (rainfall.wetStations && hydrologyAvailable) {
    event = "sampling_opportunity";
    label = "Sampling opportunity";
    summary = "Light rainfall and hydrometric evidence are present. This may be an early or weak event window.";
    action = "Useful for opportunistic field checks, but do not over-interpret without chemistry.";
  } else if (rainfall.wetStations) {
    event = "rain_context_only";
    label = "Rain context";
    summary = "Rainfall is present, but no hydrometric evidence is visible near the active focus.";
    action = "Treat rainfall as a driver proxy. Check whether the relevant OPW station lies outside this focus area.";
  } else if (rainfall.records && hydrologyAvailable) {
    event = "dry_baseline";
    label = "Dry baseline";
    summary = "Nearby rainfall is dry while hydrometric records are present. This is closer to a baseline/movement-only view.";
    action = "Useful for baseline contrast; event-load claims need wet-period chemistry.";
  } else if (hydrologyAvailable) {
    event = "flow_only";
    label = "Flow-only";
    summary = "Hydrometric evidence is present, but rainfall context is missing or outside the focus view.";
    action = "Use as movement evidence only. Add rainfall and concentration before making a catchment-pulse claim.";
  }

  const evidenceLadder = buildEvidenceLadder({
    rainfall,
    hydrologyAvailable,
    marineAvailable: Boolean(spatial.marine) || marineRecords.length > 0,
    nutrientRecords,
    event,
  });

  const signalCards = [];

  if (spatial.rainfall) {
    signalCards.push({
      level: rainfall.state === "dry" ? "rain dry proximity" : "rain proximity",
      title: spatial.rainfall.record.name || "Nearest rainfall station",
      body: `Rainfall: ${formatMm(spatial.rainfall.rainfall)} · ${formatKm(spatial.rainfall.distanceKm)} from focus centre · ${spatial.rainfall.confidence} confidence.`,
    });
  } else if (rainfall.top) {
    signalCards.push({
      level: rainfall.state === "dry" ? "rain dry" : "rain",
      title: rainfall.top.record.name || "Rainfall observation",
      body: `Rainfall: ${formatMm(rainfall.top.value)} · ${rainfall.top.record.status || "observation"} · ${rainfall.top.record.observed_at || "latest"}`,
    });
  }

  if (spatial.hydrology) {
    signalCards.push({
      level: "flow proximity",
      title: spatial.hydrology.record.name || "Nearest OPW hydrometric station",
      body: `${formatKm(spatial.hydrology.distanceKm)} from focus centre · ${spatial.hydrology.confidence} confidence. Hydrology is movement evidence, not chemistry.`,
    });
  } else if (hydrologyRecords.length) {
    const latestHydro = [...hydrologyRecords].sort(byNewestThenName)[0];
    signalCards.push({
      level: "flow",
      title: latestHydro?.name || "Hydrometric signal",
      body: `${hydrologyRecords.length.toLocaleString("en-IE")} OPW hydrometric record${hydrologyRecords.length === 1 ? "" : "s"} in this view. Hydrology is movement evidence, not chemistry.`,
    });
  }

  if (spatial.marine) {
    signalCards.push({
      level: "marine proximity",
      title: spatial.marine.record.name || "Nearest Marine Institute buoy",
      body: `${formatKm(spatial.marine.distanceKm)} from focus centre · ${spatial.marine.confidence} confidence. Marine data are coastal met-ocean context, not nutrient chemistry.`,
    });
  } else if (marineRecords.length) {
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
    spatial,
    hydrology: {
      count: hydrologyRecords.length,
      label: spatial.hydrology ? `${formatKm(spatial.hydrology.distanceKm)}` : hydrologyRecords.length.toLocaleString("en-IE"),
      text: spatial.hydrology
        ? `Nearest OPW hydrometric record is ${spatial.hydrology.confidence} to this focus centre.`
        : hydrologyRecords.length
          ? "Live OPW hydrometric evidence is available for movement/context."
          : "No OPW hydrometric record is visible in this focus view.",
    },
    marine: {
      count: marineRecords.length,
      label: spatial.marine ? `${formatKm(spatial.marine.distanceKm)}` : marineRecords.length.toLocaleString("en-IE"),
      text: spatial.marine
        ? `Nearest Marine Institute buoy is ${spatial.marine.confidence} to this focus centre.`
        : marineRecords.length
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
    evidenceLadder,
    signalCards,
  };
}
