const state = {
  birds: [],
  filtered: [],
  map: null,
  marker: null,
  location: null,
  habitats: new Set()
};

const els = {
  grid: document.getElementById("birdGrid"),
  template: document.getElementById("birdCardTemplate"),
  search: document.getElementById("search"),
  status: document.getElementById("statusFilter"),
  sound: document.getElementById("soundFilter"),
  sort: document.getElementById("sortFilter"),
  notice: document.getElementById("coverageNotice"),
  total: document.getElementById("totalSpecies"),
  audio: document.getElementById("audioSpecies"),
  rare: document.getElementById("rareSpecies"),
  generated: document.getElementById("generatedAt"),
  shuffle: document.getElementById("shuffleSound"),
  map: document.getElementById("birdMap"),
  useLocation: document.getElementById("useLocation"),
  month: document.getElementById("monthFilter"),
  radius: document.getElementById("radiusFilter"),
  deckMode: document.getElementById("deckMode"),
  nearbySummary: document.getElementById("nearbySummary")
};

const MONTHS = {
  1: "January", 2: "February", 3: "March", 4: "April",
  5: "May", 6: "June", 7: "July", 8: "August",
  9: "September", 10: "October", 11: "November", 12: "December"
};

const IRELAND_CENTRE = { lat: 53.35, lng: -7.7 };
const DUBLIN_COAST = { lat: 53.38, lng: -6.13 };

const COAST_POINTS = [
  { name: "Donegal", lat: 55.15, lng: -8.13 },
  { name: "Sligo", lat: 54.27, lng: -8.48 },
  { name: "Mayo", lat: 53.80, lng: -9.52 },
  { name: "Galway Bay", lat: 53.25, lng: -9.10 },
  { name: "Shannon Estuary", lat: 52.62, lng: -9.23 },
  { name: "Kerry", lat: 52.15, lng: -9.90 },
  { name: "Cork Harbour", lat: 51.85, lng: -8.30 },
  { name: "Waterford", lat: 52.15, lng: -7.05 },
  { name: "Wexford", lat: 52.34, lng: -6.46 },
  { name: "Wicklow", lat: 52.98, lng: -6.04 },
  { name: "Dublin Bay", lat: 53.33, lng: -6.10 },
  { name: "Dundalk Bay", lat: 54.00, lng: -6.25 }
];

const ESTUARY_POINTS = [
  { name: "Baldoyle/Malahide", lat: 53.45, lng: -6.15 },
  { name: "Dublin Bay", lat: 53.32, lng: -6.13 },
  { name: "Rogerstown", lat: 53.52, lng: -6.12 },
  { name: "Boyne", lat: 53.72, lng: -6.25 },
  { name: "Dundalk Bay", lat: 54.00, lng: -6.25 },
  { name: "Wexford Harbour", lat: 52.34, lng: -6.45 },
  { name: "Cork Harbour", lat: 51.85, lng: -8.30 },
  { name: "Shannon Estuary", lat: 52.62, lng: -9.23 },
  { name: "Galway Bay", lat: 53.25, lng: -9.10 }
];

const CITY_POINTS = [
  { name: "Dublin", lat: 53.35, lng: -6.26 },
  { name: "Cork", lat: 51.90, lng: -8.47 },
  { name: "Galway", lat: 53.27, lng: -9.06 },
  { name: "Limerick", lat: 52.66, lng: -8.63 },
  { name: "Waterford", lat: 52.26, lng: -7.11 },
  { name: "Drogheda", lat: 53.72, lng: -6.35 },
  { name: "Dundalk", lat: 54.00, lng: -6.40 },
  { name: "Sligo", lat: 54.27, lng: -8.47 }
];

function statusText(codes = []) {
  const labels = {
    A: "Recorded naturally since 1950",
    B: "Historical natural record before 1950 only",
    C: "Introduced / established feral",
    R: "Rarity requiring details"
  };
  return codes.map(code => labels[code] || code).join("; ") || "Unclassified";
}

function hasAudio(bird) {
  return Boolean(bird.audio && bird.audio.file);
}

