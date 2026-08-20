import * as THREE from 'three';

const EPSILON = 1e-8;
const definitionCache = new Map();

export const SHAPE_NAMES = {
  cube: 'Cube',
  pyramid: 'Square pyramid',
  tetrahedron: 'Tetrahedron',
  octahedron: 'Octahedron',
  icosahedron: 'Icosahedron',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  torus: 'Torus',
  sofa: 'Sofa',
  triangle: 'Thin triangle plate',
  circle: 'Thin circular plate',
  rectangle: 'Thin rectangular plate'
};

export const THIN_SHAPES = new Set(['triangle', 'circle', 'rectangle']);

// One source of truth for both the rendered sofa and its occupancy test.
// Coordinates are deliberately symmetric about the origin before normalisation.
const SOFA_PARTS = [
  { size: [2.60, 0.50, 1.15], centre: [0, -0.45, 0] },
  { size: [2.50, 1.45, 0.22], centre: [0, 0, -0.50] },
  { size: [0.32, 0.95, 1.22], centre: [-1.32, -0.25, 0] },
  { size: [0.32, 0.95, 1.22], centre: [1.32, -0.25, 0] },
  { size: [1.20, 0.24, 0.92], centre: [-0.58, -0.10, 0.06] },
  { size: [1.20, 0.24, 0.92], centre: [0.58, -0.10, 0.06] },
  { size: [1.12, 0.72, 0.16], centre: [-0.58, 0.18, -0.34] },
  { size: [1.12, 0.72, 0.16], centre: [0.58, 0.18, -0.34] }
];

function sofaRawRadius() {
  let maxRadiusSq = 0;
  for (const { size, centre } of SOFA_PARTS) {
    const [sx, sy, sz] = size;
    const [cx, cy, cz] = centre;
    for (const dx of [-sx / 2, sx / 2]) {
      for (const dy of [-sy / 2, sy / 2]) {
        for (const dz of [-sz / 2, sz / 2]) {
          maxRadiusSq = Math.max(maxRadiusSq, (cx + dx) ** 2 + (cy + dy) ** 2 + (cz + dz) ** 2);
        }
      }
    }
  }
  return Math.sqrt(maxRadiusSq);
}

const SOFA_RAW_RADIUS = sofaRawRadius();

function boxPart(size, centre) {
  const [sx, sy, sz] = size;
  const [cx, cy, cz] = centre;
  const indexed = new THREE.BoxGeometry(sx, sy, sz);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.translate(cx, cy, cz);
  return geometry;
}

function mergeNonIndexedGeometries(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function sofaGeometry() {
  return mergeNonIndexedGeometries(SOFA_PARTS.map(part => boxPart(part.size, part.centre)));
}

function rawGeometry(kind) {
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
    case 'sofa': return sofaGeometry();
    case 'triangle': return new THREE.CylinderGeometry(1.5, 1.5, 0.065, 3, 1, false, Math.PI / 2);
    case 'circle': return new THREE.CylinderGeometry(1.45, 1.45, 0.065, 64, 1, false);
    case 'rectangle': return new THREE.BoxGeometry(2.55, 0.065, 1.5);
    default: return new THREE.BoxGeometry(2, 2, 2);
  }
}

export function normaliseGeometry(geometry) {
  geometry.computeBoundingBox();
  geometry.center();
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius || 1;
  geometry.scale(1 / radius, 1 / radius, 1 / radius);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createShapeGeometry(kind) {
  return normaliseGeometry(rawGeometry(kind));
}

function planeKey(normal, constant) {
  return `${normal.x.toFixed(6)},${normal.y.toFixed(6)},${normal.z.toFixed(6)},${constant.toFixed(6)}`;
}

function buildConvexPlanes(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.getAttribute('position');
  const unique = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    ab.copy(b).sub(a);
    ac.copy(c).sub(a);
    normal.copy(ab).cross(ac);
    if (normal.lengthSq() < EPSILON) continue;
    normal.normalize();

    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(centroid) < 0) normal.negate();

    let constant = normal.dot(a);
    if (constant < 0) {
      normal.negate();
      constant = -constant;
    }

    const planeNormal = normal.clone();
    unique.set(planeKey(planeNormal, constant), { normal: planeNormal, constant });
  }

  source.dispose();
  return Array.from(unique.values());
}

