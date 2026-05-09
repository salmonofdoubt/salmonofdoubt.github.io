from pathlib import Path
import datetime
import re

html_path = Path("demos/intelligence/index.html")
css_path = Path("demos/intelligence/styles.css")
js_path = Path("demos/intelligence/app.js")

for p in (html_path, css_path, js_path):
    if not p.exists():
        raise SystemExit(f"Missing {p}. Run this from the repo root.")

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
for p in (html_path, css_path, js_path):
    p.with_suffix(p.suffix + f".bak-{stamp}").write_text(p.read_text(encoding="utf-8"), encoding="utf-8")

html = html_path.read_text(encoding="utf-8")

toggle_block = '''
        <div class="toggle-stack" aria-label="Visual layers">
          <label class="toggle-row" for="showLandingBars">
            <input id="showLandingBars" type="checkbox" checked />
            <span>Show landing bars</span>
          </label>
          <label class="toggle-row" for="showMaturityHalos">
            <input id="showMaturityHalos" type="checkbox" checked />
            <span>Show maturity halos</span>
          </label>
          <label class="toggle-row" for="showTheoryDiagnostics">
            <input id="showTheoryDiagnostics" type="checkbox" checked />
            <span>Show theory diagnostics</span>
          </label>
        </div>
'''

if 'id="showTheoryDiagnostics"' not in html:
    html = re.sub(
        r'(\s*<label for="colourMode">Colour points by</label>\s*<select id="colourMode">.*?</select>)',
        r'\1\n' + toggle_block,
        html,
        count=1,
        flags=re.S
    )

theory_section = '''
    <section id="theory-layer" class="section theory-layer">
      <div class="panel theory-panel">
        <span class="eyebrow">Planetary intelligence layer</span>
        <h2>From technosphere to mature technosphere</h2>
        <p class="section-intro">
          This layer interprets the 3D model as a transition problem. A society may have strong human capability
          and sophisticated institutions while still remaining planetarily immature if it cannot sense Earth-system
          feedbacks and adapt behaviour within ecological limits.
        </p>

        <div class="transition-steps" aria-label="Planetary intelligence transition sequence">
          <div class="transition-step">Geosphere</div>
          <div class="transition-step">Immature biosphere</div>
          <div class="transition-step">Mature biosphere</div>
          <div class="transition-step active">Immature technosphere</div>
          <div class="transition-step">Mature technosphere</div>
        </div>

        <div class="theory-grid">
          <article class="theory-card">
            <h3>Five diagnostics</h3>
            <p class="muted">
              The diagnostics follow the planetary-intelligence properties: emergence, networked information flow,
              semantic feedback, boundaries and signals, and autopoietic self-maintenance.
            </p>
            <ul class="list-clean muted diagnostic-list">
              <li><strong>Emergence:</strong> capability arising above individual actors.</li>
              <li><strong>Networks:</strong> institutional and informational connectivity.</li>
              <li><strong>Semantic feedback:</strong> environmental signals become meaningful for action.</li>
              <li><strong>Boundaries and signals:</strong> planetary limits are detected and acted upon.</li>
              <li><strong>Autopoiesis:</strong> the system supports its own long-term conditions of existence.</li>
            </ul>
          </article>

          <article class="theory-card selected-theory-card">
            <h3>Selected-country theory profile</h3>
            <div id="selectedTheory">
              <p class="muted">Click a country marker to view its maturity state, diagnostic bars, and mature-technosphere gap.</p>
            </div>
          </article>
        </div>
      </div>
    </section>

'''

if 'id="theory-layer"' not in html:
    html = html.replace('    <section id="model" class="section grid two">', theory_section + '    <section id="model" class="section grid two">')

html_path.write_text(html, encoding="utf-8")

css = css_path.read_text(encoding="utf-8")