function hasImage(bird) {
  return Boolean(bird.image && (bird.image.thumb || bird.image.original || bird.image.url));
}

function renderImage(bird) {
  if (!hasImage(bird)) {
    return `<div class="image-placeholder">No image matched yet</div>`;
  }

  const image = bird.image;
  const src = image.thumb || image.original || image.url;
  const page = image.commons_url || image.url || "#";
  const source = image.source || "Wikimedia";
  const licence = image.license || "See source page";

  return `
    <img src="${src}" alt="${bird.common_name || "Bird"}" loading="lazy" />
    <p class="image-credit">
      Image: <a href="${page}" target="_blank" rel="noopener">${source}</a>. ${licence}.
    </p>
  `;
}

function qualityRank(q) {
  return { A: 1, B: 2, C: 3, D: 4, E: 5 }[String(q || "").toUpperCase()] || 9;
}

function classifyStatus(bird) {
  const codes = bird.status_codes || [];
  if (codes.includes("B")) return "historical";
  if (codes.includes("C")) return "introduced";
  if (codes.includes("R")) return "rare";
  return "regular";
}

function matchesStatus(bird, filter) {
  if (filter === "all") return true;
  if (filter === "regular") {
    const codes = bird.status_codes || [];
    return codes.includes("A") || codes.includes("C");
  }
  return classifyStatus(bird) === filter;
}

function monthFromNow() {
  return new Date().getMonth() + 1;
}

function selectedMonth() {
  return Number(els.month?.value || monthFromNow());
}

function deckLimit() {
  const radius = Number(els.radius?.value || 10);
  if (radius <= 5) return 45;
  if (radius <= 10) return 70;
  if (radius <= 25) return 110;
  return 160;
}

