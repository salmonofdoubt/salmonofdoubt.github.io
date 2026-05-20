const state = {
  birds: [],
  filtered: []
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
  shuffle: document.getElementById("shuffleSound")
};

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
  return Boolean(bird.image && (bird.image.thumb || bird.image.url));
}

function renderImage(bird) {
  if (!hasImage(bird)) {
    return `<div class="image-placeholder">No image matched yet</div>`;
  }

  const image = bird.image;
  const src = image.thumb || image.url;
  const page = image.url || "#";
  const artist = image.artist || "Unknown photographer";
  const licence = image.license || "Licence not parsed";
  const source = image.source || "Wikimedia Commons";

  return `
    <img src="${src}" alt="${bird.common_name || 'Bird'}" loading="lazy" />
    <p class="image-credit">
      Image: <a href="${page}" target="_blank" rel="noopener">${source}</a>. ${artist}. ${licence}.
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

function renderBadges(bird) {
  const codes = bird.status_codes || [];
  const parts = codes.map(code => {
    const klass = code === "R" ? "rare" : code === "B" ? "historical" : "";
    return `<span class="badge ${klass}">${code}</span>`;
  });

  if (hasAudio(bird)) {
    parts.push(`<span class="badge">Sound</span>`);
    const q = bird.audio.q ? String(bird.audio.q).toUpperCase() : "";
    if (q) parts.push(`<span class="badge">Q ${q}</span>`);
  } else {
    parts.push(`<span class="badge missing">No sound</span>`);
  }

  return parts.join("");
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

  birds.sort((a, b) => {
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
    node.querySelector(".sound-block").innerHTML = renderSound(bird);
    node.querySelector(".group").textContent = bird.group || "Unspecified";
    node.querySelector(".status-text").textContent = statusText(bird.status_codes);
    els.grid.appendChild(node);
  });

  els.notice.textContent = `${birds.length.toLocaleString()} of ${state.birds.length.toLocaleString()} species currently displayed.`;
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

async function init() {
  try {
    const response = await fetch("./data/birds.json?v=" + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.birds = Array.isArray(payload.birds) ? payload.birds : [];
    updateStats(payload);
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

[els.search, els.status, els.sound, els.sort].forEach(el => {
  el.addEventListener("input", render);
  el.addEventListener("change", render);
});

els.shuffle.addEventListener("click", playRandomBird);

init();
