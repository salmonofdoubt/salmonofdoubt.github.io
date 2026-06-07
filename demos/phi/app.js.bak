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

function isNbsDecision(data = decisionData()) {
  return data.mode === "nbs";
}

function buildModeSpecificAudit() {
  const data = decisionData();

  if (isNbsDecision(data)) {
    return `## NbS / SDSS audit
${buildNbsAudit()}`;
  }

  return `## Project / method audit

This is not an NbS spatial decision-support memo, so the NbS-SDSS audit is intentionally not included.

Method questions:
1. Is the project objective clear enough for a public demo?
2. Does the workflow make the boundary between human judgement and AI critique obvious?
3. Does the tool avoid implying that AI should make the decision?
4. Does the memo distinguish evidence, assumptions, values, uncertainty, and risks?
5. Does the EcoLogits note avoid false precision?
6. Is the Zenodo status honest, with no invented DOI?
7. What user test would show whether the workflow confuses people?
8. What would justify revising the demo before release?

Core safeguard:
The public demo should make human ownership of the decision clearer than the interface aesthetics.`;
}

function isNbsDecision(data = decisionData()) {
  return data.mode === "nbs";
}

function classifyOptionType(name) {
  const text = String(name || "").toLowerCase();

  if (/advis|engagement|consult|training|workshop|governance|diagnos|survey|walkover|monitoring|baseline/.test(text)) {
    return "process";
  }

  if (/buffer|pond|wetland|dam|peat|hedgerow|woodland|margin|drain|rewet|trap|interception/.test(text)) {
    return "physical intervention";
  }

  if (/site|zone|field|parcel|reach|subcatchment|catchment/.test(text)) {
    return "site priority";
  }

  return "unspecified";
}

