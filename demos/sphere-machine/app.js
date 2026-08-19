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
const MAX_SUPERPOSITIONS = 96;
const MAX_TRAIL_POINTS = 30000;
const MAX_HISTORY = 720;
const OBSERVED_RADII = 96;
const Z_BINS = 18;
const PHI_BINS = 36;
const COVERAGE_BIN_COUNT = Z_BINS * PHI_BINS;
const GOLDEN = 0.6180339887498949;

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
  trailFilled: false
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
let currentGeometry;
let superpositionMesh;
let referenceSphere;
let probeShell;
let axesHelper;
let trailPoints;
let trailGeometry;
let trailPosition;
let outerPoints = [];

const dummy = new THREE.Object3D();
const tempQuaternion = new THREE.Quaternion();
const inverseQuaternion = new THREE.Quaternion();
const tempVector = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const worldProbe = new THREE.Vector3();

function fract(value) {
  return value - Math.floor(value);
}

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

function persistenceIntensity() {
  if (activeAxes().length === 0) return 0;
  return THREE.MathUtils.smoothstep(maxRpm(), 0, 280);
}

function exposureWindow() {
  return THREE.MathUtils.lerp(0.1, 0.82, persistenceIntensity());
}

function visualSampleCount() {
  if (activeAxes().length === 0) return 0;
  return THREE.MathUtils.clamp(
    Math.round(THREE.MathUtils.lerp(2, MAX_SUPERPOSITIONS, persistenceIntensity())),
    2,
    MAX_SUPERPOSITIONS
  );
}

function orientationAtExposure(index, count, target) {
  if (count <= 0 || activeAxes().length === 0) return target.identity();
  const phase = fract((index + 0.5) * GOLDEN);
  const t = (phase - 0.5) * exposureWindow();
  tempEuler.set(
    state.angles.x + angularVelocity('x') * t,
    state.angles.y + angularVelocity('y') * t,
    state.angles.z + angularVelocity('z') * t,
    'XYZ'
  );
  return target.setFromEuler(tempEuler);
}

function currentQuaternion(target = tempQuaternion) {
  return target.setFromEuler(state.angles);
}

function disposeObject() {
  if (objectGroup) scene.remove(objectGroup);
  if (superpositionMesh) scene.remove(superpositionMesh);
  solidMesh?.material?.dispose();
  edgeLines?.geometry?.dispose();
  edgeLines?.material?.dispose();
  superpositionMesh?.material?.dispose();
  currentGeometry?.dispose();
  objectGroup = null;
  solidMesh = null;
  edgeLines = null;
  superpositionMesh = null;
  currentGeometry = null;
}

