const ENDPOINTS = {
  nominatim: "https://nominatim.openstreetmap.org/search",
  dail: "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/ArcGIS/rest/services/ConstituencyBoundariesUngeneralised_National_Electoral_Boundaries_2023/FeatureServer/0/query",
  localAuthority: "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/LocalAuthorities_NationalStatutoryBoundaries_Ungeneralised_2024/FeatureServer/0/query",
  lea: "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/ArcGIS/rest/services/LocalElectoralArea_NationalStatutoryBoundaries_Ungeneralised_2024/FeatureServer/1/query",
};

const els = {
  form: document.getElementById("lookupForm"),
  query: document.getElementById("query"),
  locateBtn: document.getElementById("locateBtn"),
  status: document.getElementById("statusBox"),
  resultMeta: document.getElementById("resultMeta"),
  notesBox: document.getElementById("notesBox"),
  tdList: document.getElementById("tdList"),
  councillorList: document.getElementById("councillorList"),
  formatHint: document.getElementById("formatHint"),
};

const state = {
  tds: [],
  councillors: [],
  fallbacks: {},
  meta: null,
};

const LOCAL_AUTHORITY_MAP = {
  "DUBLIN CITY": "Dublin City Council",
  "DUBLIN CITY COUNCIL": "Dublin City Council",
  "DUN LAOGHAIRE RATHDOWN": "Dún Laoghaire-Rathdown County Council",
  "DUN LAOGHAIRE-RATHDOWN": "Dún Laoghaire-Rathdown County Council",
  FINGAL: "Fingal County Council",
  "SOUTH DUBLIN": "South Dublin County Council",
  "SOUTH DUBLIN COUNTY": "South Dublin County Council",
};

