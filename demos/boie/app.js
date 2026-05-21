const state = {
  birds: [],
  filtered: [],
  plausibleCount: 0,
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
  group: document.getElementById("groupFilter"),
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
  preset: document.getElementById("presetFilter"),
  listenOnly: document.getElementById("listenOnly"),
  includeRare: document.getElementById("includeRare"),
  nearbySummary: document.getElementById("nearbySummary"),
  chorusList: document.getElementById("chorusList"),
  chorusContext: document.getElementById("chorusContext"),
  chorusMosaic: document.getElementById("chorusMosaic"),
  playChorus: document.getElementById("playChorusTogether"),
  stopChorus: document.getElementById("stopChorusTogether")
};

const MONTHS = {
  1: "January", 2: "February", 3: "March", 4: "April",
  5: "May", 6: "June", 7: "July", 8: "August",
  9: "September", 10: "October", 11: "November", 12: "December"
};

const HABITAT_PRESETS = {
  garden: ["garden", "urban", "woodland"],
  park: ["urban", "garden", "woodland", "river"],
  farmland: ["farmland", "garden", "river"],
  river: ["river", "wetland", "woodland", "farmland"],
  estuary: ["estuary", "wetland", "coast", "river"],
  coast: ["coast", "estuary", "wetland"],
  bog: ["bog", "farmland", "wide"]
};

const IRELAND_CENTRE = { lat: 53.35, lng: -7.7 };

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

function hasAudio(bird) {
  return Boolean(bird.audio && bird.audio.file);
}

function hasImage(bird) {
  return Boolean(bird.image && (bird.image.thumb || bird.image.original || bird.image.url));
}

