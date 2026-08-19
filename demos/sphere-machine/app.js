import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';
import {
  SHAPE_NAMES,
  createShapeGeometry,
  containsShapePoint,
  getOuterPoints
} from './shape-model.js';
import { getClassicalRadialProfile } from './classical-profile.js';

const TWO_PI = Math.PI * 2;
const MAX_RPM = 360;
const MAX_HISTORY_INSTANCES = 96;
const MAX_RETINAL_INSTANCES = 32;
const MAX_TRAIL_POINTS = 30000;
const MAX_HISTORY = 720;
const OBSERVED_RADII = 96;
const Z_BINS = 18;
const PHI_BINS = 36;
const COVERAGE_BIN_COUNT = Z_BINS * PHI_BINS;
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(1.95, 1.35, 2.35);

const canvas = document.getElementById('sceneCanvas');
const stage = document.getElementById('stage');

const ui = {
  shape: document.getElementById('shapeSelect'),
  axisX: document.getElementById('axisX'),
  axisY: document.getElementById('axisY'),
  axisZ: document.getElementById('axisZ'),
  speedX: document.getElementById('speedX'),
  speedY: document.getElementById('speedY'),
  speedZ: document.getElementById('speedZ'),
  speedXOut: document.getElementById('speedXOut'),
  speedYOut: document.getElementById('speedYOut'),
  speedZOut: document.getElementById('speedZOut'),
  hudX: document.getElementById('hudX'),
  hudY: document.getElementById('hudY'),
  hudZ: document.getElementById('hudZ'),
  pause: document.getElementById('pauseButton'),
  resetOrientation: document.getElementById('resetOrientationButton'),
  resetCamera: document.getElementById('cameraButton'),
  showSphere: document.getElementById('showSphere'),
  showAxes: document.getElementById('showAxes'),
  probabilityResolution: document.getElementById('probabilityResolution'),
  probabilityResolutionOut: document.getElementById('probabilityResolutionOut'),
  coverage: document.getElementById('coverageValue'),
  coreProbability: document.getElementById('coreProbability'),
  outerProbability: document.getElementById('outerProbability'),
  integratedForm: document.getElementById('integratedForm'),
  stageTitle: document.getElementById('stage-title'),
  stageRegime: document.getElementById('stageRegime'),
  interpretation: document.getElementById('interpretation'),
  runState: document.getElementById('runState'),
  runDot: document.getElementById('runDot')
};

const state = {
  shape: 'cube',
  paused: false,
  angles: new THREE.Euler(0, 0, 0, 'XYZ'),
  lastTime: performance.now(),
  lastTrailSample: 0,
  lastObservedDispatch: 0,
  history: [],
  coverageBins: new Uint8Array(COVERAGE_BIN_COUNT),
  coverageCount: 0,
  trailWrite: 0,
  trailFilled: false,
  perceptionMode: 'human',
  exposureMs: 20,
  showOrientationMarker: true
};

const presets = {
  stop: { x: false, y: false, z: false, sx: 0, sy: 0, sz: 0 },
  slow: { x: true, y: true, z: true, sx: 5, sy: 5, sz: 5 },
  x: { x: true, y: false, z: false, sx: 180, sy: 0, sz: 0 },
  xy: { x: true, y: true, z: false, sx: 180, sy: 254, sz: 0 },
  xyz: { x: true, y: true, z: true, sx: 180, sy: 254, sz: 325 }
};

let renderer;
let scene;
let camera;
let controls;
let objectGroup;
let solidMesh;
let edgeLines;
let orientationMarker;
let currentGeometry;
let historyMesh;
let retinalMesh;
let referenceSphere;
let probeShell;
let axesHelper;
let trailPoints;
let trailGeometry;
let trailPosition;
let trailTexture;
let shadowPlane;
let outerPoints = [];

const dummy = new THREE.Object3D();
const tempQuaternion = new THREE.Quaternion();
const inverseQuaternion = new THREE.Quaternion();
const tempVector = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const worldProbe = new THREE.Vector3();

function activeAxes() {
  return ['x', 'y', 'z'].filter(axis => {
    const key = axis.toUpperCase();
    return ui[`axis${key}`].checked && Number(ui[`speed${key}`].value) > 0;
  });
}

function rpmValue(axis) {
  const key = axis.toUpperCase();
  return ui[`axis${key}`].checked ? Number(ui[`speed${key}`].value) : 0;
}

function angularVelocity(axis) {
  return rpmValue(axis) * TWO_PI / 60;
}

