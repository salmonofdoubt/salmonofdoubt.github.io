import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';

const TARGET_RADIUS = 1.55;
const MAX_RPM = 360;
const MAX_TRACE_POINTS = 42000;
const MAX_PERSISTENCE_INSTANCES = 48;
const Z_BINS = 18;
const PHI_BINS = 36;
const COVERAGE_BIN_COUNT = Z_BINS * PHI_BINS;
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const GOLDEN_FRACTION = 0.6180339887498949;

const canvas = document.getElementById('sceneCanvas');
const stage = document.getElementById('stage');
const webglError = document.getElementById('webglError');

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
  clear: document.getElementById('clearButton'),
  resetOrientation: document.getElementById('resetOrientationButton'),
  resetCamera: document.getElementById('cameraButton'),
  showTrail: document.getElementById('showTrail'),
  showSphere: document.getElementById('showSphere'),
  showAxes: document.getElementById('showAxes'),
  showEdges: document.getElementById('showEdges'),
  traceRate: document.getElementById('traceRate'),
  traceRateOut: document.getElementById('traceRateOut'),
  coverage: document.getElementById('coverageValue'),
  samples: document.getElementById('sampleValue'),
  axes: document.getElementById('axisValue'),
  interpretation: document.getElementById('interpretation'),
  stageTitle: document.getElementById('stage-title'),
  stageRegime: document.getElementById('stageRegime'),
  runState: document.getElementById('runState'),
  runDot: document.getElementById('runDot')
};

const shapeNames = {
  cube: 'Cube',
  pyramid: 'Square pyramid',
  tetrahedron: 'Tetrahedron',
  octahedron: 'Octahedron',
  icosahedron: 'Icosahedron',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  torus: 'Torus',
  triangle: 'Thin triangle',
  circle: 'Thin circle',
  rectangle: 'Thin rectangle'
};

const presets = {
  stop: { x: false, y: false, z: false, sx: 0, sy: 0, sz: 0 },
  x: { x: true, y: false, z: false, sx: 30, sy: 0, sz: 0 },
  xy: { x: true, y: true, z: false, sx: 40, sy: 56, sz: 0 },
  xyz: { x: true, y: true, z: true, sx: 180, sy: 254, sz: 325 }
};

let renderer;
let scene;
let camera;
let controls;
let objectGroup;
let solidMesh;
let edgeLines;
let persistenceMesh;
let currentGeometry;
let referenceSphere;
let axesHelper;
let tracePoints;
let traceGeometry;
let traceAttribute;
let outerPoints = [];
let currentShape = 'cube';
let paused = false;
let lastTime = performance.now();
let traceWriteIndex = 0;
let traceCount = 0;
let visitedBins = new Uint8Array(COVERAGE_BIN_COUNT);
let visitedCount = 0;

const angles = { x: 0, y: 0, z: 0 };
const tracePositions = new Float32Array(MAX_TRACE_POINTS * 3);
const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const persistenceDummy = new THREE.Object3D();
persistenceDummy.rotation.order = 'XYZ';

function buildGeometry(kind) {
  switch (kind) {
    case 'cube': return new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
    case 'pyramid': return new THREE.ConeGeometry(1.45, 2.4, 4, 1, false, Math.PI / 4);
    case 'tetrahedron': return new THREE.TetrahedronGeometry(1.6, 0);
    case 'octahedron': return new THREE.OctahedronGeometry(1.6, 0);
    case 'icosahedron': return new THREE.IcosahedronGeometry(1.6, 0);
    case 'sphere': return new THREE.SphereGeometry(1.5, 32, 20);
    case 'cylinder': return new THREE.CylinderGeometry(1.25, 1.25, 2.15, 32, 1, false);
    case 'cone': return new THREE.ConeGeometry(1.35, 2.5, 32, 1, false);
    case 'torus': return new THREE.TorusGeometry(1.05, 0.42, 16, 48);
    case 'triangle': return new THREE.CylinderGeometry(1.5, 1.5, 0.065, 3, 1, false, Math.PI / 2);
    case 'circle': return new THREE.CylinderGeometry(1.45, 1.45, 0.065, 64, 1, false);
    case 'rectangle': return new THREE.BoxGeometry(2.55, 0.065, 1.5, 1, 1, 1);
    default: return new THREE.BoxGeometry(2, 2, 2);
  }
}

