const state = {
  birds: [],
  filtered: [],
  plausibleCount: 0,
  map: null,
  marker: null,
  location: null,
  habitats: new Set(),
  habitatZones: [],
  osmHabitatContext: null,
  habitatMode: "auto",
  locationContextToken: 0,
  chorusIsPlaying: false
};

const els = {
  grid: document.getElementById("birdGrid"),
  template: document.getElementById("birdCardTemplate"),
  search: document.getElementById("search"),
  searchSelected: document.getElementById("searchSelected"),
  searchCatalogue: document.getElementById("searchCatalogue"),
  searchUnified: document.getElementById("searchUnified"),
  searchScopeSelected: document.getElementById("searchScopeSelected"),
  searchScopeCatalogue: document.getElementById("searchScopeCatalogue"),
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

const EUROPE_PILOT_CENTRE = { lat: 50.8, lng: 7.2 };

const COAST_POINTS = [
  // Ireland
  { name: "Donegal", country: "IE", lat: 55.15, lng: -8.13 },
  { name: "Sligo", country: "IE", lat: 54.27, lng: -8.48 },
  { name: "Galway Bay", country: "IE", lat: 53.25, lng: -9.10 },
  { name: "Shannon Estuary", country: "IE", lat: 52.62, lng: -9.23 },
  { name: "Cork Harbour", country: "IE", lat: 51.85, lng: -8.30 },
  { name: "Dublin Bay", country: "IE", lat: 53.33, lng: -6.10 },

  // United Kingdom
  { name: "Cornwall", country: "GB", lat: 50.26, lng: -5.05 },
  { name: "Dorset Coast", country: "GB", lat: 50.63, lng: -2.45 },
  { name: "Norfolk Coast", country: "GB", lat: 52.94, lng: 0.85 },
  { name: "Humber", country: "GB", lat: 53.70, lng: -0.20 },
  { name: "Northumberland", country: "GB", lat: 55.45, lng: -1.60 },
  { name: "Firth of Forth", country: "GB", lat: 56.02, lng: -3.20 },

  // France
  { name: "Brittany", country: "FR", lat: 48.39, lng: -4.49 },
  { name: "Normandy", country: "FR", lat: 49.36, lng: -0.86 },
  { name: "Bay of Biscay", country: "FR", lat: 46.16, lng: -1.20 },
  { name: "Camargue", country: "FR", lat: 43.50, lng: 4.50 },
  { name: "Côte d'Azur", country: "FR", lat: 43.55, lng: 7.02 },

  // Germany
  { name: "North Sea Coast", country: "DE", lat: 53.70, lng: 7.75 },
  { name: "Wadden Sea", country: "DE", lat: 54.40, lng: 8.65 },
  { name: "Hamburg / Elbe", country: "DE", lat: 53.55, lng: 9.99 },
  { name: "Baltic Coast", country: "DE", lat: 54.32, lng: 10.14 },
  { name: "Rügen", country: "DE", lat: 54.45, lng: 13.40 },

  // Italy
  { name: "Venetian Lagoon", country: "IT", lat: 45.44, lng: 12.33 },
  { name: "Po Delta", country: "IT", lat: 44.87, lng: 12.25 },
  { name: "Liguria", country: "IT", lat: 44.30, lng: 8.48 },
  { name: "Tyrrhenian Coast", country: "IT", lat: 41.90, lng: 12.45 },
  { name: "Adriatic Coast", country: "IT", lat: 43.62, lng: 13.51 },
  { name: "Sicily", country: "IT", lat: 37.50, lng: 15.09 },
  { name: "Vorpommersche Boddenlandschaft", country: "DE", lat: 54.43, lng: 12.86 },
  { name: "Darß-Zingst", country: "DE", lat: 54.43, lng: 12.65 },
  { name: "Greifswald Lagoon", country: "DE", lat: 54.15, lng: 13.45 },
  { name: "Usedom", country: "DE", lat: 53.95, lng: 14.1 },
  { name: "Schleswig-Holstein Wadden Sea", country: "DE", lat: 54.55, lng: 8.65 },
  { name: "Lower Saxony Wadden Sea", country: "DE", lat: 53.72, lng: 7.65 },
];

const ESTUARY_POINTS = [
  // Ireland
  { name: "Baldoyle/Malahide", country: "IE", lat: 53.45, lng: -6.15 },
  { name: "Dublin Bay", country: "IE", lat: 53.32, lng: -6.13 },
  { name: "Rogerstown", country: "IE", lat: 53.52, lng: -6.12 },
  { name: "Boyne", country: "IE", lat: 53.72, lng: -6.25 },
  { name: "Shannon Estuary", country: "IE", lat: 52.62, lng: -9.23 },

  // United Kingdom
  { name: "Thames Estuary", country: "GB", lat: 51.50, lng: 0.60 },
  { name: "Humber Estuary", country: "GB", lat: 53.70, lng: -0.20 },
  { name: "Severn Estuary", country: "GB", lat: 51.55, lng: -2.85 },
  { name: "Mersey Estuary", country: "GB", lat: 53.35, lng: -2.95 },
  { name: "Wash", country: "GB", lat: 52.90, lng: 0.25 },

  // France
  { name: "Seine Estuary", country: "FR", lat: 49.45, lng: 0.15 },
  { name: "Loire Estuary", country: "FR", lat: 47.28, lng: -2.18 },
  { name: "Gironde Estuary", country: "FR", lat: 45.50, lng: -0.75 },
  { name: "Somme Bay", country: "FR", lat: 50.22, lng: 1.60 },
  { name: "Camargue / Rhône Delta", country: "FR", lat: 43.52, lng: 4.57 },

  // Germany
  { name: "Elbe Estuary", country: "DE", lat: 53.90, lng: 8.90 },
  { name: "Weser Estuary", country: "DE", lat: 53.55, lng: 8.55 },
  { name: "Ems Estuary", country: "DE", lat: 53.35, lng: 7.20 },
  { name: "Wadden Sea", country: "DE", lat: 54.20, lng: 8.80 },
  { name: "Oder Lagoon", country: "DE", lat: 53.85, lng: 14.15 },

  // Italy
  { name: "Venetian Lagoon", country: "IT", lat: 45.44, lng: 12.33 },
  { name: "Po Delta", country: "IT", lat: 44.87, lng: 12.25 },
  { name: "Comacchio Lagoons", country: "IT", lat: 44.65, lng: 12.18 },
  { name: "Orbetello Lagoon", country: "IT", lat: 42.44, lng: 11.23 }
];

const WETLAND_POINTS = [
  { name: "Vorpommersche Boddenlandschaft", country: "DE", lat: 54.43, lng: 12.86 },
  { name: "Darß-Zingst Lagoon", country: "DE", lat: 54.42, lng: 12.72 },
  { name: "Greifswald Lagoon", country: "DE", lat: 54.15, lng: 13.45 },
  { name: "Oder Lagoon", country: "DE", lat: 53.85, lng: 14.15 },
  { name: "Schleswig-Holstein Wadden Sea", country: "DE", lat: 54.55, lng: 8.65 },
  { name: "Lower Saxony Wadden Sea", country: "DE", lat: 53.72, lng: 7.65 },
  { name: "Camargue", country: "FR", lat: 43.52, lng: 4.57 },
  { name: "Somme Bay", country: "FR", lat: 50.22, lng: 1.60 },
  { name: "Loire Estuary Wetlands", country: "FR", lat: 47.28, lng: -2.18 },
  { name: "Venetian Lagoon", country: "IT", lat: 45.44, lng: 12.33 },
  { name: "Po Delta", country: "IT", lat: 44.87, lng: 12.25 },
  { name: "Comacchio Lagoons", country: "IT", lat: 44.65, lng: 12.18 },
  { name: "Dublin Bay", country: "IE", lat: 53.32, lng: -6.13 },
  { name: "Shannon Estuary", country: "IE", lat: 52.62, lng: -9.23 },
  { name: "The Wash", country: "GB", lat: 52.90, lng: 0.25 },
  { name: "Thames Estuary", country: "GB", lat: 51.50, lng: 0.60 }
];

const CITY_POINTS = [
  // Ireland
  { name: "Dublin", country: "IE", lat: 53.35, lng: -6.26 },
  { name: "Cork", country: "IE", lat: 51.90, lng: -8.47 },
  { name: "Galway", country: "IE", lat: 53.27, lng: -9.06 },
  { name: "Limerick", country: "IE", lat: 52.66, lng: -8.63 },
  { name: "Sligo", country: "IE", lat: 54.27, lng: -8.47 },

  // United Kingdom
  { name: "London", country: "GB", lat: 51.51, lng: -0.13 },
  { name: "Birmingham", country: "GB", lat: 52.49, lng: -1.89 },
  { name: "Manchester", country: "GB", lat: 53.48, lng: -2.24 },
  { name: "Edinburgh", country: "GB", lat: 55.95, lng: -3.19 },
  { name: "Cardiff", country: "GB", lat: 51.48, lng: -3.18 },

  // France
  { name: "Paris", country: "FR", lat: 48.86, lng: 2.35 },
  { name: "Lyon", country: "FR", lat: 45.76, lng: 4.84 },
  { name: "Marseille", country: "FR", lat: 43.30, lng: 5.37 },
  { name: "Nantes", country: "FR", lat: 47.22, lng: -1.55 },
  { name: "Bordeaux", country: "FR", lat: 44.84, lng: -0.58 },

  // Germany
  { name: "Berlin", country: "DE", lat: 52.52, lng: 13.40 },
  { name: "Hamburg", country: "DE", lat: 53.55, lng: 9.99 },
  { name: "Munich", country: "DE", lat: 48.14, lng: 11.58 },
  { name: "Cologne", country: "DE", lat: 50.94, lng: 6.96 },
  { name: "Frankfurt", country: "DE", lat: 50.11, lng: 8.68 },
  { name: "Leipzig", country: "DE", lat: 51.34, lng: 12.37 },

  // Italy
  { name: "Rome", country: "IT", lat: 41.90, lng: 12.50 },
  { name: "Milan", country: "IT", lat: 45.46, lng: 9.19 },
  { name: "Venice", country: "IT", lat: 45.44, lng: 12.33 },
  { name: "Turin", country: "IT", lat: 45.07, lng: 7.69 },
  { name: "Naples", country: "IT", lat: 40.85, lng: 14.27 },
  { name: "Trieste", country: "IT", lat: 45.65, lng: 13.77 }
];

const EUROPE_URBAN_POINTS = [
  // Germany: broader city coverage for inland urban clicks
  { name: "Berlin", country: "DE", lat: 52.52, lng: 13.40 },
  { name: "Hamburg", country: "DE", lat: 53.55, lng: 9.99 },
  { name: "Munich", country: "DE", lat: 48.14, lng: 11.58 },
  { name: "Cologne", country: "DE", lat: 50.94, lng: 6.96 },
  { name: "Frankfurt", country: "DE", lat: 50.11, lng: 8.68 },
  { name: "Stuttgart", country: "DE", lat: 48.78, lng: 9.18 },
  { name: "Düsseldorf", country: "DE", lat: 51.23, lng: 6.77 },
  { name: "Dortmund", country: "DE", lat: 51.51, lng: 7.47 },
  { name: "Essen", country: "DE", lat: 51.46, lng: 7.01 },
  { name: "Leipzig", country: "DE", lat: 51.34, lng: 12.37 },
  { name: "Bremen", country: "DE", lat: 53.08, lng: 8.80 },
  { name: "Dresden", country: "DE", lat: 51.05, lng: 13.74 },
  { name: "Hanover", country: "DE", lat: 52.37, lng: 9.73 },
  { name: "Nuremberg", country: "DE", lat: 49.45, lng: 11.08 },
  { name: "Duisburg", country: "DE", lat: 51.43, lng: 6.76 },
  { name: "Bochum", country: "DE", lat: 51.48, lng: 7.22 },
  { name: "Wuppertal", country: "DE", lat: 51.26, lng: 7.15 },
  { name: "Bielefeld", country: "DE", lat: 52.03, lng: 8.53 },
  { name: "Bonn", country: "DE", lat: 50.74, lng: 7.10 },
  { name: "Münster", country: "DE", lat: 51.96, lng: 7.63 },
  { name: "Karlsruhe", country: "DE", lat: 49.01, lng: 8.40 },
  { name: "Mannheim", country: "DE", lat: 49.49, lng: 8.47 },
  { name: "Augsburg", country: "DE", lat: 48.37, lng: 10.90 },
  { name: "Wiesbaden", country: "DE", lat: 50.08, lng: 8.24 },
  { name: "Gelsenkirchen", country: "DE", lat: 51.52, lng: 7.09 },
  { name: "Mönchengladbach", country: "DE", lat: 51.18, lng: 6.44 },
  { name: "Braunschweig", country: "DE", lat: 52.27, lng: 10.52 },
  { name: "Chemnitz", country: "DE", lat: 50.83, lng: 12.92 },
  { name: "Kiel", country: "DE", lat: 54.32, lng: 10.14 },
  { name: "Aachen", country: "DE", lat: 50.78, lng: 6.08 },
  { name: "Halle", country: "DE", lat: 51.48, lng: 11.97 },
  { name: "Magdeburg", country: "DE", lat: 52.12, lng: 11.63 },
  { name: "Freiburg", country: "DE", lat: 47.99, lng: 7.85 },
  { name: "Krefeld", country: "DE", lat: 51.34, lng: 6.57 },
  { name: "Lübeck", country: "DE", lat: 53.87, lng: 10.69 },
  { name: "Oberhausen", country: "DE", lat: 51.50, lng: 6.85 },
  { name: "Erfurt", country: "DE", lat: 50.98, lng: 11.03 },
  { name: "Mainz", country: "DE", lat: 50.00, lng: 8.27 },
  { name: "Rostock", country: "DE", lat: 54.09, lng: 12.10 },
  { name: "Kassel", country: "DE", lat: 51.31, lng: 9.49 },
  { name: "Potsdam", country: "DE", lat: 52.39, lng: 13.06 },
  { name: "Saarbrücken", country: "DE", lat: 49.24, lng: 6.99 },
  { name: "Oldenburg", country: "DE", lat: 53.14, lng: 8.21 },
  { name: "Osnabrück", country: "DE", lat: 52.28, lng: 8.05 },
  { name: "Heidelberg", country: "DE", lat: 49.40, lng: 8.67 },
  { name: "Darmstadt", country: "DE", lat: 49.87, lng: 8.65 },
  { name: "Regensburg", country: "DE", lat: 49.01, lng: 12.10 },
  { name: "Ingolstadt", country: "DE", lat: 48.77, lng: 11.43 },
  { name: "Würzburg", country: "DE", lat: 49.79, lng: 9.95 },
  { name: "Ulm", country: "DE", lat: 48.40, lng: 9.99 },
  { name: "Göttingen", country: "DE", lat: 51.54, lng: 9.93 },
  { name: "Trier", country: "DE", lat: 49.75, lng: 6.64 },
  { name: "Jena", country: "DE", lat: 50.93, lng: 11.59 },
  { name: "Erlangen", country: "DE", lat: 49.59, lng: 11.00 },

  // Existing pilot countries: useful urban anchors
  { name: "London", country: "GB", lat: 51.51, lng: -0.13 },
  { name: "Birmingham", country: "GB", lat: 52.49, lng: -1.89 },
  { name: "Manchester", country: "GB", lat: 53.48, lng: -2.24 },
  { name: "Edinburgh", country: "GB", lat: 55.95, lng: -3.19 },
  { name: "Paris", country: "FR", lat: 48.86, lng: 2.35 },
  { name: "Lyon", country: "FR", lat: 45.76, lng: 4.84 },
  { name: "Marseille", country: "FR", lat: 43.30, lng: 5.37 },
  { name: "Nantes", country: "FR", lat: 47.22, lng: -1.55 },
  { name: "Bordeaux", country: "FR", lat: 44.84, lng: -0.58 },
  { name: "Rome", country: "IT", lat: 41.90, lng: 12.50 },
  { name: "Milan", country: "IT", lat: 45.46, lng: 9.19 },
  { name: "Venice", country: "IT", lat: 45.44, lng: 12.33 },
  { name: "Turin", country: "IT", lat: 45.07, lng: 7.69 },
  { name: "Naples", country: "IT", lat: 40.85, lng: 14.27 },
  { name: "Trieste", country: "IT", lat: 45.65, lng: 13.77 },
  { name: "Dublin", country: "IE", lat: 53.35, lng: -6.26 },
  { name: "Cork", country: "IE", lat: 51.90, lng: -8.47 },
  { name: "Galway", country: "IE", lat: 53.27, lng: -9.06 }
];

const RIVER_POINTS = [
  // Germany
  { name: "Danube at Ulm", country: "DE", lat: 48.40, lng: 9.99 },
  { name: "Danube at Regensburg", country: "DE", lat: 49.01, lng: 12.10 },
  { name: "Isar at Munich", country: "DE", lat: 48.14, lng: 11.58 },
  { name: "Rhine at Cologne", country: "DE", lat: 50.94, lng: 6.96 },
  { name: "Rhine at Düsseldorf", country: "DE", lat: 51.23, lng: 6.77 },
  { name: "Rhine at Mainz", country: "DE", lat: 50.00, lng: 8.27 },
  { name: "Rhine at Mannheim", country: "DE", lat: 49.49, lng: 8.47 },
  { name: "Main at Frankfurt", country: "DE", lat: 50.11, lng: 8.68 },
  { name: "Main at Würzburg", country: "DE", lat: 49.79, lng: 9.95 },
  { name: "Elbe at Dresden", country: "DE", lat: 51.05, lng: 13.74 },
  { name: "Elbe at Hamburg", country: "DE", lat: 53.55, lng: 9.99 },
  { name: "Spree at Berlin", country: "DE", lat: 52.52, lng: 13.40 },
  { name: "Neckar at Stuttgart", country: "DE", lat: 48.78, lng: 9.18 },
  { name: "Leine at Hanover", country: "DE", lat: 52.37, lng: 9.73 },
  { name: "Weser at Bremen", country: "DE", lat: 53.08, lng: 8.80 },

  // Other pilot anchors
  { name: "Thames at London", country: "GB", lat: 51.51, lng: -0.13 },
  { name: "Seine at Paris", country: "FR", lat: 48.86, lng: 2.35 },
  { name: "Rhône at Lyon", country: "FR", lat: 45.76, lng: 4.84 },
  { name: "Tiber at Rome", country: "IT", lat: 41.90, lng: 12.50 },
  { name: "Po at Turin", country: "IT", lat: 45.07, lng: 7.69 },
  { name: "Liffey at Dublin", country: "IE", lat: 53.35, lng: -6.26 }
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

function pointInHabitatRing(location, ring) {
  const x = location.lng;
  const y = location.lat;
  let inside = false;
  let j = ring.length - 1;

  for (let i = 0; i < ring.length; i += 1) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);

    if (intersects) inside = !inside;
    j = i;
  }

  return inside;
}

