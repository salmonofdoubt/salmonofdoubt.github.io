const stage = document.getElementById('stage');
const axisControls = document.querySelector('.axis-controls');
const stagePanel = document.querySelector('.stage-panel-v2');
const presetGrid = document.querySelector('.preset-grid-primary');
const sidebarHeading = document.querySelector('.sidebar-heading');
const advancedControls = document.querySelector('.advanced-controls');

function dispatch(element, type) {
  element?.dispatchEvent(new Event(type, { bubbles: true }));
}

function installStageWorkbench() {
  if (!stage || !axisControls || !stagePanel || stage.closest('.stage-workbench')) return;

  const workbench = document.createElement('div');
  workbench.className = 'stage-workbench';
  stagePanel.insertBefore(workbench, stage);
  workbench.append(stage, axisControls);
  axisControls.classList.add('axis-controls-near-stage');

  const legend = axisControls.querySelector('legend');
  if (legend) legend.textContent = 'Axis speeds';

  const key = document.createElement('div');
  key.className = 'source-point-key';
  key.innerHTML = '<span><i class="source-swatch"></i>source object</span><span><i class="point-swatch"></i>generated probability points</span>';
  stage.append(key);
}

function installSlowPreset() {
  if (!presetGrid || presetGrid.querySelector('[data-preset="slow"]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip slow-chip';
  button.dataset.preset = 'slow';
  button.textContent = 'Slow · 5 rpm';

  const spherise = presetGrid.querySelector('[data-preset="xyz"]');
  presetGrid.insertBefore(button, spherise || null);

  button.addEventListener('click', () => {
    for (const axis of ['X', 'Y', 'Z']) {
      const enabled = document.getElementById(`axis${axis}`);
      const speed = document.getElementById(`speed${axis}`);
      if (enabled) enabled.checked = true;
      if (speed) speed.value = '5';
    }

    // Resume if needed: slow mode is meant to make the motion observable.
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton?.textContent.trim() === 'Resume') pauseButton.click();

    dispatch(document.getElementById('axisX'), 'change');
    dispatch(document.getElementById('axisY'), 'change');
    dispatch(document.getElementById('axisZ'), 'change');
    dispatch(document.getElementById('speedX'), 'input');

    document.querySelectorAll('[data-preset]').forEach(candidate => {
      candidate.classList.toggle('active', candidate === button);
    });
  });
}

function lockVisualLayer(id) {
  const checkbox = document.getElementById(id);
  if (!checkbox) return;
  checkbox.checked = true;
  dispatch(checkbox, 'change');

  const label = checkbox.closest('label');
  if (label) {
    label.hidden = true;
    label.setAttribute('aria-hidden', 'true');
  }
}

function makeSourceAndPointsPermanent() {
  // These are part of the core demonstration, not optional decoration.
  lockVisualLayer('showSuperposition');
  lockVisualLayer('showProbability');
  lockVisualLayer('showEdges');

  if (advancedControls) {
    const summary = advancedControls.querySelector('summary');
    if (summary) summary.textContent = 'Display extras';
  }
}

function simplifySidebar() {
  if (!sidebarHeading) return;
  const eyebrow = sidebarHeading.querySelector('.eyebrow');
  const heading = sidebarHeading.querySelector('h3');
  const copy = sidebarHeading.querySelector('p');
  if (eyebrow) eyebrow.textContent = 'Secondary controls';
  if (heading) heading.textContent = 'View & reset';
  if (copy) copy.textContent = 'The rotation controls now stay beside the object. Use this panel only for camera, reset and optional display aids.';
}

function installStylesheet() {
  if (document.querySelector('link[data-stage-controls]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'stage-controls.css?v=20260819-1';
  link.dataset.stageControls = 'true';
  document.head.append(link);
}

installStylesheet();
installStageWorkbench();
installSlowPreset();
makeSourceAndPointsPermanent();
simplifySidebar();