function normaliseGeometry(geometry) {
  geometry.computeBoundingBox();
  geometry.center();
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius || 1;
  const scale = TARGET_RADIUS / radius;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();
  return geometry;
}

function extractOuterPoints(geometry) {
  const position = geometry.getAttribute('position');
  const candidates = [];
  let maxRadius = 0;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, y, z);
    maxRadius = Math.max(maxRadius, radius);
    candidates.push({ x, y, z, radius });
  }

  const unique = new Map();
  const threshold = maxRadius * 0.995;
  for (const point of candidates) {
    if (point.radius < threshold) continue;
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, new THREE.Vector3(point.x, point.y, point.z));
  }

  let points = Array.from(unique.values());
  const maxTracers = currentShape === 'sphere' ? 96 : 128;
  if (points.length > maxTracers) {
    const sampled = [];
    const step = points.length / maxTracers;
    for (let i = 0; i < maxTracers; i += 1) sampled.push(points[Math.floor(i * step)]);
    points = sampled;
  }

  return points.length ? points : [new THREE.Vector3(TARGET_RADIUS, 0, 0)];
}

function disposeObject() {
  if (objectGroup) scene.remove(objectGroup);
  if (persistenceMesh) scene.remove(persistenceMesh);

  solidMesh?.material?.dispose();
  edgeLines?.geometry?.dispose();
  edgeLines?.material?.dispose();
  persistenceMesh?.material?.dispose();
  currentGeometry?.dispose();

  objectGroup = null;
  solidMesh = null;
  edgeLines = null;
  persistenceMesh = null;
  currentGeometry = null;
}