function pointInHabitatFeature(location, feature) {
  const geometry = feature?.geometry || {};
  const coordinates = geometry.coordinates || [];

  if (geometry.type === "Polygon") {
    return coordinates.some(ring => pointInHabitatRing(location, ring));
  }

  if (geometry.type === "MultiPolygon") {
    return coordinates.some(polygon =>
      polygon.some(ring => pointInHabitatRing(location, ring))
    );
  }

  return false;
}

function habitatZonesForLocation(location) {
  if (!location || !Array.isArray(state.habitatZones)) return [];

  return state.habitatZones
    .filter(feature => pointInHabitatFeature(location, feature))
    .sort((a, b) => Number(b.properties?.priority || 0) - Number(a.properties?.priority || 0));
}

function habitatZoneSetForLocation(location) {
  const habitats = new Set();

  habitatZonesForLocation(location).forEach(feature => {
    (feature.properties?.habitats || []).forEach(habitat => habitats.add(habitat));
  });

  return habitats;
}

function habitatZoneLabelForLocation(location) {
  const zones = habitatZonesForLocation(location);
  return zones[0]?.properties?.label || "";
}

async function loadHabitatZones() {
  try {
    const response = await fetch("./data/habitat-zones.geojson", { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.habitatZones = Array.isArray(payload.features) ? payload.features : [];
  } catch (error) {
    console.warn("Could not load habitat zones; falling back to distance heuristics", error);
    state.habitatZones = [];
  }
}


function osmHabitatCacheKey(location) {
  const lat = Math.round(Number(location.lat) * 100) / 100;
  const lng = Math.round(Number(location.lng) * 100) / 100;
  return `birds:osm-habitat:${lat}:${lng}`;
}

function osmHabitatContextMatches(location) {
  if (!state.osmHabitatContext?.location || !location) return false;
  return distanceKm(state.osmHabitatContext.location, location) <= 1.5;
}

function addHabitatScore(scores, habitat, amount, evidence, label) {
  scores.set(habitat, (scores.get(habitat) || 0) + amount);
  if (label && evidence.length < 10) evidence.push(label);
}

function classifyOsmElements(elements) {
  const scores = new Map();
  const evidence = [];

  (elements || []).forEach(element => {
    const tags = element.tags || {};
    const natural = String(tags.natural || "").toLowerCase();
    const wetland = String(tags.wetland || "").toLowerCase();
    const water = String(tags.water || "").toLowerCase();
    const waterway = String(tags.waterway || "").toLowerCase();
    const landuse = String(tags.landuse || "").toLowerCase();
    const leisure = String(tags.leisure || "").toLowerCase();
    const place = String(tags.place || "").toLowerCase();
    const building = tags.building;

    if (place && /city|town|village|suburb|neighbourhood/.test(place)) {
      addHabitatScore(scores, "urban", 5, evidence, `place=${place}`);
      addHabitatScore(scores, "garden", 1.2, evidence, "urban green/garden assumption");
    }

    if (building) {
      addHabitatScore(scores, "urban", 0.35, evidence, "buildings nearby");
    }

    if (/residential|commercial|retail|industrial|construction|brownfield/.test(landuse)) {
      addHabitatScore(scores, "urban", 4, evidence, `landuse=${landuse}`);
    }

    if (/park|garden|common|recreation_ground/.test(leisure)) {
      addHabitatScore(scores, "garden", 4, evidence, `leisure=${leisure}`);
      addHabitatScore(scores, "urban", 1.5, evidence, "managed green space");
    }

    if (/allotments|cemetery/.test(landuse)) {
      addHabitatScore(scores, "garden", 3.5, evidence, `landuse=${landuse}`);
    }

    if (/farmland|farmyard|meadow|pasture|orchard|vineyard|grass/.test(landuse)) {
      addHabitatScore(scores, "farmland", 4, evidence, `landuse=${landuse}`);
    }

    if (/wood|tree_row|scrub/.test(natural) || /forest/.test(landuse)) {
      addHabitatScore(scores, "woodland", 4, evidence, natural ? `natural=${natural}` : `landuse=${landuse}`);
    }

    if (/heath|moor|fell|bare_rock|scree/.test(natural)) {
      addHabitatScore(scores, "bog", 3.2, evidence, `natural=${natural}`);
    }

    if (/water|lake|pond|reservoir|basin|lagoon/.test(natural) || /lake|pond|reservoir|basin|lagoon/.test(water)) {
      addHabitatScore(scores, "river", 3.5, evidence, natural ? `natural=${natural}` : `water=${water}`);
    }

    if (/river|stream|canal|ditch|drain/.test(waterway)) {
      addHabitatScore(scores, "river", 4, evidence, `waterway=${waterway}`);
    }

    if (natural === "wetland" || wetland) {
      addHabitatScore(scores, "wetland", 5, evidence, wetland ? `wetland=${wetland}` : "natural=wetland");

      if (/saltmarsh|tidalflat|mud|reedbed|marsh|lagoon/.test(wetland)) {
        addHabitatScore(scores, "estuary", 3, evidence, `coastal wetland=${wetland}`);
      }

      if (/saltmarsh|tidalflat|lagoon/.test(wetland)) {
        addHabitatScore(scores, "coast", 2.5, evidence, `coastal wetland=${wetland}`);
      }
    }

    if (/coastline|beach|sand|shingle|bay/.test(natural)) {
      addHabitatScore(scores, "coast", 5, evidence, `natural=${natural}`);
    }

    if (/lagoon/.test(water)) {
      addHabitatScore(scores, "wetland", 4, evidence, "water=lagoon");
      addHabitatScore(scores, "coast", 3, evidence, "water=lagoon");
      addHabitatScore(scores, "estuary", 2.5, evidence, "water=lagoon");
    }
  });

  const habitats = new Set();

  scores.forEach((score, habitat) => {
    const threshold = habitat === "urban" ? 2.6 : 2.0;
    if (score >= threshold) habitats.add(habitat);
  });

  if (habitats.has("estuary")) {
    habitats.add("wetland");
    habitats.add("coast");
  }

  return {
    habitats: [...habitats],
    scores: Object.fromEntries(scores),
    evidence
  };
}

function buildOverpassQuery(location) {
  const radiusKm = Number(els.radius?.value || 10);
  const radius = Math.max(2200, Math.min(7000, radiusKm * 700));
  const lat = Number(location.lat).toFixed(5);
  const lng = Number(location.lng).toFixed(5);

  return `
[out:json][timeout:8];
(
  nwr(around:${radius},${lat},${lng})["natural"~"coastline|beach|sand|shingle|bay|wetland|water|wood|tree_row|scrub|heath|moor|fell|bare_rock|scree"];
  nwr(around:${radius},${lat},${lng})["wetland"];
  nwr(around:${radius},${lat},${lng})["water"];
  nwr(around:${radius},${lat},${lng})["waterway"~"river|stream|canal|ditch|drain"];
  nwr(around:${radius},${lat},${lng})["landuse"~"residential|commercial|retail|industrial|construction|brownfield|farmland|farmyard|meadow|pasture|orchard|vineyard|grass|forest|allotments|cemetery"];
  nwr(around:${radius},${lat},${lng})["leisure"~"park|garden|common|recreation_ground"];
  nwr(around:${radius},${lat},${lng})["place"~"city|town|village|suburb|neighbourhood"];
  nwr(around:${radius},${lat},${lng})["building"];
);
out tags center 140;
`;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => window.clearTimeout(timer));
}

async function resolveOsmHabitatContext(location) {
  if (!location) return null;

  const cacheKey = osmHabitatCacheKey(location);

  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < 1000 * 60 * 60 * 24 * 14) {
      return cached;
    }
  } catch {
    // Ignore malformed cache entries.
  }

  const query = buildOverpassQuery(location);

  try {
    const response = await fetchWithTimeout(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: query
      },
      5500
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const classified = classifyOsmElements(payload.elements || []);

    const context = {
      checked_at: new Date().toISOString(),
      source: "osm-overpass",
      location: { lat: Number(location.lat), lng: Number(location.lng) },
      habitats: classified.habitats,
      scores: classified.scores,
      evidence: classified.evidence
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(context));
    } catch {
      // Storage may be unavailable. The resolver still works.
    }

    return context;
  } catch (error) {
    console.warn("OSM habitat lookup failed; using static zone and distance fallback", error);
    return {
      checked_at: new Date().toISOString(),
      source: "osm-failed",
      location: { lat: Number(location.lat), lng: Number(location.lng) },
      habitats: [],
      scores: {},
      evidence: [String(error.message || error)]
    };
  }
}

