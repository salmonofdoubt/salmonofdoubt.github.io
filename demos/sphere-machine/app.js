import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';

const TWO_PI = Math.PI * 2;
const MAX_RPM = 360;
const MAX_SUPERPOSITIONS = 96;
const PROBABILITY_POINTS = 1800;
const ANALYSIS_ORIENTATIONS = 96;
const Z_BINS = 18;
const PHI_BINS = 36;
const COVERAGE_BIN_COUNT = Z_BINS * PHI_BINS;
const GOLDEN = 0.6180339887498949;
const SILVER = 0.4142135623730950;

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
  showSuperposition: document.getElementById('showSuperposition'),
  showProbability: document.getElementById('showProbability'),
  showSphere: document.getElementById('showSphere'),
  showAxes: document.getElementById('showAxes'),
  showEdges: document.getElementById('showEdges'),
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
  runDot: document.getElementById('runDot'),
  radialPlot: document.getElementById('radialPlot')
};

const state = {
  shape: 'cube',
  paused: false,
  angles: new THREE.Euler(0, 0, 0, 'XYZ'),
  lastTime: performance.now(),
  superpositionCount: 0,
  coverage: 0,
  localProfile: [],
  shellProfile: []
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
let axesHelper;
let probabilityCloud;
let probabilityGeometry;
let probabilityPosition;
let probabilityColor;
let probabilitySize;
let outerPoints = [];
let probabilitySamples = [];
let probabilityValues = new Float32Array(PROBABILITY_POINTS);

const dummy = new THREE.Object3D();
const baseQuaternion = new THREE.Quaternion();
const sampleQuaternion = new THREE.Quaternion();
const workingQuaternion = new THREE.Quaternion();
const inverseQuaternion = new THREE.Quaternion();
const tempVector = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');

function fract(value) {
  return value - Math.floor(value);
}

function buildGeometry(kind) {
  switch (kind) {
    case 'cube': return new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
    case 'pyramid': return new THREE.ConeGeometry(1.45, 2.4, 4, 1, false, Math.PI / 4);
    case 'tetrahedron': return new THREE.TetrahedronGeometry(1.6, 0);
    case 'octahedron': return new THREE.OctahedronGeometry(1.6, 0);
    case 'icosahedron': return new THREE.IcosahedronGeometry(1.6, 0);
    case 'sphere': return new THREE.SphereGeometry(1.5, 36, 24);
    case 'cylinder': return new THREE.CylinderGeometry(1.25, 1.25, 2.15, 36, 1, false);
    case 'cone': return new THREE.ConeGeometry(1.35, 2.5, 36, 1, false);
    case 'torus': return new THREE.TorusGeometry(1.05, 0.42, 18, 56);
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
  geometry.scale(1 / radius, 1 / radius, 1 / radius);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function extractOuterPoints(geometry) {
  const position = geometry.getAttribute('position');
  const unique = new Map();
  let maxRadius = 0;

  for (let i = 0; i < position.count; i += 1) {
    maxRadius = Math.max(
      maxRadius,
      Math.hypot(position.getX(i), position.getY(i), position.getZ(i))
    );
  }

  const threshold = maxRadius * 0.995;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (Math.hypot(x, y, z) < threshold) continue;
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, new THREE.Vector3(x, y, z));
  }

  let points = Array.from(unique.values());
  if (points.length > 128) {
    const sampled = [];
    const step = points.length / 128;
    for (let i = 0; i < 128; i += 1) sampled.push(points[Math.floor(i * step)]);
    points = sampled;
  }

  return points.length ? points : [new THREE.Vector3(1, 0, 0)];
}

function pointInTriangle2D(x, z) {
  const ax = 0, az = 1;
  const bx = -0.8660254, bz = -0.5;
  const cx = 0.8660254, cz = -0.5;
  const v0x = cx - ax, v0z = cz - az;
  const v1x = bx - ax, v1z = bz - az;
  const v2x = x - ax, v2z = z - az;
  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;
  const inv = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function containsPoint(kind, p) {
  switch (kind) {
    case 'cube': {
      const h = 1 / Math.sqrt(3);
      return Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) <= h;
    }
    case 'sphere':
      return p.lengthSq() <= 1;
    case 'octahedron':
      return Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z) <= 1;
    case 'icosahedron':
    case 'tetrahedron':
      return currentGeometry?.boundingBox?.containsPoint(p) && p.length() <= 1;
    case 'cylinder': {
      const radius = 0.757;
      const halfHeight = 0.652;
      return Math.abs(p.y) <= halfHeight && Math.hypot(p.x, p.z) <= radius;
    }
    case 'cone': {
      const halfHeight = 0.68;
      const localY = p.y + halfHeight;
      if (localY < 0 || localY > halfHeight * 2) return false;
      const radius = 0.733 * (1 - localY / (halfHeight * 2));
      return Math.hypot(p.x, p.z) <= radius;
    }
    case 'pyramid': {
      const halfHeight = 0.68;
      const localY = p.y + halfHeight;
      if (localY < 0 || localY > halfHeight * 2) return false;
      const halfSide = 0.59 * (1 - localY / (halfHeight * 2));
      return Math.abs(p.x) <= halfSide && Math.abs(p.z) <= halfSide;
    }
    case 'torus': {
      const major = 0.70;
      const minor = 0.28;
      const q = Math.hypot(p.x, p.z) - major;
      return q * q + p.y * p.y <= minor * minor;
    }
    case 'triangle':
      return Math.abs(p.y) <= 0.025 && pointInTriangle2D(p.x, p.z);
    case 'circle':
      return Math.abs(p.y) <= 0.025 && Math.hypot(p.x, p.z) <= 0.999;
    case 'rectangle':
      return Math.abs(p.x) <= 0.82 && Math.abs(p.z) <= 0.48 && Math.abs(p.y) <= 0.025;
    default:
      return false;
  }
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
  currentGeometry = normaliseGeometry(buildGeometry(kind));
  outerPoints = extractOuterPoints(currentGeometry);

  objectGroup = new THREE.Group();
  solidMesh = new THREE.Mesh(
    currentGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x32c7d9,
      roughness: 0.3,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  objectGroup.add(solidMesh);

  edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(currentGeometry, 22),
    new THREE.LineBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    })
  );
  objectGroup.add(edgeLines);
  scene.add(objectGroup);

  superpositionMesh = new THREE.InstancedMesh(
    currentGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x66edff,
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

  ui.stageTitle.textContent = `Rotating ${shapeNames[kind].toLowerCase()}`;
  updateSuperposition();
  recalculateProbability();
}

