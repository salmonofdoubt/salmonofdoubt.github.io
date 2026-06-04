const $ = (id) => document.getElementById(id);

const state = {
  options: [
    { name: "Riparian buffers", benefit: 4, evidence: 4, reversible: 3, risk: 2, uncertainty: 3 },
    { name: "Sediment ponds", benefit: 3, evidence: 3, reversible: 2, risk: 3, uncertainty: 3 },
    { name: "Peatland restoration", benefit: 5, evidence: 3, reversible: 2, risk: 3, uncertainty: 4 },
    { name: "Advisory measures first", benefit: 3, evidence: 3, reversible: 5, risk: 1, uncertainty: 2 },
  ],
};

function safeValue(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function scoreOption(option) {
  return Number(option.benefit) + Number(option.evidence) + Number(option.reversible) - Number(option.risk) - Number(option.uncertainty) + 5;
}

function topOption() {
  return [...state.options].sort((a, b) => scoreOption(b) - scoreOption(a))[0] || null;
}

function selectedBiases() {
  return [...document.querySelectorAll("#bias input[type='checkbox']:checked")].map((el) => el.value);
}

function labelFor(id, value) {
  const el = $(id);
  const option = el?.querySelector(`option[value="${value}"]`);
  return option ? option.textContent : value;
}

function decisionData() {
  return {
    title: safeValue("decisionTitle"),
    mode: safeValue("decisionMode"),
    stakes: Number(safeValue("stakes") || 1),
    reversibility: Number(safeValue("reversibility") || 3),
    deadline: safeValue("deadline"),
    objective: safeValue("objective"),
    context: safeValue("context"),
    stakeholders: safeValue("stakeholders"),
    hopedOutcome: safeValue("hopedOutcome"),
    changeMind: safeValue("changeMind"),
    nbsIntervention: safeValue("nbsIntervention"),
    nbsOutcome: safeValue("nbsOutcome"),
    spatialCriteria: safeValue("spatialCriteria"),
    fieldValidation: safeValue("fieldValidation"),
  };
}

function boundaryRisk(data = decisionData()) {
  let risk = data.stakes * 2 + (4 - data.reversibility);
  if (["financial", "medical", "safety"].includes(data.mode)) risk += 4;
  if (["nbs", "policy"].includes(data.mode)) risk += 2;
  if (data.stakes >= 3 && data.reversibility <= 2) risk += 2;
  return Math.max(1, Math.min(12, risk));
}

function boundaryAdvice(mode) {
  const advice = {
    nbs: "AI and spatial models can indicate where to investigate first. They must not turn suitability into an automatic recommendation.",
    research: "AI can structure evidence and critique assumptions. It must not replace disciplinary judgement or field validation.",
    policy: "AI can support synthesis. Public legitimacy, accountability, and stakeholder interpretation remain human responsibilities.",
    personal: "AI can clarify options and values. You remain responsible for the choice.",
    financial: "Use AI to organise questions only. Qualified professional advice is required.",
    medical: "Use AI to prepare discussion notes only. Clinical decisions belong with qualified clinicians.",
    safety: "Use AI for checklists and documentation only. Safety decisions require conservative human governance.",
  };
  return advice[mode] || advice.personal;
}

function updateBoundary() {
  const data = decisionData();
  const risk = boundaryRisk(data);
  const level = risk >= 10 ? "High delegation risk" : risk >= 6 ? "Moderate delegation risk" : "Low delegation risk";

  $("boundaryMeter").style.width = `${Math.min(100, risk * 8.4)}%`;
  $("boundaryLevel").textContent = level;
  $("boundaryText").textContent = boundaryAdvice(data.mode);
}

function updateReadiness() {
  const data = decisionData();
  const textScore = [data.title, data.objective, data.context, data.stakeholders].filter((x) => x.length > 16).length * 10;
  const optionScore = Math.min(24, state.options.length * 6);
  const biasScore = Math.min(18, selectedBiases().length * 3 + (data.changeMind ? 6 : 0) + (data.hopedOutcome ? 4 : 0));
  const nbsScore = data.mode === "nbs" ? [data.spatialCriteria, data.fieldValidation].filter((x) => x.length > 16).length * 6 : 8;
  const riskPenalty = data.stakes >= 3 ? 6 : 0;
  const reversePenalty = data.reversibility <= 2 ? 6 : 0;
  const total = Math.max(0, Math.min(100, textScore + optionScore + biasScore + nbsScore - riskPenalty - reversePenalty));

  $("readinessScore").textContent = total;
  $("readinessText").textContent =
    total >= 75 ? "Ready for red-team review, not automatic action." :
    total >= 55 ? "Good memo basis. Add evidence and field checks." :
    "Add clearer framing, evidence, options, and bias checks.";
}

function renderOptions() {
  const body = $("optionRows");
  body.innerHTML = "";

  state.options.forEach((option, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input value="${option.name}" data-field="name" data-index="${index}"></td>
      ${["benefit", "evidence", "reversible", "risk", "uncertainty"].map((field) => `
        <td>
          <select data-field="${field}" data-index="${index}">
            ${[1,2,3,4,5].map((n) => `<option value="${n}" ${Number(option[field]) === n ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </td>
      `).join("")}
      <td><strong>${scoreOption(option)}</strong></td>
      <td><button type="button" data-remove="${index}">Remove</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("input", () => {
      const index = Number(el.dataset.index);
      const field = el.dataset.field;
      state.options[index][field] = field === "name" ? el.value : Number(el.value);
      renderOptions();
      updateAll();
    });
  });

  body.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.options.splice(Number(button.dataset.remove), 1);
      renderOptions();
      updateAll();
    });
  });
}

function consistencyNotes() {
  const data = decisionData();
  const top = topOption();
  const notes = [];

  if (top) notes.push(`Score leader: ${top.name} (${scoreOption(top)}/15). Treat this as a screening signal, not a decision.`);

  if (data.mode === "nbs" && top && data.nbsIntervention && !top.name.toLowerCase().includes(data.nbsIntervention.toLowerCase().split(" ")[0])) {
    notes.push(`Spatial audit mismatch: option matrix favours "${top.name}", while the NbS audit focuses on "${data.nbsIntervention}". Explain the sequence.`);
  }

  if (data.stakes >= 3 || data.reversibility <= 2) {
    notes.push("High-stakes or hard-to-reverse decision: require field validation, stakeholder review, and monitoring design.");
  }

  if (data.changeMind && /tool|model|map|gis|hydrology/i.test(data.changeMind) && !/evidence|measure|confirm|show|data|pathway/i.test(data.changeMind)) {
    notes.push("The change-my-mind entry names a tool rather than observable evidence. Convert it into a testable condition.");
  }

  return notes;
}

function buildNbsAudit() {
  const data = decisionData();
  const top = topOption();
  return `NbS Spatial Decision Audit

Intervention under spatial audit:
${data.nbsIntervention || "[not selected]"}

Current option-matrix leader:
${top ? `${top.name} (${scoreOption(top)}/15)` : "[not available]"}

Primary outcome:
${data.nbsOutcome || "[not selected]"}

Spatial criteria used:
${data.spatialCriteria || "[not stated]"}

Field validation required:
${data.fieldValidation || "[not stated]"}

Consistency and caution notes:
${consistencyNotes().map((x) => `- ${x}`).join("\n") || "- No major consistency issue detected."}

Core safeguard:
A high suitability score does not mean "build here". It means "investigate here first".`;
}

function buildRedTeamPrompt() {
  const data = decisionData();
  const top = topOption();
  return `Act as a sceptical academic examiner.

Review this decision without agreeing with me prematurely.

Decision:
${data.title || "[not stated]"}

Objective:
${data.objective || "[not stated]"}

Context:
${data.context || "[not stated]"}

Score leader:
${top ? `${top.name} (${scoreOption(top)}/15)` : "[not available]"}

Known bias signals:
${selectedBiases().map((x) => `- ${x}`).join("\n") || "- None selected"}

Consistency notes:
${consistencyNotes().map((x) => `- ${x}`).join("\n") || "- None"}

Your task:
1. Identify the strongest objection.
2. Identify weak assumptions.
3. Distinguish tools from observable evidence.
4. Identify ecological, ethical, governance, or practical risks.
5. State what would change your mind.
6. Recommend: proceed, revise, test first, delay, or reject.

Do not make the decision for me. Improve the quality of my judgement.`;
}

function buildEcoLogitsSummary() {
  return `## EcoLogits summary

Measured or directly knowable from the design:
- This memo was generated locally in a browser.
- The demo uses local storage only.
- It does not require login, a database, server-side processing, or an AI API call.

Estimated AI use avoided:
- Avoided AI calls counted: 1 decision-memo generation equivalent.
- Estimated avoided AI inference electricity: about 0.34 Wh.
- Plausible avoided range: 0.18-0.67 Wh.
- This is an avoided-inference estimate, not a measured footprint.

If you paste this memo into AI for critique:
- Count that external AI call separately.
- The benefit is disciplined, targeted AI use rather than total AI avoidance.`;
}

function buildMemo() {
  const data = decisionData();
  const top = topOption();
  const optionRows = state.options.map((o) => `| ${o.name} | ${o.benefit} | ${o.evidence} | ${o.reversible} | ${o.risk} | ${o.uncertainty} | ${scoreOption(o)} |`).join("\n");

  return `# P(HI) Decision Memo

## Decision
${data.title || "[Decision not stated]"}

## Objective
${data.objective || "[Objective not stated]"}

## Context
${data.context || "[Context not stated]"}

## Affected people, places, or systems
${data.stakeholders || "[Stakeholders not stated]"}

## Decision characteristics
- Mode: ${labelFor("decisionMode", data.mode)}
- Stakes: ${labelFor("stakes", String(data.stakes))}
- Reversibility: ${labelFor("reversibility", String(data.reversibility))}
- Deadline: ${data.deadline || "Not specified"}

## Options considered
| Option | Benefit | Evidence | Reversible | Risk | Uncertainty | Score |
|---|---:|---:|---:|---:|---:|---:|
${optionRows}

## Score leader
${top ? `${top.name} (${scoreOption(top)}/15)` : "No option available"}

Scores are screening signals, not decisions.

## Decision consistency check
${consistencyNotes().map((x) => `- ${x}`).join("\n") || "- No major consistency issue detected."}

## Bias audit
Selected bias signals:
${selectedBiases().map((x) => `- ${x}`).join("\n") || "- None selected"}

Outcome I may be hoping for:
${data.hopedOutcome || "[Not stated]"}

Evidence that would change my mind:
${data.changeMind || "[Not stated]"}

## Judgement boundary
${$("boundaryLevel").textContent}

${$("boundaryText").textContent}

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

${buildEcoLogitsSummary()}

## P(HI) principle
AI may assist reasoning, but the human remains responsible for values, consequences, and action.`;
}

function buildAiReviewPrompt() {
  return `You are reviewing a P(HI) Decision Memo.

Do not make the decision for me. Act as a critical thinking partner.

Challenge:
1. Weak assumptions
2. Missing evidence
3. Tools or maps mistaken for evidence
4. Bias and automation bias
5. Ecological, governance, ethical, and practical risks
6. Field checks or independent review needed
7. Recommendation: proceed, revise, test first, delay, or reject

Decision memo to review:

${buildMemo()}`;
}

function buildEvidencePrompt() {
  return `You are reviewing a P(HI)-SDSS evidence audit for a nature-based solutions decision.

Do not choose the intervention for me. Improve the evidence logic.

Check whether:
1. Spatial criteria match the objective
2. The intervention matches the pollutant pathway
3. The option score and spatial audit are consistent
4. Artificial drainage, hydrological connectivity, maintenance, access, and monitoring are considered
5. The map directs investigation rather than pretending to finish the decision

Audit to review:

${buildNbsAudit()}`;
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
  if ($("copyStatus")) $("copyStatus").textContent = message;
}

function downloadMemo() {
  const text = $("memoOutput").value || buildMemo();
  const blob = new Blob([text], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "phi-decision-memo.md";
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadNbsExample() {
  $("decisionTitle").value = "Prioritise NbS interventions for an agricultural catchment";
  $("decisionMode").value = "nbs";
  $("stakes").value = "3";
  $("reversibility").value = "2";
  $("objective").value = "Improve water quality while protecting biodiversity and keeping implementation feasible for land managers.";
  $("context").value = "A catchment programme needs to decide which nature-based solutions should be investigated first. Spatial layers suggest several possible intervention zones, but pollutant pathways, maintenance, land access, and field validation remain uncertain.";
  $("stakeholders").value = "Farmers, catchment managers, local community, river ecology, protected habitats, advisory bodies, water-quality regulators.";
  $("hopedOutcome").value = "A visible physical NbS intervention, such as a new buffer.";
  $("changeMind").value = "Field evidence that artificial drainage bypasses the proposed buffer.";
  state.options = [
    { name: "Riparian buffers", benefit: 4, evidence: 4, reversible: 3, risk: 2, uncertainty: 3 },
    { name: "Sediment ponds", benefit: 3, evidence: 3, reversible: 2, risk: 3, uncertainty: 3 },
    { name: "Peatland restoration", benefit: 5, evidence: 3, reversible: 2, risk: 3, uncertainty: 4 },
    { name: "Advisory measures first", benefit: 3, evidence: 3, reversible: 5, risk: 1, uncertainty: 2 },
  ];
  renderOptions();
  updateAll();
}

function loadPhiExample() {
  $("decisionTitle").value = "Develop the P(HI) Judgement Lab as a public research demo";
  $("decisionMode").value = "research";
  $("stakes").value = "2";
  $("reversibility").value = "3";
  $("objective").value = "Create a coherent public project linking the P(HI) article, AI critique workflow, EcoLogits, and NbS spatial decision support.";
  $("context").value = "The project needs to be useful as a public website demo, an academic article companion, and a reusable decision protocol without overclaiming what AI can decide.";
  $("stakeholders").value = "Independent researchers, students, NbS practitioners, climate communicators, policy readers, and future collaborators.";
  $("hopedOutcome").value = "A polished demo that can be cited and shared.";
  $("changeMind").value = "Evidence that the workflow confuses users or encourages AI delegation.";
  state.options = [
    { name: "Public static demo", benefit: 5, evidence: 4, reversible: 4, risk: 2, uncertainty: 2 },
    { name: "Long article only", benefit: 3, evidence: 4, reversible: 5, risk: 2, uncertainty: 3 },
    { name: "Interactive AI app", benefit: 4, evidence: 2, reversible: 2, risk: 4, uncertainty: 4 },
  ];
  renderOptions();
  updateAll();
}

function updateAll() {
  updateBoundary();
  updateReadiness();
}

function init() {
  const today = new Date();
  today.setDate(today.getDate() + 16);
  $("deadline").value = today.toISOString().slice(0, 10);

  renderOptions();
  updateAll();

  document.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("input", updateAll);
    el.addEventListener("change", updateAll);
  });

  document.querySelectorAll("#bias input").forEach((el) => el.addEventListener("change", updateAll));

  $("startDecision").addEventListener("click", () => $("cockpit").scrollIntoView({ behavior: "smooth" }));
  $("loadNbsExample").addEventListener("click", loadNbsExample);
  $("loadPhiExample").addEventListener("click", loadPhiExample);

  $("addOption").addEventListener("click", () => {
    state.options.push({ name: "New option", benefit: 3, evidence: 3, reversible: 3, risk: 3, uncertainty: 3 });
    renderOptions();
    updateAll();
  });

  $("generateMemo").addEventListener("click", () => {
    $("memoOutput").value = buildMemo();
  });

  $("copyMemo").addEventListener("click", () => copyText($("memoOutput").value || buildMemo(), "Copied memo."));
  $("downloadMemo").addEventListener("click", downloadMemo);
  $("copyFullReview").addEventListener("click", () => copyText(buildAiReviewPrompt(), "Copied full AI review prompt."));
  $("copyRedTeam").addEventListener("click", () => copyText(buildRedTeamPrompt(), "Copied red-team prompt."));
  $("copyEvidenceAudit").addEventListener("click", () => copyText(buildEvidencePrompt(), "Copied NbS/SDSS evidence audit."));
}

document.addEventListener("DOMContentLoaded", init);
