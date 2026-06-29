import assert from "node:assert/strict";
import {
  isLiveSignalSource,
  normaliseFreshnessClass,
  sourceFreshness,
  sourceFreshnessLabel,
  sourceSignalLayer,
} from "../js/freshness.js";

assert.equal(normaliseFreshnessClass("current"), "near_live");
assert.equal(normaliseFreshnessClass("latest"), "recent");
assert.equal(normaliseFreshnessClass("WFD"), "context");

assert.equal(sourceFreshness({ id: "opw_waterlevel" }), "live");
assert.equal(sourceFreshnessLabel({ id: "opw_waterlevel" }), "Live signal");
assert.equal(sourceSignalLayer({ id: "opw_waterlevel" }), "live_signal");
assert.equal(isLiveSignalSource({ id: "opw_waterlevel" }), true);

assert.equal(sourceFreshness({ id: "epa_wfd" }), "context");
assert.equal(sourceFreshnessLabel({ id: "epa_wfd" }), "WFD/context layer");
assert.equal(sourceSignalLayer({ id: "epa_wfd" }), "wfd_context");
assert.equal(isLiveSignalSource({ id: "epa_wfd" }), false);

assert.equal(sourceFreshness({ id: "epa_bathing_alerts" }), "near_live");
assert.equal(isLiveSignalSource({ id: "epa_bathing_alerts" }), true);

assert.equal(sourceFreshness({ id: "marine_institute_weather_buoys" }), "near_live");
assert.equal(sourceSignalLayer({ id: "marine_institute_weather_buoys" }), "live_signal");
assert.equal(isLiveSignalSource({ id: "marine_institute_weather_buoys" }), true);

console.log("WQ freshness taxonomy tests passed.");