css_add = '''
.toggle-stack {
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.72rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 195, 255, 0.16);
  background: rgba(255, 255, 255, 0.035);
  cursor: pointer;
  user-select: none;
}

.toggle-row input {
  width: auto;
  min-width: 1rem;
  accent-color: var(--accent-2);
}

.toggle-row span {
  color: var(--text);
  font-weight: 800;
  font-size: 0.92rem;
}

.theory-layer.is-hidden,
.theory-detail-block.is-hidden {
  display: none;
}

.theory-panel {
  position: relative;
  overflow: hidden;
}

.theory-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 0%, rgba(94, 234, 212, 0.10), transparent 30%),
    radial-gradient(circle at 90% 10%, rgba(110, 168, 255, 0.10), transparent 28%);
}

.theory-panel > * {
  position: relative;
}

.transition-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 1.2rem 0 1.4rem;
}

.transition-step {
  padding: 0.8rem 0.7rem;
  border-radius: 16px;
  color: var(--muted);
  background: rgba(7, 11, 20, 0.42);
  border: 1px solid rgba(153, 177, 255, 0.13);
  text-align: center;
  font-weight: 800;
  font-size: 0.86rem;
}

.transition-step.active {
  color: #ffffff;
  background: linear-gradient(135deg, rgba(44, 99, 255, 0.62), rgba(94, 234, 212, 0.22));
  border-color: rgba(94, 234, 212, 0.36);
}

.theory-grid {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 1rem;
}

.theory-card,
.theory-detail-block {
  padding: 1rem;
  border-radius: 20px;
  background: rgba(7, 11, 20, 0.42);
  border: 1px solid rgba(153, 177, 255, 0.13);
}

.theory-card h3,
.theory-detail-block h4 {
  margin-top: 0;
}

.diagnostic-list li + li {
  margin-top: 0.55rem;
}

.maturity-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  color: #ffffff;
  background: rgba(110,168,255,0.14);
  border: 1px solid rgba(110,168,255,0.26);
  font-weight: 900;
}

.maturity-badge.mature-technosphere-candidate {
  background: rgba(94, 234, 212, 0.14);
  border-color: rgba(94, 234, 212, 0.34);
}

.maturity-badge.transitioning-technosphere {
  background: rgba(110, 168, 255, 0.14);
  border-color: rgba(110, 168, 255, 0.34);
}

.maturity-badge.immature-technosphere {
  background: rgba(251, 191, 36, 0.13);
  border-color: rgba(251, 191, 36, 0.32);
}

.maturity-badge.emerging-technosphere,
.maturity-badge.low-system-capacity-state {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.30);
}

.diagnostic-bars {
  display: grid;
  gap: 0.72rem;
  margin: 0.95rem 0;
}

.diagnostic-row {
  display: grid;
  grid-template-columns: 170px 1fr 44px;
  align-items: center;
  gap: 0.7rem;
}

.diagnostic-label {
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.diagnostic-track {
  height: 0.72rem;
  border-radius: 999px;
  background: rgba(153, 177, 255, 0.12);
  overflow: hidden;
}

.diagnostic-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(110,168,255,0.88), rgba(94,234,212,0.92));
}

.diagnostic-value {
  color: var(--text);
  text-align: right;
  font-weight: 900;
  font-size: 0.85rem;
}

.gap-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0.9rem 0;
}

.gap-card {
  padding: 0.85rem;
  border-radius: 16px;
  background: rgba(110,168,255,0.08);
  border: 1px solid rgba(110,168,255,0.14);
}

.gap-card span {
  display: block;
  color: var(--muted);
  font-size: 0.82rem;
}

.gap-card strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.25rem;
}

@media (max-width: 980px) {
  .transition-steps,
  .theory-grid,
  .gap-strip {
    grid-template-columns: 1fr;
  }

  .diagnostic-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .diagnostic-value {
    text-align: left;
  }
}
'''

if ".theory-layer" not in css:
    css = css.rstrip() + "\n\n" + css_add.strip() + "\n"

css_path.write_text(css, encoding="utf-8")

js = js_path.read_text(encoding="utf-8")

