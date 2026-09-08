const interventions = [
  {
    id: "riparian",
    number: "01",
    title: "Riparian buffers",
    summary: "Vegetated margins that interrupt pollutant pathways while strengthening the land–water interface.",
    pressures: ["nutrients", "sediment", "biodiversity"],
    labels: ["Nutrients", "Sediment", "Biodiversity"],
    fit: "Where diffuse runoff or shallow subsurface flow can be intercepted before reaching a watercourse.",
    function: "Slow and filter runoff, trap sediment, support nutrient uptake and soil denitrification, stabilise banks, provide shade and habitat connectivity.",
    monitor: "Width and continuity; vegetation cover; bank condition; runoff bypass; turbidity/TSS; nutrient concentrations where the sampling design can detect change.",
    watch: "Concentrated flow can bypass a buffer. Effectiveness depends on hydrological connectivity, width, soils, vegetation, maintenance, and pollutant form."
  },
  {
    id: "wetland",
    number: "02",
    title: "Constructed wetlands",
    summary: "Designed wetland systems that use retention, sedimentation, vegetation, and microbial processes.",
    pressures: ["nutrients", "sediment", "flooding", "biodiversity"],
    labels: ["Nutrients", "Sediment", "Flooding", "Biodiversity"],
    fit: "Where flows can be safely intercepted and retained long enough for treatment without creating unacceptable hydraulic or ecological risk.",
    function: "Increase residence time; settle suspended solids; support nutrient uptake and denitrification; create wetland habitat; sometimes attenuate peak flows locally.",
    monitor: "Inflow/outflow flow and water level; nitrate, phosphorus and TSS as relevant; vegetation; sediment accumulation; overflow/bypass frequency.",
    watch: "Hydraulic loading and siting matter. Overloading, short-circuiting, accumulated sediment, or poor maintenance can reduce performance and alter nutrient behaviour."
  },
  {
    id: "pond",
    number: "03",
    title: "Sediment ponds & traps",
    summary: "Small retention features designed primarily to slow runoff and settle suspended material.",
    pressures: ["sediment", "nutrients", "flooding"],
    labels: ["Sediment", "Particulate P", "Flooding"],
    fit: "At identifiable runoff delivery points where particulate material can be intercepted before entering receiving waters.",
    function: "Reduce flow velocity, encourage sedimentation, retain particulate-bound pollutants, and provide limited temporary storage.",
    monitor: "Turbidity/TSS; sediment depth; inflow and outlet condition; water level; overtopping and bypass during high-flow events.",
    watch: "They mainly target particulate loads, not dissolved nutrients. Desilting and safe sediment management are part of the intervention, not optional extras."
  },
  {
    id: "hedgerow",
    number: "04",
    title: "Hedgerows & shelterbelts",
    summary: "Linear woody features that can reconnect habitat and reshape wind, runoff, and field-edge structure.",
    pressures: ["biodiversity", "sediment", "drought"],
    labels: ["Biodiversity", "Sediment", "Water retention"],
    fit: "Where landscape connectivity, erosion control, shelter, and interruption of diffuse surface pathways are relevant.",
    function: "Provide habitat and connectivity, reduce wind exposure, increase structural roughness, disrupt some surface runoff pathways, and support infiltration around root zones.",
    monitor: "Woody continuity and structure; flowering/fruiting; gaps; soil condition or infiltration; erosion; selected bird, pollinator, or invertebrate indicators.",
    watch: "A hedge is not automatically a water-quality measure. Placement relative to actual runoff pathways determines whether it intercepts the target pressure."
  },
  {
    id: "rewetting",
    number: "05",
    title: "Peatland & wet-grassland rewetting",
    summary: "Hydrological restoration aimed at recovering wet conditions, ecosystem function, and long-term resilience.",
    pressures: ["carbon", "drought", "flooding", "biodiversity"],
    labels: ["Carbon / peat", "Water retention", "Flooding", "Biodiversity"],
    fit: "On drained organic or wetland soils where restoring a higher water table is ecologically appropriate and compatible with surrounding land and infrastructure.",
    function: "Raise or stabilise water tables, reduce peat oxidation, restore wetland vegetation, retain water in the landscape, and recover habitat processes.",
    monitor: "Water-table depth; vegetation community; drain/block condition; downstream DOC or colour where relevant; flow response; GHGs only where the monitoring design supports it.",
    watch: "Responses can be non-linear. Methane, dissolved organic carbon, local water levels, adjacent land, and time-to-recovery need explicit consideration."
  },
  {
    id: "leaky",
    number: "06",
    title: "Leaky barriers & floodplain reconnection",
    summary: "Measures that slow high flows, increase roughness, and reconnect water with temporary landscape storage.",
    pressures: ["flooding", "sediment", "biodiversity", "drought"],
    labels: ["Flooding", "Sediment", "Biodiversity", "Water retention"],
    fit: "Where hydraulic and geomorphic assessment shows that slowing or spreading flow can occur without transferring unacceptable risk elsewhere.",
    function: "Increase hydraulic roughness, delay some peak flow locally, encourage floodplain storage and deposition, and create more diverse wet habitat.",
    monitor: "Water level and flow timing; inundation extent/duration; barrier condition; erosion/deposition; debris accumulation; passage and habitat effects.",
    watch: "Local attenuation does not prove catchment-scale flood reduction. Landowner consent, structural condition, geomorphic response, and maintenance are essential."
  }
];

