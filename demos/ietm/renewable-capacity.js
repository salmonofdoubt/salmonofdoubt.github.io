(() => {
  const DATA_URL = "data/source/renewable_capacity.json";
  const STYLE_ID = "ietm-renewable-capacity-style";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isNumber(value) {
    return Number.isFinite(Number(value));
  }

  function fmtMw(value) {
    const mw = Number(value);
    if (!Number.isFinite(mw)) return "n/a";

    if (Math.abs(mw) >= 1000) {
      return `${(mw / 1000).toLocaleString("en-IE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} GW`;
    }

    return `${mw.toLocaleString("en-IE", {
      maximumFractionDigits: 0
    })} MW`;
  }

  function fmtDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IE", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short"
    });
  }

  function technologyLabel(key) {
    return {
      battery_storage: "Battery storage",
      bioenergy: "Bioenergy",
      hydro: "Hydro",
      solar: "Solar",
      waste_to_energy: "Waste to energy",
      wave: "Wave",
      wind_onshore: "Onshore wind",
      wind_offshore: "Offshore wind",
      hybrid_renewable: "Hybrid renewable",
      hybrid_renewable_storage: "Hybrid + storage"
    }[key] || String(key || "Unknown").replaceAll("_", " ");
  }

  function statusLabel(key) {
    return {
      connected: "Connected / energised",
      contracted: "Contracted pipeline",
      awarded_support: "Support awarded",
      aggregate_observed: "Aggregate observed",
      removed_from_register_candidate: "Removed candidates"
    }[key] || String(key || "Unknown").replaceAll("_", " ");
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .renewable-buildout-section {
        position: relative;
      }

      .renewable-buildout-panel {
        overflow: hidden;
        border-color: rgba(91, 214, 160, 0.34);
        background:
          radial-gradient(circle at top right, rgba(91, 214, 160, 0.16), transparent 34%),
          rgba(8, 18, 27, 0.84);
      }

      .renewable-buildout-status {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .renewable-buildout-summary {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.9rem;
        margin-top: 1rem;
      }

      .renewable-buildout-card {
        min-width: 0;
        padding: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.045);
      }

      .renewable-buildout-card small,
      .renewable-buildout-tech small,
      .renewable-buildout-source small {
        display: block;
        color: var(--muted, #9fb3bd);
        font-size: 0.76rem;
        line-height: 1.35;
      }

      .renewable-buildout-card strong {
        display: block;
        margin-top: 0.3rem;
        color: var(--text, #ecf6f8);
        font-size: clamp(1.35rem, 3vw, 2rem);
        letter-spacing: -0.04em;
      }

      .renewable-buildout-card.connected strong {
        color: var(--green, #72e0a8);
      }

      .renewable-buildout-card.contracted strong {
        color: var(--yellow, #ffd166);
      }

      .renewable-buildout-card.aggregate_observed strong {
        color: var(--blue, #72d6ff);
      }

      .renewable-buildout-card.removed_from_register_candidate strong {
        color: var(--pink, #ff8fab);
      }

      .renewable-buildout-tech-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-top: 1rem;
      }

      .renewable-buildout-tech {
        padding: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 1rem;
        background: rgba(0, 0, 0, 0.18);
      }

      .renewable-buildout-tech h4,
      .renewable-buildout-method h4 {
        margin: 0 0 0.65rem;
        font-size: 0.96rem;
      }

      .renewable-buildout-row {
        display: grid;
        grid-template-columns: minmax(7rem, 1fr) minmax(8rem, 1.25fr) auto;
        align-items: center;
        gap: 0.75rem;
        margin: 0.58rem 0;
      }

      .renewable-buildout-row span:first-child {
        color: var(--muted, #9fb3bd);
        font-size: 0.86rem;
      }

      .renewable-buildout-row strong {
        color: var(--text, #ecf6f8);
        font-size: 0.9rem;
        white-space: nowrap;
      }

      .renewable-buildout-track {
        height: 0.55rem;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
      }

      .renewable-buildout-fill {
        display: block;
        height: 100%;
        width: var(--w, 0%);
        border-radius: inherit;
        background: linear-gradient(90deg, rgba(91, 214, 160, 0.55), rgba(114, 214, 255, 0.8));
      }

      .renewable-buildout-method {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255, 209, 102, 0.22);
        border-radius: 1rem;
        background: rgba(255, 209, 102, 0.06);
      }

      .renewable-buildout-method p {
        margin: 0.5rem 0 0;
      }

      .renewable-buildout-source {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 0.75rem;
        align-items: center;
        margin-top: 0.9rem;
      }

      .renewable-buildout-source a {
        color: inherit;
      }

      .renewable-buildout-error {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255, 143, 171, 0.28);
        border-radius: 1rem;
        background: rgba(255, 143, 171, 0.08);
      }

      @media (max-width: 980px) {
        .renewable-buildout-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .renewable-buildout-tech-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .renewable-buildout-summary {
          grid-template-columns: 1fr;
        }

        .renewable-buildout-row {
          grid-template-columns: 1fr auto;
        }

        .renewable-buildout-track {
          grid-column: 1 / -1;
          order: 3;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectNavLink() {
    const topbar = document.querySelector(".topbar");
    if (!topbar || topbar.querySelector('a[href="#renewable-buildout"]')) return;

    const link = document.createElement("a");
    link.href = "#renewable-buildout";
    link.textContent = "Build-out";

    const pressure = topbar.querySelector('a[href="#demand-pressure"]');
    if (pressure?.nextSibling) {
      topbar.insertBefore(link, pressure.nextSibling);
    } else {
      topbar.appendChild(link);
    }
  }

  function ensureSection() {
    let section = document.getElementById("renewable-buildout");
    if (section) return section;

    section = document.createElement("section");
    section.id = "renewable-buildout";
    section.className = "section renewable-buildout-section";
    section.innerHTML = `
      <div class="section-head">
        <p class="eyebrow">Capacity evidence</p>
        <h2>What renewable capacity is built and planned?</h2>
        <p>
          Official register evidence for connected, contracted and aggregate observed renewable capacity.
          These are capacity-register signals, not live generation values.
        </p>
        <p class="source-note-pill">
          Connected, contracted and aggregate observed MW are different evidence bases; do not add them without qualification.
        </p>
      </div>

      <article class="panel renewable-buildout-panel" aria-labelledby="renewable-buildout-title">
        <div class="panel-head">
          <div>
            <h3 id="renewable-buildout-title">Renewable build-out tracker</h3>
            <p class="panel-subtitle">Official grid and register evidence · conservative interpretation</p>
          </div>
          <span class="pill accent renewable-buildout-status" id="renewableCapacityStatus">Loading</span>
        </div>

        <div class="renewable-buildout-summary" id="renewableCapacitySummary"></div>
        <div class="renewable-buildout-tech-grid" id="renewableCapacityTechGrid"></div>
        <div class="renewable-buildout-method" id="renewableCapacityMethod"></div>
      </article>
    `;

    const truth = document.getElementById("truth-meter");
    if (truth?.parentElement) {
      truth.parentElement.insertBefore(section, truth);
    } else {
      document.querySelector("main")?.appendChild(section);
    }

    return section;
  }

  function technologyRows(title, rows) {
    const entries = Object.entries(rows || {})
      .filter(([, value]) => isNumber(value) && Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const max = Math.max(...entries.map(([, value]) => Number(value)), 1);

    if (!entries.length) {
      return `
        <article class="renewable-buildout-tech">
          <h4>${esc(title)}</h4>
          <small>No mapped technology rows in this category.</small>
        </article>
      `;
    }

    return `
      <article class="renewable-buildout-tech">
        <h4>${esc(title)}</h4>
        ${entries.map(([key, value]) => {
          const width = Math.max(4, Math.min(100, (Number(value) / max) * 100));
          return `
            <div class="renewable-buildout-row">
              <span>${esc(technologyLabel(key))}</span>
              <div class="renewable-buildout-track" aria-hidden="true">
                <i class="renewable-buildout-fill" style="--w:${width.toFixed(1)}%"></i>
              </div>
              <strong>${esc(fmtMw(value))}</strong>
            </div>
          `;
        }).join("")}
      </article>
    `;
  }

  function renderCapacity(data) {
    const summaryTarget = document.getElementById("renewableCapacitySummary");
    const techTarget = document.getElementById("renewableCapacityTechGrid");
    const methodTarget = document.getElementById("renewableCapacityMethod");
    const statusTarget = document.getElementById("renewableCapacityStatus");

    if (!summaryTarget || !techTarget || !methodTarget) return;

    const meta = data.meta || {};
    const summary = data.summary || {};
    const totals = summary.totals_by_status_mw || {};
    const byTech = summary.by_status_and_technology_mw || {};
    const recordCount = summary.record_count ?? (data.projects || []).length;
    const errors = Number(meta.error_count || 0);

    if (statusTarget) {
      statusTarget.textContent = errors > 0 ? `${errors} source issue${errors === 1 ? "" : "s"}` : "Live evidence";
      statusTarget.classList.toggle("warning", errors > 0);
      statusTarget.classList.toggle("accent", errors === 0);
    }

    const cards = [
      ["connected", "Connected", "Energised or connected official-register capacity"],
      ["contracted", "Contracted", "Projects with grid-contract evidence"],
      ["awarded_support", "Support awarded", "RESS/ORESS rows once award parsing is wired"],
      ["aggregate_observed", "Aggregate observed", "System-summary capacity, separate basis"],
      ["removed_from_register_candidate", "Removed candidates", "Not proof of decommissioning"]
    ];

    summaryTarget.innerHTML = cards.map(([key, label, note]) => `
      <article class="renewable-buildout-card ${esc(key)}">
        <small>${esc(label)}</small>
        <strong>${esc(fmtMw(totals[key] || 0))}</strong>
        <small>${esc(note)}</small>
      </article>
    `).join("");

    techTarget.innerHTML = [
      technologyRows("Connected / energised by technology", byTech.connected || {}),
      technologyRows("Contracted pipeline by technology", byTech.contracted || {})
    ].join("");

    methodTarget.innerHTML = `
      <h4>How to read this</h4>
      <p>
        The tracker has <strong>${esc(recordCount)}</strong> harvested project/register rows from
        <strong>${esc(meta.successful_source_count || 0)}</strong> successfully loaded source layers.
        Last generated: <strong>${esc(fmtDate(meta.generated_at))}</strong>.
      </p>
      <p>
        ${esc(meta.caveat || summary.warning || "Capacity bases differ. Connected, contracted, auction and aggregate values should not be added without qualification.")}
      </p>
      <div class="renewable-buildout-source">
        <small>Data file:</small>
        <a href="${esc(DATA_URL)}" target="_blank" rel="noopener noreferrer">renewable_capacity.json</a>
        <small>Audit:</small>
        <a href="data/source/renewable_capacity_audit.json" target="_blank" rel="noopener noreferrer">renewable_capacity_audit.json</a>
      </div>
    `;
  }

  function renderError(error) {
    const section = ensureSection();
    const panel = section.querySelector(".renewable-buildout-panel");
    if (!panel) return;

    panel.insertAdjacentHTML("beforeend", `
      <div class="renewable-buildout-error">
        <strong>Capacity tracker unavailable</strong>
        <p>${esc(error?.message || error)}</p>
      </div>
    `);

    const statusTarget = document.getElementById("renewableCapacityStatus");
    if (statusTarget) statusTarget.textContent = "Unavailable";
  }

  async function init() {
    injectStyle();
    injectNavLink();
    ensureSection();

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
      const data = await response.json();
      renderCapacity(data);
    } catch (error) {
      console.error("Renewable capacity tracker failed", error);
      renderError(error);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
