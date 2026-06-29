import {
  FRESHNESS_CLASSES,
  isLiveSignalSource,
  sourceFreshness,
  sourceFreshnessLabel,
  sourceSignalLayer,
  sourceTaxonomy,
} from "./freshness.js";

const DATA_PATH = "./data/latest.json";

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function escapeHtml(value) {
  return safeText(value, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value) {
  return asNumber(value).toLocaleString("en-IE");
}

export function recordsBySource(records = []) {
  const counts = new Map();

  for (const record of records) {
    if (!record || !record.source) continue;
    counts.set(record.source, (counts.get(record.source) || 0) + 1);
  }

  return counts;
}

function sourceCount(source, counts) {
  const id = source.id || source.source;
  const counted = counts.get(id);
  return Number.isFinite(counted) ? counted : asNumber(source.records);
}

function sortValue(source) {
  const freshness = sourceFreshness(source);
  return asNumber(source.freshness_sort || FRESHNESS_CLASSES[freshness]?.sort || 99);
}

export function summariseLiveSignals(payload = {}) {
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const records = Array.isArray(payload.records) ? payload.records : [];
  const counts = recordsBySource(records);

  const enriched = sources
    .map((source) => {
      const id = source.id || source.source || "unknown";
      const signalLayer = sourceSignalLayer(source);
      const taxonomy = sourceTaxonomy(id);
      const live = isLiveSignalSource(source) || signalLayer === "live_signal";

      return {
        ...source,
        sourceId: id,
        signalLayer,
        isLiveSignal: live,
        freshness: sourceFreshness(source),
        freshnessLabel: sourceFreshnessLabel(source),
        displayHint: source.display_hint || source.displayHint || source.caveat || taxonomy.displayHint || "",
        recordCount: sourceCount(source, counts),
        sort: sortValue(source),
      };
    })
    .sort((a, b) => a.sort - b.sort || safeText(a.name).localeCompare(safeText(b.name)));

  const liveSources = enriched.filter((source) => source.isLiveSignal);
  const contextSources = enriched.filter((source) => !source.isLiveSignal);

  return {
    generatedAt: payload.generated_at_utc || "",
    harvestHealth: payload.harvest_health || null,
    liveSources,
    contextSources,
    liveRecordCount: liveSources.reduce((sum, source) => sum + source.recordCount, 0),
    contextRecordCount: contextSources.reduce((sum, source) => sum + source.recordCount, 0),
  };
}

function metricCard(label, value, detail = "") {
  return `
    <article>
      <span>${escapeHtml(value)}</span>
      <strong>${escapeHtml(label)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function sourceCard(source) {
  const status = safeText(source.status, "unknown");
  const statusClass = status.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const liveClass = source.isLiveSignal ? "is-live" : "is-context";
  const hint = source.display_hint || source.displayHint || source.caveat || "";

  return `
    <article class="live-source-card ${liveClass}">
      <div class="live-source-card-top">
        <span class="live-badge ${liveClass}">${escapeHtml(source.freshnessLabel)}</span>
        <span class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>
      </div>
      <h3>${escapeHtml(source.name || source.source_label || source.sourceId)}</h3>
      <p>${escapeHtml(hint)}</p>
      <dl>
        <div>
          <dt>Records</dt>
          <dd>${formatCount(source.recordCount)}</dd>
        </div>
        <div>
          <dt>Layer</dt>
          <dd>${escapeHtml(source.signalLayer.replaceAll("_", " "))}</dd>
        </div>
      </dl>
    </article>
  `;
}

export function renderLiveSignals(payload, elements) {
  const summary = summariseLiveSignals(payload);
  const health = summary.harvestHealth?.status || "not reported";

  elements.summary.innerHTML = [
    metricCard("live / near-live feeds", summary.liveSources.length, "OPW and current alert streams"),
    metricCard("live signal records", formatCount(summary.liveRecordCount), "hydrology or restrictions"),
    metricCard("context feeds", summary.contextSources.length, "recent, seasonal, WFD, historical or planned"),
    metricCard("harvest health", health, summary.generatedAt || "latest payload"),
  ].join("");

  elements.liveGrid.innerHTML = summary.liveSources.length
    ? summary.liveSources.map(sourceCard).join("")
    : '<p class="empty-note">No live signal feeds are currently present in the payload.</p>';

  elements.contextGrid.innerHTML = summary.contextSources.length
    ? summary.contextSources.map(sourceCard).join("")
    : '<p class="empty-note">No context feeds are currently present in the payload.</p>';

  return summary;
}

async function bootLiveSignals() {
  const summary = document.getElementById("liveSignalSummary");
  const liveGrid = document.getElementById("liveSourceGrid");
  const contextGrid = document.getElementById("contextSourceGrid");

  if (!summary || !liveGrid || !contextGrid) return;

  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    renderLiveSignals(await response.json(), { summary, liveGrid, contextGrid });
  } catch (error) {
    liveGrid.innerHTML = `<p class="empty-note">Could not load live signal summary: ${escapeHtml(error.message || error)}</p>`;
  }
}

if (typeof document !== "undefined") {
  bootLiveSignals();
}
