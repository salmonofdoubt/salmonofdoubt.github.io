import { SITE_CONFIG } from "./site-config.js";
import { DEFAULT_PROFILE_ID, OBSERVER_PROFILES } from "./profiles.js";

const DB_NAME = "envlens-local-library";
const LEGACY_DB_NAME = "umwelt-lens-local-library";
const DB_VERSION = 1;
const STORE_NAME = "photos";

const state = {
  profileId: DEFAULT_PROFILE_ID,
  mode: "sunny",
  viewMode: "observer",
  cvdType: "deuteranopia",
  distanceCm: 50,
  reveal: 50,
  current: null,
  decodedSource: null,
  renderToken: 0,
  db: null,
  installPrompt: null,
  thumbnailUrls: new Map()
};

const elements = {
  speciesSelect: document.getElementById("speciesSelect"),
  observerHelp: document.getElementById("observerHelp"),
  quickViewButtons: [...document.querySelectorAll("[data-quick-view]")],
  viewButtons: [...document.querySelectorAll("[data-view]")],
  viewHelp: document.getElementById("viewHelp"),
  humanVisionField: document.getElementById("humanVisionField"),
  humanVisionSelect: document.getElementById("humanVisionSelect"),
  simpleHelp: document.getElementById("simpleHelp"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  distanceRange: document.getElementById("distanceRange"),
  distanceOutput: document.getElementById("distanceOutput"),
  photoInput: document.getElementById("photoInput"),
  choosePhoto: document.getElementById("choosePhoto"),
  loadSample: document.getElementById("loadSample"),
  uploadZone: document.getElementById("uploadZone"),
  saveLocally: document.getElementById("saveLocally"),
  statusBox: document.querySelector(".status-box"),
  statusText: document.getElementById("statusText"),
  comparisonPanel: document.querySelector(".comparison-panel"),
  comparisonStage: document.getElementById("comparisonStage"),
  stageLoader: document.getElementById("stageLoader"),
  translatedLabel: document.getElementById("translatedLabel"),
  humanCanvas: document.getElementById("humanCanvas"),
  beeCanvas: document.getElementById("beeCanvas"),
  revealRange: document.getElementById("revealRange"),
  centreDivider: document.getElementById("centreDivider"),
  downloadComparison: document.getElementById("downloadComparison"),
  modeExplanation: document.getElementById("modeExplanation"),
  observerMetric: document.getElementById("observerMetric"),
  observerMetricHelp: document.getElementById("observerMetricHelp"),
  uvMetricTitle: document.getElementById("uvMetricTitle"),
  uvMetricValue: document.getElementById("uvMetricValue"),
  uvMetricHelp: document.getElementById("uvMetricHelp"),
  confidenceMetric: document.getElementById("confidenceMetric"),
  confidenceHelp: document.getElementById("confidenceHelp"),
  photoCount: document.getElementById("photoCount"),
  storageUse: document.getElementById("storageUse"),
  protectStorage: document.getElementById("protectStorage"),
  clearLibrary: document.getElementById("clearLibrary"),
  photoGrid: document.getElementById("photoGrid"),
  emptyLibrary: document.getElementById("emptyLibrary"),
  libraryNotice: document.getElementById("libraryNotice"),
  doiPill: document.getElementById("doiPill"),
  doiText: document.getElementById("doiText"),
  installApp: document.getElementById("installApp"),
  installDialog: document.getElementById("installDialog"),
  installInstructions: document.getElementById("installInstructions")
};

const humanContext = elements.humanCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
const beeContext = elements.beeCanvas.getContext("2d", { alpha: false });
const workCanvas = document.createElement("canvas");
const workContext = workCanvas.getContext("2d", { alpha: false });

const SRGB_TO_LINEAR = new Float32Array(256);
for (let value = 0; value < 256; value += 1) {
  const normalized = value / 255;
  SRGB_TO_LINEAR[value] = normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

const LINEAR_TO_SRGB = new Uint8ClampedArray(4097);
for (let index = 0; index < LINEAR_TO_SRGB.length; index += 1) {
  const linear = index / 4096;
  const encoded = linear <= 0.0031308
    ? linear * 12.92
    : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  LINEAR_TO_SRGB[index] = Math.round(Math.max(0, Math.min(1, encoded)) * 255);
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function linearToByte(value) {
  return LINEAR_TO_SRGB[Math.round(clamp(value) * 4096)];
}

function deterministicNoise(pixelIndex) {
  let hash = (pixelIndex * 1664525 + 1013904223) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822519) >>> 0;
  hash ^= hash >>> 13;
  return ((hash & 1023) / 1023) - 0.5;
}

const COLOUR_VISION_PROFILES = Object.freeze({
  deuteranopia: Object.freeze({
    label: "Deuteranopia",
    shortLabel: "Deuteranopia",
    description: "Approximate reduced red–green discrimination using a common accessibility-oriented simulation.",
    matrix: Object.freeze([
      0.367322, 0.860646, -0.227968,
      0.280085, 0.672501, 0.047413,
      -0.011820, 0.042940, 0.968881
    ])
  }),
  protanopia: Object.freeze({
    label: "Protanopia",
    shortLabel: "Protanopia",
    description: "Approximate reduced long-wavelength discrimination with muted reds and changed yellow–green relationships.",
    matrix: Object.freeze([
      0.152286, 1.052583, -0.204868,
      0.114503, 0.786281, 0.099216,
      -0.003882, -0.048116, 1.051998
    ])
  }),
  tritanopia: Object.freeze({
    label: "Tritanopia",
    shortLabel: "Tritanopia",
    description: "Approximate reduced blue–yellow discrimination using a compact accessibility-oriented transform.",
    matrix: Object.freeze([
      1.255528, -0.076749, -0.178779,
      -0.078411, 0.930809, 0.147602,
      0.004733, 0.691367, 0.303900
    ])
  })
});

function getActiveProfile() {
  return OBSERVER_PROFILES[state.profileId] || OBSERVER_PROFILES[DEFAULT_PROFILE_ID];
}

function getColourVisionProfile() {
  return COLOUR_VISION_PROFILES[state.cvdType] || COLOUR_VISION_PROFILES.deuteranopia;
}

function getCurrentViewLabel() {
  if (state.viewMode === "uv-proxy") return "UV proxy";
  if (state.viewMode === "colour-blind") return getColourVisionProfile().shortLabel;
  return `${getActiveProfile().commonName} model`;
}

function getQuickViewKey() {
  if (state.viewMode === "uv-proxy") return "uv-proxy";
  if (state.viewMode === "colour-blind") return "colour-blind";
  if (state.profileId === "sympetrum") return "dragonfly";
  if (state.profileId === "deilephila-elpenor") return "night-moth";
  return "bee";
}

function updateQuickViewButtons() {
  const activeKey = getQuickViewKey();
  elements.quickViewButtons.forEach((button) => {
    const active = button.dataset.quickView === activeKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function smoothstep(edge0, edge1, value) {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function quantileFromHistogram(histogram, quantile, total) {
  const target = total * quantile;
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) return index / (histogram.length - 1);
  }
  return 1;
}

function applyColourVisionTransform(red, green, blue, type) {
  const matrix = getColourVisionProfile(type)?.matrix || getColourVisionProfile().matrix;
  return [
    clamp(matrix[0] * red + matrix[1] * green + matrix[2] * blue),
    clamp(matrix[3] * red + matrix[4] * green + matrix[5] * blue),
    clamp(matrix[6] * red + matrix[7] * green + matrix[8] * blue)
  ];
}

function buildSignalBuffers(source, profile, mode) {
  const pixelCount = source.length / 4;
  const uvSignals = new Float32Array(pixelCount);
  const blueSignals = new Float32Array(pixelCount);
  const greenSignals = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);

  const uvMatrix = profile.receptorModel.uvProxy;
  const blueMatrix = profile.receptorModel.blue;
  const greenMatrix = profile.receptorModel.green;

  for (let offset = 0, pixelIndex = 0; offset < source.length; offset += 4, pixelIndex += 1) {
    const red = SRGB_TO_LINEAR[source[offset]];
    const green = SRGB_TO_LINEAR[source[offset + 1]];
    const blue = SRGB_TO_LINEAR[source[offset + 2]];

    const uvBase = uvMatrix[0] * red + uvMatrix[1] * green + uvMatrix[2] * blue;
    const uvProxy = clamp((uvBase + 0.045 * (1 - red) + 0.03 * Math.max(0, blue - green)) * mode.uvGain);
    const blueResponse = clamp(blueMatrix[0] * red + blueMatrix[1] * green + blueMatrix[2] * blue) * mode.blueGain;
    const greenResponse = clamp(greenMatrix[0] * red + greenMatrix[1] * green + greenMatrix[2] * blue) * mode.greenGain;

    uvSignals[pixelIndex] = uvProxy;
    blueSignals[pixelIndex] = blueResponse;
    greenSignals[pixelIndex] = greenResponse;
    histogram[Math.max(0, Math.min(255, Math.round(uvProxy * 255)))] += 1;
  }

  const uvLow = quantileFromHistogram(histogram, 0.04, pixelCount);
  const uvHigh = Math.max(uvLow + 0.08, quantileFromHistogram(histogram, 0.97, pixelCount));

  return { uvSignals, blueSignals, greenSignals, uvLow, uvHigh };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

function formatDate(timestamp) {
  try {
    return new Intl.DateTimeFormat("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(timestamp));
  } catch {
    return "Stored locally";
  }
}

function setStatus(message, type = "busy") {
  elements.statusText.textContent = message;
  elements.statusBox.classList.toggle("is-ready", type === "ready");
  elements.statusBox.classList.toggle("is-error", type === "error");
}

function setStageLoading(isLoading, message = "Preparing image…") {
  elements.comparisonStage.classList.toggle("is-loading", isLoading);
  elements.stageLoader.textContent = message;
}

function configureDoi() {
  elements.doiText.textContent = SITE_CONFIG.doi;
  const hasRealDoi = Boolean(SITE_CONFIG.doiUrl) && !SITE_CONFIG.doi.includes("0000000");

  if (hasRealDoi) {
    elements.doiPill.href = SITE_CONFIG.doiUrl;
    elements.doiPill.classList.remove("is-placeholder");
    elements.doiPill.setAttribute("aria-label", `Open Zenodo DOI ${SITE_CONFIG.doi}`);
    return;
  }

  elements.doiPill.href = "#";
  elements.doiPill.classList.add("is-placeholder");
  elements.doiPill.title = "Zenodo DOI will be added after publication.";
  elements.doiPill.addEventListener("click", (event) => {
    event.preventDefault();
    setStatus("The Zenodo DOI is still a publication placeholder.", "ready");
  });
}

function updateReveal(value) {
  state.reveal = Number(value);
  elements.revealRange.value = String(state.reveal);
  elements.comparisonStage.style.setProperty("--reveal", `${state.reveal}%`);
}

function updateModeUi() {
  const profile = getActiveProfile();
  const mode = profile.modes[state.mode];

  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (state.viewMode === "colour-blind") {
    elements.modeExplanation.innerHTML = `<strong>${getColourVisionProfile().label}</strong><span>Accessibility-oriented approximation from the uploaded RGB photograph. The insect illumination and distance assumptions are not the main driver here.</span>`;
  } else {
    elements.modeExplanation.innerHTML = `<strong>${mode.label}</strong><span>${mode.description}</span>`;
  }
}

function updateObserverUi() {
  const profile = getActiveProfile();
  elements.speciesSelect.value = profile.id;
  elements.observerHelp.textContent = `${profile.commonName} view: ${profile.distinction}`;

  if (state.viewMode === "colour-blind") {
    const humanProfile = getColourVisionProfile();
    elements.observerMetric.textContent = `Human viewer · ${humanProfile.label}`;
    elements.observerMetricHelp.textContent = humanProfile.description;
  } else {
    elements.observerMetric.textContent = profile.scientificName;
    elements.observerMetricHelp.textContent = profile.summary;
  }
}

function updateViewUi() {
  const profile = getActiveProfile();
  const humanProfile = getColourVisionProfile();
  const isUvProxy = state.viewMode === "uv-proxy";
  const isColourBlind = state.viewMode === "colour-blind";

  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === state.viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.humanVisionField.hidden = !isColourBlind;

  if (isUvProxy) {
    elements.translatedLabel.textContent = "Estimated UV proxy";
    elements.beeCanvas.setAttribute(
      "aria-label",
      "Violet false-colour display of an ultraviolet proxy inferred from the visible photograph"
    );
    elements.viewHelp.textContent =
      "No UV was photographed. Brighter violet indicates a higher RGB-derived UV hypothesis, not measured ultraviolet reflectance.";
    elements.uvMetricTitle.textContent = "UV source";
    elements.uvMetricValue.textContent = "RGB-derived hypothesis";
    elements.uvMetricHelp.textContent =
      "The phone image supplied no ultraviolet channel. This panel is a contrast-preserving educational proxy, not evidence of actual UV reflectance.";
    elements.confidenceMetric.textContent = "Low";
    elements.confidenceHelp.textContent =
      "Useful for exploratory comparison only. Dark areas are not proof of UV absorption, and bright areas are not proof of UV reflection.";
  } else if (isColourBlind) {
    elements.translatedLabel.textContent = `${humanProfile.shortLabel} impression`;
    elements.beeCanvas.setAttribute(
      "aria-label",
      `Approximate ${humanProfile.label.toLowerCase()} rendering of the uploaded photograph`
    );
    elements.viewHelp.textContent = `${humanProfile.description}`;
    elements.uvMetricTitle.textContent = "Source";
    elements.uvMetricValue.textContent = "Human RGB only";
    elements.uvMetricHelp.textContent =
      "This accessibility view is derived directly from the uploaded photograph rather than from the insect observer model.";
    elements.confidenceMetric.textContent = "Interpretive";
    elements.confidenceHelp.textContent =
      "Colour-vision-difference simulations are approximations. They help communication and design checking but are not individual diagnoses.";
  } else {
    elements.translatedLabel.textContent = `${profile.commonName} model`;
    elements.beeCanvas.setAttribute(
      "aria-label",
      `Human-visible false-colour simulation of visual information for ${profile.commonName}`
    );
    elements.viewHelp.textContent =
      `Human-visible false-colour translation for ${profile.commonName}. ${profile.summary}`;
    elements.uvMetricTitle.textContent = "UV information";
    elements.uvMetricValue.textContent = "Proxy only";
    elements.uvMetricHelp.textContent =
      "Ordinary RGB photographs do not record ultraviolet reflectance, so the UV-like channel remains a labelled approximation.";
    elements.confidenceMetric.textContent = "Illustrative";
    elements.confidenceHelp.textContent =
      `Observer-specific, scientifically informed, but not calibrated multispectral imaging. ${profile.distinction}`;
  }

  if (elements.simpleHelp) {
    if (state.viewMode === "uv-proxy") {
      elements.simpleHelp.textContent = "UV clue highlights possible ultraviolet-related structure inferred from the visible photo. It is not a measured UV photograph.";
    } else if (state.viewMode === "colour-blind") {
      elements.simpleHelp.textContent = "Colour vision shows a common red-green colour-vision-difference impression.";
    } else {
      elements.simpleHelp.textContent = `Now showing ${getActiveProfile().commonName.toLowerCase()} view.`;
    }
  }

  updateObserverUi();
  updateQuickViewButtons();
  updateModeUi();
}

function updateDistanceUi() {
  elements.distanceOutput.value = `${state.distanceCm} cm`;
  elements.distanceOutput.textContent = `${state.distanceCm} cm`;
}

function calculateRenderSize(width, height, maxDimension = SITE_CONFIG.maxRenderDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function decodeBlob(blob) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      return createImageElement(blob);
    }
  }
  return createImageElement(blob);
}

function createImageElement(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The browser could not decode this image."));
    };
    image.src = url;
  });
}