function statusText(codes = []) {
  const labels = {
    A: "Recorded naturally since 1950",
    B: "Historical natural record before 1950 only",
    C: "Introduced / established feral",
    R: "Rarity requiring details"
  };
  return codes.map(code => labels[code] || code).join("; ") || "Unclassified";
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

function qualityRank(q) {
  return { A: 1, B: 2, C: 3, D: 4, E: 5 }[String(q || "").toUpperCase()] || 9;
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

function birdAliases(bird) {
  const common = String(bird.common_name || "").toLowerCase();
  const scientific = String(bird.scientific_name || "").toLowerCase();
  const aliases = [];

  if (common.includes("european robin") || scientific.includes("erithacus rubecula")) {
    aliases.push("robin", "garden robin", "irish robin");
  }

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
  addIf(/brent|godwit|redshank|curlew|dunlin|knot|bar-tailed|black-tailed|oystercatcher|shelduck|turnstone|sanderling|ringed plover|grey plover/.test(t), "estuary");
  addIf(/warbler|woodpecker|treecreeper|nuthatch|tit|chiffchaff|willow|blackcap|goldcrest|firecrest|jay|sparrowhawk|woodcock|owl|thrush|redstart|flycatcher|crossbill/.test(t), "woodland");
  addIf(/sparrow|starling|swift|swallow|martin|wagtail|pigeon|dove|rook|jackdaw|magpie|crow|robin|blackbird|dunnock|finch|greenfinch|goldfinch|chaffinch|collared dove/.test(t), "urban");
  addIf(/robin|blackbird|dunnock|wren|sparrow|tit|finch|starling|magpie|woodpigeon|collared dove|goldcrest/.test(t), "garden");
  addIf(/lapwing|skylark|yellowhammer|bunting|partridge|pheasant|corncrake|rook|crow|kestrel|buzzard|harrier|owl|swallow|martin|wheatear|stonechat|meadow pipit/.test(t), "farmland");
  addIf(/kingfisher|dipper|grey wagtail|sand martin|goosander|merganser|swan|duck|grebe|heron|moorhen|coot|wagtail/.test(t), "river");
  addIf(/curlew|golden plover|merlin|hen harrier|red grouse|ptarmigan|raven|wheatear|stonechat|meadow pipit|twite/.test(t), "bog");
  addIf(/eagle|falcon|harrier|buzzard|kestrel|kite|osprey|hawk|owl/.test(t), "wide");

  if (!habitats.size) habitats.add("general");

  return {
    habitats: [...habitats],
    migratory: {
      summer: /swallow|swift|martin|cuckoo|warbler|chiffchaff|willow|whitethroat|redstart|flycatcher|wheatear|tern|puffin|corncrake|nightjar|hobby|osprey/.test(t),
      winter: /brent|whooper|wigeon|teal|scaup|goldeneye|scoter|diver|godwit|dunlin|knot|sanderling|redwing|fieldfare|waxwing|snow bunting|jack snipe|purple sandpiper/.test(t)
    }
  };
}

function monthsForBird(bird) {
  const ecology = inferBirdEcology(bird);
  const t = textBag(bird);
  const codes = bird.status_codes || [];

  if (codes.includes("B")) return [];
  if (codes.includes("R")) return [1,2,3,4,5,6,7,8,9,10,11,12];
  if (ecology.migratory.summer && !ecology.migratory.winter) return [4,5,6,7,8,9];
  if (ecology.migratory.winter && !ecology.migratory.summer) return [10,11,12,1,2,3];
  if (/tern|skua|phalarope|whimbrel|curlew sandpiper|little stint/.test(t)) return [4,5,8,9,10];

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

  if (profile.urban) habitats.add("urban");
  else habitats.add("woodland");

  if (profile.coastal || profile.nearCoastal) habitats.add("coast");
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
  const habitats = inferBirdEcology(bird).habitats || [];

  if (habitats.includes("general")) return true;
  if (habitats.some(h => selected.has(h))) return true;
  if (habitats.includes("wide") && !selected.has("estuary")) return true;

  return false;
}

function scoreBirdForNearby(bird) {
  const month = selectedMonth();
  const birdMonths = monthsForBird(bird);
  const ecology = inferBirdEcology(bird);
  const habitats = activeHabitats();
  const codes = bird.status_codes || [];

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
  if (codes.includes("C")) score -= 6;

  if (hasAudio(bird)) score += 4;
  if (hasImage(bird)) score += 4;

  let confidence = "low";
  if (score >= 70) confidence = "high";
  else if (score >= 40) confidence = "medium";

  return { score, confidence, reasons: reasons.slice(0, 4), habitats: ecology.habitats, months: birdMonths };
}

function localMatchLabel(confidence) {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  if (confidence === "low") return "Low";
  return "Context only";
}

function recordingTypeLabel(typeValue) {
  const text = Array.isArray(typeValue)
    ? typeValue.join(", ").toLowerCase()
    : String(typeValue || "").toLowerCase();

  if (text.includes("song")) return "Song";
  if (text.includes("flight")) return "Flight call";
  if (text.includes("alarm")) return "Alarm call";
  if (text.includes("display")) return "Display call";
  if (text.includes("call")) return "Call";
  return "Recording";
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


function renderBadges(bird) {
  return "";
}

function renderLocalReason(bird) {
  if (!bird.local || els.deckMode?.value === "all") return "";
  const label = localMatchLabel(bird.local.confidence);
  const bits = bird.local.reasons?.length ? bird.local.reasons.join(" · ") : "seasonal plausibility";
  return `<p><strong>Local match: ${label}.</strong> Why shown: ${bits}.</p>`;
}

function renderSound(bird) {
  if (!hasAudio(bird)) {
    return `<p class="missing-note">No public xeno-canto recording was matched during the latest harvest.</p>`;
  }

  const audio = bird.audio;
  const rawType = Array.isArray(audio.type) ? audio.type.join(", ") : (audio.type || "recording");
  const source = audio.url ? `<a href="${audio.url}" target="_blank" rel="noopener">xeno-canto ${audio.id || ""}</a>` : "xeno-canto";
  const rec = audio.recordist ? `Recordist: ${audio.recordist}` : "Recordist unknown";
  const country = audio.country ? `Country: ${audio.country}` : "Country unknown";
  const licence = audio.license ? `Licence: ${audio.license}` : "Licence not parsed";

  return `
    <audio controls preload="none" src="${audio.file}"></audio>
    <p class="sound-meta">
      ${rawType}. ${rec}. ${country}. Quality ${audio.q || "?"}. ${licence}. Source: ${source}.
    </p>
  `;
}

function habitatGroupLabel(bird) {
  const habitats = inferBirdEcology(bird).habitats || [];
  if (habitats.includes("estuary")) return "Estuary and tidal wetland birds";
  if (habitats.includes("coast")) return "Coastal and seabirds";
  if (habitats.includes("wetland")) return "Wetland, ducks, waders, and marsh birds";
  if (habitats.includes("river")) return "Rivers, lakes, and freshwater birds";
  if (habitats.includes("bog")) return "Bog, upland, and open-country birds";
  if (habitats.includes("woodland")) return "Woodland and scrub birds";
  if (habitats.includes("farmland")) return "Farmland and hedgerow birds";
  if (habitats.includes("urban") || habitats.includes("garden")) return "Urban, garden, and parkland birds";
  if (habitats.includes("wide")) return "Wide-ranging raptors and large birds";
  return "Generalist and other birds";
}

function seasonGroupLabel(bird) {
  const months = monthsForBird(bird);
  const codes = bird.status_codes || [];

  if (codes.includes("B")) return "Historical records";
  if (codes.includes("R")) return "Rare or vagrant records";

  const hasWinter = [12, 1, 2].some(m => months.includes(m));
  const hasSpring = [3, 4, 5].some(m => months.includes(m));
  const hasSummer = [6, 7, 8].some(m => months.includes(m));
  const hasAutumn = [9, 10, 11].some(m => months.includes(m));

  if (months.length >= 11) return "Resident or broadly present year-round";
  if (hasSummer && hasSpring && !hasWinter) return "Summer visitors and breeding-season birds";
  if (hasWinter && !hasSummer) return "Winter visitors";
  if ((hasSpring || hasAutumn) && months.length <= 6) return "Passage migrants";
  return "Seasonally variable or irregular";
}

function localGroupLabel(bird) {
  const confidence = bird.local?.confidence || "unscored";
  if (confidence === "high") return "High local match";
  if (confidence === "medium") return "Medium local match";
  if (confidence === "low") return "Low local match";
  return "Unscored catalogue entries";
}

function groupLabelForBird(bird) {
  const mode = els.group?.value || "local";
  if (mode === "checklist") return bird.group || "Unspecified checklist group";
  if (mode === "habitat") return habitatGroupLabel(bird);
  if (mode === "season") return seasonGroupLabel(bird);
  return localGroupLabel(bird);
}

function groupRank(label) {
  const order = [
    "High local match",
    "Medium local match",
    "Low local match",
    "Unscored catalogue entries",
    "Estuary and tidal wetland birds",
    "Coastal and seabirds",
    "Wetland, ducks, waders, and marsh birds",
    "Rivers, lakes, and freshwater birds",
    "Bog, upland, and open-country birds",
    "Woodland and scrub birds",
    "Farmland and hedgerow birds",
    "Urban, garden, and parkland birds",
    "Wide-ranging raptors and large birds",
    "Generalist and other birds",
    "Resident or broadly present year-round",
    "Summer visitors and breeding-season birds",
    "Winter visitors",
    "Passage migrants",
    "Seasonally variable or irregular",
    "Rare or vagrant records",
    "Historical records"
  ];
  const idx = order.indexOf(label);
  return idx === -1 ? 999 : idx;
}

function groupDescription(label) {
  const descriptions = {
    "High local match": "Strong month, habitat, and location fit. These are the first birds to listen for.",
    "Medium local match": "Plausible in this setting, but less tightly tied to the chosen place or month.",
    "Low local match": "Weak local signal. Kept for context, search, or broader browsing.",
    "Estuary and tidal wetland birds": "Birds associated with mudflats, tidal channels, saltmarsh, estuarine edges, and sheltered coastal wetlands.",
    "Coastal and seabirds": "Birds of beaches, cliffs, harbours, nearshore waters, islands, and open sea influence.",
    "Wetland, ducks, waders, and marsh birds": "Birds linked to freshwater marsh, reedbed, wet grassland, lakes, ponds, and open water.",
    "Rivers, lakes, and freshwater birds": "Species often encountered along rivers, streams, reservoirs, lakes, canals, and riparian corridors.",
    "Bog, upland, and open-country birds": "Species associated with peatland, moorland, uplands, rough grassland, and exposed open landscapes.",
    "Woodland and scrub birds": "Birds of trees, woodland edge, scrub, hedgerow structure, and shaded nesting or feeding niches.",
    "Farmland and hedgerow birds": "Birds often linked to fields, farmyards, pasture, tillage, hedgerows, ditches, and rural edges.",
    "Urban, garden, and parkland birds": "Species commonly encountered around gardens, streets, parks, campuses, and built landscapes.",
    "Wide-ranging raptors and large birds": "Mobile species that may range across several habitats and large territories.",
    "Generalist and other birds": "Species not cleanly assigned to one simple habitat guild in the current model."
  };
  return descriptions[label] || "Checklist group from the Irish bird list.";
}

function renderBirdCard(bird) {
  const node = els.template.content.cloneNode(true);

  const imageBlock = node.querySelector(".image-block");
  if (imageBlock) imageBlock.innerHTML = renderImage(bird);

  node.querySelector(".common-name").textContent = bird.common_name || "Unnamed species";
  node.querySelector(".scientific-name").textContent = bird.scientific_name || "";
  node.querySelector(".irish-name").textContent = bird.irish_name || "";
  node.querySelector(".badges").innerHTML = renderBadges(bird);

  const reason = node.querySelector(".local-reason");
  if (reason) reason.innerHTML = renderLocalReason(bird);

  node.querySelector(".sound-block").innerHTML = renderSound(bird);
  node.querySelector(".group").textContent = bird.group || "Unspecified";
  node.querySelector(".status-text").textContent = statusText(bird.status_codes);

  return node;
}

function renderGroupedBirds(birds) {
  els.grid.innerHTML = "";

  const groups = new Map();

  birds.forEach(bird => {
    const label = groupLabelForBird(bird);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(bird);
  });

  [...groups.entries()]
    .sort((a, b) => groupRank(a[0]) - groupRank(b[0]) || a[0].localeCompare(b[0]))
    .forEach(([label, items]) => {
      const section = document.createElement("section");
      section.className = "bird-group-section";

      const header = document.createElement("header");
      header.className = "bird-group-header";
      header.innerHTML = `
        <div>
          <h2>${label}</h2>
          <p>${groupDescription(label)}</p>
        </div>
        <span>${items.length.toLocaleString()} species</span>
      `;

      const groupGrid = document.createElement("div");
      groupGrid.className = "bird-group-grid";

      items.forEach(bird => groupGrid.appendChild(renderBirdCard(bird)));
      section.append(header, groupGrid);
      els.grid.appendChild(section);
    });
}

function applyNearbyDeck(birds) {
  const query = els.search?.value.trim().toLowerCase() || "";

  if (els.deckMode?.value === "all") {
    state.plausibleCount = birds.length;
    return birds.map(b => ({ ...b, local: null }));
  }

  const scored = birds
    .map(bird => ({ ...bird, local: scoreBirdForNearby(bird) }))
    .sort((a, b) => b.local.score - a.local.score || String(a.common_name).localeCompare(String(b.common_name)));

  if (query) {
    state.plausibleCount = scored.length;
    return scored;
  }

  const radius = Number(els.radius?.value || 10);
  const threshold = radius <= 5 ? 52 : radius <= 10 ? 46 : radius <= 25 ? 38 : 32;

  const plausible = scored
    .filter(b => b.local.score >= threshold)
    .filter(passesHabitatGate)
    .filter(b => {
      if (els.includeRare?.checked) return true;
      const codes = b.status_codes || [];
      return !codes.includes("R") && !codes.includes("B");
    });

  state.plausibleCount = plausible.length;
  return plausible.slice(0, deckLimit());
}


let activeChorusPlayers = [];

function chorusCandidates() {
  return state.filtered
    .filter(hasAudio)
    .filter(b => !(b.status_codes || []).includes("B"))
    .slice(0, 8);
}

function stopChorusTogether() {
  activeChorusPlayers.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    } catch (error) {
      console.warn("Could not stop chorus audio", error);
    }
  });

  activeChorusPlayers = [];

  if (els.playChorus) {
    els.playChorus.textContent = "Play chorus together";
  }
}