function optionTypeSummary() {
  const grouped = state.options.reduce((acc, option) => {
    const type = classifyOptionType(option.name);
    acc[type] = acc[type] || [];
    acc[type].push(option.name);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([type, names]) => `- ${type}: ${names.join(", ")}`)
    .join("\n");
}

function hasMixedPriorityTypes() {
  return new Set(state.options.map((option) => classifyOptionType(option.name))).size > 1;
}

function buildPriorityClarifier() {
  const top = topOption();
  const topType = top ? classifyOptionType(top.name) : "unspecified";

  if (!top || !hasMixedPriorityTypes()) {
    return "The current options appear to be in broadly comparable categories. Still check whether the score compares like with like.";
  }

  return `The option matrix mixes priority types.

Current option categories:
${optionTypeSummary()}

Current score leader:
${top.name} (${scoreOption(top)}/15), classified as ${topType}.

Interpretation safeguard:
If the score leader is a process option, such as advisory measures, it should be treated as a diagnostic or governance phase, not as the final physical NbS intervention. The memo should distinguish process priority, intervention priority, and site priority.`;
}

function buildModeSpecificAudit() {
  const data = decisionData();

  if (isNbsDecision(data)) {
    return `## NbS / SDSS audit
${buildNbsAudit()}

## Priority-type clarification
${buildPriorityClarifier()}`;
  }

  return `## Project / method audit

This is not an NbS spatial decision-support memo, so the NbS-SDSS audit is intentionally not included.

Method questions:
1. Is the project objective clear enough for a public demo?
2. Does the workflow make the boundary between human judgement and AI critique obvious?
3. Does the tool avoid implying that AI should make the decision?
4. Does the memo distinguish evidence, assumptions, values, uncertainty, and risks?
5. Does the EcoLogits note avoid false precision?
6. Is the Zenodo status honest, with no invented DOI?
7. What user test would show whether the workflow confuses people?
8. What would justify revising the demo before release?

Core safeguard:
The public demo should make human ownership of the decision clearer than the interface aesthetics.`;
}

function buildNbsAudit() {
  const data = decisionData();
  const top = topOption();

  return `NbS Spatial Decision Audit

Intervention under spatial audit:
${data.nbsIntervention || "[not selected]"}

Current option-matrix leader:
${top ? `${top.name} (${scoreOption(top)}/15)` : "[not available]"}

Current priority-type check:
${buildPriorityClarifier()}

Primary outcome:
${data.nbsOutcome || "[not selected]"}

Spatial criteria used:
${data.spatialCriteria || "[not stated]"}

Field validation required:
${data.fieldValidation || "[not stated]"}

Consistency and caution notes:
${consistencyNotes().map((x) => `- ${x}`).join("\n") || "- No major consistency issue detected."}

P(HI)-SDSS examiner questions:
1. Is the matrix comparing like with like?
2. Is the score leader a process priority, intervention priority, or site priority?
3. Does the spatial audit intervention match the pollutant pathway?
4. Could artificial drainage, subsurface flow, legacy phosphorus, access, or maintenance invalidate the mapped suitability?
5. What field evidence would falsify the preferred physical intervention?
6. What monitoring design would show whether the intervention worked?
7. Who has authority to move from investigation to implementation?
8. What stakeholder review is required before action?

Core safeguard:
A high suitability score does not mean "build here". It means "investigate here first".`;
}

function buildRedTeamPrompt() {
  const data = decisionData();
  const top = topOption();

  if (isNbsDecision(data)) {
    return `Act as a sceptical academic examiner reviewing a P(HI)-SDSS decision memo for nature-based solutions.

Do not make the decision for me. Improve the quality of my judgement.

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

Priority-type check:
${buildPriorityClarifier()}

Consistency notes:
${consistencyNotes().map((x) => `- ${x}`).join("\n") || "- None"}

Your response must use this structure:

1. Recommendation
State one of: proceed, revise, test first, delay, or reject.

2. Strongest objection
Identify the strongest objection to the current reasoning.

3. Category clarity
Separate:
- process priority
- intervention priority
- site priority

Explain whether the option matrix compares like with like.

4. Weak assumptions
Identify assumptions about pollutant pathways, spatial layers, land-manager feasibility, monitoring, maintenance, and reversibility.

5. Tools versus observable evidence
Provide a table with:
- item
- what it is
- what it is not

6. Ecological, ethical, governance, and practical risks
Flag risks separately.

7. Field validation and independent review needed
List the evidence required before implementation.

8. What would change your mind?
State the strongest falsifying evidence.

9. Revised decision wording
Rewrite the decision so it clearly distinguishes diagnostic/advisory sequencing from final physical NbS intervention selection.

Use APA 7 references where possible. Do not invent citations.`;
  }

  return `Act as a sceptical academic examiner reviewing a P(HI) project decision.

Do not make the decision for me. Improve the quality of my judgement.

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

Your response must use this structure:

1. Recommendation
State one of: proceed, revise, test first, delay, or reject.

2. Strongest objection
Identify the strongest objection to the current project path.

3. Weak assumptions
Identify assumptions about users, clarity, public value, citation value, EcoLogits, and AI handoff behaviour.

4. Tools versus evidence
Distinguish what the demo proves from what it merely demonstrates.

5. Ethical, governance, reputational, and practical risks
Flag risks separately.

6. User testing needed
Define what evidence would show whether the workflow confuses users or encourages AI delegation.

7. What would change your mind?
State falsifying evidence that would make the project weaker or require redesign.

8. Revised decision wording
Rewrite the project decision in a more defensible form.

Use APA 7 references where possible. Do not invent citations.`;
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
  const optionRows = state.options.map((o) => `| ${o.name} | ${classifyOptionType(o.name)} | ${o.benefit} | ${o.evidence} | ${o.reversible} | ${o.risk} | ${o.uncertainty} | ${scoreOption(o)} |`).join("\n");

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
| Option | Type | Benefit | Evidence | Reversible | Risk | Uncertainty | Score |
|---|---|---:|---:|---:|---:|---:|---:|
${optionRows}

## Score leader
${top ? `${top.name} (${scoreOption(top)}/15), classified as ${classifyOptionType(top.name)}` : "No option available"}

Scores are screening signals, not decisions.

## Priority-type check
${buildPriorityClarifier()}

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

${buildModeSpecificAudit()}

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
  const data = decisionData();

  if (isNbsDecision(data)) {
    return `You are reviewing a P(HI) Decision Memo for an NbS spatial decision-support problem.

Do not make the decision for me. Act as a sceptical academic examiner and critical thinking partner.

Your response must be structured as follows:

1. Recommendation
Choose one: proceed, revise, test first, delay, or reject.

2. Strongest objection
Identify the strongest objection to the current memo.

3. Category clarity
Separate:
- process priority
- intervention priority
- site priority

Check whether the option matrix compares like with like.

4. Weak assumptions
Identify assumptions about spatial layers, pollutant pathways, artificial drainage, land-manager feasibility, maintenance, monitoring, and reversibility.

5. Tools versus observable evidence
Create a table:
- item
- what it is
- what it is not

6. Ecological, ethical, governance, and practical risks
Discuss each separately.

7. Field validation and independent review needed
List the evidence required before implementation.

8. What would change your mind?
Identify the most important falsifying evidence.

9. Revised decision wording
Rewrite the provisional decision so it distinguishes advisory/process sequencing from final physical NbS intervention selection.

10. References
Use APA 7 references where possible. Do not invent citations.

Decision memo to review:

${buildMemo()}`;
  }

  return `You are reviewing a P(HI) Decision Memo for a public research/demo project.

Do not make the decision for me. Act as a sceptical academic examiner and critical thinking partner.

Your response must be structured as follows:

1. Recommendation
Choose one: proceed, revise, test first, delay, or reject.

2. Strongest objection
Identify the strongest objection to the current project path.

3. What the demo proves versus what it only demonstrates
Separate evidence from aspiration.

4. Weak assumptions
Identify assumptions about users, interface clarity, AI handoff behaviour, citation value, and public usefulness.

5. Ethical, governance, reputational, and practical risks
Discuss each separately.

6. User testing needed
State what evidence would show whether users understand: P(HI) structures, AI critiques, human decides.

7. EcoLogits check
Assess whether the footprint claims distinguish measured design facts from estimates.

8. Zenodo readiness
State what must be true before archival.

9. Revised decision wording
Rewrite the provisional decision in a more defensible form.

10. References
Use APA 7 references where possible. Do not invent citations.

Decision memo to review:

${buildMemo()}`;
}

function buildEvidencePrompt() {
  const data = decisionData();

  if (!isNbsDecision(data)) {
    return `You are reviewing a P(HI) project-method audit.

Do not make the decision for me. Improve the quality of the project logic.

Use this structure:
1. Recommendation: proceed, revise, test first, delay, or reject.
2. What the demo actually demonstrates.
3. What the demo does not demonstrate.
4. Weak assumptions about users and AI handoff behaviour.
5. Evidence needed before public release.
6. EcoLogits caution: distinguish measured design facts from estimates.
7. Zenodo caution: state whether the project is ready for archival.
8. Revised release wording.

Decision memo to review:

${buildMemo()}`;
  }

  return `You are reviewing a P(HI)-SDSS evidence audit for a nature-based solutions decision.

Do not choose the intervention for me. Improve the evidence logic.

Use this structure:
1. Recommendation: proceed, revise, test first, delay, or reject.
2. Category clarity: process priority, intervention priority, site priority.
3. Tools versus observable evidence table.
4. Pollutant pathway check.
5. Artificial drainage and hydrological connectivity check.
6. Land-manager feasibility and maintenance check.
7. Monitoring and field validation checklist.
8. Falsifying evidence.
9. Revised decision wording.

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
