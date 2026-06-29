import assert from "node:assert/strict";
import { recordMatches } from "../js/records.js";
import {
  recordMatchesSourceScope,
  recordSourceProfile,
  sourceLookup,
  sourceScopeLabel,
} from "../js/sourceScope.js";

const sources = [
  { id: "opw_waterlevel", freshness_class: "live", signal_layer: "live_signal", is_live_signal: true },
  { id: "epa_bathing_alerts", freshness_class: "near_live", signal_layer: "live_signal", is_live_signal: true },
  { id: "epa_bathing_measurements", freshness_class: "recent", signal_layer: "recent_observation" },
  { id: "epa_wfd", freshness_class: "context", signal_layer: "wfd_context" },
  { id: "epa_geoportal_context", freshness_class: "historical", signal_layer: "historical_context" },
];

const lookup = sourceLookup(sources);

assert.equal(sourceScopeLabel("live_signal"), "Live signals");

assert.equal(recordMatchesSourceScope({ source: "opw_waterlevel" }, "live_signal", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "epa_bathing_alerts" }, "live_signal", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "epa_wfd" }, "live_signal", lookup), false);

assert.equal(recordMatchesSourceScope({ source: "epa_bathing_measurements" }, "recent_observation", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "opw_waterlevel" }, "recent_observation", lookup), false);

assert.equal(recordMatchesSourceScope({ source: "epa_wfd" }, "context", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "epa_geoportal_context" }, "context", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "opw_waterlevel" }, "context", lookup), false);

assert.equal(recordMatchesSourceScope({ source: "local_chemistry", freshness: "local" }, "local_import", lookup), true);
assert.equal(recordMatchesSourceScope({ source: "opw_waterlevel" }, "local_import", lookup), false);

const profile = recordSourceProfile({ source: "epa_wfd", type: "wfd_context" }, lookup);
assert.equal(profile.isLive, false);
assert.equal(profile.isContext, true);

assert.equal(
  recordMatches(
    { type: "water_level", source: "opw_waterlevel", name: "River station" },
    { layer: "water_level", sourceScope: "live_signal", sourceIndex: lookup, query: "" },
  ),
  true,
);

assert.equal(
  recordMatches(
    { type: "wfd_context", source: "epa_wfd", name: "WFD status" },
    { layer: "all", sourceScope: "live_signal", sourceIndex: lookup, query: "" },
  ),
  false,
);

console.log("WQ source-scope tests passed.");