function playChorusTogether() {
  const birds = chorusCandidates();

  if (!birds.length) {
    if (els.notice) {
      els.notice.textContent = "No playable birds in the current chorus. Switch off filters or change location/month.";
    }
    return;
  }

  stopChorusTogether();

  if (els.playChorus) {
    els.playChorus.textContent = "Playing chorus…";
  }

  birds.forEach((bird, index) => {
    const audio = new Audio(bird.audio.file);
    audio.preload = "auto";
    audio.volume = Math.max(0.10, 0.22 - (birds.length * 0.012));
    activeChorusPlayers.push(audio);

    // A tiny stagger makes the result feel like a natural chorus and avoids
    // hammering the browser with eight simultaneous remote loads.
    window.setTimeout(() => {
      audio.play().catch(error => {
        console.warn("Could not play chorus bird", bird.common_name, error);
        if (els.notice) {
          els.notice.textContent = "Some chorus audio could not start. Press Play again or use individual bird controls.";
        }
      });
    }, index * 220);
  });

  if (els.notice) {
    els.notice.textContent = `Playing ${birds.length} birds together from Today’s likely chorus. Use Stop chorus to end playback.`;
  }
}

function renderChorusMosaic(birds) {
  if (!els.chorusMosaic) return;

  if (!birds.length) {
    els.chorusMosaic.innerHTML = "";
    return;
  }

  els.chorusMosaic.innerHTML = birds.map(bird => {
    const image = bird.image || {};
    const src = image.thumb || image.original || image.url || "";
    const name = bird.common_name || "Bird";

    if (!src) {
      return `
        <div class="chorus-photo is-empty" title="${name}">
          <span>${name.slice(0, 2)}</span>
        </div>
      `;
    }

    return `
      <button type="button" class="chorus-photo" data-bird="${name}" title="${name}">
        <img src="${src}" alt="${name}" loading="lazy" />
        <span>${name}</span>
      </button>
    `;
  }).join("");
}