function createObject(kind) {
  disposeObject();
  currentShape = kind;
  currentGeometry = normaliseGeometry(buildGeometry(kind));
  outerPoints = extractOuterPoints(currentGeometry);

  objectGroup = new THREE.Group();

  solidMesh = new THREE.Mesh(
    currentGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x37c8d8,
      roughness: 0.34,
      metalness: 0.12,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  solidMesh.renderOrder = 2;
  objectGroup.add(solidMesh);

  edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(currentGeometry, 22),
    new THREE.LineBasicMaterial({
      color: 0xe9f8f8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  edgeLines.renderOrder = 3;
  objectGroup.add(edgeLines);
  scene.add(objectGroup);

  persistenceMesh = new THREE.InstancedMesh(
    currentGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x49dce9,
      transparent: true,
      opacity: 0.035,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    MAX_PERSISTENCE_INSTANCES
  );
  persistenceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  persistenceMesh.count = 0;
  persistenceMesh.frustumCulled = false;
  persistenceMesh.renderOrder = 1;
  scene.add(persistenceMesh);

  ui.stageTitle.textContent = `Rotating ${shapeNames[kind].toLowerCase()}`;
  applyAngles();
  clearEnvelope();
  applyDisplayVisibility();
  updateVisualPersistence();
  updatePersistenceMesh();
}

function initScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    console.error(error);
    webglError.hidden = false;
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  resetCamera();

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 3.1;
  controls.maxDistance = 9;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbdeff5, 0x061018, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
  key.position.set(4, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c6cff, 2.2);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  const floor = new THREE.GridHelper(8, 16, 0x1b8d9c, 0x173743);
  floor.position.y = -2.05;
  floor.material.transparent = true;
  floor.material.opacity = 0.24;
  scene.add(floor);

  axesHelper = new THREE.AxesHelper(2.25);
  axesHelper.material.transparent = true;
  axesHelper.material.opacity = 0.72;
  scene.add(axesHelper);

  referenceSphere = new THREE.Mesh(
    new THREE.SphereGeometry(TARGET_RADIUS, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.11, depthWrite: false })
  );
  scene.add(referenceSphere);

  traceGeometry = new THREE.BufferGeometry();
  traceAttribute = new THREE.BufferAttribute(tracePositions, 3);
  traceAttribute.setUsage(THREE.DynamicDrawUsage);
  traceGeometry.setAttribute('position', traceAttribute);
  traceGeometry.setDrawRange(0, 0);

  tracePoints = new THREE.Points(
    traceGeometry,
    new THREE.PointsMaterial({
      color: 0xf0fbff,
      size: 0.027,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  tracePoints.renderOrder = 4;
  scene.add(tracePoints);

  createObject(currentShape);
  resizeRenderer();
  return true;
}

function resetCamera() {
  if (!camera) return;
  camera.position.set(4.5, 3.15, 5.4);
  camera.lookAt(0, 0, 0);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.floor(width * pixelRatio);
  const targetHeight = Math.floor(height * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function rpmValue(axis) {
  const key = axis.toUpperCase();
  return ui[`axis${key}`].checked ? Number(ui[`speed${key}`].value) : 0;
}

function angularRate(axis) {
  return rpmValue(axis) * 6 * DEG;
}

function activeAxisCount() {
  return ['X', 'Y', 'Z'].reduce(
    (count, axis) => count + (ui[`axis${axis}`].checked && Number(ui[`speed${axis}`].value) > 0 ? 1 : 0),
    0
  );
}

function maxRpm() {
  return Math.max(rpmValue('x'), rpmValue('y'), rpmValue('z'));
}

function applyAngles() {
  if (!objectGroup) return;
  objectGroup.rotation.order = 'XYZ';
  objectGroup.rotation.set(angles.x, angles.y, angles.z);
}

function setCoverageBin(point) {
  const radius = point.length();
  if (radius < 1e-8) return;
  const y = THREE.MathUtils.clamp(point.y / radius, -1, 1);
  const phi = Math.atan2(point.z, point.x);
  const zIndex = Math.min(Z_BINS - 1, Math.floor(((y + 1) * 0.5) * Z_BINS));
  const phiIndex = Math.min(PHI_BINS - 1, Math.floor(((phi + Math.PI) / TWO_PI) * PHI_BINS));
  const index = zIndex * PHI_BINS + phiIndex;

  if (!visitedBins[index]) {
    visitedBins[index] = 1;
    visitedCount += 1;
  }
}

function writeTracePoint(point) {
  const offset = traceWriteIndex * 3;
  tracePositions[offset] = point.x;
  tracePositions[offset + 1] = point.y;
  tracePositions[offset + 2] = point.z;
  traceWriteIndex = (traceWriteIndex + 1) % MAX_TRACE_POINTS;
  traceCount = Math.min(MAX_TRACE_POINTS, traceCount + 1);
  setCoverageBin(point);
}

function addTraceAtOrientation(x, y, z) {
  if (!outerPoints.length || !traceAttribute) return;
  tempEuler.set(x, y, z, 'XYZ');
  tempQuaternion.setFromEuler(tempEuler);

  for (const source of outerPoints) {
    tempVector.copy(source).applyQuaternion(tempQuaternion);
    writeTracePoint(tempVector);
  }
}

function commitTraceUpdate() {
  if (!traceAttribute || !traceGeometry) return;
  traceAttribute.needsUpdate = true;
  traceGeometry.setDrawRange(0, traceCount);
}

function traceExposureCount(dx, dy, dz) {
  const travelDegrees = (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / DEG;
  const density = Number(ui.traceRate.value);
  const densityFactor = [0, 0.45, 0.65, 0.85, 1.0, 1.25][density] || 0.85;
  return THREE.MathUtils.clamp(Math.ceil((travelDegrees / 3) * densityFactor), 1, MAX_PERSISTENCE_INSTANCES);
}

function persistenceIntensity() {
  if (activeAxisCount() === 0) return 0;
  return THREE.MathUtils.smoothstep(maxRpm(), 20, 300);
}

function updatePersistenceMesh() {
  if (!persistenceMesh) return;

  const intensity = persistenceIntensity();
  if (intensity <= 0.001) {
    persistenceMesh.count = 0;
    persistenceMesh.visible = false;
    return;
  }

  const count = THREE.MathUtils.clamp(
    Math.round(THREE.MathUtils.lerp(3, MAX_PERSISTENCE_INSTANCES, intensity)),
    3,
    MAX_PERSISTENCE_INSTANCES
  );
  const exposureWindow = THREE.MathUtils.lerp(0.08, 0.82, intensity);
  const wx = angularRate('x');
  const wy = angularRate('y');
  const wz = angularRate('z');

  persistenceMesh.visible = true;
  persistenceMesh.count = count;
  persistenceMesh.material.opacity = THREE.MathUtils.lerp(0.025, 0.055, intensity);

  for (let i = 0; i < count; i += 1) {
    const phase = (i * GOLDEN_FRACTION) % 1;
    const t = (phase - 0.5) * exposureWindow;

    persistenceDummy.rotation.set(
      angles.x + wx * t,
      angles.y + wy * t,
      angles.z + wz * t
    );
    persistenceDummy.updateMatrix();
    persistenceMesh.setMatrixAt(i, persistenceDummy.matrix);
  }

  persistenceMesh.instanceMatrix.needsUpdate = true;
}

function integrateFrame(dt) {
  const wx = angularRate('x');
  const wy = angularRate('y');
  const wz = angularRate('z');
  const dx = wx * dt;
  const dy = wy * dt;
  const dz = wz * dt;
  const startX = angles.x;
  const startY = angles.y;
  const startZ = angles.z;
  const exposures = traceExposureCount(dx, dy, dz);

  for (let i = 1; i <= exposures; i += 1) {
    const t = i / exposures;
    addTraceAtOrientation(startX + dx * t, startY + dy * t, startZ + dz * t);
  }

  angles.x = (startX + dx) % TWO_PI;
  angles.y = (startY + dy) % TWO_PI;
  angles.z = (startZ + dz) % TWO_PI;
  applyAngles();
  commitTraceUpdate();
  updatePersistenceMesh();
}

function clearEnvelope() {
  traceWriteIndex = 0;
  traceCount = 0;
  visitedBins = new Uint8Array(COVERAGE_BIN_COUNT);
  visitedCount = 0;
  traceGeometry?.setDrawRange(0, 0);
  updateMetrics();
}

function resetOrientation() {
  angles.x = 0;
  angles.y = 0;
  angles.z = 0;
  applyAngles();
  clearEnvelope();
  updatePersistenceMesh();
}

function updateSpeedOutputs() {
  for (const axis of ['X', 'Y', 'Z']) {
    const input = ui[`speed${axis}`];
    const out = ui[`speed${axis}Out`];
    const hud = ui[`hud${axis}`];
    const enabled = ui[`axis${axis}`].checked;
    const value = Number(input.value);

    out.textContent = `${value} rpm`;
    hud.textContent = enabled ? `${value} rpm` : 'off';
    input.disabled = !enabled;
  }

  updateVisualPersistence();
  updatePersistenceMesh();
}

function updateVisualPersistence() {
  if (!solidMesh || !edgeLines || !tracePoints) return;

  const intensity = persistenceIntensity();
  solidMesh.material.opacity = THREE.MathUtils.lerp(0.88, 0.24, intensity);
  edgeLines.material.opacity = ui.showEdges.checked
    ? THREE.MathUtils.lerp(0.9, 0.08, intensity)
    : 0;
  tracePoints.material.opacity = THREE.MathUtils.lerp(0.24, 0.34, intensity);
  tracePoints.material.size = THREE.MathUtils.lerp(0.025, 0.031, intensity);
}

function updateMetrics() {
  const coverage = (visitedCount / COVERAGE_BIN_COUNT) * 100;
  const axes = activeAxisCount();
  ui.coverage.textContent = `${coverage.toFixed(coverage < 10 ? 1 : 0)}%`;
  ui.samples.textContent = traceCount.toLocaleString();
  ui.axes.textContent = String(axes);
  ui.stageRegime.textContent = regimeLabel(axes);
  ui.interpretation.textContent = interpretationText(axes, coverage);
}

function regimeLabel(axes) {
  if (currentShape === 'sphere') return 'already rotationally symmetric';
  if (axes === 0) return 'static geometry';
  if (axes === 1) return 'single-axis revolution';
  if (axes === 2) return 'two-axis blended form';
  if (maxRpm() >= 120) return 'high-RPM spherical integration';
  return 'three-axis sphere search';
}

function interpretationText(axes, coverage) {
  if (currentShape === 'sphere') {
    return 'A sphere is already invariant under rotation, so increasing RPM leaves its visible form essentially unchanged.';
  }
  if (axes === 0) {
    return 'No active rotation: the instantaneous object and its integrated form are identical.';
  }
  if (axes === 1) {
    return 'With one axis, repeated orientations merge into a surface of revolution. It can look rounded, but it does not explore all directions.';
  }
  if (axes === 2) {
    return 'Two axes blend many complete copies of the object into a broader time-integrated form. Add the third axis for spherical symmetry.';
  }
  if (coverage > 95) {
    return 'The full object is now being shown in many orientations at once. Its time-integrated visible form is strongly sphere-like, while the instantaneous geometry remains inside that synthesis.';
  }
  if (maxRpm() >= 120) {
    return 'High RPM now overlays many actual orientations of the complete object, so the object itself should read as an increasingly solid sphere-like form rather than a faint tracer.';
  }
  return 'Three axes are active. Raise the RPM and the separate orientations will progressively fuse into one rounded integrated form.';
}

function applyDisplayVisibility() {
  if (tracePoints) tracePoints.visible = ui.showTrail.checked;
  if (referenceSphere) referenceSphere.visible = ui.showSphere.checked;
  if (axesHelper) axesHelper.visible = ui.showAxes.checked;
  if (edgeLines) edgeLines.visible = ui.showEdges.checked;
  updateVisualPersistence();
}

function setPaused(value) {
  paused = value;
  ui.pause.textContent = paused ? 'Resume' : 'Pause';
  ui.runState.textContent = paused ? 'paused' : 'running';
  ui.runDot.classList.toggle('paused', paused);
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

  if (name === 'xyz') {
    ui.traceRate.value = '5';
    ui.showTrail.checked = true;
    ui.showSphere.checked = false;
  }

  updateTraceRateLabel();
  updateSpeedOutputs();
  applyDisplayVisibility();
  resetOrientation();
  setPaused(false);
  updateMetrics();
}

function markCustomProgramme() {
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
  updateSpeedOutputs();
  clearEnvelope();
  updateMetrics();
}

function updateTraceRateLabel() {
  const labels = { 1: 'very low', 2: 'low', 3: 'medium', 4: 'high', 5: 'maximum' };
  ui.traceRateOut.textContent = labels[Number(ui.traceRate.value)] || 'medium';
}

function bindEvents() {
  ui.shape.addEventListener('change', () => createObject(ui.shape.value));

  for (const axis of ['X', 'Y', 'Z']) {
    ui[`axis${axis}`].addEventListener('change', markCustomProgramme);
    ui[`speed${axis}`].addEventListener('input', markCustomProgramme);
  }

  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  ui.pause.addEventListener('click', () => setPaused(!paused));
  ui.clear.addEventListener('click', clearEnvelope);
  ui.resetOrientation.addEventListener('click', resetOrientation);
  ui.resetCamera.addEventListener('click', resetCamera);

  for (const checkbox of [ui.showTrail, ui.showSphere, ui.showAxes, ui.showEdges]) {
    checkbox.addEventListener('change', applyDisplayVisibility);
  }

  ui.traceRate.addEventListener('input', () => {
    updateTraceRateLabel();
    clearEnvelope();
  });

  window.addEventListener('resize', resizeRenderer, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resizeRenderer).observe(stage);
}

function animate(now) {
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  resizeRenderer();
  const dt = Math.min(0.04, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (!paused) {
    integrateFrame(dt);
    updateMetrics();
  }

  controls?.update();
  renderer.render(scene, camera);
}

function start() {
  bindEvents();
  updateSpeedOutputs();
  updateTraceRateLabel();

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (initScene()) {
    applyPreset('xyz');
    if (reduceMotion) setPaused(true);
    requestAnimationFrame(animate);
  }
}

start();