function maxRpm() {
  return Math.max(rpmValue('x'), rpmValue('y'), rpmValue('z'));
}

function currentQuaternion(target = tempQuaternion) {
  return target.setFromEuler(state.angles);
}

function historyVisibilityFactor() {
  return THREE.MathUtils.smoothstep(maxRpm(), 12, 90);
}

function createRoundPointTexture() {
  const sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.48, 'rgba(235,252,255,.95)');
  gradient.addColorStop(0.78, 'rgba(180,242,250,.55)');
  gradient.addColorStop(1, 'rgba(180,242,250,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(sprite);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function setupPerceptionControls() {
  const host = document.querySelector('.axis-controls-near-stage');
  if (!host || host.querySelector('.perception-block')) return;

  const block = document.createElement('div');
  block.className = 'perception-block';
  block.innerHTML = `
    <div class="perception-heading">
      <span>Perception</span>
      <small>How the moving source object is displayed</small>
    </div>
    <div class="perception-toggle" role="group" aria-label="Perception rendering mode">
      <button type="button" data-perception="crisp">Crisp frames</button>
      <button type="button" data-perception="human" class="active">Human exposure</button>
    </div>
    <label class="exposure-control" for="exposureMs">
      <span>Exposure <output id="exposureOut">20 ms</output></span>
      <input id="exposureMs" type="range" min="5" max="50" step="1" value="20">
    </label>
    <button id="orientationMarkerButton" type="button" class="marker-toggle active" aria-pressed="true">Orientation marker · on</button>
    <p id="perceptionHint" class="perception-hint">Averages several intermediate orientations over 20 ms. This is a display-exposure approximation, not a biological retina model.</p>
  `;
  host.append(block);

  const exposure = block.querySelector('#exposureMs');
  const exposureOut = block.querySelector('#exposureOut');
  const hint = block.querySelector('#perceptionHint');
  const markerButton = block.querySelector('#orientationMarkerButton');

  block.querySelectorAll('[data-perception]').forEach(button => {
    button.addEventListener('click', () => {
      state.perceptionMode = button.dataset.perception;
      block.querySelectorAll('[data-perception]').forEach(candidate => {
        candidate.classList.toggle('active', candidate === button);
      });
      block.classList.toggle('is-crisp', state.perceptionMode === 'crisp');
      updatePerceptionHint(hint);
      updateVisuals();
    });
  });

  exposure.addEventListener('input', () => {
    state.exposureMs = Number(exposure.value);
    exposureOut.textContent = `${state.exposureMs} ms`;
    updatePerceptionHint(hint);
    updateVisuals();
  });

  markerButton.addEventListener('click', () => {
    state.showOrientationMarker = !state.showOrientationMarker;
    markerButton.classList.toggle('active', state.showOrientationMarker);
    markerButton.setAttribute('aria-pressed', String(state.showOrientationMarker));
    markerButton.textContent = `Orientation marker · ${state.showOrientationMarker ? 'on' : 'off'}`;
    updateVisuals();
  });
}

function lockOuterSphereControl() {
  if (!ui.showSphere) return;
  ui.showSphere.checked = true;
  ui.showSphere.disabled = true;
  const label = ui.showSphere.closest('label');
  if (label) label.remove();
}

function updatePerceptionHint(hint = document.getElementById('perceptionHint')) {
  if (!hint) return;
  if (state.perceptionMode === 'crisp') {
    hint.textContent = 'One instantaneous source-object orientation per display frame. Symmetric shapes can look as if they wobble or reverse.';
  } else {
    hint.textContent = `Averages several intermediate orientations over ${state.exposureMs} ms. The marker shows the true continuous direction even when the symmetric outline is ambiguous.`;
  }
}

function disposeObject() {
  if (objectGroup) scene.remove(objectGroup);
  if (historyMesh) scene.remove(historyMesh);
  if (retinalMesh) scene.remove(retinalMesh);
  solidMesh?.material?.dispose();
  edgeLines?.geometry?.dispose();
  edgeLines?.material?.dispose();
  orientationMarker?.geometry?.dispose();
  orientationMarker?.material?.dispose();
  historyMesh?.material?.dispose();
  retinalMesh?.material?.dispose();
  currentGeometry?.dispose();
  objectGroup = null;
  solidMesh = null;
  edgeLines = null;
  orientationMarker = null;
  historyMesh = null;
  retinalMesh = null;
  currentGeometry = null;
}

