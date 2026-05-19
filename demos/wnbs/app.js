const state = {
  stories: [],
  selected: new Set(),
  drafts: new Map(),
};

const els = {
  stories: document.getElementById("stories"),
  summary: document.getElementById("summary"),
  search: document.getElementById("searchInput"),
  status: document.getElementById("statusFilter"),
  copySelected: document.getElementById("copySelectedBtn"),
  toast: document.getElementById("toast"),
};

function clean(value, fallback = "") {
  return String(value || fallback)
    .replace(/Strong water-quality\/ecology signal detected\.\s*/gi, "")
    .replace(/Evidence terms:\s*/gi, "")
    .replace(/\bundefined\b/gi, "")
    .replace(/,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "n.d.";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function freshnessClass(item) {
  const value = String(item.freshness_status || "").toLowerCase();
  if (["fresh", "current"].includes(value)) return "fresh";
  if (["strategic", "unknown"].includes(value)) return "strategic";
  if (["stale", "stale_call", "archive"].includes(value)) return "stale";
  return Number(item.age_days) > 90 ? "stale" : "fresh";
}

function freshnessLabel(item) {
  const cls = freshnessClass(item);
  if (cls === "fresh") return item.freshness_note || "Fresh or current";
  if (cls === "strategic") return item.freshness_note || "Strategic or background";
  return item.freshness_note || "Stale or archive. Verify before posting.";
}

function sourceCitation(item) {
  const publisher = clean(item.source_name || item.source_id, "Source");
  const date = formatDate(item.published);
  const title = clean(item.title, "Untitled item");
  const url = clean(item.url, "");
  return `${publisher}. (${date}). ${title}.\n${url}`.trim();
}

function inferInsight(item) {
  const text = `${item.title || ""} ${item.summary || ""} ${item.water_relevance || ""} ${item.angle || ""}`.toLowerCase();

  if (/fish|spawning|passage|barrier|salmon|trout|eel/.test(text)) {
    return "Connects river restoration with fish movement, spawning habitat, and aquatic ecological recovery.";
  }
  if (/wetland|pond|constructed wetland|integrated constructed wetland/.test(text)) {
    return "Shows how wetlands and ponds can slow, filter, and treat water before it reaches receiving waters.";
  }
  if (/suds|stormwater|rainwater|urban runoff|blue green|blue-green/.test(text)) {
    return "Links urban runoff management with cleaner water, slower flow, and more resilient blue-green infrastructure.";
  }
  if (/riparian|buffer|fencing|riverbank|bank erosion|livestock|stock/.test(text)) {
    return "Targets the land-water edge where sediment, nutrients, livestock pressure, and habitat condition meet.";
  }
  if (/peat|rewet|bog|drain|hydrology/.test(text)) {
    return "Links hydrological restoration with downstream water conditions, flow regulation, and habitat recovery.";
  }
  return "A practical signal where land management, water quality, ecology, and biodiversity need to be judged together.";
}

function defaultPost(item) {
  const title = clean(item.title, "Practical Water NbS signal");
  const take = clean(item.brand_fit || item.why_post || inferInsight(item));
  const citation = sourceCitation(item);

  return `A practical Water NbS signal for Ireland.

${title}

This caught my attention because it connects land management with what ultimately matters in a catchment: cleaner surface water, healthier aquatic ecology, and better conditions for water-related biodiversity.

For me, the useful question is not simply whether a project is green or nature-based. The useful question is whether it changes a pressure pathway.

What I would look for:
• pressure reduced: nutrients, sediment, runoff, hydromorphological alteration, or habitat fragmentation
• catchment position: source area, pathway, riparian zone, floodplain, wetland, drain, stream, or receiving water
• practical intervention: buffer, wetland, pond, SuDS feature, peatland rewetting, river restoration, fencing, planting, or flow attenuation
• monitoring evidence: chemistry, sediment, flow, macroinvertebrates, fish, habitat condition, or ecological status
• repeatability: whether this can be maintained and applied elsewhere in Ireland

My take: ${take}

This is where Nature-based Solutions become serious: not as decorative greening, but as practical catchment infrastructure that supports water quality, ecology, and biodiversity.

Source:
${citation}

#NatureBasedSolutions #WaterQuality #FreshwaterEcology #Biodiversity #Ireland #CatchmentManagement`;
}

function postFor(item) {
  return state.drafts.get(item.id) || defaultPost(item);
}

function postPackFor(item) {
  return [
    "LINKEDIN POST TEXT",
    postFor(item),
    "",
    "SOURCE URL",
    clean(item.url, ""),
    "",
    "SOURCE CITATION",
    sourceCitation(item),
    "",
    "INSIGHT CARD",
    "Use the image preview shown in the WNBS story card, or click it to download the PNG.",
  ].join("\n");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("Copied");
  }
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
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

  lines.slice(0, maxLines).forEach((entry, index) => {
    ctx.fillText(entry, x, y + index * lineHeight);
  });

  return y + Math.max(lines.length, 1) * lineHeight;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function buildInsightCardCanvas(item) {
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

  const title = clean(item.title, "Practical Water NbS signal");
  const source = clean(item.source_name || item.source_id, "Source");
  const date = formatDate(item.published);
  const insight = inferInsight(item);

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
  roundRect(ctx, 72, 215, 372, 60, 30);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 25px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Practical catchment signal", 100, 253);

  let titleFont = 66;
  if (title.length > 90) titleFont = 58;
  if (title.length > 135) titleFont = 50;

  ctx.fillStyle = ink;
  ctx.font = `950 ${titleFont}px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  const titleEnd = drawWrapped(ctx, title, 72, 380, 1040, titleFont + 10, 5);

  const panelY = Math.max(titleEnd + 70, 690);

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 72, panelY, 1056, 250, 34);
  ctx.fill();

  ctx.fillStyle = green;
  ctx.font = "900 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("Why this matters", 112, panelY + 62);

  ctx.fillStyle = ink;
  ctx.font = "650 38px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  drawWrapped(ctx, insight, 112, panelY + 125, 960, 47, 3);

  ctx.fillStyle = "#edf4e9";
  roundRect(ctx, 72, 980, 1056, 95, 28);
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

  return canvas;
}

function downloadInsightCard(item) {
  const link = document.createElement("a");
  const safeId = String(item.id || "water-nbs-signal").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  link.download = `${safeId}.png`;
  link.href = buildInsightCardCanvas(item).toDataURL("image/png");
  link.click();
  toast("PNG downloaded");
}

function renderSummary(stories) {
  const fresh = stories.filter((item) => freshnessClass(item) === "fresh").length;
  const strategic = stories.filter((item) => freshnessClass(item) === "strategic").length;
  const stale = stories.filter((item) => freshnessClass(item) === "stale").length;

  els.summary.innerHTML = `
    <div class="summary-pill">${stories.length} visible stories</div>
    <div class="summary-pill">${fresh} fresh/current</div>
    <div class="summary-pill">${strategic} strategic/background</div>
    <div class="summary-pill">${stale} stale/archive</div>
  `;
}

function visibleStories() {
  const q = clean(els.search.value).toLowerCase();
  const filter = els.status.value;

  return state.stories.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.source_name,
      item.water_relevance,
      item.practical_relevance,
      item.brand_fit,
      item.why_post,
      item.angle,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ].join(" ").toLowerCase();

    const matchesSearch = !q || haystack.includes(q);
    const matchesStatus = filter === "all" || freshnessClass(item) === filter;
    return matchesSearch && matchesStatus;
  });
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "story-card";

  const freshClass = freshnessClass(item);
  const score = Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : "n/a";
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 5) : [];

  card.innerHTML = `
    <div class="story-col">
      <h2 class="story-title">${escapeHtml(clean(item.title, "Untitled story"))}</h2>

      <div class="meta">
        <span class="chip score">Score ${escapeHtml(score)}</span>
        <span class="chip ${freshClass === "stale" ? "warn" : ""}">${escapeHtml(freshnessLabel(item))}</span>
        <span class="chip">${escapeHtml(clean(item.source_name || item.source_id, "Source"))}</span>
        <span class="chip">${escapeHtml(formatDate(item.published))}</span>
      </div>

      <p class="story-summary">${escapeHtml(clean(item.summary, "Open the source and verify the practical water-quality hook before posting."))}</p>

      <dl>
        <div>
          <dt>Water value</dt>
          <dd>${escapeHtml(clean(item.water_relevance || item.nbs_relevance, "Check the source for the water-quality or ecology value."))}</dd>
        </div>
        <div>
          <dt>Practical value</dt>
          <dd>${escapeHtml(clean(item.practical_relevance, "Check implementation details before posting."))}</dd>
        </div>
        <div>
          <dt>Brand fit</dt>
          <dd>${escapeHtml(clean(item.brand_fit || item.why_post, inferInsight(item)))}</dd>
        </div>
      </dl>

      <div class="meta">
        ${tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
      </div>

      <div class="source-row">
        <a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener">Open source</a>
        <button type="button" class="copy-source">Copy source URL</button>
      </div>

      <label class="select-row">
        <input type="checkbox" class="select-story" />
        Include in selected post packs
      </label>
    </div>

    <div class="post-col">
      <label class="draft-label">LinkedIn post draft</label>
      <textarea class="draft"></textarea>

      <div class="actions">
        <button type="button" class="copy-post primary">Copy post</button>
        <button type="button" class="copy-pack">Copy post pack</button>
        <button type="button" class="download-card">Download PNG</button>
      </div>

      <div class="insight-preview-block">
        <div class="insight-preview-title">Insight card preview</div>
        <img class="insight-preview" alt="Insight card preview" />
        <div class="insight-preview-note">Click the image to download the full PNG.</div>
      </div>
    </div>
  `;

  const draft = card.querySelector(".draft");
  draft.value = postFor(item);
  draft.addEventListener("input", () => state.drafts.set(item.id, draft.value));

  const checkbox = card.querySelector(".select-story");
  checkbox.checked = state.selected.has(item.id);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) state.selected.add(item.id);
    else state.selected.delete(item.id);
  });

  card.querySelector(".copy-source").addEventListener("click", () => copyText(clean(item.url, "")));
  card.querySelector(".copy-post").addEventListener("click", () => copyText(draft.value));
  card.querySelector(".copy-pack").addEventListener("click", () => copyText(postPackFor(item)));
  card.querySelector(".download-card").addEventListener("click", () => downloadInsightCard(item));

  const preview = card.querySelector(".insight-preview");
  preview.src = buildInsightCardCanvas(item).toDataURL("image/png");
  preview.addEventListener("click", () => downloadInsightCard(item));

  return card;
}

function render() {
  const stories = visibleStories();
  renderSummary(stories);
  els.stories.innerHTML = "";

  if (!stories.length) {
    els.stories.innerHTML = `<div class="empty">No stories match this filter.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  stories.forEach((item) => fragment.appendChild(renderCard(item)));
  els.stories.appendChild(fragment);
}

async function loadStories() {
  els.stories.innerHTML = `<div class="empty">Loading Water NbS stories...</div>`;

  try {
    const response = await fetch(`data/stories.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();

    const rawStories = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.stories)
        ? payload.stories
        : Array.isArray(payload.items)
          ? payload.items
          : [];

    state.stories = rawStories
      .map((item, index) => ({
        ...item,
        id: item.id || `story-${index + 1}`,
      }))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    render();
  } catch (error) {
    console.error(error);
    els.stories.innerHTML = `<div class="empty">Could not load data/stories.json. Run the discovery script or check the file path.</div>`;
  }
}

els.search.addEventListener("input", render);
els.status.addEventListener("change", render);

els.copySelected.addEventListener("click", () => {
  const selected = state.stories.filter((item) => state.selected.has(item.id));
  if (!selected.length) {
    toast("No stories selected");
    return;
  }
  copyText(selected.map(postPackFor).join("\n\n====================\n\n"));
});

loadStories();