function sourceDimensions(source) {
  return {
    width: source.width || source.naturalWidth,
    height: source.height || source.naturalHeight
  };
}

function closeDecodedSource() {
  if (state.decodedSource && typeof state.decodedSource.close === "function") {
    state.decodedSource.close();
  }
  state.decodedSource = null;
}

async function loadPhotoBlob(blob, metadata = {}) {
  const token = ++state.renderToken;
  setStageLoading(true, "Preparing image…");
  setStatus(`Preparing ${metadata.name || "image"}…`);

  try {
    const source = await decodeBlob(blob);
    if (token !== state.renderToken) {
      if (typeof source.close === "function") source.close();
      return;
    }

    closeDecodedSource();
    state.decodedSource = source;
    state.current = {
      id: metadata.id || null,
      name: metadata.name || "photograph",
      blob,
      createdAt: metadata.createdAt || Date.now()
    };

    const dimensions = sourceDimensions(source);
    const renderSize = calculateRenderSize(dimensions.width, dimensions.height);

    elements.humanCanvas.width = renderSize.width;
    elements.humanCanvas.height = renderSize.height;
    elements.beeCanvas.width = renderSize.width;
    elements.beeCanvas.height = renderSize.height;
    workCanvas.width = renderSize.width;
    workCanvas.height = renderSize.height;

    elements.comparisonStage.style.aspectRatio = `${renderSize.width} / ${renderSize.height}`;

    humanContext.clearRect(0, 0, renderSize.width, renderSize.height);
    humanContext.imageSmoothingEnabled = true;
    humanContext.imageSmoothingQuality = "high";
    humanContext.drawImage(source, 0, 0, renderSize.width, renderSize.height);

    await renderObserverView(token);
    elements.downloadComparison.disabled = false;
    setStageLoading(false);
    setStatus(`${metadata.name || "Photo"} is ready.`, "ready");
    if (metadata.name && metadata.name !== "Built-in flower sample") {
      elements.choosePhoto.innerHTML = '<span aria-hidden="true">📷</span> Change photo';
    }
  } catch (error) {
    console.error(error);
    setStageLoading(false);
    setStatus(error.message || "The image could not be loaded.", "error");
  }
}