function seasonForMonth(month) {
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function birdAliases(bird) {
  const common = String(bird.common_name || "").toLowerCase();
  const scientific = String(bird.scientific_name || "").toLowerCase();
  const aliases = [];

  if (common.includes("european robin") || scientific.includes("erithacus rubecula")) {
    aliases.push("robin", "garden robin", "irish robin");
  }

  if (common.includes("wren")) aliases.push("wren");
  if (common.includes("blackbird")) aliases.push("blackbird");
  if (common.includes("chaffinch")) aliases.push("chaffinch");

  return aliases.join(" ");
}

function textBag(bird) {
  return [
    bird.common_name,
    bird.scientific_name,
    bird.irish_name,
    bird.group,
    bird.status,
    birdAliases(bird)
  ].join(" ").toLowerCase();
}

function inferBirdEcology(bird) {
  const t = textBag(bird);
  const habitats = new Set();

  const addIf = (condition, value) => { if (condition) habitats.add(value); };

  addIf(/gull|tern|skua|auk|guillemot|razorbill|puffin|fulmar|gannet|cormorant|shag|shearwater|petrel|kittiwake|diver|eider|scoter|merganser|seaduck|oystercatcher|turnstone|sanderling/.test(t), "coast");
  addIf(/brent|wigeon|teal|pintail|shoveler|godwit|curlew|redshank|greenshank|sandpiper|plover|lapwing|snipe|rail|crake|heron|egret|ibis|spoonbill|moorhen|coot|duck|goose|swan|grebe|bittern|avocet|stilt/.test(t), "wetland");
  addIf(/estuary|brent|godwit|redshank|curlew|dunlin|knot|bar-tailed|black-tailed|oystercatcher|shelduck|turnstone|sanderling|ringed plover|grey plover/.test(t), "estuary");
  addIf(/warbler|woodpecker|treecreeper|nuthatch|tit|chiffchaff|willow|blackcap|goldcrest|firecrest|jay|sparrowhawk|woodcock|owl|thrush|redstart|flycatcher|crossbill/.test(t), "woodland");
  addIf(/sparrow|starling|swift|swallow|martin|wagtail|pigeon|dove|rook|jackdaw|magpie|crow|robin|blackbird|dunnock|finch|greenfinch|goldfinch|chaffinch|collared dove/.test(t), "urban");
  addIf(/robin|blackbird|dunnock|wren|sparrow|tit|finch|starling|magpie|woodpigeon|collared dove|goldcrest/.test(t), "garden");
  addIf(/lapwing|skylark|yellowhammer|bunting|partridge|pheasant|corncrake|rook|crow|kestrel|buzzard|harrier|owl|swallow|martin|wheatear|stonechat|meadow pipit/.test(t), "farmland");
  addIf(/kingfisher|dipper|grey wagtail|sand martin|goosander|merganser|swan|duck|grebe|heron|moorhen|coot|wagtail/.test(t), "river");
  addIf(/curlew|golden plover|merlin|hen harrier|red grouse|ptarmigan|raven|wheatear|stonechat|meadow pipit|twite/.test(t), "bog");
  addIf(/eagle|falcon|harrier|buzzard|kestrel|kite|osprey|hawk|owl/.test(t), "wide");

  if (!habitats.size) {
    habitats.add("general");
  }

  const migratory = {
    summer: /swallow|swift|martin|cuckoo|warbler|chiffchaff|willow|whitethroat|redstart|flycatcher|wheatear|tern|puffin|corncrake|nightjar|hobby|osprey/.test(t),
    winter: /brent|whooper|wigeon|teal|scaup|goldeneye|scoter|diver|godwit|dunlin|knot|sanderling|redwing|fieldfare|waxwing|snow bunting|jack snipe|purple sandpiper/.test(t),
    passage: /sandpiper|phalarope|skua|whimbrel|spotted flycatcher|redstart|wheatear|warbler|tern|plover/.test(t)
  };

  return { habitats: [...habitats], migratory };
}

function monthsForBird(bird) {
  const ecology = inferBirdEcology(bird);
  const t = textBag(bird);
  const codes = bird.status_codes || [];

  if (codes.includes("B")) return [];
  if (codes.includes("R")) {
    if (ecology.migratory.summer) return [4, 5, 6, 7, 8, 9];
    if (ecology.migratory.winter) return [10, 11, 12, 1, 2, 3];
    return [1,2,3,4,5,6,7,8,9,10,11,12];
  }

  if (ecology.migratory.summer && !ecology.migratory.winter) return [4, 5, 6, 7, 8, 9];
  if (ecology.migratory.winter && !ecology.migratory.summer) return [10, 11, 12, 1, 2, 3];
  if (/tern|skua|phalarope|whimbrel|curlew sandpiper|little stint/.test(t)) return [4, 5, 8, 9, 10];

  return [1,2,3,4,5,6,7,8,9,10,11,12];
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function nearestDistanceKm(location, points) {
  if (!location || !points?.length) return Infinity;
  return Math.min(...points.map(point => distanceKm(location, point)));
}

function roughCoastSignal(location) {
  if (!location) return 0;

  const radius = Number(els.radius?.value || 10);
  const coastDistance = nearestDistanceKm(location, COAST_POINTS);

  if (coastDistance <= Math.max(8, radius * 0.65)) return 1;
  if (coastDistance <= Math.max(18, radius * 0.95)) return 0.5;
  return 0;
}

function locationProfile(location) {
  const radius = Number(els.radius?.value || 10);

  const coastDistance = nearestDistanceKm(location, COAST_POINTS);
  const estuaryDistance = nearestDistanceKm(location, ESTUARY_POINTS);
  const cityDistance = nearestDistanceKm(location, CITY_POINTS);

  return {
    coastDistance,
    estuaryDistance,
    cityDistance,
    coastal: coastDistance <= Math.max(10, radius * 0.7),
    nearCoastal: coastDistance <= Math.max(22, radius),
    estuary: estuaryDistance <= Math.max(10, radius * 0.65),
    urban: cityDistance <= Math.max(8, radius * 0.45),
    inland: coastDistance > Math.max(25, radius)
  };
}

function autoHabitatsFromLocation(location) {
  const habitats = new Set(["general"]);

  if (!location) {
    habitats.add("garden");
    habitats.add("farmland");
    habitats.add("river");
    return habitats;
  }

  const profile = locationProfile(location);

  habitats.add("garden");
  habitats.add("farmland");
  habitats.add("river");

  if (profile.urban) {
    habitats.add("urban");
  } else {
    habitats.add("woodland");
  }

  if (profile.coastal || profile.nearCoastal) {
    habitats.add("coast");
  }

  if (profile.estuary) {
    habitats.add("estuary");
    habitats.add("wetland");
  }

  if (profile.inland) {
    habitats.add("woodland");
    habitats.add("bog");
  }

  return habitats;
}

function activeHabitats() {
  if (state.habitats.size) return new Set(state.habitats);
  return autoHabitatsFromLocation(state.location);
}

function passesHabitatGate(bird) {
  const selected = state.habitats.size ? new Set(state.habitats) : activeHabitats();
  const ecology = inferBirdEcology(bird);
  const habitats = ecology.habitats || [];

  if (habitats.includes("general")) return true;
  if (habitats.some(h => selected.has(h))) return true;

  // Wide-ranging raptors/corvids can remain plausible, but not dominant.
  if (habitats.includes("wide") && !selected.has("estuary")) return true;

  return false;
}

function scoreBirdForNearby(bird) {
  const month = selectedMonth();
  const ecology = inferBirdEcology(bird);
  const birdMonths = monthsForBird(bird);
  const codes = bird.status_codes || [];
  const habitats = activeHabitats();
  const radius = Number(els.radius?.value || 10);

  let score = 0;
  const reasons = [];

  if (birdMonths.includes(month)) {
    score += 36;
    reasons.push(`${MONTHS[month]} match`);
  } else if (birdMonths.length) {
    score -= 35;
    reasons.push(`less likely in ${MONTHS[month]}`);
  } else {
    score -= 90;
    reasons.push("historical/low seasonal relevance");
  }

  const overlap = ecology.habitats.filter(h => habitats.has(h));
  if (overlap.length) {
    score += 28 + Math.min(12, overlap.length * 4);
    reasons.push(`habitat: ${overlap.slice(0, 2).join(", ")}`);
  } else if (ecology.habitats.includes("general")) {
    score += 16;
    reasons.push("generalist");
  } else {
    score -= 12;
  }

  const profile = locationProfile(state.location);

  if (habitats.has("coast") || habitats.has("estuary")) {
    if (ecology.habitats.includes("coast") || ecology.habitats.includes("estuary")) score += 22;
  } else {
    if (ecology.habitats.includes("coast") || ecology.habitats.includes("estuary")) score -= 42;
  }

  if (profile.estuary && ecology.habitats.includes("estuary")) score += 28;
  if (profile.coastal && ecology.habitats.includes("coast")) score += 22;
  if (profile.inland && ecology.habitats.includes("coast")) score -= 45;
  if (profile.inland && ecology.habitats.includes("estuary")) score -= 55;
  if (profile.urban && (ecology.habitats.includes("urban") || ecology.habitats.includes("garden"))) score += 14;

  if (codes.includes("R")) {
    score -= 55;
    reasons.push("rarity penalty");
  }
  if (codes.includes("B")) {
    score -= 120;
    reasons.push("historical only");
  }
  if (codes.includes("C")) {
    score -= 6;
  }

  if (hasAudio(bird)) score += 4;
  if (hasImage(bird)) score += 4;

  if (radius >= 25) score += ecology.habitats.includes("wide") ? 12 : 3;
  if (radius <= 5 && ecology.habitats.includes("wide")) score -= 8;

  let confidence = "low";
  if (score >= 70) confidence = "high";
  else if (score >= 40) confidence = "medium";

  return {
    score,
    confidence,
    reasons: reasons.slice(0, 4),
    habitats: ecology.habitats,
    months: birdMonths
  };
}

function renderBadges(bird) {
  const codes = bird.status_codes || [];
  const parts = codes.map(code => {
    const klass = code === "R" ? "rare" : code === "B" ? "historical" : "";
    return `<span class="badge ${klass}">${code}</span>`;
  });

  if (bird.local) {
    parts.push(`<span class="badge confidence ${bird.local.confidence}">${bird.local.confidence}</span>`);
  }

  if (hasAudio(bird)) {
    parts.push(`<span class="badge">Sound</span>`);
    const q = bird.audio.q ? String(bird.audio.q).toUpperCase() : "";
    if (q) parts.push(`<span class="badge">Q ${q}</span>`);
  } else {
    parts.push(`<span class="badge missing">No sound</span>`);
  }

  if (hasImage(bird)) {
    parts.push(`<span class="badge image-ok">Image</span>`);
  }

  return parts.join("");
}

function renderLocalReason(bird) {
  if (!bird.local || els.deckMode.value === "all") return "";
  const month = MONTHS[selectedMonth()];
  const bits = bird.local.reasons?.length ? bird.local.reasons.join(" · ") : "seasonal plausibility";
  return `<p><strong>${month} local deck.</strong> ${bits}. Score ${Math.round(bird.local.score)}.</p>`;
}

function renderSound(bird) {
  if (!hasAudio(bird)) {
    return `
      <p class="missing-note">
        No public xeno-canto recording was matched during the latest harvest. This is a coverage gap, not evidence that the species is silent. An outrageous biological claim would be most illogical.
      </p>
    `;
  }

  const audio = bird.audio;
  const type = Array.isArray(audio.type) ? audio.type.join(", ") : (audio.type || "recording");
  const source = audio.url ? `<a href="${audio.url}" target="_blank" rel="noopener">xeno-canto ${audio.id || ""}</a>` : "xeno-canto";
  const rec = audio.recordist ? `Recordist: ${audio.recordist}` : "Recordist unknown";
  const country = audio.country ? `Country: ${audio.country}` : "Country unknown";
  const licence = audio.license ? `Licence: ${audio.license}` : "Licence not parsed";

  return `
    <audio controls preload="none" src="${audio.file}"></audio>
    <p class="sound-meta">
      ${type}. ${rec}. ${country}. Quality ${audio.q || "?"}. ${licence}. Source: ${source}.
    </p>
  `;
}

function applyNearbyDeck(birds) {
  const query = els.search.value.trim().toLowerCase();

  if (els.deckMode.value === "all") {
    state.plausibleCount = birds.length;
    return birds.map(b => ({ ...b, local: null }));
  }

  const radius = Number(els.radius?.value || 10);
  const threshold = radius <= 5 ? 52 : radius <= 10 ? 46 : radius <= 25 ? 38 : 32;

  const scored = birds
    .map(bird => {
      const local = scoreBirdForNearby(bird);
      return { ...bird, local };
    })
    .sort((a, b) => b.local.score - a.local.score || String(a.common_name).localeCompare(String(b.common_name)));

  if (query) {
    state.plausibleCount = scored.length;
    return scored;
  }

  const plausible = scored
    .filter(b => b.local.score >= threshold)
    .filter(passesHabitatGate);

  state.plausibleCount = plausible.length;

  return plausible.slice(0, deckLimit());
}

function render() {
  const q = els.search.value.trim().toLowerCase();
  const status = els.status.value;
  const sound = els.sound.value;
  const sort = els.sort.value;

  let birds = state.birds.filter(bird => {
    const haystack = [
      textBag(bird),
      ...(bird.status_codes || [])
    ].join(" ").toLowerCase();

    // Direct search is authoritative. Other filters should not hide a named lookup.
    if (q) return haystack.includes(q);

    if (!matchesStatus(bird, status)) return false;
    if (sound === "has" && !hasAudio(bird)) return false;
    if (sound === "missing" && hasAudio(bird)) return false;
    return true;
  });

  birds = applyNearbyDeck(birds);

  birds.sort((a, b) => {
    if (els.deckMode.value === "nearby" && sort === "common") {
      return (b.local?.score || 0) - (a.local?.score || 0) || String(a.common_name).localeCompare(String(b.common_name));
    }
    if (sort === "scientific") return String(a.scientific_name).localeCompare(String(b.scientific_name));
    if (sort === "quality") return qualityRank(a.audio?.q) - qualityRank(b.audio?.q) || String(a.common_name).localeCompare(String(b.common_name));
    if (sort === "status") return String(a.status || "").localeCompare(String(b.status || "")) || String(a.common_name).localeCompare(String(b.common_name));
    return String(a.common_name).localeCompare(String(b.common_name));
  });

  state.filtered = birds;
  els.grid.innerHTML = "";

  birds.forEach(bird => {
    const node = els.template.content.cloneNode(true);
    node.querySelector(".image-block").innerHTML = renderImage(bird);
    node.querySelector(".common-name").textContent = bird.common_name || "Unnamed species";
    node.querySelector(".scientific-name").textContent = bird.scientific_name || "";
    node.querySelector(".irish-name").textContent = bird.irish_name || "";
    node.querySelector(".badges").innerHTML = renderBadges(bird);
    node.querySelector(".local-reason").innerHTML = renderLocalReason(bird);
    node.querySelector(".sound-block").innerHTML = renderSound(bird);
    node.querySelector(".group").textContent = bird.group || "Unspecified";
    node.querySelector(".status-text").textContent = statusText(bird.status_codes);
    els.grid.appendChild(node);
  });

  if (els.deckMode.value === "nearby") {
    const plausible = Number(state.plausibleCount || birds.length);
    const cap = deckLimit();
    const suffix = plausible > birds.length ? ` Showing top ${birds.length.toLocaleString()} of ${plausible.toLocaleString()}.` : "";
    els.notice.textContent = `${plausible.toLocaleString()} plausible species from ${state.birds.length.toLocaleString()} checklist species for this month/location/filter.${suffix}`;
  } else {
    els.notice.textContent = `${birds.length.toLocaleString()} of ${state.birds.length.toLocaleString()} species displayed in full catalogue mode.`;
  }
  updateNearbySummary();
}

function updateStats(payload) {
  const birds = payload.birds || [];
  const audioCount = birds.filter(hasAudio).length;
  const rareCount = birds.filter(b => (b.status_codes || []).includes("R")).length;

  els.total.textContent = birds.length.toLocaleString();
  els.audio.textContent = audioCount.toLocaleString();
  els.rare.textContent = rareCount.toLocaleString();

  const generated = payload.meta?.generated_at;
  els.generated.textContent = generated ? new Date(generated).toLocaleDateString("en-IE") : "seed";
}

function updateNearbySummary() {
  if (!els.nearbySummary) return;

  const month = MONTHS[selectedMonth()];
  const habitatText = [...activeHabitats()].filter(h => h !== "general").slice(0, 6).join(", ") || "general Ireland";
  const radius = els.radius?.value || "10";
  const limit = deckLimit();

  if (state.location) {
    const profile = locationProfile(state.location);
    const placeBits = [];
    if (profile.estuary) placeBits.push("estuary signal");
    else if (profile.coastal) placeBits.push("coastal signal");
    else if (profile.nearCoastal) placeBits.push("near-coastal signal");
    else placeBits.push("inland signal");
    if (profile.urban) placeBits.push("urban signal");

    els.nearbySummary.textContent =
      `${month}, approx. ${radius} km radius, ${placeBits.join(", ")}, max ${limit} cards, habitats: ${habitatText}. Coordinates are used only in this browser session.`;
  } else {
    els.nearbySummary.textContent =
      `${month}, no exact location selected. Showing top ${limit} Ireland-wide seasonal cards for selected habitats: ${habitatText}.`;
  }
}

async function init() {
  try {
    const response = await fetch("./data/birds.json?v=" + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.birds = Array.isArray(payload.birds) ? payload.birds : [];
    updateStats(payload);
    initialiseMonth();
    initialiseMap();
    initialiseHabitatButtons();
    render();
  } catch (error) {
    console.error(error);
    els.notice.textContent = "Could not load bird atlas data. Check data/birds.json.";
  }
}

function playRandomBird() {
  const playable = state.filtered.filter(hasAudio);
  if (!playable.length) {
    els.notice.textContent = "No playable sound in the current filter. Adjust the filters, Captain.";
    return;
  }

  const bird = playable[Math.floor(Math.random() * playable.length)];
  els.search.value = bird.common_name || "";
  els.status.value = "all";
  els.sound.value = "has";
  render();

  window.setTimeout(() => {
    const audio = document.querySelector("audio");
    if (audio) {
      audio.play().catch(() => {
        els.notice.textContent = `Selected ${bird.common_name}. Press play on the audio control to start it.`;
      });
      document.querySelector(".bird-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 80);
}

function initialiseMonth() {
  if (!els.month) return;
  els.month.value = String(monthFromNow());
}

function setLocation(lat, lng, source = "map") {
  state.location = { lat, lng, source };

  if (state.map && window.L) {
    if (!state.marker) {
      state.marker = L.marker([lat, lng]).addTo(state.map);
    } else {
      state.marker.setLatLng([lat, lng]);
    }
    state.map.setView([lat, lng], source === "browser" ? 11 : state.map.getZoom());
  }

  // Suggest coast/estuary if the broad coastal heuristic fires.
  if (roughCoastSignal(state.location) > 0) {
    state.habitats.add("coast");
    state.habitats.add("estuary");
    state.habitats.add("wetland");
    syncHabitatButtons();
  }

  render();
}

function initialiseMap() {
  if (!els.map || !window.L) {
    if (els.map) {
      els.map.innerHTML = "<div class='map-fallback'>Map library unavailable. Habitat and month filters still work.</div>";
    }
    return;
  }

  state.map = L.map(els.map, {
    scrollWheelZoom: false
  }).setView([IRELAND_CENTRE.lat, IRELAND_CENTRE.lng], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);

  state.map.on("click", event => {
    setLocation(event.latlng.lat, event.latlng.lng, "map");
  });
}

function initialiseHabitatButtons() {
  document.querySelectorAll("[data-habitat]").forEach(button => {
    button.addEventListener("click", () => {
      const habitat = button.dataset.habitat;
      if (state.habitats.has(habitat)) {
        state.habitats.delete(habitat);
      } else {
        state.habitats.add(habitat);
      }
      syncHabitatButtons();
      render();
    });
  });
  syncHabitatButtons();
}

function syncHabitatButtons() {
  document.querySelectorAll("[data-habitat]").forEach(button => {
    button.classList.toggle("active", state.habitats.has(button.dataset.habitat));
  });
}

function useBrowserLocation() {
  if (!navigator.geolocation) {
    els.nearbySummary.textContent = "Browser geolocation is not available. Click the map instead.";
    return;
  }

  els.nearbySummary.textContent = "Requesting approximate location…";

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      setLocation(latitude, longitude, "browser");
    },
    () => {
      els.nearbySummary.textContent = "Location permission was not granted. Click the map instead.";
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 1000 * 60 * 60
    }
  );
}

[els.search, els.status, els.sound, els.sort, els.month, els.radius, els.deckMode].forEach(el => {
  if (!el) return;
  el.addEventListener("input", render);
  el.addEventListener("change", render);
});

els.shuffle.addEventListener("click", playRandomBird);
els.useLocation?.addEventListener("click", useBrowserLocation);

init();

// BOIE mobile controls v1
(function () {
  function installMobileMapToggle() {
    const panel = document.querySelector(".nearby-panel");
    const grid = document.querySelector(".nearby-grid");

    if (!panel || !grid || panel.querySelector(".mobile-nearby-toggle")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-nearby-toggle";
    button.textContent = "Show / hide map and location controls";

    panel.insertBefore(button, grid);

    // On phones, start with the map visible once, but allow fast collapse.
    button.addEventListener("click", () => {
      document.body.classList.toggle("boie-mobile-map-collapsed");

      // Leaflet needs a resize nudge when the map returns.
      window.setTimeout(() => {
        if (window.L && state && state.map) {
          state.map.invalidateSize();
        }
      }, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installMobileMapToggle);
  } else {
    installMobileMapToggle();
  }
})();
