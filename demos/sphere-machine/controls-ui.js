// Progressive UI composition for Sphere Machine.
// The base HTML keeps every control available without this enhancement; this module
// reorganises the same bound elements into a simpler experiment-first interface.

const experiment = document.querySelector('.experiment-section');

if (experiment && !experiment.dataset.controlsStreamlined) {
  experiment.dataset.controlsStreamlined = 'true';

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = './controls-ui.css?v=20260820-1';
  stylesheet.dataset.sphereControlsUi = 'true';
  document.head.appendChild(stylesheet);

  const commandbar = experiment.querySelector('.experiment-commandbar');
  const presetGrid = experiment.querySelector('.preset-grid-primary');
  const stagePanel = experiment.querySelector('.stage-panel-v2');
  const stageWorkbench = experiment.querySelector('.stage-workbench');
  const axisControls = experiment.querySelector('.axis-controls-near-stage');
  const secondary = experiment.querySelector('.controls-panel-v2');
  const utilityGrid = secondary?.querySelector('.utility-grid');
  const advanced = secondary?.querySelector('.advanced-controls');
  const sidebarNote = secondary?.querySelector('.sidebar-note');
  const perception = axisControls?.querySelector('.perception-block');
  const showAxesLabel = document.getElementById('showAxes')?.closest('label');
  const pauseButton = document.getElementById('pauseButton');
  const restartButton = document.getElementById('resetOrientationButton');
  const resetViewButton = document.getElementById('cameraButton');

  // 1. Presets remain the primary interaction. Detailed axis controls become Custom.
  const customButton = document.createElement('button');
  customButton.type = 'button';
  customButton.className = 'chip custom-chip';
  customButton.textContent = 'Custom';
  customButton.setAttribute('aria-expanded', 'false');
  customButton.setAttribute('aria-controls', 'customRotationDrawer');
  presetGrid?.appendChild(customButton);

  const customDrawer = document.createElement('div');
  customDrawer.id = 'customRotationDrawer';
  customDrawer.className = 'custom-rotation-drawer';
  customDrawer.hidden = true;
  if (axisControls) customDrawer.appendChild(axisControls);
  commandbar?.insertAdjacentElement('afterend', customDrawer);

  function setCustomOpen(open) {
    customDrawer.hidden = !open;
    customButton.classList.toggle('active', open);
    customButton.setAttribute('aria-expanded', String(open));
  }

  customButton.addEventListener('click', () => setCustomOpen(customDrawer.hidden));

  presetGrid?.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => setCustomOpen(false));
  });

  axisControls?.querySelectorAll('input').forEach(control => {
    const markCustom = () => {
      customButton.classList.add('active');
      customButton.setAttribute('aria-expanded', 'true');
      customDrawer.hidden = false;
    };
    control.addEventListener('input', markCustom);
    control.addEventListener('change', markCustom);
  });

  // 2. Secondary actions become one compact utility row directly below the stage.
  const utilityBar = document.createElement('div');
  utilityBar.className = 'stage-utility-bar';
  utilityBar.setAttribute('aria-label', 'Experiment utilities');

  if (pauseButton) utilityBar.appendChild(pauseButton);
  if (restartButton) {
    restartButton.textContent = 'Restart experiment';
    utilityBar.appendChild(restartButton);
  }
  if (resetViewButton) {
    resetViewButton.textContent = 'Reset view';
    utilityBar.appendChild(resetViewButton);
  }

  // 3. Perceptual/display options belong under one View disclosure.
  const viewDetails = document.createElement('details');
  viewDetails.className = 'view-controls';
  const viewSummary = document.createElement('summary');
  viewSummary.className = 'button view-summary';
  viewSummary.textContent = 'View';
  const viewPanel = document.createElement('div');
  viewPanel.className = 'view-controls-panel';

  if (perception) viewPanel.appendChild(perception);
  if (showAxesLabel) {
    const displayOptions = document.createElement('div');
    displayOptions.className = 'display-options';
    const displayTitle = document.createElement('strong');
    displayTitle.textContent = 'Display';
    displayOptions.append(displayTitle, showAxesLabel);
    viewPanel.appendChild(displayOptions);
  }

  viewDetails.append(viewSummary, viewPanel);
  utilityBar.appendChild(viewDetails);
  stageWorkbench?.insertAdjacentElement('afterend', utilityBar);

  // The probability-resolution slider is an implementation choice, not a user task.
  // Keep the bound elements alive for the model, but remove them from the visible UI.
  advanced?.remove();
  utilityGrid?.remove();

  const referenceCaption = document.createElement('p');
  referenceCaption.className = 'reference-sphere-caption';
  referenceCaption.innerHTML = '<span aria-hidden="true"></span>Outer wireframe = rotational reference sphere';
  utilityBar.insertAdjacentElement('afterend', referenceCaption);

  sidebarNote?.remove();
  secondary?.remove();

  // Avoid repeating the same X/Y/Z numbers beside the Custom sliders while it is open.
  const hud = stagePanel?.querySelector('.stage-hud-left');
  const syncHud = () => hud?.classList.toggle('is-suppressed', !customDrawer.hidden);
  customButton.addEventListener('click', syncHud);
  presetGrid?.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', syncHud));

  // Ensure the startup state visually reflects the app's canonical Slow preset.
  requestAnimationFrame(() => {
    const activePreset = presetGrid?.querySelector('[data-preset].active');
    if (!activePreset) presetGrid?.querySelector('[data-preset="slow"]')?.classList.add('active');
  });
}