async function renderObserverView(expectedToken = state.renderToken) {
  if (!state.current || !state.decodedSource) return;

  const profile = getActiveProfile();
  const mode = profile.modes[state.mode];
  const width = elements.humanCanvas.width;
  const height = elements.humanCanvas.height;
  const sourceImage = humanContext.getImageData(0, 0, width, height);
  const outputImage = workContext.createImageData(width, height);
  const source = sourceImage.data;
  const output = outputImage.data;

  const displayRed = profile.displayModel.redFrom;
  const displayGreen = profile.displayModel.greenFrom;
  const displayBlue = profile.displayModel.blueFrom;
  const isNight = state.mode === "night";
  const signals = buildSignalBuffers(source, profile, mode);

  for (let offset = 0, pixelIndex = 0; offset < source.length; offset += 4, pixelIndex += 1) {
    const red = SRGB_TO_LINEAR[source[offset]];
    const green = SRGB_TO_LINEAR[source[offset + 1]];
    const blue = SRGB_TO_LINEAR[source[offset + 2]];

    const uvProxy = signals.uvSignals[pixelIndex];
    const blueResponse = signals.blueSignals[pixelIndex];
    const greenResponse = signals.greenSignals[pixelIndex];
    const uvNormalized = smoothstep(signals.uvLow, signals.uvHigh, uvProxy);
    const uvDisplay = clamp(0.45 * uvProxy + 0.55 * Math.pow(uvNormalized, 0.84));
    const noise = deterministicNoise(pixelIndex) * mode.noise;

    let mappedRed;
    let mappedGreen;
    let mappedBlue;

    if (state.viewMode === "colour-blind") {
      [mappedRed, mappedGreen, mappedBlue] = applyColourVisionTransform(red, green, blue, state.cvdType);
    } else if (state.viewMode === "uv-proxy") {
      const floor = state.mode === "night" ? 0.03 : state.mode === "overcast" ? 0.06 : 0.08;
      const proxySignal = clamp(floor + Math.pow(uvNormalized, 0.88) * (0.94 - floor) + noise * 0.18);
      mappedRed = clamp(0.06 + proxySignal * 0.58);
      mappedGreen = clamp(0.03 + proxySignal * 0.18);
      mappedBlue = clamp(0.12 + proxySignal * 0.84);
    } else if (isNight) {
      const lowLightSignal = clamp((0.16 * uvDisplay + 0.24 * blueResponse + 0.60 * greenResponse) * mode.exposure + noise);
      mappedRed = lowLightSignal * 0.24;
      mappedGreen = lowLightSignal * 0.56;
      mappedBlue = lowLightSignal * 0.45;
    } else {
      mappedRed = displayRed[0] * uvDisplay + displayRed[1] * blueResponse + displayRed[2] * greenResponse;
      mappedGreen = displayGreen[0] * uvDisplay + displayGreen[1] * blueResponse + displayGreen[2] * greenResponse;
      mappedBlue = displayBlue[0] * uvDisplay + displayBlue[1] * blueResponse + displayBlue[2] * greenResponse;

      const luminance = 0.24 * mappedRed + 0.56 * mappedGreen + 0.20 * mappedBlue;
      mappedRed = luminance + (mappedRed - luminance) * mode.chroma;
      mappedGreen = luminance + (mappedGreen - luminance) * mode.chroma;
      mappedBlue = luminance + (mappedBlue - luminance) * mode.chroma;

      mappedRed = ((mappedRed - 0.5) * mode.contrast + 0.5) * mode.exposure + noise;
      mappedGreen = ((mappedGreen - 0.5) * mode.contrast + 0.5) * mode.exposure + noise;
      mappedBlue = ((mappedBlue - 0.5) * mode.contrast + 0.5) * mode.exposure + noise;
    }

    output[offset] = linearToByte(mappedRed);
    output[offset + 1] = linearToByte(mappedGreen);
    output[offset + 2] = linearToByte(mappedBlue);
    output[offset + 3] = 255;
  }

  if (expectedToken !== state.renderToken) return;

  workContext.putImageData(outputImage, 0, 0);

  const spatial = profile.spatialModel;
  const distanceFactor = Math.pow(state.distanceCm / spatial.referenceDistanceCm, spatial.distanceExponent);
  const blur = state.viewMode === "colour-blind"
    ? 0
    : Math.min(8, spatial.baseBlurPx * distanceFactor * mode.blurMultiplier);

  beeContext.clearRect(0, 0, width, height);
  beeContext.save();
  beeContext.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : "none";
  beeContext.drawImage(workCanvas, 0, 0);
  beeContext.restore();
}

