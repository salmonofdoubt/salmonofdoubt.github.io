const stateSelect = document.getElementById('quantumStateSelect');
const densityCanvas = document.getElementById('quantumDensityCanvas');
const radialCanvas = document.getElementById('quantumRadialCanvas');
const stateName = document.getElementById('quantumStateName');
const symmetryLabel = document.getElementById('quantumSymmetry');
const nodeLabel = document.getElementById('quantumNode');
const explanation = document.getElementById('quantumExplanation');
const classicalCanvas = document.getElementById('radialPlot');

const quantumStates = {
  '1s': {
    name: 'Hydrogen 1s',
    symmetry: 'spherical',
    node: 'no finite radial node',
    localDensity(r) {
      return Math.exp(-2 * r);
    },
    planeDensity(x, z) {
      return Math.exp(-2 * Math.hypot(x, z));
    },
    radialShell(r) {
      return r * r * Math.exp(-2 * r);
    },
    explanation:
      'The 1s probability density depends only on radius. Every direction is equivalent. This is the cleanest quantum comparison with the radially symmetric field produced by complete rotational averaging.'
  },
  '2s': {
    name: 'Hydrogen 2s',
    symmetry: 'spherical',
    node: 'radial node at r = 2a₀',
    localDensity(r) {
      const amplitude = 2 - r;
      return amplitude * amplitude * Math.exp(-r);
    },
    planeDensity(x, z) {
      const r = Math.hypot(x, z);
      const amplitude = 2 - r;
      return amplitude * amplitude * Math.exp(-r);
    },
    radialShell(r) {
      const amplitude = 2 - r;
      return r * r * amplitude * amplitude * Math.exp(-r);
    },
    explanation:
      'The 2s state is still perfectly spherical, but it contains a spherical nodal surface at r = 2a₀. Spherical symmetry therefore does not mean a uniform or featureless probability distribution.'
  },
  '2pz': {
    name: 'Hydrogen 2p_z',
    symmetry: 'directional',
    node: 'nodal plane z = 0',
    localDensity(r) {
      return r * r * Math.exp(-r) / 3;
    },
    planeDensity(x, z) {
      const r = Math.hypot(x, z);
      return z * z * Math.exp(-r);
    },
    radialShell(r) {
      return r ** 4 * Math.exp(-r);
    },
    explanation:
      'A single 2p_z state has a preferred axis and a nodal plane. This is the counter-example that prevents “quantum probability is always spherical” from becoming the claim. Directional quantum structure is real.'
  },
  '2pavg': {
    name: 'Hydrogen 2p shell average',
    symmetry: 'spherical after m-average',
    node: 'zero at the origin',
    localDensity(r) {
      return r * r * Math.exp(-r);
    },
    planeDensity(x, z) {
      const r = Math.hypot(x, z);
      return r * r * Math.exp(-r);
    },
    radialShell(r) {
      return r ** 4 * Math.exp(-r);
    },
    explanation:
      'This is an equal incoherent mixture of m = −1, 0, +1 for l = 1. The spherical-harmonic addition theorem makes the summed angular density independent of direction. Individual 2p states are directional; the complete m-mixture is isotropic.'
  }
};

function normalise(values) {
  const max = Math.max(...values, 1e-12);
  return values.map(value => value / max);
}

function drawDensity(state) {
  const ctx = densityCanvas.getContext('2d');
  const width = densityCanvas.width;
  const height = densityCanvas.height;
  const image = ctx.createImageData(width, height);
  const extent = 8;
  const samples = new Float32Array(width * height);
  let maxDensity = 0;

  for (let py = 0; py < height; py += 1) {
    const z = ((height - 1 - py) / (height - 1) * 2 - 1) * extent;
    for (let px = 0; px < width; px += 1) {
      const x = (px / (width - 1) * 2 - 1) * extent;
      const value = state.planeDensity(x, z);
      const index = py * width + px;
      samples[index] = value;
      maxDensity = Math.max(maxDensity, value);
    }
  }

  for (let i = 0; i < samples.length; i += 1) {
    const value = maxDensity > 0 ? samples[i] / maxDensity : 0;
    const mapped = Math.pow(value, 0.33);
    const offset = i * 4;
    image.data[offset] = Math.round(20 + 120 * mapped);
    image.data[offset + 1] = Math.round(25 + 95 * mapped);
    image.data[offset + 2] = Math.round(45 + 210 * mapped);
    image.data[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(235,248,255,.88)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('z', width / 2 + 8, 16);
  ctx.fillText('x', width - 18, height / 2 - 8);
  ctx.fillStyle = 'rgba(190,216,230,.74)';
  ctx.fillText('2D slice of |ψ(x,z)|² · coordinates in a₀', 12, height - 12);
}

function drawRadial(state) {
  const ctx = radialCanvas.getContext('2d');
  const width = radialCanvas.width;
  const height = radialCanvas.height;
  const left = 48;
  const right = 20;
  const top = 28;
  const bottom = 42;
  const maxR = 12;
  const count = 240;
  const local = [];
  const shell = [];

  for (let i = 0; i < count; i += 1) {
    const r = maxR * i / (count - 1);
    local.push(state.localDensity(r));
    shell.push(state.radialShell(r));
  }

  const localNorm = normalise(local);
  const shellNorm = normalise(shell);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07131d';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (height - top - bottom) * i / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = left + (width - left - right) * i / 4;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, height - bottom);
    ctx.stroke();
  }

  function series(data, colour, lineWidth = 2.5) {
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = left + (width - left - right) * index / (data.length - 1);
      const y = top + (1 - value) * (height - top - bottom);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  series(localNorm, '#66e4ff');
  series(shellNorm, '#a391ff');

  ctx.fillStyle = '#66e4ff';
  ctx.fillRect(left, 10, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('local |ψ|²', left + 24, 16);
  ctx.fillStyle = '#a391ff';
  ctx.fillRect(left + 120, 10, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.fillText('radial-shell probability', left + 144, 16);

  ctx.fillStyle = 'rgba(220,238,247,.75)';
  ctx.fillText('0', left - 4, height - 16);
  ctx.fillText('12 a₀', width - 54, height - 16);
  ctx.fillText('normalised for shape comparison', left, height - 2);
}

function updateQuantumState() {
  const state = quantumStates[stateSelect.value] || quantumStates['1s'];
  stateName.textContent = state.name;
  symmetryLabel.textContent = state.symmetry;
  nodeLabel.textContent = state.node;
  explanation.textContent = state.explanation;
  drawDensity(state);
  drawRadial(state);
}

stateSelect.addEventListener('change', updateQuantumState);
window.addEventListener('resize', updateQuantumState, { passive: true });

if (classicalCanvas) {
  const observer = new MutationObserver(() => {});
  observer.observe(classicalCanvas, { attributes: true });
}

updateQuantumState();
