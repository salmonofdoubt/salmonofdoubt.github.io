import './pwa.js';
import './startup-slow.js';
import './radial-probability.js';
import { getClassicalRadialProfile } from './classical-profile.js';

const stateSelect = document.getElementById('quantumStateSelect');
const densityCanvas = document.getElementById('quantumDensityCanvas');
const radialCanvas = document.getElementById('quantumRadialCanvas');
const stateName = document.getElementById('quantumStateName');
const symmetryLabel = document.getElementById('quantumSymmetry');
const nodeLabel = document.getElementById('quantumNode');
const explanation = document.getElementById('quantumExplanation');
const shapeSelect = document.getElementById('shapeSelect');
const resolutionControl = document.getElementById('probabilityResolution');

let quantumMode = 'local';

const quantumStates = {
  '1s': {
    name: 'Hydrogen 1s', symmetry: 'spherical', node: 'no finite radial node',
    localDensity: r => Math.exp(-2 * r),
    planeDensity: (x, z) => Math.exp(-2 * Math.hypot(x, z)),
    radialShell: r => r * r * Math.exp(-2 * r),
    explanation: 'The 1s local probability density |ψ|² is maximal at the centre. Its shell probability starts at zero because a shell of radius zero has zero volume.'
  },
  '2s': {
    name: 'Hydrogen 2s', symmetry: 'spherical', node: 'radial node at r = 2a₀',
    localDensity(r) { const a = 2 - r; return a * a * Math.exp(-r); },
    planeDensity(x, z) { const r = Math.hypot(x, z); const a = 2 - r; return a * a * Math.exp(-r); },
    radialShell(r) { const a = 2 - r; return r * r * a * a * Math.exp(-r); },
    explanation: 'The 2s state remains spherical but has a spherical nodal surface at r = 2a₀. Spherical symmetry does not mean featureless probability.'
  },
  '2pz': {
    name: 'Hydrogen 2p_z', symmetry: 'directional', node: 'nodal plane z = 0',
    localDensity: r => r * r * Math.exp(-r) / 3,
    planeDensity: (x, z) => z * z * Math.exp(-Math.hypot(x, z)),
    radialShell: r => r ** 4 * Math.exp(-r),
    explanation: 'A single 2p_z state has a preferred axis and a nodal plane. Directional quantum structure is real and prevents “quantum probability is always spherical” from becoming the claim.'
  },
  '2pavg': {
    name: 'Hydrogen 2p shell average', symmetry: 'spherical after m-average', node: 'zero at the origin',
    localDensity: r => r * r * Math.exp(-r),
    planeDensity: (x, z) => { const r = Math.hypot(x, z); return r * r * Math.exp(-r); },
    radialShell: r => r ** 4 * Math.exp(-r),
    explanation: 'This equal incoherent mixture of m = −1, 0, +1 has isotropic density by the spherical-harmonic addition theorem, although all 2p components still vanish at the origin.'
  }
};

function normalise(values) {
  const max = Math.max(...values, 1e-12);
  return values.map(value => value / max);
}

function installModeToggle() {
  if (!radialCanvas || document.getElementById('quantumModeToggle')) return;
  const toggle = document.createElement('div');
  toggle.id = 'quantumModeToggle';
  toggle.className = 'quantum-mode-toggle';
  toggle.innerHTML = '<button type="button" class="active" data-qmode="local">Local density</button><button type="button" data-qmode="shell">Shell probability</button>';
  radialCanvas.parentElement.insertBefore(toggle, radialCanvas);
  toggle.addEventListener('click', event => {
    const button = event.target.closest('[data-qmode]');
    if (!button) return;
    quantumMode = button.dataset.qmode;
    toggle.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    updateQuantumState();
  });
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
  ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(235,248,255,.88)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('z', width / 2 + 8, 16);
  ctx.fillText('x', width - 18, height / 2 - 8);
  ctx.fillStyle = 'rgba(190,216,230,.74)';
  ctx.fillText('2D slice of local density |ψ(x,z)|² · coordinates in a₀', 12, height - 12);
}

function drawRadial(state) {
  const ctx = radialCanvas.getContext('2d');
  const width = radialCanvas.width;
  const height = radialCanvas.height;
  const left = 50, right = 20, top = 38, bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxR = 12;
  const count = 240;
  const quantum = [];

  for (let i = 0; i < count; i += 1) {
    const r = maxR * i / (count - 1);
    quantum.push(quantumMode === 'local' ? state.localDensity(r) : state.radialShell(r));
  }
  const quantumNorm = normalise(quantum);
  const classical = getClassicalRadialProfile(shapeSelect.value, Number(resolutionControl?.value || 3));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07131d';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + plotHeight * i / 4;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = left + plotWidth * i / 4;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - bottom); ctx.stroke();
  }

  function series(values, colour, widthPx = 2.5, radii = null) {
    ctx.beginPath();
    values.forEach((value, index) => {
      const fraction = radii ? radii[index] : index / (values.length - 1);
      const x = left + plotWidth * fraction;
      const y = top + (1 - value) * plotHeight;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colour;
    ctx.lineWidth = widthPx;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  series(classical.occupancy, '#ffffff', 2.1, classical.radii);
  series(quantumNorm, quantumMode === 'local' ? '#66e4ff' : '#a391ff', 2.7);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(left, 10, 18, 2); ctx.fillStyle = '#dceef7';
  ctx.fillText(`${classical.shapeName} occupancy pS(r)`, left + 24, 15);
  const qColour = quantumMode === 'local' ? '#66e4ff' : '#a391ff';
  const qLabel = quantumMode === 'local' ? 'quantum local density |ψ|²' : 'quantum shell probability 4πr²|ψ|²';
  ctx.fillStyle = qColour; ctx.fillRect(left + 190, 10, 18, 3); ctx.fillStyle = '#dceef7';
  ctx.fillText(qLabel, left + 214, 15);

  ctx.fillStyle = 'rgba(220,238,247,.75)';
  ctx.fillText('0', left - 4, height - 28);
  ctx.fillText('1', width - right - 3, height - 28);
  ctx.fillText('classical x = r/rmax · quantum x = r/(12a₀)', left, height - 8);
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

installModeToggle();
stateSelect.addEventListener('change', updateQuantumState);
shapeSelect.addEventListener('change', updateQuantumState);
resolutionControl?.addEventListener('input', updateQuantumState);
window.addEventListener('resize', updateQuantumState, { passive: true });
updateQuantumState();
