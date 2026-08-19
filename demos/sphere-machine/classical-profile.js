import * as THREE from 'three';
import {
  SHAPE_NAMES,
  createShapeGeometry,
  containsShapePoint,
  getConvexPlanes
} from './shape-model.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EPSILON = 1e-8;
const directionCache = new Map();
const profileCache = new Map();
const tempPoint = new THREE.Vector3();

export { SHAPE_NAMES as CLASSICAL_SHAPE_NAMES };

function fibonacciDirections(count) {
  if (directionCache.has(count)) return directionCache.get(count);
  const directions = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - 2 * ((i + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * GOLDEN_ANGLE;
    directions.push(new THREE.Vector3(Math.cos(phi) * radius, y, Math.sin(phi) * radius));
  }
  directionCache.set(count, directions);
  return directions;
}

function lowerBound(sorted, value) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

function settingsForLevel(level = 3) {
  const safeLevel = Math.max(1, Math.min(5, Number(level) || 3));
  return {
    directions: [768, 1536, 3072, 6144, 12288][safeLevel - 1],
    radii: [80, 96, 128, 160, 192][safeLevel - 1]
  };
}

function convexProfile(kind, directions, radialCount) {
  if (kind === 'sphere') {
    return {
      radii: Array.from({ length: radialCount }, (_, i) => i / (radialCount - 1)),
      occupancy: new Array(radialCount).fill(1),
      guaranteedRadius: 1
    };
  }

  const planes = getConvexPlanes(kind) || [];
  const boundaries = new Float64Array(directions.length);

  for (let i = 0; i < directions.length; i += 1) {
    let limit = Infinity;
    const direction = directions[i];
    for (const plane of planes) {
      const denominator = plane.normal.dot(direction);
      if (denominator <= EPSILON) continue;
      limit = Math.min(limit, plane.constant / denominator);
    }
    boundaries[i] = Number.isFinite(limit) ? THREE.MathUtils.clamp(limit, 0, 1) : 1;
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const radii = [];
  const occupancy = [];
  for (let i = 0; i < radialCount; i += 1) {
    const r = i / (radialCount - 1);
    const firstInside = lowerBound(sorted, r - 1e-10);
    radii.push(r);
    occupancy.push((sorted.length - firstInside) / sorted.length);
  }

  return { radii, occupancy, guaranteedRadius: sorted[0] || 0 };
}

function nonConvexProfile(kind, directions, radialCount) {
  const radii = [];
  const occupancy = [];
  for (let i = 0; i < radialCount; i += 1) {
    const r = i / (radialCount - 1);
    let hits = 0;
    for (const direction of directions) {
      tempPoint.copy(direction).multiplyScalar(r);
      if (containsShapePoint(kind, tempPoint)) hits += 1;
    }
    radii.push(r);
    occupancy.push(hits / directions.length);
  }
  return { radii, occupancy, guaranteedRadius: 0 };
}

export function getClassicalRadialProfile(kind, level = 3) {
  const settings = settingsForLevel(level);
  const cacheKey = `${kind}:${settings.directions}:${settings.radii}`;
  if (profileCache.has(cacheKey)) return profileCache.get(cacheKey);

  const validationGeometry = createShapeGeometry(kind);
  validationGeometry.dispose();

  const directions = fibonacciDirections(settings.directions);
  const profile = kind === 'torus'
    ? nonConvexProfile(kind, directions, settings.radii)
    : convexProfile(kind, directions, settings.radii);

  const shellRaw = profile.radii.map((r, index) => r * r * profile.occupancy[index]);
  const shellMax = Math.max(...shellRaw, 1e-12);
  profile.shell = shellRaw.map(value => value / shellMax);
  profile.directionCount = settings.directions;
  profile.shape = kind;
  profile.shapeName = SHAPE_NAMES[kind] || kind;
  profile.coreOccupancy = profile.occupancy[0] ?? 0;

  profileCache.set(cacheKey, profile);
  return profile;
}
