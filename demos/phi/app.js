const state = {
  options: [],
};

const examples = {
  nbs: {
    decisionTitle: "Prioritise NbS interventions for an agricultural catchment",
    decisionMode: "nbs",
    objective: "Improve water quality while protecting biodiversity and keeping implementation feasible for land managers.",
    stakes: "3",
    reversibility: "2",
    context: "A catchment programme needs to decide which nature-based solutions should be investigated first. Spatial layers suggest several possible intervention zones, but pollutant pathways, maintenance, land access, and field validation remain uncertain.",
    stakeholders: "Farmers, catchment managers, local community, river ecology, protected habitats, advisory bodies, water-quality regulators.",
    options: [
      { name: "Riparian buffers", benefit: 4, evidence: 4, reversible: 3, risk: 2, uncertainty: 3 },
      { name: "Sediment ponds", benefit: 3, evidence: 3, reversible: 2, risk: 3, uncertainty: 3 },
      { name: "Peatland restoration", benefit: 5, evidence: 3, reversible: 2, risk: 3, uncertainty: 4 },
      { name: "Advisory measures first", benefit: 3, evidence: 3, reversible: 5, risk: 1, uncertainty: 2 },
    ],
    nbsIntervention: "Riparian buffer",
    nbsOutcome: "Water quality",
    spatialCriteria: "Stream proximity, overland-flow likelihood, slope, erosion risk, existing buffer cover, soil drainage, habitat connectivity, field access.",
    fieldValidation: "Confirm pollutant pathway, check artificial drainage, inspect bank erosion, assess landowner feasibility, verify maintenance burden, identify monitoring points upstream and downstream.",
  },
  phi: {
    decisionTitle: "Turn the P(HI) article and Decision Lab into a public project",
    decisionMode: "research",
    objective: "Create a coherent public research artefact combining an article, website demo, and applied NbS/SDSS method.",
    stakes: "2",
    reversibility: "4",
    context: "The P(HI) article argues that human intelligence prevails when AI is made accountable to life. The website can operationalise the article through a decision protocol and later connect to spatial decision support for NbS planning.",
    stakeholders: "Independent researcher, students, environmental practitioners, AI-curious public, NbS policy audience, future collaborators.",
    options: [
      { name: "Publish article first", benefit: 4, evidence: 4, reversible: 4, risk: 2, uncertainty: 2 },
      { name: "Build website MVP first", benefit: 5, evidence: 3, reversible: 5, risk: 2, uncertainty: 3 },
      { name: "Develop SDSS case first", benefit: 4, evidence: 3, reversible: 3, risk: 3, uncertainty: 4 },
      { name: "Wait and refine privately", benefit: 2, evidence: 2, reversible: 5, risk: 3, uncertainty: 4 },
    ],
    nbsIntervention: "Advisory or non-structural measure",
    nbsOutcome: "Multi-benefit delivery",
    spatialCriteria: "Not yet map-based. Use project coherence, public value, research contribution, feasibility, and reusability as first-stage criteria.",
    fieldValidation: "Test with one real decision memo, one NbS case, one SDSS suitability scenario, and one reader who has not seen the article.",
  },
};

const selectors = [
  "decisionTitle",
  "decisionMode",
  "objective",
  "deadline",
  "stakes",
  "reversibility",
  "context",
  "stakeholders",
  "hopedOutcome",
  "changeMind",
  "criticMode",
  "preferredOption",
  "nbsIntervention",
  "nbsOutcome",
  "spatialCriteria",
  "fieldValidation",
];

const $ = (id) => document.getElementById(id);

function init() {
  setupNav();
  setupOptions();
  setupEvents();
  loadDraft();

  if (!state.options.length) {
    state.options = defaultOptions();
  }

  renderOptions();
  updateAll();
}

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = $("navLinks");

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setupOptions() {
  $("addOption").addEventListener("click", () => {
    state.options.push({ name: "New option", benefit: 3, evidence: 3, reversible: 3, risk: 3, uncertainty: 3 });
    renderOptions();
    updateAll();
  });

  $("resetOptions").addEventListener("click", () => {
    state.options = defaultOptions();
    renderOptions();
    updateAll();
  });
}