let rerenderTimer = 0;
function scheduleRerender() {
  window.clearTimeout(rerenderTimer);
  rerenderTimer = window.setTimeout(async () => {
    if (!state.current) return;
    setStageLoading(true, "Changing the view…");
    await renderObserverView();
    setStageLoading(false);
    setStatus(`${getCurrentViewLabel()} updated.`, "ready");
  }, 80);
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the image."));
    }, type, quality);
  });
}

async function compressForStorage(file) {
  const source = await decodeBlob(file);
  try {
    const dimensions = sourceDimensions(source);
    const size = calculateRenderSize(dimensions.width, dimensions.height, SITE_CONFIG.maxStoredDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);

    let blob;
    try {
      blob = await canvasToBlob(canvas, "image/webp", SITE_CONFIG.storedImageQuality);
    } catch {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
    }

    const thumbnailSize = calculateRenderSize(size.width, size.height, 320);
    const thumbnailCanvas = document.createElement("canvas");
    thumbnailCanvas.width = thumbnailSize.width;
    thumbnailCanvas.height = thumbnailSize.height;
    const thumbnailContext = thumbnailCanvas.getContext("2d", { alpha: false });
    thumbnailContext.imageSmoothingEnabled = true;
    thumbnailContext.imageSmoothingQuality = "high";
    thumbnailContext.drawImage(canvas, 0, 0, thumbnailSize.width, thumbnailSize.height);

    let thumbnail;
    try {
      thumbnail = await canvasToBlob(thumbnailCanvas, "image/webp", 0.72);
    } catch {
      thumbnail = await canvasToBlob(thumbnailCanvas, "image/jpeg", 0.76);
    }

    return {
      blob,
      thumbnail,
      width: size.width,
      height: size.height,
      size: blob.size
    };
  } finally {
    if (typeof source.close === "function") source.close();
  }
}

