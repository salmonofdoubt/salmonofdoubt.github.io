import {
  isLiveSignalSource,
  sourceFreshness,
  sourceSignalLayer,
} from "./freshness.js";

export const SOURCE_SCOPE_OPTIONS = [
  {
    value: "all",
    label: "All source layers",
    description: "Show every mapped and unmapped source layer.",
  },
  {
    value: "official_wq",
    label: "Official WQ",
    description: "Official EPA WFD status, monitoring-station and chemistry-value records.",
  },
  {
    value: "live_signal",
    label: "Live signals",
    description: "OPW hydrometry and current/near-live alerts.",
  },
  {
    value: "recent_observation",
    label: "Recent official observations",
    description: "Recent official samples or observations, not continuous live sensing.",
  },
  {
    value: "context",
    label: "WFD / context",
    description: "WFD, seasonal, historical, planned and other background context.",
  },
  {
    value: "local_import",
    label: "Local imports",
    description: "Browser-local chemistry records imported by the user.",
  },
];

const CONTEXT_FRESHNESS = new Set(["context", "seasonal", "historical", "planned"]);
const RECENT_FRESHNESS = new Set(["recent", "official_historic"]);

export function sourceLookup(sources = []) {
  const lookup = new Map();

  for (const source of sources || []) {
    const id = source?.id || source?.source;

    if (id) {
      lookup.set(id, source);
    }
  }

  return lookup;
}

function lookupSource(record, sourcesOrLookup) {
  const sourceId = record?.source;

  if (!sourceId) return null;

  if (sourcesOrLookup instanceof Map) {
    return sourcesOrLookup.get(sourceId) || null;
  }

  return sourceLookup(sourcesOrLookup).get(sourceId) || null;
}

export function sourceScopeLabel(scope) {
  return SOURCE_SCOPE_OPTIONS.find((option) => option.value === scope)?.label || "All source layers";
}

export function isLocalImportRecord(record) {
  return (
    record?.source === "local_chemistry" ||
    record?.status === "imported" ||
    record?.freshness === "local"
  );
}

export function isOfficialWqRecord(record, source = null) {
  return (
    record?.source === "epa_official_wq" ||
    record?.source === "epa_official_chemistry" ||
    String(record?.type || "").startsWith("official_wq_") ||
    String(record?.type || "").startsWith("official_chemistry_") ||
    String(source?.source_group || source?.group || "").includes("official_wq")
  );
}

export function recordSourceProfile(record, sourcesOrLookup = []) {
  const source = lookupSource(record, sourcesOrLookup);
  const profile = source || {
    id: record?.source,
    source: record?.source,
    freshness: record?.freshness,
    freshness_class: record?.freshness_class || record?.freshness,
    signal_layer: record?.signal_layer,
    is_live_signal: record?.is_live_signal,
  };

  const signalLayer = sourceSignalLayer(profile);
  const freshness = sourceFreshness(profile);
  const officialWq = isOfficialWqRecord(record, source);
  const isLive =
    isLiveSignalSource(profile) ||
    signalLayer === "live_signal" ||
    freshness === "live" ||
    freshness === "near_live";

  return {
    source,
    freshness,
    signalLayer,
    isLive,
    isRecent: RECENT_FRESHNESS.has(freshness) || signalLayer === "recent_observation",
    isOfficialWq: officialWq,
    isContext:
      !officialWq &&
      (
        CONTEXT_FRESHNESS.has(freshness) ||
        String(signalLayer || "").includes("context") ||
        String(record?.type || "").includes("context")
      ),
    isLocalImport: isLocalImportRecord(record),
  };
}

export function recordMatchesSourceScope(record, scope = "all", sourcesOrLookup = []) {
  if (scope === "all" || !scope) return true;

  const profile = recordSourceProfile(record, sourcesOrLookup);

  if (scope === "official_wq") {
    return profile.isOfficialWq;
  }

  if (scope === "live_signal") {
    return profile.isLive;
  }

  if (scope === "recent_observation") {
    return profile.isRecent;
  }

  if (scope === "context") {
    return profile.isContext;
  }

  if (scope === "local_import") {
    return profile.isLocalImport;
  }

  return true;
}