function setupEvents() {
  selectors.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", updateAll);
    el.addEventListener("change", updateAll);
  });

  $("biasChecks").addEventListener("change", updateAll);
  $("generateMemo").addEventListener("click", () => $("decisionMemo").textContent = buildMemo());
  $("downloadMemo").addEventListener("click", downloadMemo);
  $("clearDraft").addEventListener("click", clearDraft);
  $("loadNbsExample").addEventListener("click", () => loadExample("nbs"));
  $("loadPhiExample").addEventListener("click", () => loadExample("phi"));

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.copyTarget, button));
  });
}

function defaultOptions() {
  return [
    { name: "Proceed now", benefit: 3, evidence: 2, reversible: 3, risk: 3, uncertainty: 3 },
    { name: "Proceed after evidence check", benefit: 4, evidence: 4, reversible: 3, risk: 2, uncertainty: 2 },
    { name: "Delay", benefit: 2, evidence: 2, reversible: 4, risk: 2, uncertainty: 4 },
  ];
}

function renderOptions() {
  const body = $("optionsBody");
  body.innerHTML = "";

  state.options.forEach((option, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="option-name"><input aria-label="Option name" value="${escapeHtml(option.name)}" data-field="name" data-index="${index}"></td>
      ${scaleCell("benefit", option.benefit, index)}
      ${scaleCell("evidence", option.evidence, index)}
      ${scaleCell("reversible", option.reversible, index)}
      ${scaleCell("risk", option.risk, index)}
      ${scaleCell("uncertainty", option.uncertainty, index)}
      <td><span class="score-badge">${scoreOption(option)}</span></td>
      <td><button class="remove-row" type="button" aria-label="Remove option" data-remove="${index}">×</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", handleOptionInput);
    input.addEventListener("change", handleOptionInput);
  });

  body.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.options.length <= 1) return;
      state.options.splice(Number(button.dataset.remove), 1);
      renderOptions();
      updateAll();
    });
  });
}

function scaleCell(field, value, index) {
  return `
    <td>
      <select aria-label="${field}" data-field="${field}" data-index="${index}">
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(value) === n ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </td>
  `;
}

function handleOptionInput(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  const value = field === "name" ? event.target.value : Number(event.target.value);
  state.options[index][field] = value;
  renderOptions();
  updateAll();
}

function scoreOption(option) {
  const raw = Number(option.benefit) + Number(option.evidence) + Number(option.reversible) - Number(option.risk) - Number(option.uncertainty) + 5;
  return Math.max(0, Math.min(15, raw));
}

function updateAll() {
  updateBoundary();
  updateReadiness();
  $("redTeamPrompt").textContent = buildRedTeamPrompt();
  $("nbsAudit").textContent = buildNbsAudit();
  saveDraft();
}

function getDecisionData() {
  return Object.fromEntries(selectors.map((id) => [id, $(id)?.value || ""]));
}

function getSelectedBiases() {
  return Array.from(document.querySelectorAll("#biasChecks input:checked")).map((input) => input.value);
}

function highestOption() {
  return [...state.options].sort((a, b) => scoreOption(b) - scoreOption(a))[0] || null;
}

function updateBoundary() {
  const data = getDecisionData();
  const mode = data.decisionMode;
  const stakes = Number(data.stakes || 1);
  const reversibility = Number(data.reversibility || 1);

  let risk = stakes + (5 - reversibility);
  if (["financial", "medical", "safety"].includes(mode)) risk += 3;
  if (mode === "nbs" || mode === "policy") risk += 1;

  const level = risk >= 9 ? "High delegation risk" : risk >= 6 ? "Moderate delegation risk" : "Low delegation risk";
  const pill = risk >= 9 ? "danger" : risk >= 6 ? "warn" : "safe";
  const width = Math.max(12, Math.min(100, risk * 10));

  const adviceByMode = {
    personal: "AI can help frame options, clarify values, and generate a memo. You remain responsible for the choice.",
    research: "AI can structure evidence, assumptions, and critique. It must not replace disciplinary judgement, supervision, or field validation.",
    policy: "AI can support synthesis and scenario comparison. Public legitimacy, accountability, and stakeholder interpretation remain human responsibilities.",
    nbs: "AI and spatial models can indicate where to investigate first. They must not turn suitability into an automatic recommendation.",
    financial: "Use AI only to prepare questions, organise evidence, and compare advisor responses. Qualified professional advice is required.",
    medical: "Use AI only to prepare discussion notes and questions. Clinical decisions belong with qualified clinicians and informed consent.",
    safety: "Use AI for checklists and documentation only. Safety-critical decisions require competent human governance and conservative judgement.",
  };

  $("meterFill").style.width = `${width}%`;
  $("boundaryLevel").textContent = level;
  $("boundaryAdvice").textContent = adviceByMode[mode] || adviceByMode.personal;

  $("decisionStatus").innerHTML = `
    <span class="status-pill ${pill}">${level}</span>
    <span class="status-copy">${adviceByMode[mode] || adviceByMode.personal}</span>
  `;
}