function osmHabitatSetForLocation(location) {
  if (!osmHabitatContextMatches(location)) return new Set();
  return new Set(state.osmHabitatContext?.habitats || []);
}

async function refineHabitatsFromOsm(location, token) {
  const context = await resolveOsmHabitatContext(location);

  if (!context) return;
  if (token !== state.locationContextToken) return;
  if (state.habitatMode !== "auto") return;

  state.osmHabitatContext = context;

  if (!context.habitats?.length) return;

  syncHabitatsFromPin(location);
  invalidateChorusSelection("OSM habitat context loaded");
  render();
}


function locationProfile(location) {
  const radius = Number(els.radius?.value || 10);
  const coastDistance = nearestDistanceKm(location, COAST_POINTS);
  const estuaryDistance = nearestDistanceKm(location, ESTUARY_POINTS);
  const wetlandDistance = nearestDistanceKm(
    location,
    typeof WETLAND_POINTS !== "undefined" ? WETLAND_POINTS : []
  );
  const cityDistance = nearestDistanceKm(location, [
    ...CITY_POINTS,
    ...(typeof EUROPE_URBAN_POINTS !== "undefined" ? EUROPE_URBAN_POINTS : [])
  ]);
  const riverDistance = nearestDistanceKm(
    location,
    typeof RIVER_POINTS !== "undefined" ? RIVER_POINTS : []
  );

  const zoneHabitats = typeof habitatZoneSetForLocation === "function"
    ? habitatZoneSetForLocation(location)
    : new Set();

  const osmHabitats = typeof osmHabitatSetForLocation === "function"
    ? osmHabitatSetForLocation(location)
    : new Set();

  const coastalThreshold = Math.max(32, radius * 1.4);
  const nearCoastalThreshold = Math.max(55, radius * 2.0);
  const estuaryThreshold = Math.max(28, radius * 1.3);
  const wetlandThreshold = Math.max(30, radius * 1.3);
  const urbanThreshold = Math.max(16, radius * 1.4);
  const riverThreshold = Math.max(12, radius * 1.1);

  return {
    coastDistance,
    estuaryDistance,
    wetlandDistance,
    cityDistance,
    riverDistance,
    zoneLabel: typeof habitatZoneLabelForLocation === "function" ? habitatZoneLabelForLocation(location) : "",
    zoneHabitats: [...zoneHabitats],
    osmHabitats: [...osmHabitats],
    osmSource: state.osmHabitatContext?.source || "",
    coastal: osmHabitats.has("coast") || zoneHabitats.has("coast") || coastDistance <= coastalThreshold,
    nearCoastal: osmHabitats.has("coast") || zoneHabitats.has("coast") || coastDistance <= nearCoastalThreshold,
    estuary: osmHabitats.has("estuary") || zoneHabitats.has("estuary") || estuaryDistance <= estuaryThreshold,
    wetland: osmHabitats.has("wetland") || zoneHabitats.has("wetland") || wetlandDistance <= wetlandThreshold,
    urban: osmHabitats.has("urban") || zoneHabitats.has("urban") || cityDistance <= urbanThreshold,
    river: osmHabitats.has("river") || zoneHabitats.has("river") || riverDistance <= riverThreshold,
    inland: !osmHabitats.has("coast") && !zoneHabitats.has("coast") && coastDistance > nearCoastalThreshold
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

  profile.zoneHabitats.forEach(habitat => habitats.add(habitat));
  profile.osmHabitats.forEach(habitat => habitats.add(habitat));

  if (profile.urban) {
    habitats.add("urban");
    habitats.add("garden");
    habitats.add("woodland");
  }

  if (!profile.urban && !profile.coastal && !profile.nearCoastal && !profile.wetland && !profile.estuary) {
    habitats.add("farmland");
    habitats.add("woodland");
  }

  if (profile.river) {
    habitats.add("river");
  }

  if (profile.coastal || profile.nearCoastal) {
    habitats.add("coast");
  }

  if (profile.estuary) {
    habitats.add("estuary");
    habitats.add("wetland");
    habitats.add("coast");
  }

  if (profile.wetland) {
    habitats.add("wetland");
  }

  if (!profile.urban && !profile.river && !profile.coastal && !profile.nearCoastal && !profile.estuary && !profile.wetland) {
    habitats.add("farmland");
    habitats.add("woodland");
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


function normaliseQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function birdSearchHaystack(bird) {
  return [
    textBag(bird),
    bird.common_name,
    bird.scientific_name,
    bird.irish_name,
    bird.group,
    bird.status,
    ...(bird.status_codes || []),
    ...(bird.aliases || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function birdMatchesQuery(bird, rawQuery) {
  const query = normaliseQuery(rawQuery);
  if (!query) return true;

  const haystack = birdSearchHaystack(bird);
  const terms = query.split(/\s+/).filter(Boolean);

  return terms.every(term => haystack.includes(term));
}

function activeSearchMode() {
  const unifiedQuery = normaliseQuery(els.searchUnified?.value);

  if (unifiedQuery) {
    return {
      mode: state.searchScope || "selected",
      query: unifiedQuery
    };
  }

  // Backwards compatibility if old fields still exist in a cached/local branch.
  const selectedQuery = normaliseQuery(els.searchSelected?.value);
  const catalogueQuery = normaliseQuery(els.searchCatalogue?.value);

  if (catalogueQuery) return { mode: "catalogue", query: catalogueQuery };
  if (selectedQuery) return { mode: "selected", query: selectedQuery };

  return { mode: "none", query: "" };
}

function applySharedFilters(birds) {
  const status = els.status?.value || "all";
  const sound = els.sound?.value || "all";

  return birds.filter(bird => {
    if (!matchesStatus(bird, status)) return false;
    if (sound === "has" && !hasAudio(bird)) return false;
    if (sound === "missing" && hasAudio(bird)) return false;
    if (els.listenOnly?.checked && !hasAudio(bird)) return false;
    return true;
  });
}

function bindDualSearchControls() {
  if (!state.searchScope) {
    state.searchScope = "selected";
  }

  function syncScopeButtons() {
    const scope = state.searchScope || "selected";

    if (els.searchScopeSelected) {
      els.searchScopeSelected.classList.toggle("is-active", scope === "selected");
      els.searchScopeSelected.setAttribute("aria-pressed", scope === "selected" ? "true" : "false");
    }

    if (els.searchScopeCatalogue) {
      els.searchScopeCatalogue.classList.toggle("is-active", scope === "catalogue");
      els.searchScopeCatalogue.setAttribute("aria-pressed", scope === "catalogue" ? "true" : "false");
    }
  }

  if (els.searchUnified && !els.searchUnified.dataset.bound) {
    els.searchUnified.dataset.bound = "true";
    els.searchUnified.addEventListener("input", () => {
      if (els.searchSelected) els.searchSelected.value = "";
      if (els.searchCatalogue) els.searchCatalogue.value = "";
      invalidateChorusSelection("Filters changed");
      render();
    });
  }

  [els.searchScopeSelected, els.searchScopeCatalogue].forEach(button => {
    if (!button || button.dataset.bound) return;

    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      state.searchScope = button.dataset.searchScope || "selected";
      syncScopeButtons();
      invalidateChorusSelection("Filters changed");
      render();
    });
  });

  // Old dual search fallback if those controls still exist.
  if (els.searchSelected && !els.searchSelected.dataset.bound) {
    els.searchSelected.dataset.bound = "true";
    els.searchSelected.addEventListener("input", () => {
      if (els.searchSelected.value.trim() && els.searchCatalogue?.value) {
        els.searchCatalogue.value = "";
      }
      invalidateChorusSelection("Filters changed");
      render();
    });
  }

  if (els.searchCatalogue && !els.searchCatalogue.dataset.bound) {
    els.searchCatalogue.dataset.bound = "true";
    els.searchCatalogue.addEventListener("input", () => {
      if (els.searchCatalogue.value.trim() && els.searchSelected?.value) {
        els.searchSelected.value = "";
      }
      invalidateChorusSelection("Filters changed");
      render();
    });
  }

  syncScopeButtons();
}

function applyNearbyDeck(birds) {
  if (els.deckMode?.value === "all") {
    state.plausibleCount = birds.length;
    return birds.map(b => ({ ...b, local: null }));
  }

  const scored = birds
    .map(bird => ({ ...bird, local: scoreBirdForNearby(bird) }))
    .sort((a, b) => b.local.score - a.local.score || String(a.common_name).localeCompare(String(b.common_name)));

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

function invalidateChorusSelection(reason = "Context changed") {
  activeChorusPlayers.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    } catch (error) {
      console.warn("Could not stop stale chorus audio", error);
    }
  });

  activeChorusPlayers = [];
  state.chorusNeedsRemix = true;
  state.chorusRemixReason = reason;
  syncChorusControlButtons();
}


function chorusBirdKey(bird) {
  return `${bird.scientific_name || bird.common_name || ""}:${bird.audio?.file || ""}`;
}

function uniqueChorusBirds(birds) {
  const seen = new Set();
  const unique = [];

  birds.forEach(bird => {
    const key = chorusBirdKey(bird);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(bird);
  });

  return unique;
}

function chorusEligible(bird) {
  if (!hasAudio(bird)) return false;
  const codes = bird.status_codes || [];
  return !codes.includes("B");
}

function relaxedLocalChorusBirds() {
  const search = typeof activeSearchMode === "function"
    ? activeSearchMode()
    : { query: "" };

  // If the user is deliberately searching, do not broaden the chorus.
  if (search.query) return [];

  return applySharedFilters(state.birds)
    .filter(chorusEligible)
    .map(bird => ({ ...bird, local: scoreBirdForNearby(bird) }))
    .filter(bird => {
      const codes = bird.status_codes || [];
      if (!els.includeRare?.checked && (codes.includes("R") || codes.includes("B"))) return false;
      return (bird.local?.score || 0) >= 24;
    })
    .sort((a, b) =>
      (b.local?.score || 0) - (a.local?.score || 0) ||
      String(a.common_name).localeCompare(String(b.common_name))
    );
}

function selectableChorusBirds() {
  const search = typeof activeSearchMode === "function"
    ? activeSearchMode()
    : { query: "" };

  const primary = state.filtered
    .filter(chorusEligible)
    .filter(bird => {
      const codes = bird.status_codes || [];
      if (!els.includeRare?.checked && (codes.includes("R") || codes.includes("B"))) return false;
      return true;
    });

  // If a search is active, respect it. Otherwise, do not allow the chorus to collapse to one bird
  // merely because a very tight location deck produced too few playable records.
  if (search.query) {
    return uniqueChorusBirds(primary).slice(0, 24);
  }

  const relaxed = relaxedLocalChorusBirds();

  return uniqueChorusBirds([
    ...primary,
    ...relaxed
  ]).slice(0, 24);
}

function currentFilteredChorusSignature() {
  return selectableChorusBirds()
    .map(bird => `${bird.common_name || ""}:${bird.audio?.file || ""}`)
    .join("|");
}

function currentChorusSelectionSignature() {
  return (state.chorusSelection || [])
    .map(bird => `${bird.common_name || ""}:${bird.audio?.file || ""}`)
    .join("|");
}

function isChorusSelectionStale() {
  if (state.chorusNeedsRemix) return true;
  if (!state.chorusDeckSignature) return false;
  return state.chorusDeckSignature !== currentFilteredChorusSignature();
}

function remixChorusSelection() {
  stopChorusTogether();

  const candidates = selectableChorusBirds();
  const shuffled = candidates
    .map(bird => ({ bird, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(item => item.bird);

  state.chorusSelection = shuffled.slice(0, Math.min(8, shuffled.length));
  state.chorusDeckSignature = currentFilteredChorusSignature();
  state.chorusNeedsRemix = false;
  state.chorusRemixReason = "";

  renderChorus();

  if (els.notice) {
    els.notice.textContent = state.chorusSelection.length
      ? `Chorus remixed · ${state.chorusSelection.length} selected · press Play to listen`
      : "No playable birds available for this place and filter set.";
  }
}

function chorusCandidates() {
  if (!Array.isArray(state.chorusSelection)) {
    state.chorusSelection = [];
  }

  if (!state.chorusSelection.length) {
    const candidates = selectableChorusBirds();
    state.chorusSelection = candidates.slice(0, Math.min(8, candidates.length));
    state.chorusDeckSignature = currentFilteredChorusSignature();
    state.chorusNeedsRemix = false;
    state.chorusRemixReason = "";
  }

  return state.chorusSelection
    .filter(chorusEligible)
    .filter(bird => {
      const codes = bird.status_codes || [];
      if (!els.includeRare?.checked && (codes.includes("R") || codes.includes("B"))) return false;
      return true;
    });
}

function setChorusPlaybackState(isPlaying) {
  state.chorusIsPlaying = Boolean(isPlaying);

  const playButton = document.getElementById("toggleChorusPlayback");
  if (!playButton) return;

  playButton.textContent = state.chorusIsPlaying ? "Stop" : "Play";
  playButton.dataset.state = state.chorusIsPlaying ? "stop" : "play";
  playButton.classList.toggle("is-playing", state.chorusIsPlaying);
  playButton.setAttribute("aria-pressed", state.chorusIsPlaying ? "true" : "false");
  playButton.setAttribute("title", state.chorusIsPlaying ? "Stop chorus" : "Play chorus");
  playButton.setAttribute("aria-label", state.chorusIsPlaying ? "Stop selected chorus" : "Play selected chorus");
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
  setChorusPlaybackState(false);
  syncChorusControlButtons();
}

function playChorusTogether() {
  const birds = chorusCandidates();

  if (!birds.length) {
    if (els.notice) {
      els.notice.textContent = "No playable birds in the current chorus. Press Remix after changing filters.";
    }
    setChorusPlaybackState(false);
    syncChorusControlButtons();
    return;
  }

  activeChorusPlayers.forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    } catch (error) {
      console.warn("Could not clear previous chorus audio", error);
    }
  });

  activeChorusPlayers = [];
  setChorusPlaybackState(true);

  birds.forEach((bird, index) => {
    const audio = new Audio(bird.audio.file);
    audio.preload = "auto";
    audio.volume = Math.max(0.10, 0.22 - (birds.length * 0.012));

    audio.addEventListener("ended", () => {
      activeChorusPlayers = activeChorusPlayers.filter(player => player !== audio);
      if (!activeChorusPlayers.length) {
        setChorusPlaybackState(false);
      }
      syncChorusControlButtons();
    });

    audio.addEventListener("error", () => {
      activeChorusPlayers = activeChorusPlayers.filter(player => player !== audio);
      if (!activeChorusPlayers.length) {
        setChorusPlaybackState(false);
      }
      syncChorusControlButtons();
    });

    activeChorusPlayers.push(audio);

    window.setTimeout(() => {
      audio.play().then(() => {
        setChorusPlaybackState(true);
        syncChorusControlButtons();
      }).catch(error => {
        console.warn("Could not play chorus bird", bird.common_name, error);
        activeChorusPlayers = activeChorusPlayers.filter(player => player !== audio);

        if (!activeChorusPlayers.length) {
          setChorusPlaybackState(false);
        }

        syncChorusControlButtons();

        if (els.notice) {
          els.notice.textContent = "Some chorus audio could not start. Use the individual bird controls if needed.";
        }
      });
    }, index * 220);
  });

  if (els.notice) {
    els.notice.textContent = `Playing ${birds.length} selected chorus birds · press Stop to end playback`;
  }

  syncChorusControlButtons();
}

function renderChorusMosaic(birds) {
  if (!els.chorusMosaic) return;

  const selected = Array.isArray(birds) ? birds.slice(0, 8) : [];

  if (!selected.length) {
    els.chorusMosaic.innerHTML = `<p class="chorus-empty">No playable birds in the current chorus. Press Remix after changing filters.</p>`;
    return;
  }

  els.chorusMosaic.innerHTML = selected.map(bird => {
    const image = bird.image || {};
    const src = image.thumb || image.original || image.url || "";
    const name = bird.common_name || "Bird";
    const match = bird.local ? localMatchLabel(bird.local.confidence) : "Selected";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toUpperCase();

    return `
      <button type="button" class="chorus-tile" data-bird="${name}" title="${name}" aria-label="${name}">
        <span class="chorus-tile__thumb${src ? "" : " is-empty"}">
          ${src
            ? `<img src="${src}" alt="" loading="lazy" />`
            : `<span class="chorus-tile__initials">${initials || "B"}</span>`
          }
        </span>
        <span class="chorus-tile__name">${name}</span>
        <span class="chorus-tile__meta">${match}</span>
      </button>
    `;
  }).join("");
}

function syncChorusControlButtons() {
  const hasPlayableChorus = chorusCandidates().length > 0;
  const isPlaying = Array.isArray(activeChorusPlayers) && activeChorusPlayers.some(audio => !audio.paused);
  const isStale = isChorusSelectionStale();

  if (els.remixChorusSelection) {
    els.remixChorusSelection.disabled = !hasPlayableChorus;
    els.remixChorusSelection.classList.toggle("is-stale", isStale);
    els.remixChorusSelection.classList.toggle("is-active", isStale);
    els.remixChorusSelection.setAttribute("aria-label", isStale ? "Remix available for the current place" : "Remix chorus selection");
  }

  if (els.toggleChorusPlayback) {
    els.toggleChorusPlayback.disabled = !hasPlayableChorus;
    els.toggleChorusPlayback.classList.toggle("is-playing", isPlaying);
    els.toggleChorusPlayback.dataset.state = isPlaying ? "stop" : "play";
    els.toggleChorusPlayback.textContent = isPlaying ? "Stop" : "Play";
    els.toggleChorusPlayback.setAttribute("aria-label", isPlaying ? "Stop chorus playback" : "Play chorus");
    els.toggleChorusPlayback.setAttribute("title", isPlaying ? "Stop chorus playback" : "Play chorus");
  }
}


function installChorusControlButtons() {
  const remixButton = document.getElementById("remixChorusSelection");
  const playButton = document.getElementById("toggleChorusPlayback");

  if (remixButton) {
    remixButton.onclick = remixChorusSelection;
    remixButton.dataset.bound = "true";
  }

  if (playButton) {
    playButton.onclick = () => {
      if (state.chorusIsPlaying) {
        stopChorusTogether();
      } else {
        playChorusTogether();
      }
    };
    playButton.dataset.bound = "true";
  }

  syncChorusControlButtons();
}


function renderChorus() {
  const playable = chorusCandidates();
  const stale = isChorusSelectionStale();

  if (els.chorusContext) {
    els.chorusContext.textContent = stale
      ? `${MONTHS[selectedMonth()]} · ${playable.length} selected · remix available`
      : `${MONTHS[selectedMonth()]} · ${playable.length} selected`;
  }

  if (els.chorusList) {
    els.chorusList.innerHTML = "";
    els.chorusList.setAttribute("aria-hidden", "true");
  }

  renderChorusMosaic(playable);
  syncChorusControlButtons();
}

function render() {
  try {
    const search = activeSearchMode();
    const sort = els.sort?.value || "common";

    const catalogueBase = applySharedFilters(state.birds);
    let selectedBase = applyNearbyDeck(catalogueBase);

    let birds = selectedBase;

    if (search.mode === "catalogue") {
      birds = catalogueBase
        .filter(bird => birdMatchesQuery(bird, search.query))
        .map(bird => {
          if ((els.deckMode?.value || "nearby") === "all") {
            return { ...bird, local: null };
          }
          return { ...bird, local: scoreBirdForNearby(bird) };
        });

      state.plausibleCount = selectedBase.length;
    }

    if (search.mode === "selected") {
      birds = selectedBase.filter(bird => birdMatchesQuery(bird, search.query));
    }

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

    const nextChorusSignature = currentFilteredChorusSignature();
    if (state.chorusDeckSignature && state.chorusDeckSignature !== nextChorusSignature) {
      state.chorusNeedsRemix = true;
      state.chorusRemixReason = "Current filters changed";
    }

    renderGroupedBirds(birds);
    renderChorus();
    updateNearbySummary({ birds, selectedCount: selectedBase.length, catalogueCount: catalogueBase.length });

    updateConciseNotice({
      birds,
      search,
      selectedCount: selectedBase.length,
      catalogueCount: catalogueBase.length
    });
  } catch (error) {
    console.error(error);
    if (els.notice) els.notice.textContent = `Render error: ${error.message}`;
  }
}

function titleCaseShort(value) {
  return String(value || "")
    .replace("-", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function selectedOptionText(selectEl) {
  return selectEl?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function compactHabitatLabel() {
  const habitats = [...activeHabitats()]
    .filter(h => h !== "general")
    .map(titleCaseShort);

  if (!habitats.length) return "Auto habitat";
  if (habitats.length <= 3) return habitats.join(", ");
  return `${habitats.slice(0, 3).join(", ")} +${habitats.length - 3}`;
}

function compactPlaceLabel() {
  if (!state.location) return "Europe pilot";

  const profile = locationProfile(state.location);
  const osmHabitats = new Set(profile.osmHabitats || []);

  if (profile.zoneLabel) return profile.zoneLabel;
  if (osmHabitats.has("estuary")) return "OSM estuary / wetland";
  if (osmHabitats.has("coast") && osmHabitats.has("wetland")) return "OSM coastal wetland";
  if (osmHabitats.has("coast")) return "OSM coast";
  if (osmHabitats.has("urban") && osmHabitats.has("river")) return "OSM urban river corridor";
  if (osmHabitats.has("urban")) return "OSM urban / garden";
  if (osmHabitats.has("river")) return "OSM river corridor";
  if (osmHabitats.has("farmland") && osmHabitats.has("woodland")) return "OSM rural mosaic";

  if (profile.estuary) return "Estuary";
  if (profile.wetland && (profile.coastal || profile.nearCoastal)) return "Coastal wetland";
  if (profile.coastal) return "Coast";
  if (profile.nearCoastal) return "Near coast";
  if (profile.urban && profile.river) return "Urban river corridor";
  if (profile.urban) return "Urban / garden";
  if (profile.river) return "River corridor";
  return "Inland";
}

function updateConciseNotice(context) {
  if (els.notice) {
    els.notice.textContent = "";
    els.notice.setAttribute("aria-hidden", "true");
  }
}

function updateNearbySummary(context = null) {
  const target =
    els.nearbySummary ||
    document.querySelector(".nearby-summary");

  if (!target) return;

  const search =
    typeof activeSearchMode === "function"
      ? activeSearchMode()
      : { mode: "none", query: "" };

  const birds = Array.isArray(context?.birds)
    ? context.birds
    : Array.isArray(state.filtered)
      ? state.filtered
      : [];

  const selectedCount = Number(
    context?.selectedCount ?? state.plausibleCount ?? birds.length
  );

  const catalogueCount = Number(
    context?.catalogueCount ?? state.birds?.length ?? 0
  );

  const month = MONTHS[selectedMonth()];
  const radius = `${els.radius?.value || 10} km`;
  const place = typeof compactPlaceLabel === "function" ? compactPlaceLabel() : "Ireland-wide";
  const habitats = typeof compactHabitatLabel === "function" ? compactHabitatLabel() : "Auto habitat";
  const status = typeof selectedOptionText === "function"
    ? (selectedOptionText(els.status) || "All records")
    : "All records";
  const sound = typeof selectedOptionText === "function"
    ? (selectedOptionText(els.sound) || "All sounds")
    : "All sounds";

  const shown = birds.length.toLocaleString();
  const selectedTotal = selectedCount.toLocaleString();
  const catalogueTotal = catalogueCount.toLocaleString();

  const bits = [];

  if (search.mode === "catalogue") {
    bits.push(`Catalogue search “${search.query}”`);
    bits.push(`${shown}/${catalogueTotal} shown`);
    bits.push(status);
    bits.push(sound);
  } else if (search.mode === "selected") {
    bits.push(`Selected search “${search.query}”`);
    bits.push(`${shown}/${selectedTotal} shown`);
    bits.push(month);
    bits.push(place);
    bits.push(habitats);
  } else {
    bits.push(month);
    bits.push(radius);
    bits.push(place);
    bits.push(habitats);
    bits.push(selectedCount > birds.length ? `${shown}/${selectedTotal} shown` : `${shown} shown`);

    if (els.sound?.value === "has" || els.listenOnly?.checked) {
      bits.push("sound only");
    } else if (els.sound?.value === "missing") {
      bits.push("no sound");
    }

    bits.push(els.includeRare?.checked ? "rare on" : "rare off");
  }

  target.textContent = bits.filter(Boolean).join(" · ");
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

  state.map = L.map(els.map, { scrollWheelZoom: false }).setView([EUROPE_PILOT_CENTRE.lat, EUROPE_PILOT_CENTRE.lng], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);

  state.map.on("click", event => {
    setLocation(event.latlng.lat, event.latlng.lng, "map");
  });
}


function syncHabitatsFromPin(location) {
  if (state.habitatMode === "manual") {
    syncHabitatButtons();
    return;
  }

  const auto = autoHabitatsFromLocation(location);

  state.habitats.clear();

  // Do not show "general" as a chip. It is a scoring fallback, not a place type.
  auto.forEach(habitat => {
    if (habitat !== "general") {
      state.habitats.add(habitat);
    }
  });

  // If the pin is moved, the habitat preset should no longer claim to be manual user intent.
  if (els.preset) {
    els.preset.value = "";
  }

  syncHabitatButtons();
}

function clearBirdSearchForNewPlace() {
  const url = new URL(window.location.href);
  const hadUrlBird = url.searchParams.has("bird") || url.searchParams.has("q");

  const hadSearch = Boolean(
    els.searchUnified?.value?.trim() ||
    els.searchSelected?.value?.trim() ||
    els.searchCatalogue?.value?.trim() ||
    els.search?.value?.trim() ||
    hadUrlBird
  );

  if (!hadSearch) return;

  if (els.searchUnified) els.searchUnified.value = "";
  if (els.searchSelected) els.searchSelected.value = "";
  if (els.searchCatalogue) els.searchCatalogue.value = "";
  if (els.search) els.search.value = "";

  state.searchScope = "selected";

  if (els.searchScopeSelected) {
    els.searchScopeSelected.classList.add("is-active");
    els.searchScopeSelected.setAttribute("aria-pressed", "true");
  }

  if (els.searchScopeCatalogue) {
    els.searchScopeCatalogue.classList.remove("is-active");
    els.searchScopeCatalogue.setAttribute("aria-pressed", "false");
  }

  if (els.deckMode) els.deckMode.value = "nearby";

  if (hadUrlBird) {
    url.searchParams.delete("bird");
    url.searchParams.delete("q");
    url.searchParams.delete("scope");
    url.searchParams.delete("sound");
    window.history.replaceState({}, "", url.pathname + url.hash);
  }
}

function setLocation(lat, lng, source = "map") {
  clearBirdSearchForNewPlace();
  invalidateChorusSelection("Location changed");

  state.location = { lat, lng, source };
  state.habitatMode = "auto";
  state.osmHabitatContext = null;
  state.locationContextToken = Number(state.locationContextToken || 0) + 1;
  const token = state.locationContextToken;

  if (state.map && window.L) {
    if (!state.marker) {
      state.marker = L.marker([lat, lng]).addTo(state.map);
    } else {
      state.marker.setLatLng([lat, lng]);
    }

    state.map.setView([lat, lng], source === "browser" ? 11 : state.map.getZoom());
  }

  syncHabitatsFromPin(state.location);
  render();

  refineHabitatsFromOsm(state.location, token);
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
      state.habitatMode = "manual";
      state.habitatMode = "manual";
      if (state.habitats.has(habitat)) state.habitats.delete(habitat);
      else state.habitats.add(habitat);

      if (els.preset) els.preset.value = "";
      syncHabitatButtons();
      invalidateChorusSelection("Filters changed");
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

  state.habitatMode = "manual";
  state.habitatMode = "manual";
  state.habitats.clear();
  HABITAT_PRESETS[preset].forEach(h => state.habitats.add(h));
  syncHabitatButtons();
  invalidateChorusSelection("Habitat preset changed");
  render();
}

function playRandomBird() {
  const playable = state.filtered.filter(hasAudio);
  if (!playable.length) {
    els.notice.textContent = "No playable sound in the current filter.";
    return;
  }

  const bird = playable[Math.floor(Math.random() * playable.length)];
  if (els.searchUnified) els.searchUnified.value = bird.common_name || "";
  if (els.searchSelected) els.searchSelected.value = bird.common_name || "";
  if (els.searchCatalogue) els.searchCatalogue.value = "";
  if (els.search) els.search.value = bird.common_name || "";
  state.searchScope = "selected";
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

function handleBirdDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const linkedBird = String(params.get("bird") || params.get("q") || "").trim();

  if (!linkedBird) return;

  const scope = params.get("scope") || "catalogue";
  const sound = params.get("sound") || "all";

  if (els.searchUnified) els.searchUnified.value = linkedBird;
  if (els.searchCatalogue) els.searchCatalogue.value = linkedBird;
  if (els.searchSelected) els.searchSelected.value = linkedBird;
  if (els.search) els.search.value = linkedBird;

  state.searchScope = scope === "selected" ? "selected" : "catalogue";

  if (els.searchScopeSelected) {
    els.searchScopeSelected.setAttribute("aria-pressed", state.searchScope === "selected" ? "true" : "false");
  }

  if (els.searchScopeCatalogue) {
    els.searchScopeCatalogue.setAttribute("aria-pressed", state.searchScope === "catalogue" ? "true" : "false");
  }

  if (els.deckMode) els.deckMode.value = "all";
  if (els.status) els.status.value = "all";
  if (els.sound) els.sound.value = sound;
  if (els.group) els.group.value = "habitat";

  render();

  window.setTimeout(() => {
    const wanted = linkedBird.toLowerCase();
    const cards = [...document.querySelectorAll(".bird-card")];

    const target = cards.find(card => {
      const common = card.querySelector(".common-name")?.textContent?.trim().toLowerCase() || "";
      const scientific = card.querySelector(".scientific-name")?.textContent?.trim().toLowerCase() || "";
      return common === wanted || scientific === wanted || common.includes(wanted) || scientific.includes(wanted);
    }) || cards[0];

    if (!target) {
      if (els.notice) {
        els.notice.textContent = `${linkedBird} was not found in the current sound atlas.`;
      }
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("bird-card--pulse");

    window.setTimeout(() => {
      target.classList.remove("bird-card--pulse");
    }, 1600);

    const audio = target.querySelector("audio");
    if (audio) {
      audio.focus({ preventScroll: true });
      if (els.notice) {
        els.notice.textContent = `Opened ${linkedBird}. Press play on the sound card to hear the recording.`;
      }
    } else if (els.notice) {
      els.notice.textContent = `Opened ${linkedBird}, but no matched sound is currently available.`;
    }
  }, 140);
}

async function init() {
  try {
    const response = await fetch("./data/birds.json?v=" + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.birds = Array.isArray(payload.birds) ? payload.birds : [];
    await loadHabitatZones();

    updateStats(payload);
    initialiseMonth();
    initialiseMap();
    initialiseHabitatButtons();
    bindDualSearchControls();
    installMobileMapToggle();

    render();
    handleBirdDeepLink();
  } catch (error) {
    console.error(error);
    if (els.notice) els.notice.textContent = `Could not load BOIE: ${error.message}`;
  }
}

[els.status, els.sound, els.sort, els.group, els.month, els.radius, els.deckMode, els.listenOnly, els.includeRare].forEach(el => {
  if (!el) return;
  el.addEventListener("input", () => {
    invalidateChorusSelection();
    render();
  });
  el.addEventListener("change", () => {
    invalidateChorusSelection();
    render();
  });
});

els.preset?.addEventListener("change", applyPreset);
els.shuffle?.addEventListener("click", playRandomBird);
els.useLocation?.addEventListener("click", useBrowserLocation);
els.playChorus?.addEventListener("click", playChorusTogether);
els.stopChorus?.addEventListener("click", stopChorusTogether);

function jumpToBirdFromButton(button) {
  if (!button) return;

  const name = String(button.dataset.bird || "").trim();
  if (!name) return;

  const cards = [...document.querySelectorAll(".bird-card")];
  const target = cards.find(card => {
    const title = card.querySelector(".common-name")?.textContent?.trim();
    return title === name;
  });

  if (!target) {
    if (els.notice) {
      els.notice.textContent = `${name} is in the selected chorus. Press Remix after changing filters, or use Search if you want to filter the catalogue.`;
    }
    return;
  }

  target.classList.add("bird-card--pulse");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  window.setTimeout(() => {
    target.classList.remove("bird-card--pulse");
  }, 1400);
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


/* BOIE default group by habitat */
(function () {
  const group = document.getElementById("groupFilter");
  if (group && !group.dataset.defaulted) {
    group.dataset.defaulted = "true";
    group.value = "habitat";
  }
})();

/* BOIE mobile utility-link classifier */
(function () {
  function classifyUtilityLinks() {
    document.querySelectorAll("a").forEach(link => {
      const text = (link.textContent || "").trim().toLowerCase();
      const href = (link.href || "").toLowerCase();

      if (
        text.includes("back to demos") ||
        text === "← demos" ||
        text === "demos" ||
        text.includes("← demos")
      ) {
        link.classList.add("boie-mobile-backlink");
      }

      if (
        href.includes("doi.org") ||
        href.includes("zenodo") ||
        text.startsWith("doi")
      ) {
        link.classList.add("boie-mobile-doilink");
      }

      if (
        text.includes("support") ||
        href.includes("buymeacoffee") ||
        href.includes("github.com/sponsors")
      ) {
        link.classList.add("boie-mobile-supportlink");
      }
    });
  }

  classifyUtilityLinks();

  const observer = new MutationObserver(classifyUtilityLinks);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();



/* BOIE manual chorus controls */
(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installChorusControlButtons);
  } else {
    installChorusControlButtons();
  }

  window.addEventListener("load", installChorusControlButtons);
})();


/* BOIE exclusive individual bird audio */
(function () {
  function isBirdCardAudio(node) {
    return (
      node instanceof HTMLAudioElement &&
      Boolean(node.closest?.(".bird-card") || node.closest?.("#birdGrid"))
    );
  }

  function pauseAllBirdCardAudio(except = null) {
    document.querySelectorAll("#birdGrid audio, .bird-card audio").forEach(audio => {
      if (audio === except) return;

      try {
        if (!audio.paused) {
          audio.pause();
        }
        audio.currentTime = 0;
      } catch (error) {
        console.warn("Could not pause bird-card audio", error);
      }
    });
  }

  // Individual bird cards are mutually exclusive.
  document.addEventListener("play", event => {
    const audio = event.target;
    if (!isBirdCardAudio(audio)) return;

    // Individual bird playback should not overlap with a chorus mix.
    if (
      typeof stopChorusTogether === "function" &&
      typeof activeChorusPlayers !== "undefined" &&
      activeChorusPlayers.length
    ) {
      stopChorusTogether();
    }

    pauseAllBirdCardAudio(audio);
  }, true);

  // Chorus playback is the one permitted multi-audio mode.
  // Before starting it, stop any individual bird-card audio.
  if (typeof playChorusTogether === "function" && !playChorusTogether.__boieExclusiveAudioWrapped) {
    const originalPlayChorusTogether = playChorusTogether;

    playChorusTogether = function () {
      pauseAllBirdCardAudio();
      return originalPlayChorusTogether.apply(this, arguments);
    };

    playChorusTogether.__boieExclusiveAudioWrapped = true;
  }
})();


/* BOIE back to controls button */
(function () {
  function controlsTarget() {
    return (
      document.getElementById("birdControls") ||
      document.querySelector(".controls") ||
      document.querySelector(".nearby-panel") ||
      document.querySelector("main")
    );
  }

  function syncBackToControlsButton() {
    const button = document.getElementById("backToBirdControls");
    const target = controlsTarget();
    if (!button || !target) return;

    const rect = target.getBoundingClientRect();
    const shouldShow = rect.bottom < 0 || window.scrollY > 720;

    button.classList.toggle("is-visible", shouldShow);
    button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  function installBackToControlsButton() {
    const button = document.getElementById("backToBirdControls");
    if (!button || button.dataset.bound === "true") return;

    button.dataset.bound = "true";
    button.setAttribute("aria-hidden", "true");

    button.addEventListener("click", () => {
      const target = controlsTarget();
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      window.setTimeout(() => {
        const search =
          document.getElementById("searchUnified") ||
          document.getElementById("searchSelected") ||
          document.getElementById("search");

        if (search && window.matchMedia("(min-width: 761px)").matches) {
          search.focus({ preventScroll: true });
        }
      }, 420);
    });

    syncBackToControlsButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBackToControlsButton);
  } else {
    installBackToControlsButton();
  }

  window.addEventListener("load", syncBackToControlsButton);
  window.addEventListener("scroll", syncBackToControlsButton, { passive: true });
  window.addEventListener("resize", syncBackToControlsButton);
})();

