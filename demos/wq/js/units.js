import { normaliseKey, numberValue } from "./format.js";

const MOLAR_CONVERSIONS = {
  no3_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
  nitrate_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
  nh4_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
  ammonium_n: { factor: 71.394, unit: "µmol N/L", basis: "as nitrogen" },
  po4_p: { factor: 32.285, unit: "µmol P/L", basis: "as phosphorus" },
  phosphate_p: { factor: 32.285, unit: "µmol P/L", basis: "as phosphorus" }
};

export function convertParameter(parameter, unitMode = "native") {
  if (unitMode === "native") return parameter;

  const key = normaliseKey(parameter.key || parameter.label);
  const value = numberValue(parameter.value);
  const unit = String(parameter.unit || "").toLowerCase();

  if (value === null) return parameter;

  if (unitMode === "molar" && MOLAR_CONVERSIONS[key] && unit.includes("mg")) {
    const rule = MOLAR_CONVERSIONS[key];
    return {
      ...parameter,
      value: value * rule.factor,
      unit: rule.unit,
      basis: rule.basis,
      converted_from: `${parameter.value} ${parameter.unit}`
    };
  }

  if (unitMode === "mass" && unit.includes("mg")) {
    return {
      ...parameter,
      value: value * 1000,
      unit: String(parameter.unit).replace(/mg/i, "µg"),
      converted_from: `${parameter.value} ${parameter.unit}`
    };
  }

  return parameter;
}