theory_js = r'''
function enrichTheoryFields(row) {
  if (!row) return row;
  const ecologicalPressure = estimateEcologicalPressure(row);
  const diagnostics = deriveDiagnostics(row, ecologicalPressure);
  const gap = matureTechnosphereGap(diagnostics, ecologicalPressure);
  const enriched = {
    ...row,
    ecological_pressure: ecologicalPressure,
    ...diagnostics,
    mature_technosphere_gap: gap
  };
  enriched.maturity_state = classifyMaturity(enriched);
  enriched.maturity_interpretation = maturityInterpretation(enriched);
  return enriched;
}

function estimateEcologicalPressure(row) {
  if (row.detail && row.detail.length) {
    const pressureItems = row.detail
      .filter(d => d.layer === "planetary" && d.direction === "negative" && Number.isFinite(d.score))
      .map(d => ({ pressure: 100 - d.score, weight: Number(d.weight) || 1 }));

    if (pressureItems.length) {
      const wsum = pressureItems.reduce((sum, d) => sum + d.weight, 0);
      return clampScore(pressureItems.reduce((sum, d) => sum + d.pressure * d.weight, 0) / wsum);
    }
  }

  return clampScore(100 - Number(row.planetary_intelligence || 0));
}

function deriveDiagnostics(row, ecologicalPressure) {
  const i = Number(row.individual_intelligence || 0);
  const c = Number(row.collective_intelligence || 0);
  const p = Number(row.planetary_intelligence || 0);
  const safe = 100 - ecologicalPressure;

  return {
    emergence_score: clampScore((i * 0.35) + (c * 0.35) + (p * 0.30)),
    network_information_score: clampScore((c * 0.60) + (i * 0.20) + (p * 0.20)),
    semantic_feedback_score: clampScore((c * 0.35) + (p * 0.55) + (safe * 0.10)),
    boundary_signal_score: clampScore((p * 0.60) + (c * 0.25) + (safe * 0.15)),
    autopoiesis_score: clampScore((p * 0.55) + (c * 0.30) + (safe * 0.15))
  };
}

function matureTechnosphereGap(diagnostics, ecologicalPressure) {
  const avgDiagnostic = average([
    diagnostics.emergence_score,
    diagnostics.network_information_score,
    diagnostics.semantic_feedback_score,
    diagnostics.boundary_signal_score,
    diagnostics.autopoiesis_score
  ]);
  return clampScore(avgDiagnostic - ecologicalPressure * 0.35);
}

function classifyMaturity(row) {
  const i = Number(row.individual_intelligence || 0);
  const c = Number(row.collective_intelligence || 0);
  const p = Number(row.planetary_intelligence || 0);
  const pressure = Number(row.ecological_pressure ?? (100 - p));

  if (c >= 70 && p >= 70 && pressure <= 35) return "Mature technosphere candidate";
  if (c >= 60 && p >= 50) return "Transitioning technosphere";
  if (i >= 60 && c >= 55 && p < 50) return "Immature technosphere";
  if (i >= 45 || c >= 45) return "Emerging technosphere";
  return "Low-system-capacity state";
}

function maturityInterpretation(row) {
  switch (row.maturity_state) {
    case "Mature technosphere candidate":
      return "High coordination and stewardship with comparatively lower ecological pressure. This is closest to the mature-technosphere ideal in this prototype.";
    case "Transitioning technosphere":
      return "Meaningful coordination and planetary stewardship are present, but the feedback system is not yet strong enough to be considered mature.";
    case "Immature technosphere":
      return "Capability and institutions are present, but planetary self-regulation is weak.";
    case "Emerging technosphere":
      return "Some system capacity is present, but planetary-scale feedback and stewardship remain early.";
    default:
      return "Low composite system capacity in this proxy model. Interpret cautiously where indicator completeness is limited.";
  }
}

function maturityClassName(label) {
  return String(label || "").toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
}

function clampScore(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

function maturityColor(label, alpha = 0.26) {
  switch (label) {
    case "Mature technosphere candidate": return `rgba(94, 234, 212, ${alpha})`;
    case "Transitioning technosphere": return `rgba(110, 168, 255, ${alpha})`;
    case "Immature technosphere": return `rgba(251, 191, 36, ${alpha})`;
    case "Emerging technosphere": return `rgba(139, 92, 246, ${alpha})`;
    default: return `rgba(168, 180, 207, ${alpha})`;
  }
}

function makeDropLineTrace(rows) {
  const x = [];
  const y = [];
  const z = [];

  rows.forEach(r => {
    x.push(r.individual_intelligence, r.individual_intelligence, null);
    y.push(r.collective_intelligence, r.collective_intelligence, null);
    z.push(0, r.planetary_intelligence, null);
  });

  return {
    type: "scatter3d",
    mode: "lines",
    name: "Landing bars",
    x,
    y,
    z,
    hoverinfo: "skip",
    showlegend: true,
    legendrank: 98,
    line: { width: 2, color: "rgba(180, 210, 255, 0.25)" }
  };
}

function makeMaturityHaloTrace(rows) {
  return {
    type: "scatter3d",
    mode: "markers",
    name: "Maturity halos",
    x: rows.map(r => r.individual_intelligence),
    y: rows.map(r => r.collective_intelligence),
    z: rows.map(r => r.planetary_intelligence),
    text: rows.map(r => r.country),
    hoverinfo: "skip",
    showlegend: true,
    legendrank: 97,
    marker: {
      size: rows.map(r => Math.max(16, r.overall_synergy / 3.9)),
      color: rows.map(r => maturityColor(r.maturity_state, 0.18)),
      opacity: 0.55,
      line: {
        width: 2.5,
        color: rows.map(r => maturityColor(r.maturity_state, 0.72))
      }
    }
  };
}

function renderDiagnosticBars(row) {
  const diagnostics = [
    ["Emergence", row.emergence_score],
    ["Network information", row.network_information_score],
    ["Semantic feedback", row.semantic_feedback_score],
    ["Boundaries and signals", row.boundary_signal_score],
    ["Autopoiesis", row.autopoiesis_score]
  ];

  return `
    <div class="diagnostic-bars">
      ${diagnostics.map(([label, value]) => `
        <div class="diagnostic-row">
          <span class="diagnostic-label">${escapeHtml(label)}</span>
          <span class="diagnostic-track"><span class="diagnostic-fill" style="width:${clampScore(value)}%"></span></span>
          <span class="diagnostic-value">${clampScore(value).toFixed(0)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTheoryBlock(row) {
  const hidden = document.getElementById("showTheoryDiagnostics") && !document.getElementById("showTheoryDiagnostics").checked;
  return `
    <div class="theory-detail-block${hidden ? " is-hidden" : ""}">
      <h4>Planetary-intelligence diagnostics</h4>
      <span class="maturity-badge ${maturityClassName(row.maturity_state)}">${escapeHtml(row.maturity_state)}</span>
      <div class="gap-strip">
        <div class="gap-card"><span>Mature technosphere gap</span><strong>${row.mature_technosphere_gap.toFixed(1)}</strong></div>
        <div class="gap-card"><span>Ecological pressure</span><strong>${row.ecological_pressure.toFixed(1)}</strong></div>
      </div>
      ${renderDiagnosticBars(row)}
      <p class="muted small">${escapeHtml(row.maturity_interpretation)}</p>
    </div>
  `;
}

function updateTheoryPanel(row) {
  const target = document.getElementById("selectedTheory");
  if (!target || !row) return;
  target.innerHTML = renderTheoryBlock(row);
  updateTheoryVisibility();
}

function updateTheoryVisibility() {
  const checked = document.getElementById("showTheoryDiagnostics")?.checked ?? true;
  document.getElementById("theory-layer")?.classList.toggle("is-hidden", !checked);
  document.querySelectorAll(".theory-detail-block").forEach(el => el.classList.toggle("is-hidden", !checked));
}
'''

