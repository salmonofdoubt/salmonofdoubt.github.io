import assert from "node:assert/strict";
import { popupHtml, selectedHtml } from "../js/view.js";

const context = {
  thresholds: null,
  unitMode: "native",
};

const record = {
  id: "met-eireann:test-station",
  source: "met_eireann_observations",
  source_label: "Met Éireann current station observations",
  type: "rainfall_observation",
  freshness: "near_live",
  name: "Rainfall observation — Test Station",
  lat: 53.42,
  lon: -6.13,
  observed_at: "2026-06-29T18:00:00Z",
  generated_at: "2026-06-29T18:05:00Z",
  status: "rainfall trigger",
  description: "Rainfall is event-driver context, not chemistry.",
  url: "https://www.met.ie/latest-reports/observations",
  focus_area_ids: ["baldoyle_howth_malahide"],
  parameters: [
    { key: "rainfall", label: "Rainfall", value: 2.4, unit: "mm", basis: "station observation" },
    { key: "air_temperature", label: "Air temperature", value: 14.5, unit: "°C" },
    { key: "relative_humidity", label: "Relative humidity", value: 81, unit: "%" },
    { key: "weather_description", label: "Weather description", value: "Rain", unit: "" },
  ],
  raw: {
    station: "test-station",
    rainfall: "2.4",
    reportTime: "18:00",
  },
};

const selected = selectedHtml(record, context);
assert.ok(selected.includes("All normalised parameters"));
assert.ok(selected.includes("Rainfall"));
assert.ok(selected.includes("Air temperature"));
assert.ok(selected.includes("Relative humidity"));
assert.ok(selected.includes("Weather description"));
assert.ok(selected.includes("Original source fields"));
assert.ok(selected.includes("Full normalised record JSON"));
assert.ok(selected.includes("met-eireann:test-station"));
assert.ok(selected.includes("53.420000, -6.130000"));

const popup = popupHtml(record, context);
assert.ok(popup.includes("parameters available"));
assert.ok(popup.includes("Click marker for full record"));

console.log("WQ selected-record detail tests passed.");