function renderChorus() {
  if (!els.chorusList) return;

  const playable = chorusCandidates();

  if (els.chorusContext) {
    els.chorusContext.textContent = `${MONTHS[selectedMonth()]} · ${playable.length} quick-listen species`;
  }

  renderChorusMosaic(playable);

  if (!playable.length) {
    els.chorusList.innerHTML = `<p class="chorus-empty">No playable sounds in the current deck.</p>`;
    if (els.playChorus) els.playChorus.disabled = true;
    if (els.stopChorus) els.stopChorus.disabled = true;
    return;
  }

  if (els.playChorus) els.playChorus.disabled = false;
  if (els.stopChorus) els.stopChorus.disabled = false;

  els.chorusList.innerHTML = playable.map(bird => {
    const match = bird.local ? localMatchLabel(bird.local.confidence) : "Catalogue";
    return `
      <button type="button" class="chorus-chip" data-bird="${bird.common_name}">
        <span>${bird.common_name}</span>
        <small>${match}</small>
      </button>
    `;
  }).join("");
}

function render() {
  try {
    const q = els.search?.value.trim().toLowerCase() || "";
    const status = els.status?.value || "all";
    const sound = els.sound?.value || "all";
    const sort = els.sort?.value || "common";

    let birds = state.birds.filter(bird => {
      const haystack = [textBag(bird), ...(bird.status_codes || [])].join(" ").toLowerCase();

      if (q) return haystack.includes(q);
      if (!matchesStatus(bird, status)) return false;
      if (sound === "has" && !hasAudio(bird)) return false;
      if (sound === "missing" && hasAudio(bird)) return false;
      if (els.listenOnly?.checked && !hasAudio(bird)) return false;

      return true;
    });

    birds = applyNearbyDeck(birds);

    birds.sort((a, b) => {
      if ((els.deckMode?.value || "nearby") === "nearby" && sort === "common") {
        return (b.local?.score || 0) - (a.local?.score || 0) || String(a.common_name).localeCompare(String(b.common_name));
      }
      if (sort === "scientific") return String(a.scientific_name).localeCompare(String(b.scientific_name));
      if (sort === "quality") return qualityRank(a.audio?.q) - qualityRank(b.audio?.q) || String(a.common_name).localeCompare(String(b.common_name));
      if (sort === "status") return String(a.status || "").localeCompare(String(b.status || "")) || String(a.common_name).localeCompare(String(b.common_name));
      return String(a.common_name).localeCompare(String(b.common_name));
    });

    state.filtered = birds;
    renderGroupedBirds(birds);
    renderChorus();

    if ((els.deckMode?.value || "nearby") === "nearby") {
      const query = els.search?.value.trim() || "";
      const plausible = Number(state.plausibleCount || birds.length);
      const suffix = plausible > birds.length ? ` Showing top ${birds.length.toLocaleString()} of ${plausible.toLocaleString()}.` : "";

      if (query) {
        els.notice.textContent = `${birds.length.toLocaleString()} checklist match(es) for “${query}”.`;
      } else {
        const rareText = els.includeRare?.checked ? " Rare/vagrant records included." : " Rare/vagrant records hidden by default.";
        const listenText = els.listenOnly?.checked ? " Listening walk mode: only birds with playable sound." : "";
        els.notice.textContent = `${plausible.toLocaleString()} plausible species from ${state.birds.length.toLocaleString()} checklist species.${suffix}${rareText}${listenText}`;
      }
    } else {
      els.notice.textContent = `${birds.length.toLocaleString()} of ${state.birds.length.toLocaleString()} species displayed in full catalogue mode.`;
    }

    updateNearbySummary();
  } catch (error) {
    console.error(error);
    if (els.notice) els.notice.textContent = `Render error: ${error.message}`;
  }
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
      `${month}, approx. ${radius} km radius, ${placeBits.join(", ")}, max ${limit} cards, habitats: ${habitatText}.`;
  } else {
    els.nearbySummary.textContent =
      `${month}, no exact location selected. Showing a seasonal Ireland-wide deck for selected habitats: ${habitatText}.`;
  }
}

