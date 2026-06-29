import assert from "node:assert/strict";
import {
  recordsBySource,
  renderLiveSignals,
  summariseLiveSignals,
} from "../js/liveSignals.js";

const payload = {
  generated_at_utc: "2026-06-29T16:00:00Z",
  harvest_health: { status: "ok" },
  sources: [
    { id: "opw_waterlevel", name: "OPW", status: "ok", records: 2 },
    { id: "epa_bathing_alerts", name: "Bathing alerts", status: "ok", records: 1 },
    { id: "epa_wfd", name: "WFD", status: "ok", records: 0 },
    { id: "epa_bathing_measurements", name: "Bathing samples", status: "ok", records: 0 },
  ],
  records: [
    { source: "opw_waterlevel" },
    { source: "opw_waterlevel" },
    { source: "epa_bathing_alerts" },
  ],
};

const counts = recordsBySource(payload.records);
assert.equal(counts.get("opw_waterlevel"), 2);
assert.equal(counts.get("epa_bathing_alerts"), 1);

const summary = summariseLiveSignals(payload);
assert.equal(summary.liveSources.length, 2);
assert.equal(summary.contextSources.length, 2);
assert.equal(summary.liveRecordCount, 3);

assert.deepEqual(summary.liveSources.map((source) => source.sourceId), [
  "opw_waterlevel",
  "epa_bathing_alerts",
]);

const wfd = summary.contextSources.find((source) => source.sourceId === "epa_wfd");
assert.equal(wfd.isLiveSignal, false);
assert.equal(wfd.signalLayer, "wfd_context");

const fakeElements = {
  summary: { innerHTML: "" },
  liveGrid: { innerHTML: "" },
  contextGrid: { innerHTML: "" },
};

renderLiveSignals(payload, fakeElements);

assert.match(fakeElements.summary.innerHTML, /live signal records/);
assert.match(fakeElements.liveGrid.innerHTML, /OPW/);
assert.match(fakeElements.contextGrid.innerHTML, /WFD/);
assert.match(fakeElements.contextGrid.innerHTML, /not real-time water quality/i);

console.log("WQ live signal UI tests passed.");
