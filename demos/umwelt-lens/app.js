import { SITE_CONFIG } from "./site-config.js";
import { DEFAULT_PROFILE_ID, OBSERVER_PROFILES } from "./profiles.js";

const DB_NAME = "umwelt-lens-local-library";
const DB_VERSION = 1;
const STORE_NAME = "photos";

const state = {
  profileId: DEFAULT_PROFILE_ID,
  mode: "sunny",
  distanceCm: 50,
  reveal: 50,
  current: null,
  decodedSource: null,
  renderToken: 0,
  db: null,
  thumbnailUrls: new Map()
};

const elements = {
  speciesSelect: document.getElementById("speciesSelect"),
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
  comparisonStage: document.getElementById("comparisonStage"),
  stageLoader: document.getElementById("stageLoader"),
  humanCanvas: document.getElementById("humanCanvas"),
  beeCanvas: document.getElementById("beeCanvas"),
  revealRange: document.getElementById("revealRange"),
  centreDivider: document.getElementById("centreDivider"),
  downloadComparison: document.getElementById("downloadComparison"),
  modeExplanation: document.getElementById("modeExplanation"),
  observerMetric: document.getElementById("observerMetric"),
  photoCount: document.getElementById("photoCount"),
  storageUse: document.getElementById("storageUse"),
  protectStorage: document.getElementById("protectStorage"),
  clearLibrary: document.getElementById("clearLibrary"),
  photoGrid: document.getElementById("photoGrid"),
  emptyLibrary: document.getElementById("emptyLibrary"),
  libraryNotice: document.getElementById("libraryNotice"),
  doiPill: document.getElementById("doiPill"),
  doiText: document.getElementById("doiText")
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
  const profile = OBSERVER_PROFILES[state.profileId];
  const mode = profile.modes[state.mode];

  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.modeExplanation.innerHTML = `<strong>${mode.label}</strong><span>${mode.description}</span>`;
  elements.observerMetric.textContent = profile.scientificName;
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
    setStatus(`${metadata.name || "Image"} is ready. Move the divider to compare views.`, "ready");
  } catch (error) {
    console.error(error);
    setStageLoading(false);
    setStatus(error.message || "The image could not be loaded.", "error");
  }
}

async function renderObserverView(expectedToken = state.renderToken) {
  if (!state.current || !state.decodedSource) return;

  const profile = OBSERVER_PROFILES[state.profileId];
  const mode = profile.modes[state.mode];
  const width = elements.humanCanvas.width;
  const height = elements.humanCanvas.height;
  const sourceImage = humanContext.getImageData(0, 0, width, height);
  const outputImage = workContext.createImageData(width, height);
  const source = sourceImage.data;
  const output = outputImage.data;

  const uvMatrix = profile.receptorModel.uvProxy;
  const blueMatrix = profile.receptorModel.blue;
  const greenMatrix = profile.receptorModel.green;
  const displayRed = profile.displayModel.redFrom;
  const displayGreen = profile.displayModel.greenFrom;
  const displayBlue = profile.displayModel.blueFrom;
  const isNight = state.mode === "night";

  for (let offset = 0, pixelIndex = 0; offset < source.length; offset += 4, pixelIndex += 1) {
    const red = SRGB_TO_LINEAR[source[offset]];
    const green = SRGB_TO_LINEAR[source[offset + 1]];
    const blue = SRGB_TO_LINEAR[source[offset + 2]];

    const uvBase = uvMatrix[0] * red + uvMatrix[1] * green + uvMatrix[2] * blue;
    const uvProxy = clamp(uvBase + 0.065 * (1 - red)) * mode.uvGain;
    const blueResponse = clamp(blueMatrix[0] * red + blueMatrix[1] * green + blueMatrix[2] * blue) * mode.blueGain;
    const greenResponse = clamp(greenMatrix[0] * red + greenMatrix[1] * green + greenMatrix[2] * blue) * mode.greenGain;
    const noise = deterministicNoise(pixelIndex) * mode.noise;

    let mappedRed;
    let mappedGreen;
    let mappedBlue;

    if (isNight) {
      const lowLightSignal = clamp((0.10 * uvProxy + 0.18 * blueResponse + 0.72 * greenResponse) * mode.exposure + noise);
      mappedRed = lowLightSignal * 0.20;
      mappedGreen = lowLightSignal * 0.54;
      mappedBlue = lowLightSignal * 0.43;
    } else {
      mappedRed = displayRed[0] * uvProxy + displayRed[1] * blueResponse + displayRed[2] * greenResponse;
      mappedGreen = displayGreen[0] * uvProxy + displayGreen[1] * blueResponse + displayGreen[2] * greenResponse;
      mappedBlue = displayBlue[0] * uvProxy + displayBlue[1] * blueResponse + displayBlue[2] * greenResponse;

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
  const blur = Math.min(8, spatial.baseBlurPx * distanceFactor * mode.blurMultiplier);

  beeContext.clearRect(0, 0, width, height);
  beeContext.save();
  beeContext.filter = `blur(${blur.toFixed(2)}px)`;
  beeContext.drawImage(workCanvas, 0, 0);
  beeContext.restore();
}

let rerenderTimer = 0;
function scheduleRerender() {
  window.clearTimeout(rerenderTimer);
  rerenderTimer = window.setTimeout(async () => {
    if (!state.current) return;
    setStageLoading(true, "Updating model…");
    await renderObserverView();
    setStageLoading(false);
    setStatus("Model updated.", "ready");
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

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
    await trimLibrary();
    await refreshLibrary();

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
  context.fillText("Bee model", 24, 22);

  const humanLabelWidth = labelSize * 6.7;
  context.fillStyle = "rgba(3,7,12,0.72)";
  context.fillRect(width - humanLabelWidth - 14, 14, humanLabelWidth, labelSize * 1.65);
  context.fillStyle = "#eef8f7";
  context.fillText("Human RGB", width - humanLabelWidth + 1, 22);

  output.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = state.current.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "umwelt-lens";
    anchor.href = url;
    anchor.download = `${baseName}-${state.mode}-bee-comparison.jpg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/jpeg", 0.92);
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

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      updateModeUi();
      scheduleRerender();
    });
  });

  elements.speciesSelect.addEventListener("change", () => {
    state.profileId = elements.speciesSelect.value;
    updateModeUi();
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
    const confirmed = window.confirm("Remove every photograph from this browser’s Umwelt Lens library?");
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
  bindEvents();
  updateReveal(state.reveal);
  updateModeUi();
  updateDistanceUi();
  registerServiceWorker();
  await Promise.allSettled([initialiseStorage(), loadSample()]);
}

initialise();