function updateStats(payload) {
  const birds = payload.birds || [];
  const audioCount = birds.filter(hasAudio).length;
  const rareCount = birds.filter(b => (b.status_codes || []).includes("R")).length;

  if (els.total) els.total.textContent = birds.length.toLocaleString();
  if (els.audio) els.audio.textContent = audioCount.toLocaleString();
  if (els.rare) els.rare.textContent = rareCount.toLocaleString();

  const generated = payload.meta?.generated_at;
  if (els.generated) els.generated.textContent = generated ? new Date(generated).toLocaleDateString("en-IE") : "seed";
}

function initialiseMonth() {
  if (els.month) els.month.value = String(monthFromNow());
}

function initialiseMap() {
  if (!els.map || !window.L) return;

  state.map = L.map(els.map, { scrollWheelZoom: false }).setView([IRELAND_CENTRE.lat, IRELAND_CENTRE.lng], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);

  state.map.on("click", event => {
    setLocation(event.latlng.lat, event.latlng.lng, "map");
  });
}

function setLocation(lat, lng, source = "map") {
  state.location = { lat, lng, source };

  if (state.map && window.L) {
    if (!state.marker) state.marker = L.marker([lat, lng]).addTo(state.map);
    else state.marker.setLatLng([lat, lng]);
    state.map.setView([lat, lng], source === "browser" ? 11 : state.map.getZoom());
  }

  const profile = locationProfile(state.location);
  if (profile.coastal || profile.estuary) {
    state.habitats.add("coast");
    state.habitats.add("wetland");
    if (profile.estuary) state.habitats.add("estuary");
    syncHabitatButtons();
  }

  render();
}

