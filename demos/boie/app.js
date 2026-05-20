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

function seasonForMonth(month) {
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function textBag(bird) {
  return [
    bird.common_name,
    bird.scientific_name,
    bird.irish_name,
    bird.group,
    bird.status
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

function roughCoastSignal(location) {
  if (!location) return 0.5;

  // Approximation for V1: if user is near Irish bounding coast bands or known east-coast corridor,
  // treat coast habitat as plausible. This is deliberately broad, not a precise coastline model.
  const lat = location.lat;
  const lng = location.lng;
  const nearEast = lng > -6.45;
  const nearWest = lng < -9.0;
  const nearSouth = lat < 52.2;
  const nearNorth = lat > 54.8;
  const nearDublinCoast = distanceKm(location, DUBLIN_COAST) < 28;
  return (nearEast || nearWest || nearSouth || nearNorth || nearDublinCoast) ? 1 : 0;
}

function autoHabitatsFromLocation(location) {
  const habitats = new Set(["general"]);

  if (!location) return habitats;

  habitats.add("urban");
  habitats.add("garden");
  habitats.add("farmland");
  habitats.add("river");

  if (roughCoastSignal(location) > 0) {
    habitats.add("coast");
    habitats.add("estuary");
    habitats.add("wetland");
  }

  return habitats;
}

function activeHabitats() {
  if (state.habitats.size) return new Set(state.habitats);
  return autoHabitatsFromLocation(state.location);
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

  if (habitats.has("coast") || habitats.has("estuary")) {
    if (ecology.habitats.includes("coast") || ecology.habitats.includes("estuary")) score += 22;
  } else {
    if (ecology.habitats.includes("coast") || ecology.habitats.includes("estuary")) score -= 28;
  }

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
  if (els.deckMode.value === "all") {
    return birds.map(b => ({ ...b, local: null }));
  }

  const scored = birds.map(bird => {
    const local = scoreBirdForNearby(bird);
    return { ...bird, local };
  });

  return scored
    .filter(b => b.local.score >= 25)
    .sort((a, b) => b.local.score - a.local.score || String(a.common_name).localeCompare(String(b.common_name)))
    .slice(0, 140);
}

function render() {
  const q = els.search.value.trim().toLowerCase();
  const status = els.status.value;
  const sound = els.sound.value;
  const sort = els.sort.value;

  let birds = state.birds.filter(bird => {
    const haystack = [
      bird.common_name,
      bird.scientific_name,
      bird.irish_name,
      bird.group,
      bird.status,
      ...(bird.status_codes || [])
    ].join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
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

  const modeText = els.deckMode.value === "nearby" ? "local seasonal deck" : "full catalogue";
  els.notice.textContent = `${birds.length.toLocaleString()} of ${state.birds.length.toLocaleString()} species displayed in ${modeText}.`;
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

  if (state.location) {
    els.nearbySummary.textContent =
      `${month}, approx. ${radius} km radius, habitats: ${habitatText}. Coordinates are used only in this browser session.`;
  } else {
    els.nearbySummary.textContent =
      `${month}, no exact location selected. Using Ireland-wide seasonal plausibility and selected habitats: ${habitatText}.`;
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
