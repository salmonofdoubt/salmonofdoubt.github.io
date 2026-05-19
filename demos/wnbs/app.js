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

function cardDate(item) {
  const value = item?.published;
  if (!value) return "n.d.";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function cleanCardText(value, fallback = "Source-led evidence to review") {
  let text = String(value || fallback)
    .replace(/Strong water-quality\/ecology signal detected\.\s*/gi, "")
    .replace(/Evidence terms:\s*/gi, "")
    .replace(/\bundefined\b/gi, "")
    .replace(/,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function classifyCardStory(item) {
  const text = `${item?.title || ""} ${item?.summary || ""} ${item?.water_relevance || ""} ${item?.angle || ""}`.toLowerCase();

  if (/fish|spawning|passage|barrier|salmon|trout|eel|river habitat/.test(text)) {
    return {
      measure: "River habitat restoration",
      pressure: "Fragmented habitat and restricted ecological movement",
      outcome: "Improved fish passage, spawning habitat, and aquatic connectivity",
      monitoring: "Fish movement, spawning success, habitat condition, and ecological status"
    };
  }

  if (/wetland|integrated constructed wetland|constructed wetland|pond/.test(text)) {
    return {
      measure: "Wetland or pond-based treatment",
      pressure: "Nutrient, sediment, and runoff pressure",
      outcome: "Slower flow, better filtration, and improved receiving-water condition",
      monitoring: "Nutrients, sediment, flow, vegetation condition, and aquatic ecology"
    };
  }

  if (/suds|rainwater|stormwater|urban runoff|blue green|blue-green/.test(text)) {
    return {
      measure: "Urban SuDS or rainwater management",
      pressure: "Fast runoff and pollutant wash-off from hard surfaces",
      outcome: "Reduced runoff pressure and improved urban water quality",
      monitoring: "Runoff volume, peak flow, sediment, nutrients, and receiving-water response"
    };
  }

  if (/riparian|buffer|fencing|stock|livestock|riverbank|stream bank|bank erosion/.test(text)) {
    return {
      measure: "Riparian buffer or riverbank protection",
      pressure: "Bank erosion, sediment delivery, and direct channel pressure",
      outcome: "Lower sediment pressure and improved riparian habitat condition",
      monitoring: "Bank stability, sediment, vegetation recovery, and macroinvertebrates"
    };
  }

  if (/peat|rewet|bog|drain blocking|hydrology/.test(text)) {
    return {
      measure: "Peatland hydrological restoration",
      pressure: "Drainage-driven runoff, carbon loss, and water-colour pressure",
      outcome: "Re-wetted peat, moderated runoff, and improved downstream conditions",
      monitoring: "Water table, flow response, DOC, nutrients, and habitat recovery"
    };
  }

  return {
    measure: cleanCardText(item?.angle || "Practical water-related NbS measure"),
    pressure: "Surface-water pressure pathway to verify from source",
    outcome: cleanCardText(item?.water_relevance || "Potential water-quality, aquatic-ecology, or biodiversity benefit"),
    monitoring: "Pressure reduced, catchment position, maintenance, and measured ecological response"
  };
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  lines.slice(0, maxLines).forEach((entry, index) => {
    ctx.fillText(entry, x, y + index * lineHeight);
  });

  return y + Math.max(lines.length, 1) * lineHeight;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawSection(ctx, label, value, x, y, w, h) {
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 28);
  ctx.fill();

  ctx.fillStyle = "#e8f1e3";
  roundRect(ctx, x + 26, y + 26, 68, 68, 22);
  ctx.fill();

  ctx.fillStyle = "#356b3f";
  ctx.font = "900 25px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(label, x + 118, y + 55);

  ctx.fillStyle = "#102016";
  ctx.font = "600 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  drawWrapped(ctx, value, x + 118, y + 105, w - 160, 42, 3);
}

function downloadInsightCard(item) {
  const model = classifyCardStory(item);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  const bg = "#f5f8f2";
  const header = "#e6f0e1";
  const ink = "#102016";
  const teal = "#0f6b7a";
  const green = "#356b3f";
  const muted = "#607061";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = header;
  ctx.fillRect(0, 0, canvas.width, 150);

  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, 22, canvas.height);

  ctx.fillStyle = teal;
  ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Water NbS Signal · Ireland", 62, 92);

  ctx.fillStyle = green;
  roundRect(ctx, 62, 185, 310, 58, 29);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 26px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Practical catchment signal", 88, 224);

  ctx.fillStyle = ink;
  ctx.font = "950 58px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const title = cleanCardText(item?.title || "Practical water-quality story");
  const titleEnd = drawWrapped(ctx, title, 62, 335, 955, 68, 4);

  const start = Math.max(650, titleEnd + 42);
  const w = 956;
  const x = 62;

  drawSection(ctx, "Measure", model.measure, x, start, w, 178);
  drawSection(ctx, "Pressure pathway", model.pressure, x, start + 205, w, 178);
  drawSection(ctx, "Water outcome", model.outcome, x, start + 410, w, 178);
  drawSection(ctx, "Monitor", model.monitoring, x, start + 615, w, 178);

  ctx.fillStyle = muted;
  ctx.font = "600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

  const source = cleanCardText(item?.source_name || item?.source_id || "Source");
  const footer1 = `${source} · ${cardDate(item)}`;
  const footer2 = "salmonofdoubt.github.io/demos/wnbs";

  ctx.fillText(footer1, 62, 1282);
  const width2 = ctx.measureText(footer2).width;
  ctx.fillText(footer2, canvas.width - width2 - 62, 1282);

  const link = document.createElement("a");
  const safeId = String(item?.id || "water-nbs-signal").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  link.download = `${safeId}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("Insight card downloaded");
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


// --- WNBS CLEAN LINKEDIN CARD OVERRIDE START ---
function downloadInsightCard(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");

  const bg = "#f6f8f3";
  const band = "#e6f0e1";
  const ink = "#102016";
  const teal = "#0f6b7a";
  const green = "#356b3f";
  const muted = "#5e6d60";
  const white = "#ffffff";

  function clean(value, fallback = "") {
    return String(value || fallback)
      .replace(/Strong water-quality\/ecology signal detected\.\s*/gi, "")
      .replace(/Evidence terms:\s*/gi, "")
      .replace(/\bundefined\b/gi, "")
      .replace(/,\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sourceDate(value) {
    if (!value) return "n.d.";
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function wrap(text, x, y, maxWidth, lineHeight, maxLines) {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }

    if (line && lines.length < maxLines) lines.push(line);

    lines.slice(0, maxLines).forEach((entry, i) => {
      ctx.fillText(entry, x, y + i * lineHeight);
    });

    return y + Math.max(lines.length, 1) * lineHeight;
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function inferInsight() {
    const text = `${item?.title || ""} ${item?.summary || ""} ${item?.water_relevance || ""} ${item?.angle || ""}`.toLowerCase();

    if (/fish|spawning|passage|barrier|salmon|trout|eel/.test(text)) {
      return "Connects river restoration with fish movement, spawning habitat, and aquatic ecological recovery.";
    }

    if (/wetland|pond|constructed wetland/.test(text)) {
      return "Shows how wetlands and ponds can slow, filter, and treat water before it reaches receiving waters.";
    }

    if (/suds|stormwater|rainwater|urban runoff/.test(text)) {
      return "Links urban runoff management with cleaner water, slower flow, and more resilient blue-green infrastructure.";
    }

    if (/riparian|buffer|fencing|bank|erosion/.test(text)) {
      return "Targets the land-water edge where sediment, nutrients, livestock pressure, and habitat condition meet.";
    }

    if (/peat|rewet|bog|drain/.test(text)) {
      return "Links hydrological restoration with downstream water conditions, flow regulation, and habitat recovery.";
    }

    return "A practical signal where land management, water quality, ecology, and biodiversity need to be judged together.";
  }

  const title = clean(item?.title, "Practical Water NbS signal");
  const source = clean(item?.source_name || item?.source_id, "Source");
  const date = sourceDate(item?.published);
  const insight = inferInsight();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 1200);

  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, 28, 1200);

  ctx.fillStyle = band;
  ctx.fillRect(28, 0, 1172, 170);

  ctx.fillStyle = teal;
  ctx.font = "900 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Water NbS Signal · Ireland", 72, 98);

  ctx.fillStyle = green;
  roundRect(72, 215, 372, 60, 30);
  ctx.fill();

  ctx.fillStyle = white;
  ctx.font = "900 25px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Practical catchment signal", 100, 253);

  let titleFont = 66;
  if (title.length > 90) titleFont = 58;
  if (title.length > 135) titleFont = 50;

  ctx.fillStyle = ink;
  ctx.font = `950 ${titleFont}px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  const titleEnd = wrap(title, 72, 380, 1040, titleFont + 10, 5);

  const panelY = Math.max(titleEnd + 70, 690);

  ctx.fillStyle = white;
  roundRect(72, panelY, 1056, 250, 34);
  ctx.fill();

  ctx.fillStyle = green;
  ctx.font = "900 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Why this matters", 112, panelY + 62);

  ctx.fillStyle = ink;
  ctx.font = "650 38px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  wrap(insight, 112, panelY + 125, 960, 47, 3);

  ctx.fillStyle = "#edf4e9";
  roundRect(72, 980, 1056, 95, 28);
  ctx.fill();

  ctx.fillStyle = green;
  ctx.font = "900 26px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Practical question", 112, 1018);

  ctx.fillStyle = ink;
  ctx.font = "650 29px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("What pressure is reduced, where, and how is improvement measured?", 112, 1058);

  ctx.fillStyle = muted;
  ctx.font = "650 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(`${source} · ${date}`, 72, 1145);

  const footer = "salmonofdoubt.github.io/demos/wnbs";
  const footerWidth = ctx.measureText(footer).width;
  ctx.fillText(footer, 1200 - footerWidth - 72, 1145);

  const link = document.createElement("a");
  const safeId = String(item?.id || "water-nbs-signal").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  link.download = `${safeId}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();

  if (typeof toast === "function") toast("Clean LinkedIn card downloaded");
}
// --- WNBS CLEAN LINKEDIN CARD OVERRIDE END ---

