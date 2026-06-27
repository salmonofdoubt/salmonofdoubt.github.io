import { TYPE_STYLE } from "./config.js";
import { hasCoordinates, recordMatches } from "./records.js";
import { popupHtml } from "./view.js";

function markerStyle(record) {
  return TYPE_STYLE[record.type] || { radius: 6, color: "#5eead4", fillColor: "#0f766e" };
}

export function createMap(element, focusArea) {
  const centre = focusArea?.centre || [53.45, -7.85];
  const zoom = focusArea?.zoom || 7;

  const map = L.map(element, {
    scrollWheelZoom: false
  }).setView(centre, zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  return map;
}

export function drawFocusArea(map, focusLayer, focusArea) {
  if (!map || !focusArea) return focusLayer;

  const layer = focusLayer || L.layerGroup().addTo(map);
  layer.clearLayers();

  L.rectangle(focusArea.bounds, {
    color: "#5eead4",
    weight: 2,
    fillOpacity: 0.04
  }).addTo(layer);

  return layer;
}

export function fitFocusArea(map, focusArea, focusLayer) {
  if (!map || !focusArea) return focusLayer;
  const layer = drawFocusArea(map, focusLayer, focusArea);
  map.fitBounds(focusArea.bounds, { padding: [18, 18] });
  return layer;
}

export function fitIreland(map) {
  if (!map) return;
  map.setView([53.45, -7.85], 7);
}

export function renderMarkers({ map, markerLayer, records, filters, context, onSelect }) {
  const layer = markerLayer || L.layerGroup().addTo(map);
  layer.clearLayers();

  records
    .filter(record => recordMatches(record, filters))
    .filter(hasCoordinates)
    .forEach(record => {
      const style = markerStyle(record);
      const marker = L.circleMarker([Number(record.lat), Number(record.lon)], {
        radius: style.radius,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: 0.86,
        weight: 1.5
      });

      marker.bindPopup(popupHtml(record, context));
      marker.on("click", () => onSelect(record));
      marker.addTo(layer);
    });

  return layer;
}
