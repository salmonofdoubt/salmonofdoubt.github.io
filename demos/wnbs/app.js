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

function formatSourceDate(itemOrValue) {
  const value = typeof itemOrValue === "string" ? itemOrValue : itemOrValue?.published;
  if (!value) return "n.d.";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function storySourceCitation(item) {
  const publisher = item.source_name || item.source_id || "Source";
  const date = formatSourceDate(item);
  const title = item.title || "Untitled item";
  const url = item.url || "";
  return `${publisher}. (${date}). ${title}.\n${url}`.trim();
}

function finalPostFor(item) {
  const base = draftFor(item).trim();
  const citation = storySourceCitation(item);
  const url = String(item.url || "").trim();

  if (!base) return `Source:\n${citation}`;

  const alreadyHasSourceBlock = /(^|\n)\s*Source\s*:/i.test(base);
  const alreadyHasUrl = url && base.includes(url);

  if (alreadyHasSourceBlock || alreadyHasUrl) return base;

  return `${base}\n\nSource:\n${citation}`;
}


function formatDate(value) {
  if (!value) return "Date unknown";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function freshnessText(item) {
  const parts = [];
  if (item.published) parts.push(`Published ${formatDate(item.published)}`);
  if (Number.isFinite(Number(item.age_days))) parts.push(`${item.age_days} days old`);
  if (item.freshness_note) parts.push(item.freshness_note);
  return parts.join(" · ") || "Date not detected. Verify before posting.";
}

function sourceCitation(item) {
  const source = item.source_name || item.source_id || "Source";
  const date = item.published ? formatDate(item.published) : "n.d.";
  return `${source}. (${date}). ${item.title || "Untitled item"}.\n${item.url || ""}`.trim();
}

function postPackFor(item) {
  const post = draftFor(item).trim();
  return [
    "LINKEDIN POST TEXT",
    post,
    "",
    "SOURCE TO PASTE FOR LINK PREVIEW",
    item.url || "",
    "",
    "SOURCE CITATION",
    sourceCitation(item),
    "",
    "CURATION NOTES",
    `Freshness: ${freshnessText(item)}`,
    `Water value: ${item.water_relevance || "Check source."}`,
    `Practical value: ${item.practical_relevance || "Check source."}`,
    `Brand fit: ${item.brand_fit || "Check source."}`,
    "",
    "LINKEDIN USE",
    "Paste the post text first. Then paste the source URL on its own line and wait for LinkedIn to create a preview. If the preview is weak or absent, use the downloaded insight-card image and keep the source URL in the post or first comment."
  ].join("\n");
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function downloadInsightCard(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f6f8f3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e9f2e5";
  ctx.fillRect(0, 0, canvas.width, 120);
  ctx.fillStyle = "#356b3f";
  ctx.fillRect(0, 0, 18, canvas.height);

  ctx.fillStyle = "#0f6b7a";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("Water NbS Signal · Ireland", 70, 72);

  ctx.fillStyle = "#122015";
  ctx.font = "800 48px system-ui, sans-serif";
  let y = wrapCanvasText(ctx, item.title || "Practical water-quality story", 70, 180, 1030, 58, 3);

  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillStyle = "#356b3f";
  ctx.fillText("Measure", 70, y + 36);
  ctx.fillText("Water outcome", 70, y + 126);
  ctx.fillText("Monitoring question", 70, y + 216);

  ctx.font = "24px system-ui, sans-serif";
  ctx.fillStyle = "#122015";
  wrapCanvasText(ctx, item.angle || "Practical Water NbS opportunity", 310, y + 36, 780, 32, 2);
  wrapCanvasText(ctx, item.water_relevance || "Surface-water quality or aquatic-ecology value to verify.", 310, y + 126, 780, 32, 2);
  wrapCanvasText(ctx, "What pressure is reduced, where in the catchment, and how will improvement be measured?", 310, y + 216, 780, 32, 2);

  ctx.font = "20px system-ui, sans-serif";
  ctx.fillStyle = "#61705f";
  ctx.fillText(`${item.source_name || "Source"} · ${formatDate(item.published)}`, 70, 620);
  ctx.fillText("salmonofdoubt.github.io/demos/wnbs", 760, 620);

  const link = document.createElement("a");
  link.download = `${(item.id || "water-nbs-signal")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("Insight card downloaded");
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
      `Freshness: ${freshnessText(item)}\n\n` +
      `Water value: ${item.water_relevance || item.nbs_relevance || "Check source for water hook."}\n\n` +
      `Practical value: ${item.practical_relevance || "Check source for implementation detail."}\n\n` +
      `Brand fit: ${item.brand_fit || "Review for practical water-quality fit."}\n\n` +
      `Why it matters: ${item.why_post}\n\n` +
      `Source citation:\n\n${sourceCitation(item)}\n\n` +
      `LinkedIn post pack:\n\n${postPackFor(item)}\n`;
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
  const freshness = node.querySelector(".freshness");
  freshness.textContent = freshnessText(item);
  if (["stale", "stale_call", "unknown"].includes(item.freshness_status)) freshness.classList.add("stale-note");

  const tags = node.querySelector(".tags");
  (item.tags || []).slice(0, 8).forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tags.appendChild(span);
  });

  const draft = node.querySelector(".draft");
  draft.value = finalPostFor(item);
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
  node.querySelector(".copy-btn").addEventListener("click", () => copy(finalPostFor(item)));
  node.querySelector(".source-btn").addEventListener("click", () => copy(item.url || ""));
  node.querySelector(".pack-btn").addEventListener("click", () => copy(postPackFor(item)));
  node.querySelector(".image-btn").addEventListener("click", () => downloadInsightCard(item));
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
    const text = selectedItems().map(item => postPackFor(item)).join("\n\n====\n\n");
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
