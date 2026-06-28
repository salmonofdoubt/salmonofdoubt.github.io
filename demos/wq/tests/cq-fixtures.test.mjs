import assert from "node:assert/strict";
import {
  ALL_LOCATIONS,
  buildCqResult,
  classifySites,
  slopeInterpretation
} from "../js/cqEngine.js";
import { parseChemistryCsv } from "../js/chemistryLayer.js";

const focusAreas = {
  default_area: "test_focus",
  areas: [{
    id: "test_focus",
    name: "Synthetic test focus",
    centre: [53.6, -6.3],
    zoom: 10,
    bounds: [[53.0, -7.1], [54.0, -6.0]]
  }]
};

function csvFromRows(rows) {
  const headers = Object.keys(rows[0]);

  function escape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  return [
    headers.join(","),
    ...rows.map(row => headers.map(header => escape(row[header])).join(","))
  ].join("\n");
}

function makeRows() {
  const rows = [];

  const sites = [
    {
      site: "Activation site",
      prefix: "ACT",
      q: [0.20, 0.34, 0.56, 0.90, 1.35, 1.90],
      po4: [0.026, 0.036, 0.052, 0.079, 0.105, 0.138]
    },
    {
      site: "Dilution site",
      prefix: "DIL",
      q: [0.20, 0.34, 0.56, 0.90, 1.35, 1.90],
      po4: [0.138, 0.111, 0.086, 0.063, 0.047, 0.036]
    },
    {
      site: "Chemostatic site",
      prefix: "WEAK",
      q: [0.20, 0.34, 0.56, 0.90, 1.35, 1.90],
      po4: [0.060, 0.058, 0.061, 0.059, 0.062, 0.060]
    }
  ];

  for (const site of sites) {
    site.q.forEach((q, index) => {
      rows.push({
        sample_id: `${site.prefix}-${index + 1}`,
        site: site.site,
        name: `${site.site} sample ${index + 1}`,
        lat: 53.55 + index * 0.002,
        lon: -6.35 + index * 0.002,
        date: `2026-06-${String(20 + index).padStart(2, "0")}`,
        q_proxy_m3_s: q,
        po4_p: site.po4[index],
        no3_n: 1 + q * 0.7,
        nh4_n: 0.04 + q * 0.02
      });
    });
  }

  return rows;
}

function options(records, overrides = {}) {
  return {
    records,
    focusAreas,
    focusAreaId: "test_focus",
    parameter: "po4_p",
    location: ALL_LOCATIONS,
    period: "all",
    start: "",
    end: "",
    pairing: "imported_q",
    distanceKm: 20,
    timeRule: "latest",
    ...overrides
  };
}

const records = parseChemistryCsv(csvFromRows(makeRows()));

assert.equal(records.length, 18, "wide CSV should create one chemistry_sample per row");
assert.equal(records[0].parameters.length, 3, "each wide row should retain multiple analytes as parameters");
assert.equal(records[0].raw.q_proxy_m3_s, "0.2", "raw q_proxy_m3_s must be retained for imported-Q pairing");

{
  const result = buildCqResult(options(records, { location: "activation_site" }));
  assert.equal(result.pairs.length, 6);
  assert.equal(result.regression.ok, true);
  assert.ok(result.regression.slope > 0.25);
  assert.equal(slopeInterpretation(result.regression).label, "Activation");
}

{
  const result = buildCqResult(options(records, { location: "dilution_site" }));
  assert.equal(result.pairs.length, 6);
  assert.equal(result.regression.ok, true);
  assert.ok(result.regression.slope < -0.25);
  assert.equal(slopeInterpretation(result.regression).label, "Dilution");
}

{
  const result = buildCqResult(options(records, { location: "chemostatic_site" }));
  assert.equal(result.pairs.length, 6);
  assert.equal(result.regression.ok, true);
  assert.ok(Math.abs(result.regression.slope) <= 0.25);
  assert.equal(slopeInterpretation(result.regression).label, "Weak / chemostatic");
}

{
  const result = buildCqResult(options(records, { location: ALL_LOCATIONS }));
  assert.equal(result.locationMode, "screening");
  assert.equal(result.regression.ok, false);
  assert.match(result.regression.reason, /pooled regression is suppressed/);
}

{
  const noQCsv = csvFromRows([{
    sample_id: "NOQ-1",
    site: "Missing Q site",
    name: "Missing Q site sample",
    lat: 53.6,
    lon: -6.3,
    date: "2026-06-20",
    po4_p: 0.05,
    no3_n: 1.2,
    nh4_n: 0.06
  }]);

  const noQRecords = parseChemistryCsv(noQCsv);
  const result = buildCqResult(options(noQRecords, { location: "missing_q_site" }));

  assert.equal(result.pairs.length, 0, "imported-Q pairing must refuse records without Q");
  assert.equal(result.regression.ok, false);
}

{
  const rows = classifySites(options(records));
  const classes = new Map(rows.map(row => [row.site.key, row.interpretation.label]));

  assert.equal(rows.length, 3);
  assert.equal(classes.get("activation_site"), "Activation");
  assert.equal(classes.get("dilution_site"), "Dilution");
  assert.equal(classes.get("chemostatic_site"), "Weak / chemostatic");
}

console.log("C-Q fixture tests passed.");
