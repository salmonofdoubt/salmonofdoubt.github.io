import assert from "node:assert/strict";
import { summariseEventPulse, summariseRainfall } from "../js/pulseEngine.js";

const rainRecord = (value, name = "Rainfall observation — Dunsany") => ({
  id: `rain-${value}`,
  source: "met_eireann_observations",
  type: "rainfall_observation",
  name,
  observed_at: "2026-06-29T18:00:00Z",
  parameters: [
    { key: "rainfall", label: "Rainfall", value, unit: "mm" },
  ],
});

const hydroRecord = {
  id: "opw-1",
  source: "opw_waterlevel",
  type: "water_level",
  name: "OPW hydrometric station",
  observed_at: "2026-06-29T18:00:00Z",
  parameters: [
    { key: "value", label: "Latest hydrometric reading", value: 1.2, unit: "m" },
  ],
};

const marineRecord = {
  id: "m2",
  source: "marine_institute_weather_buoys",
  type: "marine_observation",
  name: "Irish Weather Buoy M2",
  observed_at: "2026-06-29T16:00:00Z",
  parameters: [
    { key: "significant_wave_height", label: "Significant wave height", value: 1.1, unit: "m" },
  ],
};

const nutrientRecord = {
  id: "sample-1",
  source: "local_import",
  type: "chemistry_sample",
  name: "Imported chemistry",
  observed_at: "2026-06-29T18:10:00Z",
  parameters: [
    { key: "po4_p", label: "PO₄-P", value: 0.04, unit: "mg/L" },
  ],
};

{
  const rain = summariseRainfall([rainRecord(0), rainRecord(0.2), rainRecord(2.4)]);
  assert.equal(rain.records, 3);
  assert.equal(rain.wetStations, 2);
  assert.equal(rain.triggerStations, 1);
  assert.equal(rain.state, "trigger");
}

{
  const pulse = summariseEventPulse([rainRecord(2.4), hydroRecord, marineRecord]);
  assert.equal(pulse.event, "mobilisation_watch");
  assert.equal(pulse.label, "Mobilisation watch");
  assert.equal(pulse.hydrology.count, 1);
  assert.equal(pulse.marine.count, 1);
  assert.equal(pulse.nutrients.count, 0);
  assert.ok(pulse.signalCards.some(card => card.level.includes("rain")));
  assert.ok(pulse.signalCards.some(card => card.level === "action"));
}

{
  const pulse = summariseEventPulse([rainRecord(0.0), hydroRecord]);
  assert.equal(pulse.event, "dry_baseline");
  assert.equal(pulse.rainfall.state, "dry");
}

{
  const pulse = summariseEventPulse([rainRecord(5.0), hydroRecord, nutrientRecord]);
  assert.equal(pulse.event, "high_mobilisation_watch");
  assert.equal(pulse.nutrients.count, 1);
}

console.log("WQ Event Pulse engine tests passed.");
