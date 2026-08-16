(() => {
  'use strict';

  const STORAGE_KEY = 'aie-requester-draft-v1';
  const OCEI_EMAIL = 'info@ocei.ie';

  const INFO_MODULES = [
    {
      key: 'baseline',
      title: 'Environmental baseline / constraints',
      help: 'Existing baseline, constraints, receptor or site-condition information.',
      text: 'environmental baseline and constraints information relevant to the subject, including existing surveys, maps and identified environmental receptors'
    },
    {
      key: 'water',
      title: 'Water quality / WFD',
      help: 'Status, pressures, monitoring, sampling, measures, pollution pathways.',
      text: 'water-quality and Water Framework Directive information, including relevant status, pressures, monitoring results, sampling information and measures where held'
    },
    {
      key: 'hydrology',
      title: 'Hydrology / flooding / drainage',
      help: 'Floodplain, hydraulic, drainage, runoff, groundwater and surface-water effects.',
      text: 'hydrology, flood-risk, drainage, runoff and groundwater/surface-water information relevant to the subject'
    },
    {
      key: 'hydromorphology',
      title: 'Hydromorphology / river form',
      help: 'Channel form, continuity, sediment, crossings, morphology and physical condition.',
      text: 'hydromorphology information, including channel form, continuity, sediment, crossings and physical river-condition information where relevant'
    },
    {
      key: 'ecology',
      title: 'Ecology / biodiversity',
      help: 'Habitats, species, connectivity, protected sites, survey methods and mitigation.',
      text: 'ecology and biodiversity information, including relevant habitat/species surveys, ecological constraints, connectivity, protected-site information and mitigation'
    },
    {
      key: 'heritage',
      title: 'Cultural / built heritage',
      help: 'Archaeology, architecture, historic landscape, cultural sites and setting.',
      text: 'cultural and built-heritage information relevant to environmental effects, including archaeology, architectural heritage, historic landscape and setting where held'
    },
    {
      key: 'airnoise',
      title: 'Air / noise / light',
      help: 'Existing assessments, monitoring, modelling and assumptions.',
      text: 'air-quality, noise and lighting information relevant to the environmental effects of the subject, including existing assessments, monitoring and modelling'
    },
    {
      key: 'climate',
      title: 'Climate / carbon',
      help: 'Emissions, carbon assumptions, climate resilience and adaptation.',
      text: 'climate and carbon information, including relevant emissions assumptions, carbon appraisal, climate resilience or adaptation information where held'
    },
    {
      key: 'landsoil',
      title: 'Land / soil / agriculture',
      help: 'Soil, land use, farm severance, access, hedgerows, temporary works.',
      text: 'land, soil and agricultural environmental information, including relevant land-use, soil, severance, access, hedgerow and temporary-works information'
    },
    {
      key: 'traffic',
      title: 'Traffic / transport assumptions',
      help: 'Counts, classifications, demand, origin-destination, toll/HGV scenarios.',
      text: 'traffic and transport information insofar as it informs environmental effects or environmentally consequential options, including relevant counts, classifications, assumptions and scenarios'
    },
    {
      key: 'alternatives',
      title: 'Alternatives / option appraisal',
      help: 'Long/short lists, comparisons, environmental criteria, matrices and reasons.',
      text: 'environmental information used to identify, compare or narrow alternatives/options, including relevant criteria, matrices, scores, assumptions, recorded recommendations and reasons where held'
    },
    {
      key: 'gis',
      title: 'GIS / spatial data',
      help: 'Native GIS, route/footprint geometry, constraints layers, georeferenced maps.',
      text: 'spatial information and GIS data relevant to the subject, including route/footprint geometry, constraints layers and georeferenced mapping where held'
    },
    {
      key: 'models',
      title: 'Models / raw data / assumptions',
      help: 'Inputs, outputs, scenarios, calibration, validation, sensitivity and raw data.',
      text: 'underlying model and dataset information relevant to the subject, including inputs, outputs, scenarios, calibration/validation information, assumptions and sensitivity information where held'
    },
    {
      key: 'methods',
      title: 'Methods / metadata / QA-QC',
      help: 'Sampling/analysis methods, data dictionaries, uncertainty and quality control.',
      text: 'methods and metadata needed to interpret relevant environmental information, including sampling/analysis procedures, data dictionaries, quality-control information and uncertainty where held'
    },
    {
      key: 'mitigation',
      title: 'Mitigation / monitoring',
      help: 'Proposed measures, monitoring plans, thresholds, triggers and maintenance.',
      text: 'mitigation and monitoring information, including relevant measures, monitoring plans, thresholds, adaptive-management triggers and maintenance arrangements where held'
    },
    {
      key: 'decision',
      title: 'Environmental decision trail',
      help: 'Environmental information in minutes, presentations, decision registers and working papers.',
      text: 'environmental information recording the decision trail, including relevant appraisal material, recommendations, meeting records, presentations, decision registers or working papers insofar as they contain environmental information'
    },
    {
      key: 'economics',
      title: 'Economic analysis / assumptions',
      help: 'Cost-benefit or other economic analysis used within environmental measures/activities.',
      text: 'cost-benefit and other economic analysis or assumptions used within relevant measures or activities that affect or protect the environment'
    }
  ];

  const REVIEW_ISSUES = [
    {
      key: 'search',
      title: 'Search adequacy',
      help: 'The decision says information is not held/found but does not adequately explain the search.',
      review: 'the adequacy of the searches undertaken for environmental information within the scope of the original request, including the relevant teams, repositories, project files and information systems reasonably likely to contain it',
      ocei: 'whether the public authority took reasonable and adequate steps to identify and locate the environmental information within the scope of the request'
    },
    {
      key: 'heldfor',
      title: 'Information may be held “for” the authority',
      help: 'Consultant, shared service or service provider may hold relevant environmental information.',
      review: 'whether relevant environmental information is held for the authority by a consultant, shared service or other service provider, having regard to the actual arrangements and the authority’s entitlement/control',
      ocei: 'whether relevant environmental information is held by or for the public authority, including any applicable third-party or service-provider arrangements'
    },
    {
      key: 'public',
      title: '“Publicly available” does not answer the request',
      help: 'The link or public material may not be equivalent to the information/form requested.',
      review: 'whether the information identified as publicly available is in fact the same environmental information requested, including the relevant content and existing form',
      ocei: 'whether reliance on publicly available material properly answered the request for the specified environmental information'
    },
    {
      key: 'format',
      title: 'Wrong / unavailable format',
      help: 'Information exists but the decision does not address the existing form requested.',
      review: 'the form and manner of access, including what existing electronic, data, GIS or other form is actually held and can be supplied',
      ocei: 'whether the public authority properly dealt with the requested form or manner of access under the AIE Regulations'
    },
    {
      key: 'meaning',
      title: '“Not held” / “not found” / “does not exist” is unclear',
      help: 'Different propositions have been collapsed together.',
      review: 'the distinction between information not held, information not located after searches, a named record not existing, and relevant information not yet created',
      ocei: 'whether the decision adequately and lawfully addressed the status of the requested information, including any reliance on Article 7(5)'
    },
    {
      key: 'exception',
      title: 'Refusal / exception reasoning',
      help: 'A statutory refusal ground was applied or reasons/public-interest analysis appear inadequate.',
      review: 'the application of the refusal ground(s) relied upon, including the reasons given and the Article 10 requirements where applicable',
      ocei: 'whether the refusal ground(s) relied upon were correctly applied, including any required restrictive interpretation, reasons and public-interest balancing'
    },
    {
      key: 'environmental',
      title: 'Incorrectly treated as non-environmental',
      help: 'The information may fall within one or more AIE environmental-information categories.',
      review: 'whether the information in question falls within the definition of environmental information under Article 3(1)',
      ocei: 'whether the information is environmental information within Article 3(1) of the AIE Regulations'
    },
    {
      key: 'transfer',
      title: 'Possible other public authority',
      help: 'The information may be held by another public authority and Article 7(6) may be relevant.',
      review: 'whether Article 7(6) should be applied where the authority is aware that another public authority holds the requested environmental information',
      ocei: 'whether the public authority properly addressed information known to be held by another public authority under Article 7(6)'
    },
    {
      key: 'attachments',
      title: 'Granted material / attachment missing',
      help: 'The schedule or decision says something is granted but it was not actually supplied.',
      review: 'the apparent omission of material identified as granted or enclosed in the decision/schedule',
      ocei: 'whether information identified as granted was in fact made available in accordance with the decision'
    },
    {
      key: 'scope',
      title: 'Original scope was misconstrued',
      help: 'The decision may have treated a request for underlying information as only a request for a named record.',
      review: 'whether the original request was correctly construed as a request for the specified environmental information, rather than only for a document bearing a particular title',
      ocei: 'whether the public authority correctly construed the scope and substance of the original AIE request'
    }
  ];

  const ROLE_SUGGESTIONS = {
    landowner: ['gis','hydrology','ecology','heritage','landsoil','airnoise','mitigation'],
    tenant: ['airnoise','hydrology','traffic','mitigation'],
    resident: ['traffic','airnoise','hydrology','ecology','mitigation'],
    farmer: ['landsoil','hydrology','water','gis','mitigation'],
    business: ['traffic','airnoise','hydrology','alternatives','mitigation'],
    river: ['water','hydrology','hydromorphology','ecology','models','methods','mitigation'],
    biodiversity: ['ecology','gis','methods','mitigation','decision'],
    heritage: ['heritage','gis','alternatives','decision'],
    school: ['traffic','airnoise','hydrology','mitigation'],
    community: ['alternatives','decision','models','gis','mitigation'],
    researcher: ['models','methods','gis','baseline','decision'],
    journalist: ['decision','alternatives','models','baseline'],
    representative: ['decision','alternatives','baseline','mitigation'],
    other: ['baseline','decision']
  };

  const ROLE_ACTIONS = {
    landowner: [
      ['If obtained', 'Map the actual footprint and environmental effects on the property; brief a solicitor, ecologist or engineer; make a specific consultation, access, mitigation or acquisition submission.'],
      ['If not obtained', 'Preserve the dated response; decide whether the search/access issue warrants internal review; ask again when design information legitimately matures.']
    ],
    tenant: [
      ['If obtained', 'Assess effects on living conditions, access, noise, air, lighting and flooding; use the evidence in consultation or engagement with the landlord/authority.'],
      ['If not obtained', 'Record unanswered effects and use focused follow-up questions or a later request rather than assuming that no assessment occurred.']
    ],
    resident: [
      ['If obtained', 'Turn general concern into a specific representation using traffic, noise, flood, ecology or construction evidence.'],
      ['If not obtained', 'Preserve the unresolved point and ask what evidence exists at the next meaningful decision stage.']
    ],
    farmer: [
      ['If obtained', 'Assess drainage, severance, soil, field access, hedgerows and operational impacts; obtain agricultural or engineering advice where useful.'],
      ['If not obtained', 'Record what remains undocumented and seek later-stage land/drainage information before irreversible decisions.']
    ],
    business: [
      ['If obtained', 'Assess access, traffic, construction and operational effects; make an evidence-based submission and seek practical mitigation.'],
      ['If not obtained', 'Preserve unresolved impacts and ask again when the project stage produces the relevant traffic/design evidence.']
    ],
    river: [
      ['If obtained', 'Compare WFD, hydromorphology, fish, sediment, runoff and monitoring evidence with river objectives and local observations; make a technical submission.'],
      ['If not obtained', 'Clarify whether studies are pending, held elsewhere or not yet created; alert relevant environmental bodies cautiously and preserve the chronology.']
    ],
    biodiversity: [
      ['If obtained', 'Test habitat/species assumptions, survey timing, connectivity and mitigation; contribute specialist observations.'],
      ['If not obtained', 'Ask whether surveys are pending, held elsewhere or not yet created and preserve the dated baseline.']
    ],
    heritage: [
      ['If obtained', 'Assess effects on significance, setting, archaeology and historic landscape and use them in heritage submissions.'],
      ['If not obtained', 'Record what has not been documented and seek later survey/assessment outputs if the project progresses.']
    ],
    school: [
      ['If obtained', 'Use traffic, exposure, noise and active-travel evidence to ask specific questions about pupils, movement and mitigation.'],
      ['If not obtained', 'Preserve unresolved safety/environmental questions and use consultation and elected-representative routes.']
    ],
    community: [
      ['If obtained', 'Compare options, assumptions and effects; prepare fact-based public briefings; coordinate complementary submissions.'],
      ['If not obtained', 'Coordinate focused requests rather than duplicating broad “everything” requests; preserve what the authority said at each stage.']
    ],
    researcher: [
      ['If obtained', 'Reanalyse data, reproduce findings, map GIS, assess methods and publish with a provenance trail.'],
      ['If not obtained', 'Treat non-holding/non-location as a bounded result only; document the search outcome and repeat later if the project evolves.']
    ],
    journalist: [
      ['If obtained', 'Verify claims, reconstruct the chronology and attribute statements to the actual record.'],
      ['If not obtained', 'Report the authority’s stated position precisely; do not turn “not found” into an unsupported allegation of concealment or non-assessment.']
    ],
    representative: [
      ['If obtained', 'Ask technically informed questions, scrutinise executive recommendations and represent constituents using the actual environmental evidence.'],
      ['If not obtained', 'Ask formally what evidence exists, when it will be available and what decision stage it is intended to inform.']
    ],
    other: [
      ['If obtained', 'Identify what the material lets you know, demonstrate or question in the forum relevant to your concern.'],
      ['If not obtained', 'Classify the response precisely, preserve the baseline and decide whether review or a later fresh request is actually useful.']
    ]
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  let currentStage = 'initial';
  let deferredInstallPrompt = null;

  function escapeLine(value) {
    return String(value || '').trim();
  }

  function bulletLines(items) {
    return items.filter(Boolean).map(item => `• ${item}`).join('\n');
  }

  function selectedValues(containerId) {
    return $$(`#${containerId} input[type="checkbox"]:checked`).map(el => el.value);
  }

  function selectedIssueObjects(containerId) {
    const selected = new Set(selectedValues(containerId));
    return REVIEW_ISSUES.filter(item => selected.has(item.key));
  }

  function renderDynamicChoices() {
    $('infoModules').innerHTML = INFO_MODULES.map(item => `
      <label class="checkbox-card">
        <input type="checkbox" value="${item.key}">
        <span><b>${item.title}</b><small>${item.help}</small></span>
      </label>`).join('');

    const issueHtml = REVIEW_ISSUES.map(item => `
      <label class="checkbox-card">
        <input type="checkbox" value="${item.key}">
        <span><b>${item.title}</b><small>${item.help}</small></span>
      </label>`).join('');
    $('reviewIssues').innerHTML = issueHtml;
    $('oceiIssues').innerHTML = issueHtml;
  }

  function setStage(stage, pushHash = true) {
    currentStage = ['initial','review','ocei'].includes(stage) ? stage : 'initial';
    $$('.stage-card').forEach(btn => {
      const active = btn.dataset.stage === currentStage;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    $$('.initial-only').forEach(el => el.hidden = currentStage !== 'initial');
    $$('.review-only').forEach(el => el.hidden = currentStage !== 'review');
    $$('.ocei-only').forEach(el => el.hidden = currentStage !== 'ocei');

    const config = {
      initial: {
        eyebrow: 'Stage 1',
        title: 'Initial AIE request',
        intro: 'Describe the environmental question and choose only the information that would help answer it.',
        warning: 'Start here if you have not yet made an AIE request.'
      },
      review: {
        eyebrow: 'Stage 2 · Article 11',
        title: 'Request for internal review',
        intro: 'Challenge a specific access problem in the initial AIE decision without silently expanding the original request.',
        warning: 'Internal review is normally the route after an unsatisfactory initial AIE decision, and normally the prerequisite before an OCEI appeal.'
      },
      ocei: {
        eyebrow: 'Stage 3 · Article 12',
        title: 'Appeal to OCEI',
        intro: 'Ask the Commissioner for Environmental Information to review a remaining AIE access issue after internal review.',
        warning: 'OCEI reviews the information-access decision, not whether the underlying project should proceed. Internal review is normally required first.'
      }
    }[currentStage];

    $('formEyebrow').textContent = config.eyebrow;
    $('formTitle').textContent = config.title;
    $('formIntro').textContent = config.intro;
    $('routeWarningText').textContent = config.warning;
    if (pushHash) history.replaceState(null, '', `#${currentStage}`);
    updateDraft();
  }

  function updateStructureGuidance() {
    const value = $('authorityStructure').value;
    const nameWrap = $('structureNameWrap');
    const box = $('structureGuidance');
    nameWrap.hidden = value === 'direct';
    const name = escapeLine($('structureName').value) || 'the shared service / programme / service provider';

    const messages = {
      direct: '',
      shared: `A public-facing shared service may not be a separate legal entity. Anchor the request to the managing/hosting public authority and describe relevant environmental information held by or for it within ${name}.`,
      consultant: `Do not assume that every consultant file is automatically held “for” the authority. Ask the public authority to consider relevant environmental information held for it under the actual service/contract arrangements involving ${name}.`,
      unclear: `If you genuinely cannot identify the holder, address the most plausible public authority and ask it to transfer the relevant part or advise you where to direct it if another public authority is known to hold the information.`
    };
    box.hidden = value === 'direct';
    box.textContent = messages[value] || '';
  }

  function updateFit() {
    const count = selectedValues('statutoryCategories').length;
    const box = $('fitResult');
    if (count) {
      box.classList.add('is-fit');
      box.textContent = `${count} environmental connection${count === 1 ? '' : 's'} selected. That supports an AIE route, subject to the actual information requested and the status of the body holding it.`;
    } else {
      box.classList.remove('is-fit');
      box.textContent = 'Choose at least one connection. If your request is purely administrative or for personal records, FOI may be the more suitable route.';
    }
  }

  function applyRoleSuggestions() {
    const suggestions = ROLE_SUGGESTIONS[$('role').value] || ROLE_SUGGESTIONS.other;
    $$(`#infoModules input[type="checkbox"]`).forEach(el => {
      if (suggestions.includes(el.value)) el.checked = true;
    });
    updateDraft();
    $('copyStatus').textContent = 'Role-based suggestions added. Review and remove anything you do not actually need.';
    setTimeout(() => { if ($('copyStatus').textContent.startsWith('Role-based')) $('copyStatus').textContent = ''; }, 3500);
  }

  function initialRequestItems() {
    const selected = new Set(selectedValues('infoModules'));
    const items = INFO_MODULES.filter(item => selected.has(item.key)).map(item => item.text);
    const custom = escapeLine($('customInfo').value);
    if (custom) items.push(custom.replace(/^[-•]\s*/, ''));
    return items;
  }

  function formatText() {
    const checked = selectedValues('formatChoices');
    const preferred = $('preferredForm').value;
    const custom = escapeLine($('customForm').value);
    if (preferred === 'custom' && custom) return custom;
    if (checked.length) return checked.join(', ');
    const defaults = {
      electronic: 'electronic form, in the existing electronic formats in which the information is held',
      searchable: 'searchable PDF, together with underlying data where already held electronically',
      data: 'native data formats where held, including CSV/XLSX/GIS/model outputs as applicable',
      custom: 'electronic form'
    };
    return defaults[preferred] || defaults.electronic;
  }

  function roleLine() {
    if (!$('includeRole').checked) return '';
    const select = $('role');
    const label = select.options[select.selectedIndex]?.text || '';
    return label ? `For context only, I am making this request in my capacity as: ${label}.\n\n` : '';
  }

  function structureParagraph() {
    const mode = $('authorityStructure').value;
    const structureName = escapeLine($('structureName').value);
    if (mode === 'shared') {
      return `Where relevant environmental information is maintained within${structureName ? ` ${structureName}` : ' a shared service or programme office'} on behalf of the authority, please include information held by or for the authority that falls within this request.`;
    }
    if (mode === 'consultant') {
      return `Where relevant environmental information may be held for the authority by${structureName ? ` ${structureName}` : ' a consultant or service provider'}, please consider whether it falls within information held “by or for” the authority under the AIE Regulations.`;
    }
    if (mode === 'unclear') {
      return `If relevant information is not held by or for your authority but you are aware that another public authority holds it, please transfer the relevant part of the request or advise me where it should be directed in accordance with Article 7(6).`;
    }
    return '';
  }

  function contactSignature() {
    const name = escapeLine($('requesterName').value) || '[YOUR NAME]';
    const email = escapeLine($('requesterEmail').value);
    const address = escapeLine($('requesterAddress').value);
    const lines = [name];
    if (address) lines.push(address);
    if (email) lines.push(email);
    return lines.join('\n');
  }

  function generateInitial() {
    const authority = escapeLine($('authority').value) || '[PUBLIC AUTHORITY]';
    const subjectMatter = escapeLine($('subjectMatter').value) || '[PROJECT / PLAN / PLACE / ACTIVITY]';
    const location = escapeLine($('location').value);
    const scope = escapeLine($('scopePeriod').value);
    const items = initialRequestItems();
    const requestItems = items.length ? bulletLines(items) : '• [ADD ONE OR MORE FOCUSED ITEMS OF ENVIRONMENTAL INFORMATION]';
    const structure = structureParagraph();
    const publicTransfer = $('authorityStructure').value === 'unclear' ? '' : `If the requested environmental information is not held by or for ${authority}, but you are aware that another public authority holds it, please transfer the relevant part of the request or advise me where it should be directed in accordance with Article 7(6).`;
    const locText = location ? ` in / relating to ${location}` : '';
    const scopeText = scope ? `\nThe request is limited to: ${scope}.` : '';
    const body = `Dear AIE Officer,\n\nUnder the European Communities (Access to Information on the Environment) Regulations 2007 to 2018, I request access to environmental information held by or for ${authority} concerning ${subjectMatter}${locText}.${scopeText}\n\n${roleLine()}I request the following environmental information:\n${requestItems}\n\nPreferred form: ${formatText()}.\n\n${structure ? structure + '\n\n' : ''}If any of the requested information is already publicly available, please identify the specific source or URL corresponding to the information requested.\n\nIf any information is withheld, please identify the applicable provision and reasons for refusal and make available any separable environmental information that can be released.\n\n${publicTransfer ? publicTransfer + '\n\n' : ''}Please acknowledge receipt of this request.\n\nKind regards,\n${contactSignature()}`;
    return {
      to: escapeLine($('authorityEmail').value),
      subject: `AIE request – ${subjectMatter}`,
      body
    };
  }

  function generateReview() {
    const authority = escapeLine($('authority').value) || '[PUBLIC AUTHORITY]';
    const subjectMatter = escapeLine($('subjectMatter').value) || '[SUBJECT OF ORIGINAL AIE REQUEST]';
    const ref = escapeLine($('reviewRef').value);
    const decisionDate = escapeLine($('reviewDecisionDate').value) || '[DECISION DATE]';
    const scopeText = $('reviewScope').value === 'whole' ? 'the decision as a whole' : 'the relevant parts of the decision identified below';
    const issues = selectedIssueObjects('reviewIssues');
    const custom = escapeLine($('reviewCustom').value);
    const grounds = issues.length ? bulletLines(issues.map(x => x.review)) : '• [IDENTIFY THE SPECIFIC ACCESS ISSUE(S) ARISING FROM THE ORIGINAL REQUEST AND DECISION]';
    const customBlock = custom ? `\n\nIn addition, I ask the reviewer to consider this bounded factual point:\n${custom}` : '';
    const refText = ref ? ` (${ref})` : '';
    const structure = structureParagraph();

    const body = `Dear Internal Reviewer,\n\nI request an internal review under Article 11 of the AIE Regulations of ${scopeText} in ${authority}'s decision dated ${decisionDate}${refText} concerning ${subjectMatter}.\n\nI am not seeking to broaden the scope of my original AIE request. I ask for a fresh reconsideration of the original request and decision on the following grounds:\n${grounds}${customBlock}\n\n${structure ? structure + '\n\n' : ''}Where the authority maintains that no further information is held or can be found, I would be grateful for a reasoned account sufficient to understand the searches undertaken and the basis for that conclusion. Please distinguish, where relevant, between information not held, information not located after searches, a named record not existing, and information not yet created.\n\nI ask that any environmental information located on review and falling within the original scope be made available, subject only to any lawful refusal provisions. If another public authority is known to hold information within scope, please address Article 7(6) as appropriate.\n\nPlease acknowledge receipt of this request for internal review.\n\nKind regards,\n${contactSignature()}`;
    return {
      to: escapeLine($('authorityEmail').value),
      subject: `AIE${ref ? ' ' + ref : ''} – Request for Internal Review`,
      body
    };
  }

  function generateOcei() {
    const authority = escapeLine($('authority').value) || '[PUBLIC AUTHORITY]';
    const subjectMatter = escapeLine($('subjectMatter').value) || '[SUBJECT OF AIE REQUEST]';
    const ref = escapeLine($('oceiRef').value);
    const reviewDate = escapeLine($('oceiDecisionDate').value);
    const noDecision = $('noReviewDecision').checked;
    const issues = selectedIssueObjects('oceiIssues');
    const custom = escapeLine($('oceiCustom').value);
    const issueLines = issues.length ? bulletLines(issues.map(x => x.ocei)) : '• [IDENTIFY THE SPECIFIC AIE ACCESS ISSUE(S) THAT REMAIN AFTER INTERNAL REVIEW]';
    const customBlock = custom ? `\n\nAdditional bounded factual point:\n${custom}` : '';
    const reviewSentence = noDecision
      ? `I sought an internal review from ${authority}, but no internal-review decision was notified within the period in which it was required to be notified.`
      : `I completed the internal-review process. The internal-review decision was notified on ${reviewDate || '[INTERNAL REVIEW DECISION DATE]'}.`;
    const refText = ref ? ` (${ref})` : '';

    const body = `Dear Commissioner,\n\nI wish to appeal under Article 12 of the AIE Regulations in relation to ${authority}'s handling of my request for environmental information concerning ${subjectMatter}${refText}.\n\n${reviewSentence}\n\nMy appeal concerns the following remaining AIE access issue(s):\n${issueLines}${customBlock}\n\nI ask the Commissioner to review the public authority's decision in accordance with the AIE Regulations. I understand that the Commissioner's role is to review the information-access decision rather than the substantive merits of the underlying project or activity.\n\nI attach, or can provide, the following material as applicable:\n• the original AIE request;\n• the initial decision and schedule/attachments;\n• my request for internal review;\n• the internal-review decision, if one was issued; and\n• relevant correspondence necessary to understand the appeal.\n\nPlease let me know if any further procedural information or fee step is required to validate the appeal.\n\nKind regards,\n${contactSignature()}`;
    return {
      to: OCEI_EMAIL,
      subject: `Appeal under Article 12 – AIE${ref ? ' ' + ref : ''} – ${authority}`,
      body
    };
  }

  function validateDraft() {
    const common = escapeLine($('authority').value) && escapeLine($('subjectMatter').value) && escapeLine($('requesterName').value);
    if (!common) return false;
    if (currentStage === 'initial') return initialRequestItems().length > 0;
    if (currentStage === 'review') return selectedIssueObjects('reviewIssues').length > 0 || escapeLine($('reviewCustom').value);
    if (currentStage === 'ocei') return (selectedIssueObjects('oceiIssues').length > 0 || escapeLine($('oceiCustom').value)) && ($('noReviewDecision').checked || escapeLine($('oceiDecisionDate').value));
    return false;
  }

  function updateRoleActions() {
    const actions = ROLE_ACTIONS[$('role').value] || ROLE_ACTIONS.other;
    $('roleActions').innerHTML = `<ul class="action-list">${actions.map(([lead,text]) => `<li><b>${lead}:</b> ${text}</li>`).join('')}</ul>`;
  }

  function updateDraft() {
    updateStructureGuidance();
    updateFit();
    updateRoleActions();

    let draft;
    if (currentStage === 'review') draft = generateReview();
    else if (currentStage === 'ocei') draft = generateOcei();
    else draft = generateInitial();

    $('draftTo').value = draft.to;
    $('draftSubject').value = draft.subject;
    $('draftBody').value = draft.body;

    const ready = validateDraft();
    $('draftStatus').textContent = ready ? 'Draft ready to review' : 'Needs details';
    $('draftStatus').classList.toggle('is-ready', ready);

    maybeSaveState();
  }

  function serialiseForm() {
    const data = { stage: currentStage, values: {}, checks: {} };
    $$('input, select, textarea').forEach(el => {
      if (!el.id || ['draftTo','draftSubject','draftBody'].includes(el.id)) return;
      if (el.type === 'checkbox') data.checks[el.id || `${el.closest('[id]')?.id}:${el.value}`] = el.checked;
      else data.values[el.id] = el.value;
    });
    data.groupChecks = {};
    ['statutoryCategories','infoModules','formatChoices','reviewIssues','oceiIssues'].forEach(id => {
      data.groupChecks[id] = selectedValues(id);
    });
    return data;
  }

  function maybeSaveState() {
    if (!$('rememberDraft').checked) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialiseForm())); } catch (_) {}
  }

  function restoreState() {
    let data;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { data = null; }
    if (!data) return false;
    Object.entries(data.values || {}).forEach(([id,value]) => { const el=$(id); if(el) el.value=value; });
    Object.entries(data.checks || {}).forEach(([id,value]) => { const el=$(id); if(el) el.checked=Boolean(value); });
    Object.entries(data.groupChecks || {}).forEach(([containerId,values]) => {
      const set = new Set(values || []);
      $$(`#${containerId} input[type="checkbox"]`).forEach(el => el.checked = set.has(el.value));
    });
    $('rememberDraft').checked = true;
    if (data.stage) setStage(data.stage, false);
    return true;
  }

  function resetForm() {
    if (!confirm('Clear this draft from the page and this device?')) return;
    localStorage.removeItem(STORAGE_KEY);
    $('aieForm').reset();
    $$('#statutoryCategories input, #infoModules input, #formatChoices input, #reviewIssues input, #oceiIssues input').forEach(el => el.checked = false);
    $('rememberDraft').checked = false;
    setStage('initial');
    updateDraft();
    $('copyStatus').textContent = 'Draft cleared.';
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    $('copyStatus').textContent = message;
    setTimeout(() => { if ($('copyStatus').textContent === message) $('copyStatus').textContent = ''; }, 2600);
  }

  function fullDraftText() {
    const to = escapeLine($('draftTo').value);
    const subject = escapeLine($('draftSubject').value);
    return `${to ? 'To: ' + to + '\n' : ''}Subject: ${subject}\n\n${$('draftBody').value}`;
  }

  function downloadDraft() {
    const blob = new Blob([fullDraftText()], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ref = escapeLine(currentStage === 'review' ? $('reviewRef').value : currentStage === 'ocei' ? $('oceiRef').value : '');
    a.download = `AIE_${currentStage}${ref ? '_' + ref.replace(/[^a-z0-9_-]+/gi,'_') : ''}_draft.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setupInstall() {
    const dialog = $('installDialog');
    const instructions = $('installInstructions');
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });
    $('installApp').addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        return;
      }
      const ua = navigator.userAgent || '';
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      instructions.innerHTML = isIOS
        ? '<p>On iPhone/iPad: open this page in Safari, tap <b>Share</b>, then choose <b>Add to Home Screen</b>.</p>'
        : '<p>Use your browser menu and choose <b>Install app</b>, <b>Add to Home Screen</b>, or the equivalent command. Install support depends on the browser and operating system.</p>';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else alert(instructions.textContent);
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker not registered', err)));
    }
  }

  function bindEvents() {
    $$('.stage-card').forEach(btn => btn.addEventListener('click', () => setStage(btn.dataset.stage)));
    $('applyRoleSuggestions').addEventListener('click', applyRoleSuggestions);
    $('authorityStructure').addEventListener('change', updateDraft);
    $('structureName').addEventListener('input', updateDraft);
    $('preferredForm').addEventListener('change', () => {
      $('customFormWrap').hidden = $('preferredForm').value !== 'custom';
      updateDraft();
    });
    $('rememberDraft').addEventListener('change', () => {
      if (!$('rememberDraft').checked) localStorage.removeItem(STORAGE_KEY);
      else maybeSaveState();
    });
    $('resetForm').addEventListener('click', resetForm);
    $('copyDraft').addEventListener('click', () => copyText(fullDraftText(), 'Complete draft copied.'));
    $('copyBody').addEventListener('click', () => copyText($('draftBody').value, 'Email body copied.'));
    $('downloadDraft').addEventListener('click', downloadDraft);
    $('aieForm').addEventListener('input', updateDraft);
    $('aieForm').addEventListener('change', updateDraft);
    window.addEventListener('hashchange', () => {
      const stage = location.hash.replace('#','');
      if (['initial','review','ocei'].includes(stage)) setStage(stage, false);
    });
  }

  function init() {
    renderDynamicChoices();
    bindEvents();
    const restored = restoreState();
    if (!restored) {
      const stage = location.hash.replace('#','');
      setStage(['initial','review','ocei'].includes(stage) ? stage : 'initial', false);
    }
    updateDraft();
    setupInstall();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
