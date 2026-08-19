import * as THREE from 'three';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EPSILON = 1e-8;
const directionCache = new Map();
const profileCache = new Map();

const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const tempCentroid = new THREE.Vector3();
const tempPoint = new THREE.Vector3();

export const CLASSICAL_SHAPE_NAMES = {
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

function buildGeometry(kind) {
  switch (kind) {
    case 'cube': return new THREE.BoxGeometry(2, 2, 2);
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
    case 'rectangle': return new THREE.BoxGeometry(2.55, 0.065, 1.5);
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

function fibonacciDirections(count) {
  if (directionCache.has(count)) return directionCache.get(count);

  const directions = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - 2 * ((i + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * GOLDEN_ANGLE;
    directions.push(new THREE.Vector3(
      Math.cos(phi) * radius,
      y,
      Math.sin(phi) * radius
    ));
  }

  directionCache.set(count, directions);
  return directions;
}

function planeKey(normal, constant) {
  return `${normal.x.toFixed(5)},${normal.y.toFixed(5)},${normal.z.toFixed(5)},${constant.toFixed(5)}`;
}

function convexPlanes(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.getAttribute('position');
  const unique = new Map();

  for (let i = 0; i < position.count; i += 3) {
    tempA.fromBufferAttribute(position, i);
    tempB.fromBufferAttribute(position, i + 1);
    tempC.fromBufferAttribute(position, i + 2);

    tempNormal
      .copy(tempB)
      .sub(tempA)
      .cross(tempC.clone().sub(tempA));

    if (tempNormal.lengthSq() < EPSILON) continue;
    tempNormal.normalize();

    tempCentroid
      .copy(tempA)
      .add(tempB)
      .add(tempC)
      .multiplyScalar(1 / 3);

    if (tempNormal.dot(tempCentroid) < 0) tempNormal.negate();

    let constant = tempNormal.dot(tempA);
    if (constant < 0) {
      tempNormal.negate();
      constant = -constant;
    }

    const normal = tempNormal.clone();
    unique.set(planeKey(normal, constant), { normal, constant });
  }

  source.dispose();
  return Array.from(unique.values());
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
  const directionCounts = [768, 1536, 3072, 6144, 12288];
  const radialCounts = [80, 96, 128, 160, 192];
  return {
    directions: directionCounts[safeLevel - 1],
    radii: radialCounts[safeLevel - 1]
  };
}

function torusContains(point) {
  // Three.js TorusGeometry is centred on the origin with its hole along Z.
  // R = 1.05 and tube = 0.42. After normalising by R + tube = 1.47,
  // these become the exact ratios 5/7 and 2/7.
  const major = 5 / 7;
  const tube = 2 / 7;
  const q = Math.hypot(point.x, point.y) - major;
  return q * q + point.z * point.z <= tube * tube + 1e-10;
}

function convexProfile(kind, geometry, directions, radialCount) {
  if (kind === 'sphere') {
    const radii = [];
    const occupancy = [];
    for (let i = 0; i < radialCount; i += 1) {
      const r = i / (radialCount - 1);
      radii.push(r);
      occupancy.push(1);
    }
    return { radii, occupancy, guaranteedRadius: 1 };
  }

  const planes = convexPlanes(geometry);
  const boundaries = new Float64Array(directions.length);

  for (let i = 0; i < directions.length; i += 1) {
    const direction = directions[i];
    let limit = Infinity;

    for (const plane of planes) {
      const denominator = plane.normal.dot(direction);
      if (denominator <= EPSILON) continue;
      limit = Math.min(limit, plane.constant / denominator);
    }

    boundaries[i] = Number.isFinite(limit)
      ? THREE.MathUtils.clamp(limit, 0, 1)
      : 1;
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

  return {
    radii,
    occupancy,
    guaranteedRadius: sorted[0] || 0
  };
}

function torusProfile(directions, radialCount) {
  const radii = [];
  const occupancy = [];

  for (let i = 0; i < radialCount; i += 1) {
    const r = i / (radialCount - 1);
    let hits = 0;

    for (const direction of directions) {
      tempPoint.copy(direction).multiplyScalar(r);
      if (torusContains(tempPoint)) hits += 1;
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

  const directions = fibonacciDirections(settings.directions);
  const geometry = normaliseGeometry(buildGeometry(kind));
  const profile = kind === 'torus'
    ? torusProfile(directions, settings.radii)
    : convexProfile(kind, geometry, directions, settings.radii);

  geometry.dispose();

  const shellRaw = profile.radii.map((r, index) => r * r * profile.occupancy[index]);
  const shellMax = Math.max(...shellRaw, 1e-12);
  profile.shell = shellRaw.map(value => value / shellMax);
  profile.directionCount = settings.directions;
  profile.shape = kind;
  profile.shapeName = CLASSICAL_SHAPE_NAMES[kind] || kind;

  profileCache.set(cacheKey, profile);
  return profile;
}