function showUpdatedPhoto() {
  if (!elements.comparisonPanel) return;
  window.requestAnimationFrame(() => {
    elements.comparisonPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function processUploadedFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Please choose a supported image file.", "error");
    return;
  }

  if (file.size > SITE_CONFIG.maxUploadBytes) {
    setStatus("This image is larger than the 30 MB upload limit.", "error");
    return;
  }

  setStageLoading(true, "Compressing locally…");
  setStatus(`Compressing ${file.name} locally…`);

  try {
    const compressed = await compressForStorage(file);
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name || `Photo ${new Date().toLocaleString("en-IE")}`,
      type: compressed.blob.type,
      blob: compressed.blob,
      thumbnail: compressed.thumbnail,
      width: compressed.width,
      height: compressed.height,
      size: compressed.size,
      createdAt: Date.now()
    };

    if (elements.saveLocally.checked && state.db) {
      await storePhotoWithQuotaRecovery(record);
      await trimLibrary();
      await refreshLibrary();
    }

    await loadPhotoBlob(record.blob, record);
    showUpdatedPhoto();
  } catch (error) {
    console.error(error);
    setStageLoading(false);
    setStatus(error.message || "The image could not be processed.", "error");
  } finally {
    elements.photoInput.value = "";
  }
}

function createSampleBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const context = canvas.getContext("2d", { alpha: false });

  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#9ed8ee");
  sky.addColorStop(0.48, "#d9ece8");
  sky.addColorStop(1, "#326d42");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 180; index += 1) {
    const x = (index * 83) % canvas.width;
    const y = 480 + ((index * 137) % 420);
    const radius = 18 + ((index * 19) % 58);
    context.fillStyle = `rgba(${22 + (index % 26)}, ${82 + (index % 54)}, ${38 + (index % 36)}, 0.34)`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const flowers = [
    { x: 270, y: 510, r: 110, petals: "#e14f86", centre: "#f5cf48" },
    { x: 660, y: 380, r: 145, petals: "#744fd1", centre: "#f2d44f" },
    { x: 1080, y: 570, r: 125, petals: "#f1e7d6", centre: "#d98b2b" },
    { x: 890, y: 735, r: 88, petals: "#dd4d36", centre: "#32231c" }
  ];

  flowers.forEach((flower, flowerIndex) => {
    context.strokeStyle = "rgba(38, 92, 43, 0.88)";
    context.lineWidth = 18;
    context.beginPath();
    context.moveTo(flower.x, canvas.height + 40);
    context.quadraticCurveTo(flower.x - 45, flower.y + 160, flower.x, flower.y + 40);
    context.stroke();

    const petalCount = flowerIndex === 2 ? 9 : 12;
    for (let petal = 0; petal < petalCount; petal += 1) {
      const angle = (Math.PI * 2 * petal) / petalCount;
      context.save();
      context.translate(flower.x, flower.y);
      context.rotate(angle);
      context.fillStyle = flower.petals;
      context.beginPath();
      context.ellipse(0, -flower.r * 0.62, flower.r * 0.32, flower.r * 0.67, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    const centreGradient = context.createRadialGradient(
      flower.x - flower.r * 0.15,
      flower.y - flower.r * 0.15,
      flower.r * 0.08,
      flower.x,
      flower.y,
      flower.r * 0.48
    );
    centreGradient.addColorStop(0, "#fff4a3");
    centreGradient.addColorStop(0.5, flower.centre);
    centreGradient.addColorStop(1, "#5f4315");
    context.fillStyle = centreGradient;
    context.beginPath();
    context.arc(flower.x, flower.y, flower.r * 0.44, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = "rgba(255,255,255,0.26)";
  context.beginPath();
  context.arc(1190, 165, 120, 0, Math.PI * 2);
  context.fill();

  return canvasToBlob(canvas, "image/webp", 0.88);
}

async function loadSample() {
  setStageLoading(true, "Drawing sample scene…");
  const blob = await createSampleBlob();
  await loadPhotoBlob(blob, {
    name: "Built-in flower sample",
    createdAt: Date.now()
  });
}

function openDatabase(databaseName = DB_NAME) {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(databaseName, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local storage could not be opened."));
  });
}

async function legacyDatabaseExists() {
  if (!indexedDB.databases) return false;

  try {
    const databases = await indexedDB.databases();
    return databases.some((database) => database.name === LEGACY_DB_NAME);
  } catch {
    return false;
  }
}

function readAllFromDatabase(database) {
  return new Promise((resolve, reject) => {
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      resolve([]);
      return;
    }

    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    transaction.oncomplete = () => resolve(request.result || []);
    transaction.onerror = () => reject(transaction.error || request.error || new Error("Legacy library could not be read."));
    transaction.onabort = () => reject(transaction.error || new Error("Legacy library migration was aborted."));
  });
}

async function migrateLegacyLibrary() {
  if (!(await legacyDatabaseExists())) return 0;

  const legacyDatabase = await openDatabase(LEGACY_DB_NAME);
  try {
    const records = await readAllFromDatabase(legacyDatabase);
    if (records.length === 0) return 0;

    const existing = await getAllPhotos();
    const existingIds = new Set(existing.map((record) => record.id));
    const recordsToMove = records.filter((record) => !existingIds.has(record.id));

    for (const record of recordsToMove) {
      await putPhoto(record);
    }

    return recordsToMove.length;
  } finally {
    legacyDatabase.close();
  }
}

function databaseRequest(mode, operation) {
  return new Promise((resolve, reject) => {
    if (!state.db) {
      reject(new Error("Local photo storage is unavailable."));
      return;
    }

    const transaction = state.db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;

    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error("Local storage operation failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local storage operation was aborted."));
  });
}

function getAllPhotos() {
  return databaseRequest("readonly", (store) => store.getAll()).then((records = []) =>
    records.sort((a, b) => b.createdAt - a.createdAt)
  );
}

function putPhoto(record) {
  return databaseRequest("readwrite", (store) => store.put(record));
}

function deletePhoto(id) {
  return databaseRequest("readwrite", (store) => store.delete(id));
}

function clearPhotos() {
  return databaseRequest("readwrite", (store) => store.clear());
}

async function deleteOldestPhotos(count = 1) {
  const records = await getAllPhotos();
  const oldest = records.slice(-count);
  await Promise.all(oldest.map((record) => deletePhoto(record.id)));
}

async function storePhotoWithQuotaRecovery(record) {
  try {
    await putPhoto(record);
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    await deleteOldestPhotos(5);
    await putPhoto(record);
    elements.libraryNotice.textContent = "The browser storage quota was reached, so the oldest local photographs were removed.";
  }
}

async function trimLibrary() {
  const records = await getAllPhotos();
  if (records.length <= SITE_CONFIG.maxLocalPhotos) return;
  const overflow = records.slice(SITE_CONFIG.maxLocalPhotos);
  await Promise.all(overflow.map((record) => deletePhoto(record.id)));
}

function revokeThumbnailUrls() {
  state.thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
  state.thumbnailUrls.clear();
}

async function updateStorageEstimate(records) {
  const localBytes = records.reduce((total, record) => total + (record.size || record.blob?.size || 0), 0);
  let text = `${formatBytes(localBytes)} stored locally`;

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (Number.isFinite(estimate.quota) && estimate.quota > 0) {
        text += ` · browser quota ${formatBytes(estimate.quota)}`;
      }
    } catch {
      // Local byte count remains useful when the quota estimate is unavailable.
    }
  }

  elements.storageUse.textContent = text;
}

