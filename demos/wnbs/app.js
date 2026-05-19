const state = {
  items: [],
  filtered: [],
  choices: JSON.parse(localStorage.getItem("nbsStoryRadarChoices") || "{}"),
  drafts: JSON.parse(localStorage.getItem("nbsStoryRadarDrafts") || "{}"),
  minScore: 0,
  query: "",
  angle: "all"
};

const $ = (id) => document.getElementById(id);
const cards = $("cards");
const template = $("cardTemplate");

function saveLocal() {
  localStorage.setItem("nbsStoryRadarChoices", JSON.stringify(state.choices));
  localStorage.setItem("nbsStoryRadarDrafts", JSON.stringify(state.drafts));
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 1700);
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function storyText(item) {
  return [
    item.title,
    item.summary,
    item.angle,
    item.ireland_relevance,
    item.nbs_relevance,
    item.water_relevance,
    item.practical_relevance,
    item.brand_fit,
    item.why_post,
    item.source_name,
    (item.tags || []).join(" ")
  ].join(" ");
}

function applyFilters() {
  const q = normalizeText(state.query).trim();
  state.filtered = state.items.filter(item => {
    const scorePass = Number(item.score || 0) >= state.minScore;
    const anglePass = state.angle === "all" || item.angle === state.angle;
    const queryPass = !q || normalizeText(storyText(item)).includes(q);
    return scorePass && anglePass && queryPass;
  });
  render();
}

function updateMetrics() {
  const selected = Object.values(state.choices).filter(v => v === "selected").length;
  $("candidateCount").textContent = state.items.length;
  $("excellentCount").textContent = state.items.filter(item => Number(item.score || 0) >= 85).length;
  $("selectedCount").textContent = selected;
}

function setChoice(id, choice) {
  if (state.choices[id] === choice) delete state.choices[id];
  else state.choices[id] = choice;
  saveLocal();
  render();
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
  toast("Copied");
}

function selectedItems() {
  return state.items.filter(item => state.choices[item.id] === "selected");
}

function draftFor(item) {
  return state.drafts[item.id] || item.linkedin_draft || "";
}

function selectedMarkdown() {
  const chosen = selectedItems();
  const today = new Date().toISOString().slice(0, 10);
  if (!chosen.length) return `# NbS Story Radar selected report · ${today}\n\nNo items selected yet.\n`;
  return `# NbS Story Radar selected report · ${today}\n\n${chosen.map((item, index) => {
    return `## ${index + 1}. ${item.title}\n\n` +
      `Source: ${item.source_name}\n\n` +
      `URL: ${item.url}\n\n` +
      `Score: ${item.score} · ${item.score_band || "candidate"}\n\n` +
      `Angle: ${item.angle}\n\n` +
      `Water value: ${item.water_relevance || item.nbs_relevance || "Check source for water hook."}\n\n` +
      `Practical value: ${item.practical_relevance || "Check source for implementation detail."}\n\n` +
      `Brand fit: ${item.brand_fit || "Review for practical water-quality fit."}\n\n` +
      `Why it matters: ${item.why_post}\n\n` +
      `LinkedIn draft:\n\n${draftFor(item)}\n`;
  }).join("\n---\n\n")}`;
}

function renderCard(item) {
  const node = template.content.cloneNode(true);
  const article = node.querySelector(".story-card");
  const choice = state.choices[item.id];
  if (choice) article.classList.add(choice);

  node.querySelector(".score").textContent = `${Math.round(Number(item.score || 0))}`;
  node.querySelector(".band").textContent = item.score_band || "candidate";
  node.querySelector(".source").textContent = item.source_name || item.source_id || "source";
  const title = node.querySelector(".title");
  title.textContent = item.title || "Untitled item";
  title.href = item.url || "#";
  node.querySelector(".summary").textContent = item.summary || "No summary available.";
  node.querySelector(".angle").textContent = item.angle || "Unclassified";
  node.querySelector(".ireland").textContent = item.ireland_relevance || "Ireland relevance not yet assessed.";
  node.querySelector(".water").textContent = item.water_relevance || item.nbs_relevance || "Water-quality or aquatic-ecology relevance not yet assessed.";
  node.querySelector(".practical").textContent = item.practical_relevance || "Practical implementation value not yet assessed.";
  node.querySelector(".brand").textContent = item.brand_fit || "Review for practical water-quality fit.";
  node.querySelector(".why").textContent = item.why_post || "Review before posting.";

  const tags = node.querySelector(".tags");
  (item.tags || []).slice(0, 8).forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tags.appendChild(span);
  });

  const draft = node.querySelector(".draft");
  draft.value = draftFor(item);
  draft.addEventListener("input", () => {
    state.drafts[item.id] = draft.value;
    saveLocal();
  });

  node.querySelector(".select-btn").textContent = choice === "selected" ? "Picked" : "Pick";
  node.querySelector(".watch-btn").textContent = choice === "watch" ? "Watching" : "Watch";
  node.querySelector(".reject-btn").textContent = choice === "reject" ? "Rejected" : "Reject";
  node.querySelector(".select-btn").addEventListener("click", () => setChoice(item.id, "selected"));
  node.querySelector(".watch-btn").addEventListener("click", () => setChoice(item.id, "watch"));
  node.querySelector(".reject-btn").addEventListener("click", () => setChoice(item.id, "reject"));
  node.querySelector(".copy-btn").addEventListener("click", () => copy(draft.value));
  return node;
}

function render() {
  cards.innerHTML = "";
  if (!state.filtered.length) {
    cards.innerHTML = `<article class="story-card"><h2>No matching stories</h2><p class="summary">Lower the score filter or broaden the search term.</p></article>`;
  } else {
    state.filtered.forEach(item => cards.appendChild(renderCard(item)));
  }
  updateMetrics();
}

function populateAngles() {
  const select = $("angleFilter");
  const angles = [...new Set(state.items.map(item => item.angle).filter(Boolean))].sort();
  angles.forEach(angle => {
    const option = document.createElement("option");
    option.value = angle;
    option.textContent = angle;
    select.appendChild(option);
  });
}

function bindControls() {
  $("searchInput").addEventListener("input", event => {
    state.query = event.target.value;
    applyFilters();
  });
  $("angleFilter").addEventListener("change", event => {
    state.angle = event.target.value;
    applyFilters();
  });
  $("scoreRange").addEventListener("input", event => {
    state.minScore = Number(event.target.value);
    $("scoreLabel").textContent = state.minScore;
    applyFilters();
  });
  $("copySelectedBtn").addEventListener("click", async () => {
    const text = selectedItems().map(item => `${item.title}\n${item.url}\n\n${draftFor(item)}`).join("\n\n---\n\n");
    if (!text) return toast("No selected items yet");
    await copy(text);
  });
  $("exportMarkdownBtn").addEventListener("click", async () => copy(selectedMarkdown()));
  $("clearLocalBtn").addEventListener("click", () => {
    state.choices = {};
    state.drafts = {};
    saveLocal();
    render();
    toast("Local choices cleared");
  });
}

async function init() {
  bindControls();
  try {
    const response = await fetch(`data/stories.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.items = (payload.items || []).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    state.filtered = state.items;
    populateAngles();
    $("statusPill").textContent = `Updated ${payload.generated_at ? new Date(payload.generated_at).toLocaleString() : "recently"}`;
    render();
  } catch (error) {
    $("statusPill").textContent = "Could not load radar data";
    cards.innerHTML = `<article class="story-card"><h2>Data load failed</h2><p class="summary">${error.message}</p></article>`;
  }
}

init();