if "function enrichTheoryFields" not in js:
    js = js.replace("function bindControls() {", theory_js + "\nfunction bindControls() {", 1)

js = js.replace(
    '["regionFilter", "countrySearch", "minSynergy", "colourMode"].forEach(id => {',
    '["regionFilter", "countrySearch", "minSynergy", "colourMode", "showLandingBars", "showMaturityHalos", "showTheoryDiagnostics"].forEach(id => {'
)

js = js.replace(
    'document.getElementById(id).addEventListener("input", applyFilters);\n    document.getElementById(id).addEventListener("change", applyFilters);',
    'const control = document.getElementById(id);\n    if (!control) return;\n    control.addEventListener("input", applyFilters);\n    control.addEventListener("change", applyFilters);'
)

if 'showMaturityHalos' not in js.split('document.getElementById("clearFilters").addEventListener("click"', 1)[1].split('});', 1)[0]:
    js = js.replace(
        'document.getElementById("colourMode").value = "archetype";\n    applyFilters();',
        'document.getElementById("colourMode").value = "archetype";\n    if (document.getElementById("showLandingBars")) document.getElementById("showLandingBars").checked = true;\n    if (document.getElementById("showMaturityHalos")) document.getElementById("showMaturityHalos").checked = true;\n    if (document.getElementById("showTheoryDiagnostics")) document.getElementById("showTheoryDiagnostics").checked = true;\n    applyFilters();'
    )