function createObject(kind) {
  disposeObject();
  state.shape = kind;
  currentGeometry = createShapeGeometry(kind);
  outerPoints = getOuterPoints(kind, 20).map(point => point.clone().normalize());

  objectGroup = new THREE.Group();
  objectGroup.renderOrder = 10;

  solidMesh = new THREE.Mesh(
    currentGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x37c8d8,
      roughness: 0.3,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: true,
      blending: THREE.NormalBlending
    })
  );
  solidMesh.castShadow = true;
  solidMesh.renderOrder = 10;
  objectGroup.add(solidMesh);

  edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(currentGeometry, 22),
    new THREE.LineBasicMaterial({
      color: 0xf4ffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    })
  );
  edgeLines.renderOrder = 11;
  objectGroup.add(edgeLines);

  orientationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc861 })
  );
  const markerPoint = outerPoints[0] || new THREE.Vector3(1, 0, 0);
  orientationMarker.position.copy(markerPoint).multiplyScalar(1.035);
  orientationMarker.renderOrder = 12;
  objectGroup.add(orientationMarker);
  scene.add(objectGroup);

  historyMesh = new THREE.InstancedMesh(
    currentGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x43d8ea,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    MAX_HISTORY_INSTANCES
  );
  historyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  historyMesh.frustumCulled = false;
  historyMesh.renderOrder = 1;
  scene.add(historyMesh);

  retinalMesh = new THREE.InstancedMesh(
    currentGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x8cecf5,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    MAX_RETINAL_INSTANCES
  );
  retinalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  retinalMesh.frustumCulled = false;
  retinalMesh.renderOrder = 4;
  scene.add(retinalMesh);

  ui.stageTitle.textContent = `Rotating ${SHAPE_NAMES[kind].toLowerCase()}`;
  resetAccumulation();
  updateTheoreticalMetrics();
  updateVisuals();
}

function initTrail() {
  const positions = new Float32Array(MAX_TRAIL_POINTS * 3);
  trailGeometry = new THREE.BufferGeometry();
  trailPosition = new THREE.BufferAttribute(positions, 3);
  trailPosition.setUsage(THREE.DynamicDrawUsage);
  trailGeometry.setAttribute('position', trailPosition);
  trailGeometry.setDrawRange(0, 0);

  trailTexture = createRoundPointTexture();
  trailPoints = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      color: 0xeafcff,
      size: 0.019,
      sizeAttenuation: true,
      map: trailTexture,
      alphaTest: 0.04,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    })
  );
  trailPoints.frustumCulled = false;
  trailPoints.renderOrder = 8;
  scene.add(trailPoints);
}

function initProbeShell() {
  probeShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf6c96b,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    })
  );
  probeShell.visible = false;
  scene.add(probeShell);
}

function updateHistoryMesh() {
  if (!historyMesh) return;
  const history = state.history;
  const visibility = historyVisibilityFactor();

  if (history.length <= 1 || visibility <= 0.001) {
    historyMesh.count = 0;
    historyMesh.visible = false;
    return;
  }

  const desiredCount = Math.round(THREE.MathUtils.lerp(10, MAX_HISTORY_INSTANCES, visibility));
  const count = Math.min(desiredCount, history.length, MAX_HISTORY_INSTANCES);
  historyMesh.count = count;
  historyMesh.visible = count > 1;

  const step = history.length / count;
  for (let i = 0; i < count; i += 1) {
    const quaternion = history[Math.min(history.length - 1, Math.floor(i * step))];
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.quaternion.copy(quaternion);
    dummy.updateMatrix();
    historyMesh.setMatrixAt(i, dummy.matrix);
  }

  historyMesh.material.opacity = THREE.MathUtils.lerp(0.006, 0.022, visibility);
  historyMesh.instanceMatrix.needsUpdate = true;
}

function retinalSampleCount() {
  if (state.perceptionMode !== 'human' || activeAxes().length === 0) return 0;
  const maxOmega = Math.max(angularVelocity('x'), angularVelocity('y'), angularVelocity('z'));
  const angularTravel = maxOmega * (state.exposureMs / 1000);
  const fourDegrees = THREE.MathUtils.degToRad(4);
  return THREE.MathUtils.clamp(Math.ceil(angularTravel / fourDegrees) + 1, 3, MAX_RETINAL_INSTANCES);
}

