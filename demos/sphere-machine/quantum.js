import './radial-probability.js';
import './ux-controller.js';

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
      'The 1s local probability density |ψ|² is maximal at the centre. The radial-shell probability nevertheless starts at zero because a spherical shell at r = 0 has zero volume. These are different quantities.'
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
      'The 2s state is still perfectly spherical, but it contains a spherical nodal surface at r = 2a₀. As with 1s, local density and radial-shell probability are different quantities.'
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
      'A single 2p_z state has a preferred axis and a nodal plane. Its local density is zero at the origin because the 2p wavefunction itself vanishes there; that is different from the 1s case.'
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
      'This is an equal incoherent mixture of m = −1, 0, +1 for l = 1. The spherical-harmonic addition theorem makes the summed angular density independent of direction. The density is isotropic, but it still vanishes at the origin because all 2p states do.'
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
  ctx.fillText('2D slice of local probability density |ψ(x,z)|² · coordinates in a₀', 12, height - 12);
}

function drawRadial(state) {
  const ctx = radialCanvas.getContext('2d');
  const width = radialCanvas.width;
  const height = radialCanvas.height;
  const left = 48;
  const right = 20;
  const top = 40;
  const bottom = 50;
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

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#66e4ff';
  ctx.fillRect(left, 10, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.fillText('local density |ψ(r)|²', left + 24, 16);
  ctx.fillStyle = '#a391ff';
  ctx.fillRect(left + 175, 10, 18, 3);
  ctx.fillStyle = '#dceef7';
  ctx.fillText('probability in shell 4πr²|ψ|²', left + 199, 16);

  // The origin is the point most likely to be confused: local 1s density can
  // be maximal there even though shell probability must be zero because the
  // shell has zero volume at r = 0.
  const originX = left;
  const originLocalY = top + (1 - localNorm[0]) * (height - top - bottom);
  const originShellY = top + (1 - shellNorm[0]) * (height - top - bottom);

  ctx.fillStyle = '#66e4ff';
  ctx.beginPath();
  ctx.arc(originX, originLocalY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a391ff';
  ctx.beginPath();
  ctx.arc(originX, originShellY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (state === quantumStates['1s']) {
    ctx.fillStyle = 'rgba(220,238,247,.82)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('centre: local density is maximum', left + 8, top + 12);
    ctx.fillText('shell probability = 0 because shell volume = 0', left + 8, height - bottom - 8);
  }

  ctx.fillStyle = 'rgba(220,238,247,.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('0', left - 4, height - 20);
  ctx.fillText('12 a₀', width - 54, height - 20);
  ctx.fillText('normalised for shape comparison', left, height - 4);
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