function initProbabilityCloud() {
  probabilitySamples = [];
  const positions = new Float32Array(PROBABILITY_POINTS * 3);
  const colors = new Float32Array(PROBABILITY_POINTS * 3);
  const sizes = new Float32Array(PROBABILITY_POINTS);

  for (let i = 0; i < PROBABILITY_POINTS; i += 1) {
    let x, y, z;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
    } while (x * x + y * y + z * z > 1);

    probabilitySamples.push(new THREE.Vector3(x, y, z));
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    colors[i * 3] = 0.2;
    colors[i * 3 + 1] = 0.8;
    colors[i * 3 + 2] = 1;
    sizes[i] = 1;
  }

  probabilityGeometry = new THREE.BufferGeometry();
  probabilityPosition = new THREE.BufferAttribute(positions, 3);
  probabilityColor = new THREE.BufferAttribute(colors, 3);
  probabilitySize = new THREE.BufferAttribute(sizes, 1);
  probabilityGeometry.setAttribute('position', probabilityPosition);
  probabilityGeometry.setAttribute('color', probabilityColor);
  probabilityGeometry.setAttribute('aSize', probabilitySize);

  probabilityCloud = new THREE.Points(
    probabilityGeometry,
    new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(probabilityCloud);
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

function superpositionCount() {
  const axes = activeAxes().length;
  if (axes === 0) return 0;
  const speedFraction = THREE.MathUtils.clamp(maxRpm() / MAX_RPM, 0, 1);
  const minimum = axes === 1 ? 6 : axes === 2 ? 12 : 18;
  return THREE.MathUtils.clamp(
    Math.round(minimum + speedFraction * (MAX_SUPERPOSITIONS - minimum)),
    minimum,
    MAX_SUPERPOSITIONS
  );
}

function orientationForSample(index, count, axes, target) {
  target.identity();
  if (axes.length === 0 || count <= 0) return target;

  if (axes.length === 1) {
    const angle = TWO_PI * ((index + 0.5) / count);
    if (axes[0] === 'x') target.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    if (axes[0] === 'y') target.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    if (axes[0] === 'z') target.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    return target;
  }

  if (axes.length === 2) {
    const a = TWO_PI * fract((index + 0.5) * GOLDEN);
    const b = TWO_PI * fract((index + 0.5) * SILVER);
    tempEuler.set(0, 0, 0, 'XYZ');
    tempEuler[axes[0]] = a;
    tempEuler[axes[1]] = b;
    target.setFromEuler(tempEuler);
    return target;
  }

  const u1 = (index + 0.5) / count;
  const u2 = fract((index + 0.5) * GOLDEN);
  const u3 = fract((index + 0.5) * SILVER);
  const root1 = Math.sqrt(1 - u1);
  const root2 = Math.sqrt(u1);
  const theta1 = TWO_PI * u2;
  const theta2 = TWO_PI * u3;
  target.set(
    root1 * Math.sin(theta1),
    root1 * Math.cos(theta1),
    root2 * Math.sin(theta2),
    root2 * Math.cos(theta2)
  );
  return target.normalize();
}

function currentBaseQuaternion() {
  baseQuaternion.setFromEuler(state.angles);
  return baseQuaternion;
}

function updateSuperposition() {
  if (!superpositionMesh || !solidMesh || !objectGroup) return;

  const axes = activeAxes();
  const count = superpositionCount();
  state.superpositionCount = count;
  currentBaseQuaternion();

  objectGroup.rotation.copy(state.angles);
  edgeLines.visible = ui.showEdges.checked;

  const speedFraction = THREE.MathUtils.clamp(maxRpm() / MAX_RPM, 0, 1);
  solidMesh.material.opacity = THREE.MathUtils.lerp(0.9, 0.32, speedFraction);

  superpositionMesh.visible = ui.showSuperposition.checked;
  superpositionMesh.count = count;
  superpositionMesh.material.opacity = THREE.MathUtils.lerp(0.06, 0.024, speedFraction);

  for (let i = 0; i < count; i += 1) {
    orientationForSample(i, count, axes, sampleQuaternion);
    workingQuaternion.copy(baseQuaternion).multiply(sampleQuaternion);
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.quaternion.copy(workingQuaternion);
    dummy.updateMatrix();
    superpositionMesh.setMatrixAt(i, dummy.matrix);
  }
  superpositionMesh.instanceMatrix.needsUpdate = true;

  ui.integratedForm.textContent = classifyIntegratedForm();
  ui.stageRegime.textContent = regimeLabel();
}

function classifyIntegratedForm() {
  const axes = activeAxes().length;
  const rpm = maxRpm();
  if (axes === 0) return 'single object';
  if (axes === 1) return rpm < 100 ? 'rotating form' : 'surface of revolution';
  if (axes === 2) return rpm < 120 ? 'woven form' : 'rounded superposition';
  if (rpm < 90) return 'multi-axis form';
  if (rpm < 220) return 'near-spherical';
  return 'sphere-like';
}

function regimeLabel() {
  const axes = activeAxes().length;
  if (axes === 0) return 'instantaneous geometry';
  if (axes === 1) return 'one-axis rotational averaging';
  if (axes === 2) return 'two-axis rotational averaging';
  return 'SO(3)-like rotational averaging';
}

function analysisOrientationCount() {
  const level = Number(ui.probabilityResolution.value);
  return [24, 36, 56, 76, ANALYSIS_ORIENTATIONS][level - 1] || 56;
}

function updateProbabilityResolutionLabel() {
  const labels = ['quick', 'low', 'medium', 'high', 'maximum'];
  ui.probabilityResolutionOut.textContent = labels[Number(ui.probabilityResolution.value) - 1] || 'medium';
}

function recalculateProbability() {
  if (!currentGeometry || !probabilityCloud) return;

  const axes = activeAxes();
  const count = analysisOrientationCount();
  const hits = new Uint16Array(PROBABILITY_POINTS);
  const bins = 24;
  const radialSum = new Array(bins).fill(0);
  const radialCount = new Array(bins).fill(0);
  const shellSum = new Array(bins).fill(0);
  const visited = new Uint8Array(COVERAGE_BIN_COUNT);
  let visitedCount = 0;

  for (let j = 0; j < count; j += 1) {
    orientationForSample(j, count, axes, sampleQuaternion);
    inverseQuaternion.copy(sampleQuaternion).invert();

    for (let i = 0; i < PROBABILITY_POINTS; i += 1) {
      tempVector.copy(probabilitySamples[i]).applyQuaternion(inverseQuaternion);
      if (containsPoint(state.shape, tempVector)) hits[i] += 1;
    }

    for (const point of outerPoints) {
      tempVector.copy(point).applyQuaternion(sampleQuaternion);
      const r = tempVector.length();
      if (r < 1e-8) continue;
      const y = THREE.MathUtils.clamp(tempVector.y / r, -1, 1);
      const phi = Math.atan2(tempVector.z, tempVector.x);
      const zIndex = Math.min(Z_BINS - 1, Math.floor(((y + 1) * 0.5) * Z_BINS));
      const phiIndex = Math.min(PHI_BINS - 1, Math.floor(((phi + Math.PI) / TWO_PI) * PHI_BINS));
      const index = zIndex * PHI_BINS + phiIndex;
      if (!visited[index]) {
        visited[index] = 1;
        visitedCount += 1;
      }
    }
  }

  let coreTotal = 0;
  let coreCount = 0;
  let outerTotal = 0;
  let outerCount = 0;

  for (let i = 0; i < PROBABILITY_POINTS; i += 1) {
    const probability = axes.length === 0
      ? (containsPoint(state.shape, probabilitySamples[i]) ? 1 : 0)
      : hits[i] / count;
    probabilityValues[i] = probability;

    const r = probabilitySamples[i].length();
    const bin = Math.min(bins - 1, Math.floor(r * bins));
    radialSum[bin] += probability;
    radialCount[bin] += 1;
    shellSum[bin] += probability;

    if (r <= 0.2) {
      coreTotal += probability;
      coreCount += 1;
    }
    if (r >= 0.78 && r <= 0.95) {
      outerTotal += probability;
      outerCount += 1;
    }

    const offset = i * 3;
    const brightness = Math.pow(probability, 0.65);
    probabilityColor.array[offset] = 0.16 + 0.18 * brightness;
    probabilityColor.array[offset + 1] = 0.28 + 0.72 * brightness;
    probabilityColor.array[offset + 2] = 0.36 + 0.64 * brightness;
  }

  probabilityColor.needsUpdate = true;
  probabilityCloud.visible = ui.showProbability.checked;

  state.localProfile = radialSum.map((sum, index) => radialCount[index] ? sum / radialCount[index] : 0);
  const maxShell = Math.max(...shellSum, 1e-9);
  state.shellProfile = shellSum.map(value => value / maxShell);
  state.coverage = visitedCount / COVERAGE_BIN_COUNT;

  ui.coreProbability.textContent = (coreCount ? coreTotal / coreCount : 0).toFixed(2);
  ui.outerProbability.textContent = (outerCount ? outerTotal / outerCount : 0).toFixed(2);
  ui.coverage.textContent = `${Math.round(state.coverage * 100)}%`;

  drawRadialPlot();
  updateInterpretation();
}

function drawRadialPlot() {
  const ctx = ui.radialPlot.getContext('2d');
  const width = ui.radialPlot.width;
  const height = ui.radialPlot.height;
  const left = 44;
  const right = 18;
  const top = 24;
  const bottom = 34;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07131d';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (height - top - bottom) * i / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
  }

  function drawSeries(data, strokeStyle) {
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = left + (width - left - right) * index / Math.max(1, data.length - 1);
      const y = top + (1 - value) * (height - top - bottom);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  drawSeries(state.localProfile, '#66e4ff');
  drawSeries(state.shellProfile, '#a391ff');

  ctx.fillStyle = 'rgba(225,242,250,0.82)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('1', 24, top + 4);
  ctx.fillText('0', 24, height - bottom + 4);
  ctx.fillText('0', left - 3, height - 12);
  ctx.fillText('r / rmax', width - 58, height - 12);

  ctx.fillStyle = '#66e4ff';
  ctx.fillRect(left, 9, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.fillText('local occupancy p(r)', left + 24, 15);

  ctx.fillStyle = '#a391ff';
  ctx.fillRect(left + 180, 9, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.fillText('relative shell mass', left + 204, 15);
}

function updateInterpretation() {
  const axes = activeAxes().length;
  const core = Number(ui.coreProbability.textContent || 0);
  const outer = Number(ui.outerProbability.textContent || 0);
  const rpm = maxRpm();

  if (state.shape === 'torus') {
    ui.interpretation.textContent =
      'The torus is an important counter-example: rotational averaging can be spherical in symmetry while the centre remains low-probability. The probability field carries more information than the outer silhouette alone.';
    return;
  }

  if (axes === 0) {
    ui.interpretation.textContent =
      'No rotational averaging yet. You are seeing the instantaneous object and its ordinary occupancy field.';
    return;
  }

  if (axes === 1) {
    ui.interpretation.textContent =
      'One active axis produces a surface of revolution. Increasing RPM increases the number of superposed orientations, but one axis alone does not generate full spherical symmetry.';
    return;
  }

  if (axes === 2) {
    ui.interpretation.textContent =
      'Two active axes broaden the superposition and probability field, but the orientation set is still restricted. Add the third axis for the full rotational-average experiment.';
    return;
  }

  if (rpm >= 220) {
    ui.interpretation.textContent =
      `Three-axis averaging is now strongly sphere-like. The centre is occupied with probability ${core.toFixed(2)}, while the outer region averages ${outer.toFixed(2)}. Brightness therefore behaves like a classical probability of spatial occupancy.`;
    return;
  }

  ui.interpretation.textContent =
    'Three axes are active. Raise RPM to superpose more orientations at once; the visible form and occupancy field will approach radial symmetry.';
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
  updateSuperposition();
  recalculateProbability();
}

function setPaused(value) {
  state.paused = value;
  ui.pause.textContent = value ? 'Resume' : 'Pause';
  ui.runState.textContent = value ? 'paused' : 'running';
  ui.runDot.classList.toggle('paused', value);
}

function resetOrientation() {
  state.angles.set(0, 0, 0, 'XYZ');
  updateSuperposition();
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
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
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
      updateSuperposition();
      recalculateProbability();
    });

    ui[`speed${axis}`].addEventListener('input', () => {
      document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
      updateSpeedOutputs();
      updateSuperposition();
      recalculateProbability();
    });
  }

  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  ui.pause.addEventListener('click', () => setPaused(!state.paused));
  ui.resetOrientation.addEventListener('click', resetOrientation);
  ui.resetCamera.addEventListener('click', resetCamera);

  ui.showSuperposition.addEventListener('change', updateSuperposition);
  ui.showProbability.addEventListener('change', () => {
    probabilityCloud.visible = ui.showProbability.checked;
  });
  ui.showSphere.addEventListener('change', () => {
    referenceSphere.visible = ui.showSphere.checked;
  });
  ui.showAxes.addEventListener('change', () => {
    axesHelper.visible = ui.showAxes.checked;
  });
  ui.showEdges.addEventListener('change', updateSuperposition);
  ui.probabilityResolution.addEventListener('input', () => {
    updateProbabilityResolutionLabel();
    recalculateProbability();
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
    updateSuperposition();
  }

  controls.update();
  renderer.render(scene, camera);
}

function start() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
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
  controls.minDistance = 3.0;
  controls.maxDistance = 9;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbdeff5, 0x061018, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
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
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.09,
      depthWrite: false
    })
  );
  referenceSphere.visible = ui.showSphere.checked;
  scene.add(referenceSphere);

  initProbabilityCloud();
  probabilityCloud.visible = ui.showProbability.checked;

  createObject(state.shape);
  bindEvents();
  updateProbabilityResolutionLabel();
  updateSpeedOutputs();
  resizeRenderer();
  applyPreset('xyz');
  requestAnimationFrame(animate);
}

start();