if 'state.scores = state.scores.map(enrichTheoryFields);' not in js:
    js = js.replace(
        'const minSynergy = Number(document.getElementById("minSynergy").value);',
        'const minSynergy = Number(document.getElementById("minSynergy").value);\n\n  state.scores = state.scores.map(enrichTheoryFields);',
        1
    )

if 'updateTheoryVisibility();' not in js.split('function applyFilters()', 1)[1].split('function updateSummary()', 1)[0]:
    js = js.replace(
        '  updateSummary();\n  renderPlot();\n}',
        '  updateSummary();\n  renderPlot();\n  updateTheoryVisibility();\n}',
        1
    )

if 'makeMaturityHaloTrace(rows)' not in js.split('function renderPlot()', 1)[1].split('const layout =', 1)[0]:
    js = js.replace(
        '  const layout = {',
        '''  if (document.getElementById("showMaturityHalos")?.checked ?? true) {
    traces.unshift(makeMaturityHaloTrace(rows));
  }

  if (document.getElementById("showLandingBars")?.checked ?? true) {
    traces.unshift(makeDropLineTrace(rows));
  }

  const layout = {''',
        1
    )

if 'Maturity: %{customdata.maturity_state}' not in js:
    js = js.replace(
        '    "Synergy: %{customdata.overall_synergy:.1f}<br>" +\n    "Archetype: %{customdata.archetype}<extra></extra>";',
        '    "Synergy: %{customdata.overall_synergy:.1f}<br>" +\n    "Maturity: %{customdata.maturity_state}<br>" +\n    "Mature gap: %{customdata.mature_technosphere_gap:.1f}<br>" +\n    "Archetype: %{customdata.archetype}<extra></extra>";'
    )

js = js.replace(
    'if (point && point.customdata) renderSelected(point.customdata);',
    'if (point && point.customdata && point.customdata.country) renderSelected(point.customdata);'
)

if "row = enrichTheoryFields(row);" not in js:
    js = js.replace(
        "function renderSelected(row) {",
        "function renderSelected(row) {\n  row = enrichTheoryFields(row);",
        1
    )

if '${renderTheoryBlock(row)}' not in js:
    js = js.replace(
        '    <h4>Indicator detail</h4>',
        '    ${renderTheoryBlock(row)}\n    <h4>Indicator detail</h4>',
        1
    )

if 'updateTheoryPanel(row);' not in js.split('function renderSelected(row)', 1)[1].split('function renderIndicatorTable()', 1)[0]:
    js = js.replace(
        '  `;\n}\n\nfunction renderIndicatorTable()',
        '  `;\n  updateTheoryPanel(row);\n}\n\nfunction renderIndicatorTable()',
        1
    )

js_path.write_text(js, encoding="utf-8")

print("Done. Backups created with suffix:", stamp)