function updateRetinalMesh() {
  if (!retinalMesh) return;
  const count = retinalSampleCount();
  retinalMesh.count = count;
  retinalMesh.visible = state.perceptionMode === 'human' && count > 0;
  if (!retinalMesh.visible) return;

  const exposureSeconds = state.exposureMs / 1000;
  for (let i = 0; i < count; i += 1) {
    const fraction = count === 1 ? 0 : i / (count - 1);
    const t = -exposureSeconds * (1 - fraction);
    tempEuler.set(
      state.angles.x + angularVelocity('x') * t,
      state.angles.y + angularVelocity('y') * t,
      state.angles.z + angularVelocity('z') * t,
      'XYZ'
    );
    tempQuaternion.setFromEuler(tempEuler);
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.quaternion.copy(tempQuaternion);
    dummy.updateMatrix();
    retinalMesh.setMatrixAt(i, dummy.matrix);
  }

  retinalMesh.material.opacity = THREE.MathUtils.clamp(0.20 / Math.sqrt(count), 0.022, 0.065);
  retinalMesh.instanceMatrix.needsUpdate = true;
}

function markCoverage(point) {
  const r = point.length();
  if (r < 1e-8) return;
  const y = THREE.MathUtils.clamp(point.y / r, -1, 1);
  const phi = Math.atan2(point.z, point.x);
  const zIndex = Math.min(Z_BINS - 1, Math.floor(((y + 1) * 0.5) * Z_BINS));
  const phiIndex = Math.min(PHI_BINS - 1, Math.floor(((phi + Math.PI) / TWO_PI) * PHI_BINS));
  const index = zIndex * PHI_BINS + phiIndex;
  if (!state.coverageBins[index]) {
    state.coverageBins[index] = 1;
    state.coverageCount += 1;
  }
}

function appendTrailPoint(point) {
  const offset = state.trailWrite * 3;
  trailPosition.array[offset] = point.x;
  trailPosition.array[offset + 1] = point.y;
  trailPosition.array[offset + 2] = point.z;
  state.trailWrite += 1;
  if (state.trailWrite >= MAX_TRAIL_POINTS) {
    state.trailWrite = 0;
    state.trailFilled = true;
  }
}

function sampleCurrentOrientation(now, force = false) {
  const axes = activeAxes();
  if (!force && axes.length === 0) return;

  const rpm = maxRpm();
  const interval = rpm <= 8 ? 120 : rpm <= 60 ? 75 : 40;
  if (!force && now - state.lastTrailSample < interval) return;
  state.lastTrailSample = now;

  const quaternion = currentQuaternion(new THREE.Quaternion());
  state.history.push(quaternion);
  if (state.history.length > MAX_HISTORY) state.history.shift();

  for (const source of outerPoints) {
    tempVector.copy(source).applyQuaternion(quaternion);
    if (tempVector.lengthSq() > 1e-12) tempVector.normalize();
    appendTrailPoint(tempVector);
    markCoverage(tempVector);
  }

  trailPosition.needsUpdate = true;
  trailGeometry.setDrawRange(0, state.trailFilled ? MAX_TRAIL_POINTS : state.trailWrite);
  ui.coverage.textContent = `${Math.round(state.coverageCount / COVERAGE_BIN_COUNT * 100)}%`;
  updateHistoryMesh();

  if (force || now - state.lastObservedDispatch > 260) {
    state.lastObservedDispatch = now;
    dispatchObservedProfile();
  }
}

function dispatchObservedProfile() {
  const radii = [];
  const occupancy = [];
  const history = state.history;

  for (let i = 0; i < OBSERVED_RADII; i += 1) {
    const r = i / (OBSERVED_RADII - 1);
    let hits = 0;
    for (const quaternion of history) {
      inverseQuaternion.copy(quaternion).invert();
      worldProbe.set(r, 0, 0).applyQuaternion(inverseQuaternion);
      if (containsShapePoint(state.shape, worldProbe)) hits += 1;
    }
    radii.push(r);
    occupancy.push(history.length ? hits / history.length : 0);
  }

  window.dispatchEvent(new CustomEvent('sphere-observed-profile', {
    detail: {
      shape: state.shape,
      radii,
      occupancy,
      sampleCount: history.length,
      coverage: state.coverageCount / COVERAGE_BIN_COUNT
    }
  }));
}

function resetAccumulation() {
  state.history = [];
  state.coverageBins = new Uint8Array(COVERAGE_BIN_COUNT);
  state.coverageCount = 0;
  state.trailWrite = 0;
  state.trailFilled = false;
  state.lastTrailSample = 0;
  state.lastObservedDispatch = 0;
  if (trailGeometry) trailGeometry.setDrawRange(0, 0);
  if (historyMesh) historyMesh.count = 0;
  if (ui.coverage) ui.coverage.textContent = '0%';
  sampleCurrentOrientation(performance.now(), true);
}

