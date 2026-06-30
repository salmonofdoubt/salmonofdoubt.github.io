import assert from "node:assert/strict";
import { summariseEventPulse, summariseRainfall, summariseSpatialContext } from "../js/pulseEngine.js";

const rainRecord = (value, name = "Rainfall observation — Dunsany", lat = 53.515, lon = -6.66) => ({
  id: `rain-${name}-${value}`,
  source: "met_eireann_observations",
  type: "rainfall_observation",
  name,
  lat,
  lon,
  observed_at: "2026-06-29T18:00:00Z",
  parameters: [
    { key: "rainfall", label: "Rainfall", value, unit: "mm" },
  ],
});

const hydroRecord = (name = "OPW hydrometric station", lat = 53.43, lon = -6.2) => ({
  id: `opw-${name}`,
  source: "opw_waterlevel",
  type: "water_level",
  name,
  lat,
  lon,
  observed_at: "2026-06-29T18:00:00Z",
  parameters: [
    { key: "value", label: "Latest hydrometric reading", value: 1.2, unit: "m" },
  ],
});

const marineRecord = (name = "Irish Weather Buoy M2", lat = 53.4836, lon = -5.4302) => ({
  id: `marine-${name}`,
  source: "marine_institute_weather_buoys",
  type: "marine_observation",
  name,
  lat,
  lon,
  observed_at: "2026-06-29T16:00:00Z",
  parameters: [
    { key: "significant_wave_height", label: "Significant wave height", value: 1.1, unit: "m" },
  ],
});

const nutrientRecord = {
  id: "sample-1",
  source: "local_import",
  type: "chemistry_sample",
  name: "Imported chemistry",
  lat: 53.42,
  lon: -6.13,
  observed_at: "2026-06-29T18:10:00Z",
  parameters: [
    { key: "po4_p", label: "PO₄-P", value: 0.04, unit: "mg/L" },
  ],
};

const focusArea = {
  id: "baldoyle_howth_malahide",
  name: "Baldoyle Bay · Howth · Portmarnock · Malahide",
  centre: [53.42, -6.13],
};

{
  const rain = summariseRainfall([rainRecord(0), rainRecord(0.2), rainRecord(2.4)]);
  assert.equal(rain.records, 3);
  assert.equal(rain.wetStations, 2);
  assert.equal(rain.triggerStations, 1);
  assert.equal(rain.state, "trigger");
}

{
  const pulse = summariseEventPulse([rainRecord(2.4), hydroRecord(), marineRecord()]);
  assert.equal(pulse.event, "mobilisation_watch");
  assert.equal(pulse.label, "Mobilisation watch");
  assert.equal(pulse.hydrology.count, 1);
  assert.equal(pulse.marine.count, 1);
  assert.equal(pulse.nutrients.count, 0);
  assert.ok(pulse.signalCards.some(card => card.level.includes("rain")));
  assert.ok(pulse.signalCards.some(card => card.level === "action"));
}

{
  const pulse = summariseEventPulse([rainRecord(0.0), hydroRecord()]);
  assert.equal(pulse.event, "dry_baseline");
  assert.equal(pulse.rainfall.state, "dry");
}

{
  const pulse = summariseEventPulse([rainRecord(5.0), hydroRecord(), nutrientRecord]);
  assert.equal(pulse.event, "high_mobilisation_watch");
  assert.equal(pulse.nutrients.count, 1);
}

{
  const spatial = summariseSpatialContext(
    [
      rainRecord(5.0, "Far wet station", 54.5, -8.2),
      rainRecord(0.2, "Nearby light rain station", 53.43, -6.2),
      hydroRecord("Nearby OPW", 53.44, -6.18),
      marineRecord("M2", 53.4836, -5.4302),
    ],
    focusArea,
  );

  assert.equal(spatial.rainfall.record.name, "Nearby light rain station");
  assert.equal(spatial.rainfall.rainfall, 0.2);
  assert.equal(spatial.hydrology.record.name, "Nearby OPW");
  assert.ok(spatial.rainfall.distanceKm < 10);
}

{
  const pulse = summariseEventPulse(
    [
      rainRecord(5.0, "Far wet station", 54.5, -8.2),
      rainRecord(0.0, "Nearby dry station", 53.43, -6.2),
      hydroRecord("Nearby OPW", 53.44, -6.18),
    ],
    focusArea,
  );

  assert.equal(pulse.event, "dry_baseline");
  assert.equal(pulse.rainfall.state, "dry");
  assert.ok(pulse.rainfall.text.includes("Nearest rainfall station"));
  assert.ok(pulse.signalCards.some(card => card.body.includes("from focus centre")));
}


{
  const pulse = summariseEventPulse([rainRecord(2.4), hydroRecord()], focusArea);
  assert.ok(Array.isArray(pulse.evidenceLadder));
  assert.ok(pulse.evidenceLadder.length >= 5);

  const driver = pulse.evidenceLadder.find(step => step.title === "Driver signal");
  const chemistry = pulse.evidenceLadder.find(step => step.title === "Concentration evidence");
  const impact = pulse.evidenceLadder.find(step => step.title === "Impact claim");
  const posture = pulse.evidenceLadder.find(step => step.title.startsWith("Decision posture:"));

  assert.equal(driver.level, "available");
  assert.equal(chemistry.level, "missing");
  assert.equal(impact.level, "not-proven");
  assert.equal(posture.level, "test");
}

{
  const pulse = summariseEventPulse([rainRecord(5.0), hydroRecord(), nutrientRecord], focusArea);

  const chemistry = pulse.evidenceLadder.find(step => step.title === "Concentration evidence");
  const posture = pulse.evidenceLadder.find(step => step.title.startsWith("Decision posture:"));

  assert.equal(chemistry.level, "available");
  assert.equal(posture.level, "available");
}

console.log("WQ Event Pulse engine tests passed.");
