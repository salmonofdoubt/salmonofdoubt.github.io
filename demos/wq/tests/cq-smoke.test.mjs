import assert from "node:assert/strict";
import {
  ALL_LOCATIONS,
  slopeInterpretation
} from "../js/cqEngine.js";

assert.equal(ALL_LOCATIONS, "__all__");

assert.equal(
  slopeInterpretation({ ok: true, slope: 0.5 }).label,
  "Activation"
);

assert.equal(
  slopeInterpretation({ ok: true, slope: -0.5 }).label,
  "Dilution"
);

assert.equal(
  slopeInterpretation({ ok: true, slope: 0.05 }).label,
  "Weak / chemostatic"
);

assert.equal(
  slopeInterpretation({ ok: false, reason: "No fit" }).label,
  "Not fitted"
);

console.log("C-Q smoke tests passed.");
