export async function loadJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

export async function loadAppData() {
  const [payload, thresholds, focusAreas] = await Promise.all([
    loadJson("./data/latest.json"),
    loadJson("./data/thresholds.json"),
    loadJson("./data/focus-areas.json")
  ]);

  return {
    payload,
    thresholds,
    focusAreas,
    records: Array.isArray(payload.records) ? payload.records : []
  };
}
