export const FRESHNESS_CLASSES = {
  live: {
    label: "Live signal",
    description: "Latest automated sensor or hydrometric readings.",
    sort: 10,
  },
  near_live: {
    label: "Near-live alert",
    description: "Current alert, restriction, or operational update.",
    sort: 20,
  },
  recent: {
    label: "Recent official observation",
    description: "Recent official sample or observation, not continuous live sensing.",
    sort: 30,
  },
  seasonal: {
    label: "Seasonal official data",
    description: "Seasonal or annual official monitoring information.",
    sort: 40,
  },
  historical: {
    label: "Historical context",
    description: "Historical dataset or archived monitoring context.",
    sort: 50,
  },
  context: {
    label: "WFD/context layer",
    description: "Assessment or regulatory context, not real-time water quality.",
    sort: 60,
  },
  planned: {
    label: "Planned source",
    description: "Source identified for future integration.",
    sort: 70,
  },
};

export const SOURCE_TAXONOMY = {
  opw_waterlevel: {
    freshnessClass: "live",
    signalLayer: "live_signal",
    sourceGroup: "hydrology",
    isLiveSignal: true,
    displayHint: "Live hydrological pulse; not a chemistry sensor.",
  },
  epa_bathing_alerts: {
    freshnessClass: "near_live",
    signalLayer: "live_signal",
    sourceGroup: "public_health",
    isLiveSignal: true,
    displayHint: "Current bathing-water alert or restriction.",
  },
  epa_bathing_measurements: {
    freshnessClass: "recent",
    signalLayer: "recent_observation",
    sourceGroup: "public_health",
    isLiveSignal: false,
    displayHint: "Latest official bathing sample, not continuous live sensing.",
  },
  epa_bathing_locations: {
    freshnessClass: "seasonal",
    signalLayer: "official_context",
    sourceGroup: "public_health",
    isLiveSignal: false,
    displayHint: "Seasonal location/profile/classification context.",
  },
  epa_wfd: {
    freshnessClass: "context",
    signalLayer: "wfd_context",
    sourceGroup: "regulatory_context",
    isLiveSignal: false,
    displayHint: "WFD assessment context; not real-time water quality.",
  },
  epa_geoportal_context: {
    freshnessClass: "historical",
    signalLayer: "historical_context",
    sourceGroup: "regulatory_context",
    isLiveSignal: false,
    displayHint: "Historical/context data layer.",
  },
  marine_institute_context: {
    freshnessClass: "planned",
    signalLayer: "planned_near_live",
    sourceGroup: "marine",
    isLiveSignal: false,
    displayHint: "Planned marine/near-live integration.",
  },
};

export function normaliseFreshnessClass(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (Object.hasOwn(FRESHNESS_CLASSES, key)) return key;
  if (key === "latest") return "recent";
  if (key === "current") return "near_live";
  return "context";
}

export function sourceTaxonomy(sourceId) {
  return SOURCE_TAXONOMY[sourceId] || {
    freshnessClass: "context",
    signalLayer: "context",
    sourceGroup: "context",
    isLiveSignal: false,
    displayHint: "",
  };
}

export function sourceFreshness(source) {
  const taxonomy = sourceTaxonomy(source?.id || source?.source);
  return normaliseFreshnessClass(
    source?.freshness_class ||
      source?.freshness ||
      taxonomy.freshnessClass ||
      "context",
  );
}

export function sourceFreshnessLabel(source) {
  const freshness = sourceFreshness(source);
  return FRESHNESS_CLASSES[freshness]?.label || FRESHNESS_CLASSES.context.label;
}

export function isLiveSignalSource(source) {
  const taxonomy = sourceTaxonomy(source?.id || source?.source);
  return Boolean(source?.is_live_signal || taxonomy.isLiveSignal);
}

export function sourceSignalLayer(source) {
  const taxonomy = sourceTaxonomy(source?.id || source?.source);
  return source?.signal_layer || taxonomy.signalLayer || "context";
}
