import assert from "node:assert/strict";
import { popupHtml, selectedHtml } from "../js/view.js";
import { formatDate } from "../js/format.js";

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
assert.ok(selected.includes("Normalised evidence fields"));
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

const officialWaterbody = {
  id: "official-wq:waterbody:IE_EA_080_0100",
  source: "epa_official_wq",
  source_label: "EPA official WFD water-quality records",
  type: "official_wq_waterbody",
  freshness: "official_historic",
  name: "Official WQ waterbody — Mayne Estuary",
  lat: 53.41,
  lon: -6.11,
  observed_at: "WFD Cycle 3",
  generated_at: "2026-06-30T13:29:46Z",
  status: "Moderate",
  description: "Official EPA WFD waterbody status record.",
  parameters: [
    { key: "waterbody_code", label: "Waterbody code", value: "IE_EA_080_0100", basis: "EPA WFD subcatchment Waterbodies" },
    { key: "waterbody_name", label: "Waterbody name", value: "Mayne Estuary", basis: "EPA WFD subcatchment Waterbodies" },
    { key: "waterbody_type", label: "Waterbody type", value: "Transitional", basis: "EPA WFD subcatchment Waterbodies" },
    { key: "official_status", label: "Official status", value: "Moderate", basis: "EPA WFD subcatchment Waterbodies" },
    { key: "focus_subcatchment", label: "Focus subcatchment", value: "Mayne_SC_010", basis: "Configured WQ focus subcatchment" },
  ],
  raw: {
    Name: "Mayne Estuary",
    Code: "IE_EA_080_0100",
    Type: "Transitional",
    Status: "Moderate",
  },
};

const officialSelected = selectedHtml(officialWaterbody, context);
assert.ok(officialSelected.includes("Official WFD status record"));
assert.ok(officialSelected.includes("This proves the official WFD waterbody identity"));
assert.ok(officialSelected.includes("Mayne Estuary"));
assert.ok(officialSelected.includes("IE_EA_080_0100"));
assert.ok(officialSelected.includes("Transitional"));
assert.ok(officialSelected.includes("WFD Cycle 3"));
assert.equal(officialSelected.includes("1 Mar 2001"), false);
assert.equal(officialSelected.includes("No numeric value available"), false);
assert.equal(officialSelected.includes("No threshold"), false);

const officialPopup = popupHtml(officialWaterbody, context);
assert.ok(officialPopup.includes("Status:"));
assert.ok(officialPopup.includes("Waterbody:"));
assert.ok(officialPopup.includes("Click marker for full official record"));

assert.equal(formatDate("WFD Cycle 3"), "WFD Cycle 3");
assert.equal(formatDate("IEMP2019-2021"), "IEMP2019-2021");

console.log("WQ selected-record detail tests passed.");
