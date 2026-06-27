import { normaliseKey, numberValue } from "./format.js";

export function evaluateThreshold(parameter, thresholds) {
  const key = normaliseKey(parameter.key || parameter.label);
  const value = numberValue(parameter.value);

  if (value === null || !thresholds) {
    return { label: "No threshold", className: "context", detail: "No numeric value available." };
  }

  const bathing = thresholds.bathing_coastal_transitional?.parameters || {};
  const threshold = bathing[key];

  if (!threshold) {
    return {
      label: "Context only",
      className: "context",
      detail: "No universal threshold is applied for this parameter."
    };
  }

  if (value <= threshold.excellent) {
    return { label: "Excellent context", className: "good", detail: `≤ ${threshold.excellent} ${threshold.unit}` };
  }

  if (value <= threshold.good) {
    return { label: "Good context", className: "good", detail: `≤ ${threshold.good} ${threshold.unit}` };
  }

  if (value <= threshold.sufficient) {
    return { label: "Sufficient context", className: "watch", detail: `≤ ${threshold.sufficient} ${threshold.unit}` };
  }

  return { label: "Poor context", className: "bad", detail: `> ${threshold.sufficient} ${threshold.unit}` };
}