function getDefinition(kind) {
  if (definitionCache.has(kind)) return definitionCache.get(kind);

  const geometry = createShapeGeometry(kind);
  const definition = {
    kind,
    thin: THIN_SHAPES.has(kind),
    planes: kind === 'sphere' || kind === 'torus' || kind === 'sofa' ? null : buildConvexPlanes(geometry)
  };
  geometry.dispose();
  definitionCache.set(kind, definition);
  return definition;
}

function insideRawBox(x, y, z, part) {
  const [sx, sy, sz] = part.size;
  const [cx, cy, cz] = part.centre;
  return Math.abs(x - cx) <= sx / 2 + 1e-9
    && Math.abs(y - cy) <= sy / 2 + 1e-9
    && Math.abs(z - cz) <= sz / 2 + 1e-9;
}

function containsSofaPoint(point) {
  // The raw sofa is centred before scaling, so invert the common radius scale.
  const x = point.x * SOFA_RAW_RADIUS;
  const y = point.y * SOFA_RAW_RADIUS;
  const z = point.z * SOFA_RAW_RADIUS;
  return SOFA_PARTS.some(part => insideRawBox(x, y, z, part));
}

export function containsShapePoint(kind, point) {
  if (kind === 'sphere') return point.lengthSq() <= 1 + 1e-10;

  if (kind === 'torus') {
    // TorusGeometry lies in the XY plane. R=1.05, tube=0.42 and the
    // bounding radius is R+tube=1.47, hence exact normalised ratios 5/7,2/7.
    const major = 5 / 7;
    const tube = 2 / 7;
    const q = Math.hypot(point.x, point.y) - major;
    return q * q + point.z * point.z <= tube * tube + 1e-10;
  }

  if (kind === 'sofa') return containsSofaPoint(point);

  const planes = getDefinition(kind).planes || [];
  for (const plane of planes) {
    if (plane.normal.dot(point) > plane.constant + 1e-9) return false;
  }
  return true;
}

export function getConvexPlanes(kind) {
  const planes = getDefinition(kind).planes;
  return planes ? planes.map(plane => ({ normal: plane.normal.clone(), constant: plane.constant })) : null;
}

export function getOuterPoints(kind, maxPoints = 20) {
  const geometry = createShapeGeometry(kind);
  const position = geometry.getAttribute('position');
  const unique = new Map();
  let maxRadius = 0;

  for (let i = 0; i < position.count; i += 1) {
    maxRadius = Math.max(maxRadius, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
  }

  const threshold = maxRadius * 0.995;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (Math.hypot(x, y, z) < threshold) continue;
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    if (!unique.has(key)) unique.set(key, new THREE.Vector3(x, y, z));
  }

  geometry.dispose();
  let points = Array.from(unique.values());
  if (points.length > maxPoints) {
    const reduced = [];
    const step = points.length / maxPoints;
    for (let i = 0; i < maxPoints; i += 1) reduced.push(points[Math.floor(i * step)]);
    points = reduced;
  }
  return points.length ? points : [new THREE.Vector3(1, 0, 0)];
}

export function shapeDescription(kind) {
  if (THIN_SHAPES.has(kind)) {
    return `${SHAPE_NAMES[kind]} has a small but finite thickness in this simulation, so its 3D occupancy probability is well-defined.`;
  }
  if (kind === 'torus') {
    return 'The torus contains a central hole, so rigid rotation about its centre never makes the origin occupied.';
  }
  if (kind === 'sofa') {
    return 'The sofa is modelled as the union of its seat, back, arms and cushions, so its non-convex occupancy is sampled directly rather than replaced by a convex hull.';
  }
  return `${SHAPE_NAMES[kind]} is treated as a solid body centred at the origin.`;
}
