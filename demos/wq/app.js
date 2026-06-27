import { loadAppData } from "./js/api.js";
import { activeFocusArea } from "./js/records.js";
import { createMap, drawFocusArea, fitFocusArea, fitIreland, renderMarkers } from "./js/map.js";
import { renderFocusOptions, renderSignals, renderSources, renderStats } from "./js/panels.js";
import { selectedHtml } from "./js/view.js";
import { drawCqChart } from "./js/charts.js";
import { installPwaButton, installShareButton } from "./js/pwa.js";

const state = {
  payload: null,
  thresholds: null,
  focusAreas: null,
  records: [],
  focusAreaId: null,
  selectedRecord: null,
  map: null,
  focusLayer: null,
  markerLayer: null
};

const els = {
  records: document.getElementById("statRecords"),
  sources: document.getElementById("statSources"),
  alerts: document.getElementById("statAlerts"),
  updated: document.getElementById("statUpdated"),
  map: document.getElementById("waterMap"),
  selected: document.getElementById("selectedRecord"),
  layerFilter: document.getElementById("layerFilter"),
  unitMode: document.getElementById("unitMode"),
  search: document.getElementById("searchBox"),
  signalGrid: document.getElementById("signalGrid"),
  sourceGrid: document.getElementById("sourceGrid"),
  chart: document.getElementById("cqChart"),
  chartCaption: document.getElementById("chartCaption"),
  chartParameter: document.getElementById("chartParameter"),
  chartScale: document.getElementById("chartScale"),
  focusSelect: document.getElementById("focusAreaSelect"),
  zoomFocus: document.getElementById("zoomFocus"),
  fitIreland: document.getElementById("fitIreland"),
  share: document.getElementById("shareApp"),
  install: document.getElementById("installApp")
};

function context() {
  return {
    thresholds: state.thresholds,
    unitMode: els.unitMode?.value || "native"
  };
}

function filters() {
  return {
    layer: els.layerFilter?.value || "all",
    query: els.search?.value || ""
  };
}

function currentFocusArea() {
  return activeFocusArea(state.focusAreas, state.focusAreaId);
}

function refreshMap() {
  state.markerLayer = renderMarkers({
    map: state.map,
    markerLayer: state.markerLayer,
    records: state.records,
    filters: filters(),
    context: context(),
    onSelect: record => {
      state.selectedRecord = record;
      els.selected.innerHTML = selectedHtml(record, context());
    }
  });
}

function refreshPanels() {
  renderStats(els, state.payload, state.records);
  renderSignals(els.signalGrid, state.payload, state.records, state.focusAreas, state.focusAreaId);
  renderSources(els.sourceGrid, state.payload?.sources || []);
}

function refreshChart() {
  drawCqChart(
    els.chart,
    els.chartCaption,
    state.payload,
    els.chartParameter?.value || "all",
    els.chartScale?.value || "log"
  );
}

function installTabs() {
  document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-panel]").forEach(item => item.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("is-active"));

      button.classList.add("is-active");
      document.getElementById(button.dataset.panel)?.classList.add("is-active");

      if (button.dataset.panel === "mapPanel" && state.map) {
        window.setTimeout(() => state.map.invalidateSize(), 60);
      }

      if (button.dataset.panel === "chartsPanel") {
        refreshChart();
      }
    });
  });
}

function bindControls() {
  [els.layerFilter, els.search].forEach(control => {
    control?.addEventListener("input", refreshMap);
    control?.addEventListener("change", refreshMap);
  });

  els.unitMode?.addEventListener("change", () => {
    refreshMap();
    if (state.selectedRecord) {
      els.selected.innerHTML = selectedHtml(state.selectedRecord, context());
    }
  });

  [els.chartParameter, els.chartScale].forEach(control => {
    control?.addEventListener("change", refreshChart);
  });

  els.focusSelect?.addEventListener("change", () => {
    state.focusAreaId = els.focusSelect.value;
    refreshPanels();
    state.focusLayer = fitFocusArea(state.map, currentFocusArea(), state.focusLayer);
  });

  els.zoomFocus?.addEventListener("click", () => {
    state.focusLayer = fitFocusArea(state.map, currentFocusArea(), state.focusLayer);
  });

  els.fitIreland?.addEventListener("click", () => fitIreland(state.map));
}

async function init() {
  try {
    installTabs();
    installShareButton(els.share);
    installPwaButton(els.install);

    const data = await loadAppData();

    state.payload = data.payload;
    state.thresholds = data.thresholds;
    state.focusAreas = data.focusAreas;
    state.records = data.records;
    state.focusAreaId = data.focusAreas.default_area || data.focusAreas.areas?.[0]?.id || null;

    renderFocusOptions(els.focusSelect, state.focusAreas, state.focusAreaId);
    refreshPanels();

    state.map = createMap(els.map, currentFocusArea());
    state.focusLayer = drawFocusArea(state.map, state.focusLayer, currentFocusArea());
    refreshMap();
    refreshChart();
    bindControls();
  } catch (error) {
    console.error(error);
    if (els.selected) {
      els.selected.innerHTML = `
        <h2>Could not load water data</h2>
        <p>${error.message}</p>
      `;
    }
  }
}

init();
