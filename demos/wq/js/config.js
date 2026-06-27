export const APP_VERSION = "0.2.0";

export const TYPE_LABELS = {
  water_level: "Live hydrometry",
  bathing_water: "Bathing location",
  bathing_measurement: "Bathing sample",
  bathing_alert: "Bathing alert",
  wfd_context: "WFD context",
  groundwater_context: "Groundwater context",
  marine_context: "Marine shore context"
};

export const TYPE_STYLE = {
  water_level: { radius: 5, color: "#67e8f9", fillColor: "#0891b2" },
  bathing_water: { radius: 7, color: "#5eead4", fillColor: "#0f766e" },
  bathing_measurement: { radius: 7, color: "#86efac", fillColor: "#15803d" },
  bathing_alert: { radius: 9, color: "#fb7185", fillColor: "#be123c" },
  wfd_context: { radius: 6, color: "#c084fc", fillColor: "#7e22ce" },
  groundwater_context: { radius: 6, color: "#fde68a", fillColor: "#a16207" },
  marine_context: { radius: 6, color: "#93c5fd", fillColor: "#1d4ed8" }
};