const LEA_ALIASES = {
  "DUN LAOGHAIRE": "Dún Laoghaire",
  "GLENCULLEN SANDFORD": "Glencullen–Sandyford",
  "GLENCULLEN SANDFORD 1": "Glencullen–Sandyford",
  "GLENCULLEN SANDFORD 2": "Glencullen–Sandyford",
  "GLENCULLEN SANDFORD 3": "Glencullen–Sandyford",
  "GLENCULLEN SANDFORD 4": "Glencullen–Sandyford",
  "GLENCULLEN SANDYFORD": "Glencullen–Sandyford",
  "KILLINEY SHANKILL": "Killiney–Shankill",
  "HOWTH MALAHIDE": "Howth-Malahide",
  "RUSH LUSK": "Rush-Lusk",
  "BLANCHARDSTOWN MULHUDDART": "Blanchardstown-Mulhuddart",
  "ARTANE WHITEHALL": "Artane-Whitehall",
  "BALLYFERMOT DRIMNAGH": "Ballyfermot-Drimnagh",
  "BALLYMUN FINGLAS": "Ballymun-Finglas",
  "CABRA GLASNEVIN": "Cabra-Glasnevin",
  "KIMMAGE RATHMINES": "Kimmage-Rathmines",
  "NORTH INNER CITY": "North Inner City",
  "SOUTH EAST INNER CITY": "South East Inner City",
  "SOUTH WEST INNER CITY": "South West Inner City",
  "DUBLIN SOUTH CENTRAL": "Dublin South-Central",
  "DUBLIN NORTH WEST": "Dublin North-West",
  "DUBLIN MID WEST": "Dublin Mid-West",
  "DUBLIN FINGAL EAST": "Dublin Fingal East",
  "DUBLIN FINGAL WEST": "Dublin Fingal West",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function canonicalConstituency(value) {
  const norm = normalizeText(value);
  return LEA_ALIASES[norm] || value;
}

function canonicalLea(value) {
  const norm = normalizeText(value);
  return LEA_ALIASES[norm] || value;
}

function canonicalCouncil(value) {
  const norm = normalizeText(value);
  return LOCAL_AUTHORITY_MAP[norm] || value;
}

function looksLikeEircode(input) {
  return /^[AC-FHKNPRTV-Y][0-9]{2}\s?[AC-FHKNPRTV-Y0-9]{4}$/i.test(input.trim());
}

function setStatus(message, kind = "") {
  els.status.textContent = message;
  els.status.className = `panel status ${kind}`.trim();
}

function renderCards(target, items, emptyText) {
  if (!items || items.length === 0) {
    target.className = "card-list empty-state";
    target.textContent = emptyText;
    return;
  }

  target.className = "card-list";
  target.innerHTML = items.map((item) => `
    <article class="card">
      <h3>${escapeHtml(item.name || "Unnamed contact")}</h3>
      <div class="sub">${escapeHtml(item.party || item.council || "Contact")}</div>
      <div class="meta">
        ${item.constituency ? `<div><strong>Constituency:</strong> ${escapeHtml(item.constituency)}</div>` : ""}
        ${item.lea ? `<div><strong>LEA:</strong> ${escapeHtml(item.lea)}</div>` : ""}
        ${item.email ? `<div>Email: <a href="mailto:${escapeHtmlAttr(item.email)}">${escapeHtml(item.email)}</a></div>` : ""}
        ${item.phone ? `<div>Phone: <a href="tel:${escapeHtmlAttr(item.phone)}">${escapeHtml(item.phone)}</a></div>` : ""}
        ${item.address ? `<div>Address: ${escapeHtml(item.address)}</div>` : ""}
        ${item.website ? `<div>Web: <a href="${escapeHtmlAttr(item.website)}" target="_blank" rel="noreferrer">Open page</a></div>` : ""}
      </div>
    </article>
  `).join("");
}

function renderMeta(result) {
  els.resultMeta.classList.remove("hidden");
  els.resultMeta.innerHTML = `
    <div class="meta-line"><strong>Resolved location:</strong> ${escapeHtml(result.display_name || "Current location")}</div>
    <div class="meta-line"><strong>Coordinates:</strong> ${Number(result.lat).toFixed(5)}, ${Number(result.lon).toFixed(5)}</div>
    <div class="meta-line"><strong>Constituency:</strong> ${escapeHtml(result.constituency || "Unknown")}</div>
    <div class="meta-line"><strong>Local authority:</strong> ${escapeHtml(result.localAuthority || "Unknown")}</div>
    <div class="meta-line"><strong>Local electoral area:</strong> ${escapeHtml(result.lea || "Unknown")}</div>
  `;
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    els.notesBox.classList.add("hidden");
    els.notesBox.innerHTML = "";
    return;
  }

  els.notesBox.classList.remove("hidden");
  els.notesBox.innerHTML = `<ul class="note-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

async function loadData() {
  const [tds, councillors, fallbacks, meta] = await Promise.all([
    fetch("data/tds.json").then((r) => r.json()),
    fetch("data/councillors.json").then((r) => r.json()),
    fetch("data/fallbacks.json").then((r) => r.json()),
    fetch("data/meta.json").then((r) => r.json()),
  ]);
  state.tds = tds;
  state.councillors = councillors;
  state.fallbacks = fallbacks;
  state.meta = meta;
}

async function geocodeQuery(query) {
  const clean = query.trim();
  const q = looksLikeEircode(clean) ? `${clean} Ireland` : clean;
  const url = new URL(ENDPOINTS.nominatim);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "ie");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("The address lookup service did not respond cleanly.");
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("No location match was found for that input.");
  }

  const scored = results
    .map((item) => {
      const text = `${item.display_name || ""} ${item.address?.city || ""} ${item.address?.county || ""}`.toUpperCase();
      let score = 0;
      if (text.includes("DUBLIN")) score += 5;
      if (item.address?.county && String(item.address.county).toUpperCase().includes("DUBLIN")) score += 3;
      if (looksLikeEircode(clean) && text.includes(clean.slice(0, 3).toUpperCase())) score += 2;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0].item;
  return {
    display_name: best.display_name || clean,
    lat: Number(best.lat),
    lon: Number(best.lon),
  };
}

async function queryArcGisPoint(url, lon, lat) {
  const api = new URL(url);
  api.searchParams.set("f", "json");
  api.searchParams.set("geometry", `${lon},${lat}`);
  api.searchParams.set("geometryType", "esriGeometryPoint");
  api.searchParams.set("inSR", "4326");
  api.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  api.searchParams.set("returnGeometry", "false");
  api.searchParams.set("outFields", "*");

  const response = await fetch(api.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("Official boundary lookup failed.");
  }

  const data = await response.json();
  return data?.features?.[0]?.attributes || null;
}

function firstDefined(attrs, keys) {
  if (!attrs) return "";
  for (const key of keys) {
    if (attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim()) {
      return String(attrs[key]).trim();
    }
  }
  return "";
}

function extractBoundaryName(attrs) {
  return firstDefined(attrs, ["ENG_NAME_VALUE", "CONSTITUENCY", "NAME", "name", "LEA", "lea"]);
}

async function resolvePoliticalAreas(lat, lon) {
  const [dailAttrs, localAuthorityAttrs, leaAttrs] = await Promise.all([
    queryArcGisPoint(ENDPOINTS.dail, lon, lat),
    queryArcGisPoint(ENDPOINTS.localAuthority, lon, lat),
    queryArcGisPoint(ENDPOINTS.lea, lon, lat),
  ]);

  return {
    constituency: canonicalConstituency(extractBoundaryName(dailAttrs)) || "",
    localAuthority: canonicalCouncil(extractBoundaryName(localAuthorityAttrs)) || "",
    lea: canonicalLea(extractBoundaryName(leaAttrs)) || "",
  };
}

function matchTds(constituency) {
  const target = normalizeText(constituency);
  return state.tds.filter((item) => normalizeText(item.constituency) === target);
}

function matchCouncillors(localAuthority, lea) {
  const councilTarget = normalizeText(localAuthority);
  const leaTarget = normalizeText(lea);
  return state.councillors.filter((item) => {
    return normalizeText(item.council) === councilTarget && normalizeText(item.lea) === leaTarget;
  });
}

function councilFallback(localAuthority) {
  return state.fallbacks[localAuthority] || null;
}

async function runLookupFromCoords(lat, lon, sourceLabel) {
  setStatus("Resolving official political areas…", "ok");
  const notes = [];
  const areas = await resolvePoliticalAreas(lat, lon);

  const tds = areas.constituency ? matchTds(areas.constituency) : [];
  let councillors = areas.localAuthority && areas.lea ? matchCouncillors(areas.localAuthority, areas.lea) : [];

  const fallback = areas.localAuthority ? councilFallback(areas.localAuthority) : null;
  if (councillors.length === 0 && fallback) {
    councillors = fallback.contacts || [];
    if (fallback.message) notes.push(fallback.message);
  }

  if (!areas.localAuthority || !normalizeText(areas.localAuthority).includes("DUBLIN")) {
    notes.push("This build is Dublin-first. Outside-Dublin local councillor data is not bundled.");
  }
  if (!areas.constituency) {
    notes.push("The constituency lookup did not return a result for these coordinates.");
  }
  if (!areas.lea) {
    notes.push("The local electoral area lookup did not return a result for these coordinates.");
  }
  if (areas.constituency && tds.length === 0) {
    notes.push("A constituency was identified, but no bundled TD rows matched it.");
  }
  if (areas.localAuthority && areas.lea && councillors.length === 0) {
    notes.push("A Dublin council area was identified, but no bundled councillor rows matched that LEA.");
  }

  renderMeta({
    display_name: sourceLabel,
    lat,
    lon,
    ...areas,
  });
  renderNotes(notes);
  renderCards(els.tdList, tds, "No TD contacts matched that constituency.");
  renderCards(els.councillorList, councillors, "No councillor contacts matched that area.");
  setStatus("Lookup complete.", "ok");
}

async function runLookupFromText(query) {
  setStatus("Resolving location from address or Eircode…", "ok");
  const place = await geocodeQuery(query);
  await runLookupFromCoords(place.lat, place.lon, place.display_name);
}

async function runLookupFromBrowserLocation() {
  if (!navigator.geolocation) {
    throw new Error("This browser does not expose geolocation.");
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });

  const { latitude, longitude } = position.coords;
  await runLookupFromCoords(latitude, longitude, "Browser location");
}

function resetResults() {
  els.resultMeta.classList.add("hidden");
  els.notesBox.classList.add("hidden");
  renderCards(els.tdList, [], "No result yet.");
  renderCards(els.councillorList, [], "No result yet.");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rawQuery = els.query.value.trim();
  if (!rawQuery) {
    setStatus("Please enter an address or Eircode, or use current location.", "warn");
    return;
  }

  try {
    await runLookupFromText(rawQuery);
  } catch (error) {
    resetResults();
    setStatus(error.message || "Lookup failed.", "error");
  }
});

els.locateBtn.addEventListener("click", async () => {
  try {
    setStatus("Requesting your browser location…", "ok");
    await runLookupFromBrowserLocation();
  } catch (error) {
    resetResults();
    setStatus(error.message || "Location lookup failed.", "error");
  }
});

els.query.addEventListener("input", () => {
  const value = els.query.value.trim();
  if (!value) {
    els.formatHint.textContent = "For Dublin addresses, current location is usually the cleanest route.";
    return;
  }
  els.formatHint.textContent = looksLikeEircode(value)
    ? "That looks like an Eircode. Exact browser location may still be more reliable."
    : "That looks like free-text address input. Dublin place names usually work better than vague routing keys.";
});

(async function init() {
  try {
    await loadData();
    setStatus("Ready.", "ok");
  } catch (error) {
    setStatus("The local data bundle could not be loaded.", "error");
  }
})();