async function refreshLibrary() {
  if (!state.db) return;
  const records = await getAllPhotos();
  revokeThumbnailUrls();

  elements.photoCount.textContent = `${records.length} / ${SITE_CONFIG.maxLocalPhotos}`;
  elements.clearLibrary.disabled = records.length === 0;
  elements.emptyLibrary.hidden = records.length > 0;
  elements.photoGrid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  records.forEach((record) => {
    const card = document.createElement("article");
    card.className = "photo-card";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "photo-load";
    loadButton.setAttribute("aria-label", `Load ${record.name}`);

    const image = document.createElement("img");
    const thumbnailUrl = URL.createObjectURL(record.thumbnail || record.blob);
    state.thumbnailUrls.set(record.id, thumbnailUrl);
    image.src = thumbnailUrl;
    image.alt = "";
    image.loading = "lazy";

    const metadata = document.createElement("span");
    metadata.className = "photo-meta";
    const name = document.createElement("strong");
    name.textContent = record.name;
    const date = document.createElement("span");
    date.textContent = `${formatDate(record.createdAt)} · ${formatBytes(record.size || record.blob.size)}`;
    metadata.append(name, date);
    loadButton.append(image, metadata);

    loadButton.addEventListener("click", () => {
      loadPhotoBlob(record.blob, record);
      document.getElementById("viewer").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "photo-delete";
    removeButton.setAttribute("aria-label", `Delete ${record.name} from local library`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", async () => {
      await deletePhoto(record.id);
      await refreshLibrary();
      setStatus(`${record.name} was removed from the local library.`, "ready");
    });

    card.append(loadButton, removeButton);
    fragment.appendChild(card);
  });

  elements.photoGrid.appendChild(fragment);
  await updateStorageEstimate(records);
}

async function protectStorage() {
  if (!navigator.storage?.persist) {
    elements.libraryNotice.textContent = "This browser does not expose persistent-storage controls. The library remains browser-managed.";
    return;
  }

  try {
    const persisted = await navigator.storage.persist();
    if (persisted) {
      elements.libraryNotice.textContent = "Persistent browser storage is enabled. The library is less likely to be removed automatically under storage pressure.";
      elements.protectStorage.textContent = "Protected";
      elements.protectStorage.disabled = true;
    } else {
      elements.libraryNotice.textContent = "The browser kept storage under normal management. Photos remain local but may be cleared by the visitor or under storage pressure.";
    }
  } catch {
    elements.libraryNotice.textContent = "Persistent storage could not be requested. The local library still works under normal browser storage rules.";
  }
}

async function initialiseStorage() {
  try {
    state.db = await openDatabase();
    const migratedPhotos = await migrateLegacyLibrary();
    await trimLibrary();
    await refreshLibrary();

    if (migratedPhotos > 0) {
      elements.libraryNotice.textContent = `${migratedPhotos} photo${migratedPhotos === 1 ? "" : "s"} moved into the renamed EnvLens library.`;
    }

    if (navigator.storage?.persisted) {
      const persisted = await navigator.storage.persisted();
      if (persisted) {
        elements.protectStorage.textContent = "Protected";
        elements.protectStorage.disabled = true;
      }
    }
  } catch (error) {
    console.warn(error);
    elements.saveLocally.checked = false;
    elements.saveLocally.disabled = true;
    elements.protectStorage.disabled = true;
    elements.clearLibrary.disabled = true;
    elements.storageUse.textContent = "Local library unavailable";
    elements.libraryNotice.textContent = "This browser does not currently provide durable local photo storage. Image processing still works.";
  }
}

function downloadComparison() {
  if (!state.current) return;
  const width = elements.humanCanvas.width;
  const height = elements.humanCanvas.height;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d", { alpha: false });

  context.drawImage(elements.humanCanvas, 0, 0);
  context.save();
  context.beginPath();
  context.rect(0, 0, width * (state.reveal / 100), height);
  context.clip();
  context.drawImage(elements.beeCanvas, 0, 0);
  context.restore();

  const lineX = width * (state.reveal / 100);
  context.strokeStyle = "rgba(255,255,255,0.94)";
  context.lineWidth = Math.max(2, width / 600);
  context.beginPath();
  context.moveTo(lineX, 0);
  context.lineTo(lineX, height);
  context.stroke();

  const labelSize = Math.max(18, Math.round(width / 48));
  context.font = `700 ${labelSize}px system-ui, sans-serif`;
  context.textBaseline = "top";
  context.fillStyle = "rgba(3,7,12,0.72)";
  context.fillRect(14, 14, labelSize * 6.6, labelSize * 1.65);
  context.fillStyle = "#eef8f7";
  const translatedName = getCurrentViewLabel();
  context.fillText(translatedName, 24, 22);

  const humanLabelWidth = labelSize * 6.7;
  context.fillStyle = "rgba(3,7,12,0.72)";
  context.fillRect(width - humanLabelWidth - 14, 14, humanLabelWidth, labelSize * 1.65);
  context.fillStyle = "#eef8f7";
  context.fillText("Human RGB", width - humanLabelWidth + 1, 22);

  output.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = state.current.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "envlens";
    anchor.href = url;
    anchor.download = `${baseName}-${state.mode}-${state.viewMode}-${getCurrentViewLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-comparison.jpg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/jpeg", 0.92);
}


function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function showInstallInstructions() {
  const userAgent = navigator.userAgent || "";
  const isAppleMobile = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);

  if (isAppleMobile) {
    elements.installInstructions.innerHTML = `
      <p>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>
      <ol>
        <li>Open this page in Safari.</li>
        <li>Tap the Share icon.</li>
        <li>Scroll to “Add to Home Screen”, then confirm.</li>
      </ol>
    `;
  } else if (isAndroid) {
    elements.installInstructions.innerHTML = `
      <p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
      <p>If no install command is shown yet, reload once after the page has finished caching.</p>
    `;
  } else {
    elements.installInstructions.innerHTML = `
      <p>Use the install icon in your browser’s address bar, or open the browser menu and choose <strong>Install EnvLens</strong>.</p>
      <p>The web version remains fully usable when installation is unavailable.</p>
    `;
  }

  if (typeof elements.installDialog.showModal === "function") {
    elements.installDialog.showModal();
  } else {
    elements.installDialog.setAttribute("open", "");
  }
}

async function requestInstall() {
  if (isStandaloneDisplay()) {
    setStatus("EnvLens is already running as an installed app.", "ready");
    return;
  }

  if (!state.installPrompt) {
    showInstallInstructions();
    return;
  }

  const promptEvent = state.installPrompt;
  state.installPrompt = null;
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;

  if (choice.outcome === "accepted") {
    elements.installApp.hidden = true;
    setStatus("EnvLens was added to this device.", "ready");
  } else {
    setStatus("Installation was cancelled. The browser version remains available.", "ready");
  }
}

function initialiseInstallExperience() {
  if (isStandaloneDisplay()) {
    elements.installApp.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    elements.installApp.hidden = false;
    elements.installApp.classList.add("is-ready");
  });

  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    elements.installApp.hidden = true;
    setStatus("EnvLens is installed and remains available offline.", "ready");
  });

  elements.installApp.addEventListener("click", requestInstall);
}

function populateObserverOptions() {
  const options = Object.values(OBSERVER_PROFILES).map((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.commonName} · ${profile.scientificName}`;
    return option;
  });
  elements.speciesSelect.innerHTML = "";
  options.forEach((option) => elements.speciesSelect.appendChild(option));
  elements.speciesSelect.value = state.profileId;
}