function updateTheoreticalMetrics() {
  const level = Number(ui.probabilityResolution?.value || 3);
  const profile = getClassicalRadialProfile(state.shape, level);
  const core = profile.occupancy[0] ?? 0;
  let outerTotal = 0;
  let outerCount = 0;
  profile.radii.forEach((r, index) => {
    if (r >= 0.78 && r <= 0.95) {
      outerTotal += profile.occupancy[index];
      outerCount += 1;
    }
  });
  ui.coreProbability.textContent = core.toFixed(2);
  ui.outerProbability.textContent = (outerCount ? outerTotal / outerCount : 0).toFixed(2);
  updateInterpretation();
}

function updateVisuals() {
  if (!solidMesh || !edgeLines || !objectGroup) return;
  objectGroup.rotation.copy(state.angles);

  const slowInspection = maxRpm() <= 8;
  solidMesh.material.opacity = state.perceptionMode === 'human'
    ? (slowInspection ? 0.84 : 0.68)
    : 0.96;
  edgeLines.material.opacity = state.perceptionMode === 'human'
    ? (slowInspection ? 0.82 : 0.58)
    : 0.98;
  edgeLines.visible = true;
  trailPoints.visible = true;
  trailPoints.material.size = slowInspection ? 0.017 : 0.021;
  trailPoints.material.opacity = slowInspection ? 0.5 : 0.62;
  orientationMarker.visible = state.showOrientationMarker;

  updateHistoryMesh();
  updateRetinalMesh();
  referenceSphere.visible = true;
  axesHelper.visible = ui.showAxes ? ui.showAxes.checked : true;

  ui.integratedForm.textContent = classifyIntegratedForm();
  ui.stageRegime.textContent = regimeLabel();
}

function classifyIntegratedForm() {
  const axes = activeAxes().length;
  const coverage = state.coverageCount / COVERAGE_BIN_COUNT;
  const rpm = maxRpm();
  if (axes === 0) return 'single object';
  if (rpm <= 8 && axes === 3) return 'slow accumulation';
  if (axes === 1) return 'surface of revolution';
  if (axes === 2) return coverage < 0.45 ? 'woven form' : 'rounded superposition';
  if (coverage < 0.35) return 'multi-axis form';
  if (coverage < 0.75) return 'near-spherical';
  return 'sphere-like';
}

function regimeLabel() {
  const axes = activeAxes().length;
  const perception = state.perceptionMode === 'human' ? `human exposure · ${state.exposureMs} ms` : 'crisp frames';
  if (axes === 0) return `instantaneous geometry · ${perception}`;
  if (axes === 1) return `one-axis sampling · ${perception}`;
  if (axes === 2) return `two-axis sampling · ${perception}`;
  return `three-axis sampling · ${perception}`;
}

function updateProbabilityResolutionLabel() {
  const labels = ['quick', 'low', 'medium', 'high', 'maximum'];
  ui.probabilityResolutionOut.textContent = labels[Number(ui.probabilityResolution.value) - 1] || 'medium';
}

function updateInterpretation() {
  const axes = activeAxes().length;
  const coverage = state.coverageCount / COVERAGE_BIN_COUNT;
  const core = Number(ui.coreProbability?.textContent || 0);

  if (state.shape === 'torus') {
    ui.interpretation.textContent = `The torus keeps an empty centre under every rigid rotation: full p(0)=${core.toFixed(2)}. In Slow mode the source torus and its outer observations are shown without a long-history ghost volume; the integrated form fades in only as RPM rises.`;
    return;
  }
  if (axes === 0) {
    ui.interpretation.textContent = 'Still mode shows one orientation. The source object and its current outer points remain visible.';
    return;
  }
  if (maxRpm() <= 8) {
    ui.interpretation.textContent = 'Slow mode lets you watch the source object deposit observations. Coverage and the observed probability curve build from those visited orientations.';
    return;
  }
  if (axes === 1) {
    ui.interpretation.textContent = 'One axis samples a restricted family of orientations. The accumulated form is a surface of revolution rather than the full rotational limit.';
    return;
  }
  if (axes === 2) {
    ui.interpretation.textContent = 'Two axes broaden the observed orientation set, but complete three-dimensional rotational symmetry is not yet sampled.';
    return;
  }
  ui.interpretation.textContent = `Three-axis sampling has visited ${Math.round(coverage * 100)}% of the outer direction bins. The accumulated points and history superposition approach the spherical rotational limit as coverage grows.`;
}

