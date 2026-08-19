import * as THREE from 'three';

const shapeSelect = document.getElementById('shapeSelect');
const radialCanvas = document.getElementById('radialPlot');
const resolutionControl = document.getElementById('probabilityResolution');
const analysisCopy = document.querySelector('.analysis-copy > p');
const chartCaption = document.querySelector('.analysis-chart .chart-heading > span');

if (shapeSelect && radialCanvas) {
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

  function resolutionSettings() {
    const level = Number(resolutionControl?.value || 3);
    const directionCounts = [768, 1536, 3072, 6144, 12288];
    const radialCounts = [80, 96, 128, 160, 192];
    return {
      directions: directionCounts[level - 1] || 3072,
      radii: radialCounts[level - 1] || 128
    };
  }

  function torusContains(point) {
    // Three.js TorusGeometry lies in the XY plane and is centred on the Z axis.
    // Original R = 1.05, tube = 0.42; after bounding-radius normalisation
    // the exact ratios are R = 5/7 and tube = 2/7.
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
        occupancy.push(r <= 1 ? 1 : 0);
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

  function calculateProfile(kind) {
    const settings = resolutionSettings();
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
    profileCache.set(cacheKey, profile);
    return profile;
  }

  function drawProfile(profile) {
    const ctx = radialCanvas.getContext('2d');
    const width = radialCanvas.width;
    const height = radialCanvas.height;
    const left = 46;
    const right = 18;
    const top = 30;
    const bottom = 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07131d';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,.075)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = top + plotHeight * i / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i += 1) {
      const x = left + plotWidth * i / 4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
    }

    function drawSeries(values, colour) {
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = left + plotWidth * profile.radii[index];
        const y = top + (1 - value) * plotHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    drawSeries(profile.occupancy, '#66e4ff');
    drawSeries(profile.shell, '#a391ff');

    if (profile.guaranteedRadius > 0.02 && profile.guaranteedRadius < 0.995) {
      const x = left + plotWidth * profile.guaranteedRadius;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - bottom);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(225,242,250,.78)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('p = 1 core', Math.min(x + 6, width - 72), top + 14);
    }

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220,238,247,.72)';
    ctx.fillText('1', 28, top + 4);
    ctx.fillText('0.5', 20, top + plotHeight / 2 + 4);
    ctx.fillText('0', 30, height - bottom + 4);
    ctx.fillText('0', left - 3, height - 14);
    ctx.fillText('0.5', left + plotWidth / 2 - 8, height - 14);
    ctx.fillText('1', width - right - 3, height - 14);
    ctx.fillText('r / rmax', width - 62, height - 2);

    ctx.fillStyle = '#66e4ff';
    ctx.fillRect(left, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('full rotational average p(r)', left + 24, 16);
    ctx.fillStyle = '#a391ff';
    ctx.fillRect(left + 205, 10, 18, 3);
    ctx.fillStyle = '#dceef7';
    ctx.fillText('relative r²p(r)', left + 229, 16);
  }

  function updateCopy(profile) {
    if (analysisCopy) {
      analysisCopy.innerHTML =
        `The cyan curve is the <strong>full rotational average</strong>: at each radius, ${profile.directionCount.toLocaleString()} evenly distributed directions are tested. It is deterministic, so refreshes no longer change the curve. The violet curve is the corresponding shell weighting <em>r</em>²p(<em>r</em>), normalised for comparison.`;
    }
    if (chartCaption) {
      chartCaption.textContent = 'full rotational average · cyan p(r) · violet r²p(r)';
    }
  }

  function renderDeterministicProfile() {
    const profile = calculateProfile(shapeSelect.value);
    drawProfile(profile);
    updateCopy(profile);
  }

  function scheduleRender() {
    requestAnimationFrame(renderDeterministicProfile);
  }

  shapeSelect.addEventListener('change', scheduleRender);
  resolutionControl?.addEventListener('input', scheduleRender);

  for (const id of ['axisX', 'axisY', 'axisZ', 'speedX', 'speedY', 'speedZ']) {
    document.getElementById(id)?.addEventListener('input', scheduleRender);
    document.getElementById(id)?.addEventListener('change', scheduleRender);
  }

  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', scheduleRender);
  });

  window.addEventListener('resize', scheduleRender, { passive: true });
  scheduleRender();
}