const pressureNames = {
  all: "all pressures",
  nutrients: "nutrient pressure",
  sediment: "sediment pressure",
  flooding: "flooding",
  drought: "water-retention pressure",
  biodiversity: "biodiversity",
  carbon: "carbon / peat"
};

const grid = document.getElementById("interventionGrid");
const filters = [...document.querySelectorAll("[data-pressure]")];
const resultCount = document.getElementById("resultCount");

function renderCards() {
  grid.innerHTML = interventions.map(item => `
    <article class="intervention-card" data-pressures="${item.pressures.join(" ")}">
      <div class="intervention-inner">
        <span class="card-number">${item.number}</span>
        <h3>${item.title}</h3>
        <p class="card-summary">${item.summary}</p>
        <div class="pressure-tags">
          ${item.labels.map(label => `<span class="pressure-tag">${label}</span>`).join("")}
        </div>
        <dl class="field-lines">
          <div class="field-line">
            <dt>Best fit</dt>
            <dd>${item.fit}</dd>
          </div>
          <div class="field-line">
            <dt>Function</dt>
            <dd>${item.function}</dd>
          </div>
          <div class="field-line">
            <dt>Monitor</dt>
            <dd>${item.monitor}</dd>
          </div>
          <div class="field-line watch">
            <dt>Watch-out</dt>
            <dd>${item.watch}</dd>
          </div>
        </dl>
      </div>
    </article>
  `).join("");
}

function applyFilter(pressure) {
  const cards = [...grid.querySelectorAll(".intervention-card")];
  let visible = 0;

  cards.forEach(card => {
    const matches = pressure === "all" || card.dataset.pressures.split(" ").includes(pressure);
    card.hidden = !matches;
    if (matches) visible += 1;
  });

  filters.forEach(button => {
    const active = button.dataset.pressure === pressure;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  resultCount.textContent = `${visible} of ${interventions.length} interventions shown for ${pressureNames[pressure]}.`;
}

filters.forEach(button => {
  button.addEventListener("click", () => applyFilter(button.dataset.pressure));
});

renderCards();
applyFilter("all");

const checklist = document.getElementById("credibilityChecklist");
const checks = [...checklist.querySelectorAll('input[type="checkbox"]')];
const scoreValue = document.getElementById("scoreValue");
const scoreTitle = document.getElementById("scoreTitle");
const scoreText = document.getElementById("scoreText");
const reset = document.getElementById("resetChecklist");

const scoreStates = [
  ["Claim needs work", "Start by specifying the pressure and the mechanism you expect the intervention to change."],
  ["Claim needs work", "One strong statement is not yet an evidence chain. Add the missing pressure, pathway, baseline, or safeguards."],
  ["Plausible, but evidence incomplete", "The idea has a defensible spine, but major assumptions still need to be tested or made explicit."],
  ["Plausible, but evidence incomplete", "This is a useful working proposition. Strengthen the baseline, monitoring design, or whole-system safeguards."],
  ["Credible working hypothesis", "The claim is structured well enough to take into field verification, while remaining open to revision."],
  ["Strong field-ready proposition", "The pressure, mechanism, evidence logic, safeguards, and claim strength are all visible. Site-specific verification still matters."]
];

function updateScore() {
  const score = checks.filter(input => input.checked).length;
  scoreValue.textContent = score;
  scoreTitle.textContent = scoreStates[score][0];
  scoreText.textContent = scoreStates[score][1];
}

checks.forEach(input => input.addEventListener("change", updateScore));

reset.addEventListener("click", () => {
  checks.forEach(input => { input.checked = false; });
  updateScore();
  checks[0].focus();
});