function updateSpeedOutputs() {
  for (const axis of ['X', 'Y', 'Z']) {
    const enabled = ui[`axis${axis}`].checked;
    const value = Number(ui[`speed${axis}`].value);
    ui[`speed${axis}Out`].textContent = `${value} rpm`;
    ui[`hud${axis}`].textContent = enabled ? `${value} rpm` : 'off';
    ui[`speed${axis}`].disabled = !enabled;
  }
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  ui.axisX.checked = preset.x;
  ui.axisY.checked = preset.y;
  ui.axisZ.checked = preset.z;
  ui.speedX.value = String(preset.sx);
  ui.speedY.value = String(preset.sy);
  ui.speedZ.value = String(preset.sz);
  document.querySelectorAll('[data-preset]').forEach(button => {
    button.classList.toggle('active', button.dataset.preset === name);
  });
  updateSpeedOutputs();
  resetAccumulation();
  updateVisuals();
  updateInterpretation();
}

function setPaused(value) {
  state.paused = value;
  ui.pause.textContent = value ? 'Resume' : 'Pause';
  ui.runState.textContent = value ? 'paused' : 'running';
  ui.runDot.classList.toggle('paused', value);
}

function resetOrientation() {
  state.angles.set(0, 0, 0, 'XYZ');
  resetAccumulation();
  updateVisuals();
}

function resetCamera() {
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  controls.target.set(0, 0, 0);
  controls.update();
}

function bindEvents() {
  ui.shape.addEventListener('change', () => createObject(ui.shape.value));

  for (const axis of ['X', 'Y', 'Z']) {
    ui[`axis${axis}`].addEventListener('change', () => {
      document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
      updateSpeedOutputs();
      resetAccumulation();
      updateVisuals();
      updateInterpretation();
    });
    ui[`speed${axis}`].addEventListener('input', () => {
      document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
      updateSpeedOutputs();
      resetAccumulation();
      updateVisuals();
      updateInterpretation();
    });
  }

  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  ui.pause.addEventListener('click', () => setPaused(!state.paused));
  ui.resetOrientation.addEventListener('click', resetOrientation);
  ui.resetCamera.addEventListener('click', resetCamera);
  ui.showAxes?.addEventListener('change', updateVisuals);
  ui.probabilityResolution?.addEventListener('input', () => {
    updateProbabilityResolutionLabel();
    updateTheoreticalMetrics();
  });

  window.addEventListener('sphere-radius-probe', event => {
    const radius = Number(event.detail?.radius);
    if (!Number.isFinite(radius)) return;
    probeShell.scale.setScalar(Math.max(0.001, radius));
    probeShell.visible = radius > 0.002;
  });

  window.addEventListener('resize', resizeRenderer, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resizeRenderer).observe(stage);
}

function resizeRenderer() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (!state.paused) {
    state.angles.x = (state.angles.x + angularVelocity('x') * dt) % TWO_PI;
    state.angles.y = (state.angles.y + angularVelocity('y') * dt) % TWO_PI;
    state.angles.z = (state.angles.z + angularVelocity('z') * dt) % TWO_PI;
    sampleCurrentOrientation(now);
    updateVisuals();
    updateInterpretation();
  }

  controls.update();
  renderer.render(scene, camera);
}

function start() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(DEFAULT_CAMERA_POSITION);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 2.45;
  controls.maxDistance = 8;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbdeff5, 0x061018, 1.7));

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7c6cff, 1.5);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 7.5),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.26 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.79;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const floor = new THREE.GridHelper(8, 16, 0x1b8d9c, 0x173743);
  floor.position.y = -1.775;
  floor.material.transparent = true;
  floor.material.opacity = 0.2;
  scene.add(floor);

  axesHelper = new THREE.AxesHelper(1.65);
  axesHelper.material.transparent = true;
  axesHelper.material.opacity = 0.7;
  scene.add(axesHelper);

  referenceSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 36, 24),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.09, depthWrite: false })
  );
  referenceSphere.visible = true;
  scene.add(referenceSphere);

  initTrail();
  initProbeShell();
  setupPerceptionControls();
  lockOuterSphereControl();
  createObject(state.shape);
  bindEvents();
  updateProbabilityResolutionLabel();
  updateSpeedOutputs();
  resizeRenderer();
  applyPreset('xyz');
  requestAnimationFrame(animate);
}

start();