function createObject(kind) {
  disposeObject();
  state.shape = kind;
  currentGeometry = createShapeGeometry(kind);
  outerPoints = getOuterPoints(kind, 20);

  objectGroup = new THREE.Group();
  solidMesh = new THREE.Mesh(
    currentGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x37c8d8,
      roughness: 0.32,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
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
  objectGroup.add(edgeLines);
  scene.add(objectGroup);

  superpositionMesh = new THREE.InstancedMesh(
    currentGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x49dce9,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    MAX_SUPERPOSITIONS
  );
  superpositionMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  superpositionMesh.count = 0;
  superpositionMesh.frustumCulled = false;
  scene.add(superpositionMesh);

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

  trailPoints = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      color: 0xf1fdff,
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  trailPoints.frustumCulled = false;
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

function updateSuperpositionMesh() {
  if (!superpositionMesh) return;
  const count = visualSampleCount();
  const intensity = persistenceIntensity();
  superpositionMesh.visible = count > 0;
  superpositionMesh.count = count;
  superpositionMesh.material.opacity = THREE.MathUtils.lerp(0.018, 0.052, intensity);

  for (let i = 0; i < count; i += 1) {
    orientationAtExposure(i, count, tempQuaternion);
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.quaternion.copy(tempQuaternion);
    dummy.updateMatrix();
    superpositionMesh.setMatrixAt(i, dummy.matrix);
  }
  superpositionMesh.instanceMatrix.needsUpdate = true;
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
    appendTrailPoint(tempVector);
    markCoverage(tempVector);
  }

  trailPosition.needsUpdate = true;
  trailGeometry.setDrawRange(0, state.trailFilled ? MAX_TRAIL_POINTS : state.trailWrite);
  ui.coverage.textContent = `${Math.round(state.coverageCount / COVERAGE_BIN_COUNT * 100)}%`;

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
    occupancy.push(history.length ? hits / history.length : (containsShapePoint(state.shape, worldProbe.set(r, 0, 0)) ? 1 : 0));
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

  const intensity = persistenceIntensity();
  // The source object is causal evidence. It never fades away completely.
  solidMesh.material.opacity = THREE.MathUtils.lerp(0.92, 0.42, intensity);
  edgeLines.material.opacity = THREE.MathUtils.lerp(0.96, 0.32, intensity);
  edgeLines.visible = true;
  trailPoints.visible = true;

  updateSuperpositionMesh();
  referenceSphere.visible = Boolean(ui.showSphere?.checked);
  axesHelper.visible = ui.showAxes ? ui.showAxes.checked : true;

  ui.integratedForm.textContent = classifyIntegratedForm();
  ui.stageRegime.textContent = regimeLabel();
}

function classifyIntegratedForm() {
  const axes = activeAxes().length;
  const rpm = maxRpm();
  if (axes === 0) return 'single object';
  if (rpm <= 8 && axes === 3) return 'slow accumulation';
  if (axes === 1) return rpm < 100 ? 'rotating form' : 'surface of revolution';
  if (axes === 2) return rpm < 120 ? 'woven form' : 'rounded superposition';
  if (rpm < 90) return 'multi-axis form';
  if (rpm < 220) return 'near-spherical';
  return 'sphere-like';
}

function regimeLabel() {
  const axes = activeAxes().length;
  if (axes === 0) return 'instantaneous geometry';
  if (maxRpm() <= 8 && axes === 3) return 'watching observations accumulate';
  if (axes === 1) return 'one-axis exposure';
  if (axes === 2) return 'two-axis exposure';
  return 'three-axis sphere formation';
}

function updateInterpretation() {
  const axes = activeAxes().length;
  const core = Number(ui.coreProbability.textContent || 0);
  const coverage = Math.round(state.coverageCount / COVERAGE_BIN_COUNT * 100);

  if (state.shape === 'torus') {
    ui.interpretation.textContent = `The torus keeps its central hole under rigid rotation: p(0)=${core.toFixed(2)}. Its outer envelope can become spherical while its radial occupancy remains hollow. Current observed directional coverage: ${coverage}%.`;
    return;
  }
  if (axes === 0) {
    ui.interpretation.textContent = 'Still mode shows the source object before rotational averaging. The generated points are the observations accumulated so far.';
    return;
  }
  if (maxRpm() <= 8) {
    ui.interpretation.textContent = `Slow mode: watch the source object deposit its outer points. The dashed observed probability learns from these visited orientations. Coverage is currently ${coverage}%.`;
    return;
  }
  if (axes === 1) {
    ui.interpretation.textContent = `One active axis produces a surface of revolution, not full spherical sampling. Current directional coverage: ${coverage}%.`;
    return;
  }
  if (axes === 2) {
    ui.interpretation.textContent = `Two axes broaden the sampled orientation set, but full rotational symmetry is not yet represented. Current directional coverage: ${coverage}%.`;
    return;
  }
  ui.interpretation.textContent = `Three-axis rotation is building the spherical envelope. The source object remains visible while its accumulated points fill direction space. Current coverage: ${coverage}%.`;
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

function updateProbabilityResolutionLabel() {
  if (!ui.probabilityResolutionOut || !ui.probabilityResolution) return;
  const labels = ['quick', 'low', 'medium', 'high', 'maximum'];
  ui.probabilityResolutionOut.textContent = labels[Number(ui.probabilityResolution.value) - 1] || 'medium';
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
  updateTheoreticalMetrics();
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
  camera.position.set(4.5, 3.1, 5.4);
  controls.target.set(0, 0, 0);
  controls.update();
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
  ui.showSphere?.addEventListener('change', updateVisuals);
  ui.showAxes?.addEventListener('change', updateVisuals);
  ui.probabilityResolution?.addEventListener('input', () => {
    updateProbabilityResolutionLabel();
    updateTheoreticalMetrics();
  });

  window.addEventListener('sphere-radius-probe', event => {
    const radius = Number(event.detail?.radius);
    if (!Number.isFinite(radius)) return;
    probeShell.scale.setScalar(Math.max(radius, 0.001));
    probeShell.visible = radius > 0.003;
  });

  window.addEventListener('resize', resizeRenderer, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resizeRenderer).observe(stage);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (!state.paused) {
    state.angles.x = (state.angles.x + angularVelocity('x') * dt) % TWO_PI;
    state.angles.y = (state.angles.y + angularVelocity('y') * dt) % TWO_PI;
    state.angles.z = (state.angles.z + angularVelocity('z') * dt) % TWO_PI;
    updateVisuals();
    sampleCurrentOrientation(now);
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

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(4.5, 3.1, 5.4);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 9;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbdeff5, 0x061018, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(4, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c6cff, 1.8);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  const floor = new THREE.GridHelper(8, 16, 0x1b8d9c, 0x173743);
  floor.position.y = -1.8;
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
  referenceSphere.visible = Boolean(ui.showSphere?.checked);
  scene.add(referenceSphere);

  initTrail();
  initProbeShell();
  createObject(state.shape);
  bindEvents();
  updateProbabilityResolutionLabel();
  updateSpeedOutputs();
  resizeRenderer();
  applyPreset('xyz');
  requestAnimationFrame(animate);
}

start();