function updateReadiness() {
  const data = getDecisionData();
  const textFields = [data.decisionTitle, data.objective, data.context, data.stakeholders];
  const fieldScore = textFields.filter((value) => value.trim().length > 12).length * 12;
  const optionsScore = Math.min(24, state.options.filter((option) => option.name.trim().length > 2).length * 8);
  const biasScore = Math.min(16, getSelectedBiases().length * 4 + (data.changeMind.trim() ? 6 : 0));
  const nbsScore = data.decisionMode === "nbs" ? Math.min(12, [data.spatialCriteria, data.fieldValidation].filter((x) => x.trim().length > 10).length * 6) : 8;
  const total = Math.min(100, fieldScore + optionsScore + biasScore + nbsScore);

  $("readinessScore").textContent = String(total);
  $("readinessText").textContent = total >= 75
    ? "Strong enough to generate a useful decision memo."
    : total >= 45
      ? "Promising. Add evidence, uncertainty, and red-team critique."
      : "Add a clearer frame, real options, and bias review.";
}

function buildRedTeamPrompt() {
  const data = getDecisionData();
  const top = highestOption();
  const preferred = data.preferredOption.trim() || top?.name || "[preferred option]";
  const biases = getSelectedBiases();

  return `Act as a sceptical ${data.criticMode || "reviewer"}.

Review this decision without agreeing with me prematurely.

Decision:
${data.decisionTitle || "[decision not yet stated]"}

Objective:
${data.objective || "[objective not yet stated]"}

Context:
${data.context || "[context not yet stated]"}

Preferred option:
${preferred}

Known bias signals:
${biases.length ? biases.map((b) => `- ${b}`).join("\n") : "- None selected yet"}

Your task:
1. Identify the strongest objection to this decision.
2. Identify weak assumptions.
3. Identify missing evidence.
4. Identify ecological, ethical, governance, or practical risks.
5. State what would change your mind.
6. Suggest the minimum revision needed before action.
7. End with a clear recommendation: proceed, revise, test first, delay, or reject.

Do not make the decision for me. Improve the quality of my judgement.`;
}

function buildNbsAudit() {
  const data = getDecisionData();
  return `NbS Spatial Decision Audit

Intervention:
${data.nbsIntervention || "[not selected]"}

Primary outcome:
${data.nbsOutcome || "[not selected]"}

Spatial criteria used:
${data.spatialCriteria || "[criteria not yet stated]"}

Field validation required:
${data.fieldValidation || "[field validation not yet stated]"}

P(HI)-SDSS audit questions:
1. What is the decision objective: water quality, biodiversity, flood mitigation, carbon, farm practicality, or multi-benefit delivery?
2. Which spatial criteria were selected, and why?
3. Who chose the weights?
4. What evidence supports the link between each criterion and this intervention?
5. What uncertainty affects the suitability result?
6. What field observations could falsify the recommendation?
7. Who maintains the intervention after installation?
8. Which stakeholders should review the map before action?
9. What monitoring would show whether the intervention worked?
10. Is the map directing investigation, or pretending to finish the decision?

Core safeguard:
A high suitability score does not mean "build here". It means "investigate here first".`;
}