function useBrowserLocation() {
  if (!navigator.geolocation) {
    els.nearbySummary.textContent = "Browser geolocation is not available. Click the map instead.";
    return;
  }

  els.nearbySummary.textContent = "Requesting approximate location…";

  navigator.geolocation.getCurrentPosition(
    position => {
      setLocation(position.coords.latitude, position.coords.longitude, "browser");
    },
    () => {
      els.nearbySummary.textContent = "Location permission was not granted. Click the map instead.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 1000 * 60 * 60 }
  );
}

function initialiseHabitatButtons() {
  document.querySelectorAll("[data-habitat]").forEach(button => {
    button.addEventListener("click", () => {
      const habitat = button.dataset.habitat;
      if (state.habitats.has(habitat)) state.habitats.delete(habitat);
      else state.habitats.add(habitat);

      if (els.preset) els.preset.value = "";
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

function applyPreset() {
  const preset = els.preset?.value || "";
  if (!preset || !HABITAT_PRESETS[preset]) return;

  state.habitats.clear();
  HABITAT_PRESETS[preset].forEach(h => state.habitats.add(h));
  syncHabitatButtons();
  render();
}

function playRandomBird() {
  const playable = state.filtered.filter(hasAudio);
  if (!playable.length) {
    els.notice.textContent = "No playable sound in the current filter.";
    return;
  }

  const bird = playable[Math.floor(Math.random() * playable.length)];
  els.search.value = bird.common_name || "";
  if (els.status) els.status.value = "all";
  if (els.sound) els.sound.value = "has";
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

function installMobileMapToggle() {
  const panel = document.querySelector(".nearby-panel");
  const grid = document.querySelector(".nearby-grid");
  if (!panel || !grid || panel.querySelector(".mobile-nearby-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-nearby-toggle";
  button.textContent = "Show / hide map and location controls";
  panel.insertBefore(button, grid);

  button.addEventListener("click", () => {
    document.body.classList.toggle("boie-mobile-map-collapsed");
    window.setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 120);
  });
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
    installMobileMapToggle();
    render();
  } catch (error) {
    console.error(error);
    if (els.notice) els.notice.textContent = `Could not load BOIE: ${error.message}`;
  }
}

[els.search, els.status, els.sound, els.sort, els.group, els.month, els.radius, els.deckMode, els.listenOnly, els.includeRare].forEach(el => {
  if (!el) return;
  el.addEventListener("input", render);
  el.addEventListener("change", render);
});

els.preset?.addEventListener("change", applyPreset);
els.shuffle?.addEventListener("click", playRandomBird);
els.useLocation?.addEventListener("click", useBrowserLocation);
els.playChorus?.addEventListener("click", playChorusTogether);
els.stopChorus?.addEventListener("click", stopChorusTogether);

function jumpToBirdFromButton(button) {
  if (!button) return;
  if (els.search) els.search.value = button.dataset.bird || "";
  render();
  document.querySelector(".bird-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

els.chorusList?.addEventListener("click", event => {
  jumpToBirdFromButton(event.target.closest("[data-bird]"));
});

els.chorusMosaic?.addEventListener("click", event => {
  jumpToBirdFromButton(event.target.closest("[data-bird]"));
});

init();

/* BOIE hard DOM badge remover FINAL */
(function () {
  function removeBoieBadgeClutter() {
    document
      .querySelectorAll("#birdGrid .badges, #birdGrid .badge, #birdGrid .recording-type")
      .forEach(node => node.remove());
  }

  removeBoieBadgeClutter();

  const target = document.getElementById("birdGrid");
  if (target) {
    const observer = new MutationObserver(removeBoieBadgeClutter);
    observer.observe(target, { childList: true, subtree: true });
  }

  window.addEventListener("load", removeBoieBadgeClutter);
})();


/* BOIE streamlined cockpit v1 */
(function () {
  function toggleClass(name) {
    document.body.classList.toggle(name);

    window.setTimeout(() => {
      if (typeof state !== "undefined" && state.map) {
        state.map.invalidateSize();
      }
    }, 160);
  }

  function installStreamlinedCockpit() {
    const mapButton = document.getElementById("toggleMapPanel");
    const advancedButton = document.getElementById("toggleAdvancedPanel");

    if (mapButton && !mapButton.dataset.bound) {
      mapButton.dataset.bound = "true";
      mapButton.addEventListener("click", () => {
        toggleClass("boie-map-open");
        mapButton.textContent = document.body.classList.contains("boie-map-open")
          ? "Hide map"
          : "Map / pin";
      });
    }

    if (advancedButton && !advancedButton.dataset.bound) {
      advancedButton.dataset.bound = "true";
      advancedButton.addEventListener("click", () => {
        toggleClass("boie-advanced-open");
        advancedButton.textContent = document.body.classList.contains("boie-advanced-open")
          ? "Hide extras"
          : "More filters";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installStreamlinedCockpit);
  } else {
    installStreamlinedCockpit();
  }
})();