function populateHumanVisionOptions() {
  elements.humanVisionSelect.innerHTML = "";
  Object.entries(COLOUR_VISION_PROFILES).forEach(([id, profile]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = profile.label;
    elements.humanVisionSelect.appendChild(option);
  });
  elements.humanVisionSelect.value = state.cvdType;
}

function bindEvents() {
  elements.choosePhoto.addEventListener("click", () => elements.photoInput.click());
  elements.photoInput.addEventListener("change", () => processUploadedFile(elements.photoInput.files?.[0]));
  elements.loadSample.addEventListener("click", loadSample);

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadZone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadZone.classList.remove("is-dragover");
    });
  });

  elements.uploadZone.addEventListener("drop", (event) => {
    processUploadedFile(event.dataTransfer?.files?.[0]);
  });

  elements.quickViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.quickView;
      if (key === "bee") {
        state.profileId = "apis-mellifera";
        state.viewMode = "observer";
      } else if (key === "dragonfly") {
        state.profileId = "sympetrum";
        state.viewMode = "observer";
      } else if (key === "night-moth") {
        state.profileId = "deilephila-elpenor";
        state.viewMode = "observer";
      } else if (key === "uv-proxy") {
        if (state.profileId === "deilephila-elpenor" || state.profileId === "sympetrum" || state.profileId === "apis-mellifera") {
          // preserve the currently selected animal profile behind the UV clue.
        } else {
          state.profileId = "apis-mellifera";
        }
        state.viewMode = "uv-proxy";
      } else if (key === "colour-blind") {
        state.cvdType = "deuteranopia";
        state.viewMode = "colour-blind";
      }
      updateViewUi();
      scheduleRerender();
    });
  });

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.viewMode = button.dataset.view;
      updateViewUi();
      scheduleRerender();
    });
  });

  elements.humanVisionSelect.addEventListener("change", () => {
    state.cvdType = elements.humanVisionSelect.value;
    updateViewUi();
    scheduleRerender();
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      updateModeUi();
      scheduleRerender();
    });
  });

  elements.speciesSelect.addEventListener("change", () => {
    state.profileId = elements.speciesSelect.value;
    updateObserverUi();
    updateViewUi();
    scheduleRerender();
  });

  elements.distanceRange.addEventListener("input", () => {
    state.distanceCm = Number(elements.distanceRange.value);
    updateDistanceUi();
    scheduleRerender();
  });

  elements.revealRange.addEventListener("input", () => updateReveal(elements.revealRange.value));
  elements.revealRange.addEventListener("focus", () => elements.comparisonStage.classList.add("is-focused"));
  elements.revealRange.addEventListener("blur", () => elements.comparisonStage.classList.remove("is-focused"));
  elements.centreDivider.addEventListener("click", () => updateReveal(50));
  elements.downloadComparison.addEventListener("click", downloadComparison);
  elements.protectStorage.addEventListener("click", protectStorage);

  elements.clearLibrary.addEventListener("click", async () => {
    const confirmed = window.confirm("Remove every photograph from this browser’s EnvLens library?");
    if (!confirmed) return;
    await clearPhotos();
    await refreshLibrary();
    setStatus("The local photo library was cleared.", "ready");
  });

  window.addEventListener("beforeunload", () => {
    closeDecodedSource();
    revokeThumbnailUrls();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("Offline shell registration failed:", error);
  });
}

async function initialise() {
  configureDoi();
  populateObserverOptions();
  populateHumanVisionOptions();
  bindEvents();
  updateReveal(state.reveal);
  updateObserverUi();
  updateViewUi();
  updateDistanceUi();
  initialiseInstallExperience();
  registerServiceWorker();
  await Promise.allSettled([initialiseStorage(), loadSample()]);
}

initialise();