function buildMemo() {
  const data = getDecisionData();
  const biases = getSelectedBiases();
  const top = highestOption();
  const options = state.options
    .map((option) => `| ${option.name || "Unnamed"} | ${option.benefit} | ${option.evidence} | ${option.reversible} | ${option.risk} | ${option.uncertainty} | ${scoreOption(option)} |`)
    .join("\n");

  return `# P(HI) Decision Memo

## Decision
${data.decisionTitle || "[Decision not stated]"}

## Objective
${data.objective || "[Objective not stated]"}

## Context
${data.context || "[Context not stated]"}

## Affected people, places, or systems
${data.stakeholders || "[Stakeholders not stated]"}

## Decision characteristics
- Mode: ${labelForMode(data.decisionMode)}
- Stakes: ${labelForScale(data.stakes, "stakes")}
- Reversibility: ${labelForScale(data.reversibility, "reversibility")}
- Deadline: ${data.deadline || "Not specified"}

## Options considered
| Option | Benefit | Evidence | Reversible | Risk | Uncertainty | Score |
|---|---:|---:|---:|---:|---:|---:|
${options || "| No options entered | | | | | | |"}

## Current highest-scoring option
${top ? `${top.name} (${scoreOption(top)}/15)` : "No option available"}

## Bias audit
Selected bias signals:
${biases.length ? biases.map((bias) => `- ${bias}`).join("\n") : "- None selected"}

Outcome I may be hoping for:
${data.hopedOutcome || "[Not stated]"}

Evidence that would change my mind:
${data.changeMind || "[Not stated]"}

## Judgement boundary
${$("boundaryLevel").textContent}

${$("boundaryAdvice").textContent}

## Red-team prompt
${buildRedTeamPrompt()}

## NbS / SDSS audit
${buildNbsAudit()}

## Provisional decision
[Write the decision here after red-team review.]

## Review date
[Set a date to revisit the outcome.]

## Learning question
What will I know later that I do not know now?

## P(HI) principle
AI may assist reasoning, but the human remains responsible for values, consequences, and action.`;
}

function labelForMode(mode) {
  const labels = {
    personal: "Personal / strategic",
    research: "Research / PhD",
    policy: "Policy / governance",
    nbs: "NbS spatial decision support",
    financial: "Financial / tax / legal",
    medical: "Medical / health",
    safety: "Fieldwork / safety-critical",
  };
  return labels[mode] || mode || "Not selected";
}

function labelForScale(value, type) {
  const stakes = { 1: "Low", 2: "Medium", 3: "High", 4: "High and irreversible" };
  const reversibility = { 1: "Effectively irreversible", 2: "Hard to reverse", 3: "Partly reversible", 4: "Easy to reverse" };
  return (type === "stakes" ? stakes : reversibility)[Number(value)] || "Not selected";
}

function loadExample(name) {
  const example = examples[name];
  if (!example) return;

  Object.entries(example).forEach(([key, value]) => {
    if (key === "options") return;
    if ($(key)) $(key).value = value;
  });

  state.options = example.options.map((option) => ({ ...option }));
  renderOptions();
  updateAll();
  $("decisionMemo").textContent = buildMemo();
  document.querySelector("#cockpit").scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveDraft() {
  const payload = {
    fields: getDecisionData(),
    options: state.options,
    biases: getSelectedBiases(),
    memo: $("decisionMemo").textContent,
  };
  localStorage.setItem("phiDecisionLabDraft", JSON.stringify(payload));
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem("phiDecisionLabDraft") || "null");
    if (!saved) return;

    Object.entries(saved.fields || {}).forEach(([key, value]) => {
      if ($(key)) $(key).value = value;
    });

    document.querySelectorAll("#biasChecks input").forEach((input) => {
      input.checked = (saved.biases || []).includes(input.value);
    });

    state.options = Array.isArray(saved.options) ? saved.options : [];
    $("decisionMemo").textContent = saved.memo || "";
  } catch {
    localStorage.removeItem("phiDecisionLabDraft");
  }
}

function clearDraft() {
  localStorage.removeItem("phiDecisionLabDraft");
  selectors.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (el.tagName === "SELECT") el.selectedIndex = 0;
    else el.value = "";
  });
  $("stakes").value = "2";
  $("reversibility").value = "3";
  document.querySelectorAll("#biasChecks input").forEach((input) => input.checked = false);
  state.options = defaultOptions();
  $("decisionMemo").textContent = "";
  renderOptions();
  updateAll();
}

async function copyText(targetId, button) {
  const text = $(targetId)?.textContent || "";
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);
    const old = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => button.textContent = old, 1200);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function downloadMemo() {
  const memo = $("decisionMemo").textContent.trim() || buildMemo();
  const title = ($("decisionTitle").value || "phi-decision-memo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  const blob = new Blob([memo], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "phi-decision-memo"}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", init);
