import "./styles.css";
import "./pageSignals.js";
import { getLocale, setupI18n, translate } from "./i18n.js";
import { DEFAULT_STATE, PRESETS } from "./presets.js";
import { VolumeRenderer } from "./volumeRenderer.js";

const state = { ...DEFAULT_STATE };
let activePreset = PRESETS[0]?.id ?? "";
let running = false;
let latestVolume = null;
let latestSize = state.gridSize;
let latestStep = 0;
let renderMode = "volume";
const controlUpdaters = new Map();
const displayPrecision = {
  feed: 4,
  kill: 4,
  du: 6,
  dv: 6,
  threshold: 3,
  dx: 4
};

function displayValue(key, value) {
  return displayPrecision[key] === undefined
    ? String(value)
    : Number(value).toFixed(displayPrecision[key]);
}

const elements = {
  presetGrid: document.querySelector("#presetGrid"),
  feed: document.querySelector("#feed"),
  feedNumber: document.querySelector("#feedNumber"),
  kill: document.querySelector("#kill"),
  killNumber: document.querySelector("#killNumber"),
  du: document.querySelector("#du"),
  duNumber: document.querySelector("#duNumber"),
  dv: document.querySelector("#dv"),
  dvNumber: document.querySelector("#dvNumber"),
  threshold: document.querySelector("#threshold"),
  thresholdNumber: document.querySelector("#thresholdNumber"),
  speed: document.querySelector("#speed"),
  speedNumber: document.querySelector("#speedNumber"),
  gridSize: document.querySelector("#gridSize"),
  dx: document.querySelector("#dx"),
  seed: document.querySelector("#seed"),
  boundary: document.querySelector("#boundary"),
  runPause: document.querySelector("#runPause"),
  reset: document.querySelector("#reset"),
  randomSeed: document.querySelector("#randomSeed"),
  exportImage: document.querySelector("#exportImage"),
  volumeMode: document.querySelector("#volumeMode"),
  surfaceMode: document.querySelector("#surfaceMode"),
  runningBadge: document.querySelector("#runningBadge"),
  stepCounter: document.querySelector("#stepCounter"),
  maxV: document.querySelector("#maxV"),
  avgV: document.querySelector("#avgV"),
  activeV: document.querySelector("#activeV"),
  volumeCanvas: document.querySelector("#volumeCanvas"),
  sliceXY: document.querySelector("#sliceXY"),
  sliceXZ: document.querySelector("#sliceXZ"),
  sliceYZ: document.querySelector("#sliceYZ")
};

setupI18n({ onLocaleChange: handleLocaleChange });

const renderer = createRenderer();
const worker = new Worker(new URL("./simWorker.js", import.meta.url), { type: "module" });

worker.addEventListener("message", (event) => {
  if (event.data.type !== "frame") return;
  latestSize = event.data.size;
  latestStep = event.data.step;
  latestVolume = new Uint8Array(event.data.buffer);
  renderer?.updateVolume(latestVolume, latestSize);
  drawSlices(latestVolume, latestSize);
  updateMetrics(event.data.metrics);
  updateStepCounter();
});

function createRenderer() {
  try {
    return new VolumeRenderer(elements.volumeCanvas);
  } catch (error) {
    const parent = elements.volumeCanvas.parentElement;
    parent.classList.add("viewer--error");
    const message = document.createElement("p");
    message.className = "viewer__error";
    message.textContent = translate("webgl.error");
    parent.append(message);
    console.error(error);
    return null;
  }
}

function setupPresets() {
  elements.presetGrid.innerHTML = "";
  for (const preset of PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.style.setProperty("--preset-color", preset.color);
    button.dataset.preset = preset.id;
    button.setAttribute("aria-pressed", String(preset.id === activePreset));
    button.innerHTML = `
      <span class="preset__swatch" aria-hidden="true"></span>
      <span><strong>${translate(`preset.${preset.id}.name`)}</strong><span>${translate(
        `preset.${preset.id}.note`
      )}</span></span>
    `;
    button.addEventListener("click", () => {
      activePreset = preset.id;
      applyState({ ...preset.params }, true);
      updatePressedStates();
      resetSimulation();
    });
    elements.presetGrid.append(button);
  }
}

function bindPair(key, range, number, parser = Number, options = {}) {
  const update = (raw, shouldReset = false) => {
    const parsedValue = parser(raw);
    const value =
      options.precision === undefined ? parsedValue : Number(parsedValue.toFixed(options.precision));
    const formattedValue = displayValue(key, value);
    state[key] = value;
    range.value = formattedValue;
    number.value = formattedValue;
    activePreset = "";
    updatePressedStates();
    if (key === "threshold") {
      renderer?.setThreshold(value);
    }
    sendConfig();
    if (shouldReset) resetSimulation();
  };
  controlUpdaters.set(key, update);
  range.addEventListener("input", () => update(range.value));
  number.addEventListener("change", () => update(number.value));
}

function bindControls() {
  bindPair("feed", elements.feed, elements.feedNumber, Number, { precision: 4 });
  bindPair("kill", elements.kill, elements.killNumber, Number, { precision: 4 });
  bindPair("du", elements.du, elements.duNumber);
  bindPair("dv", elements.dv, elements.dvNumber);
  bindPair("threshold", elements.threshold, elements.thresholdNumber);
  bindPair("speed", elements.speed, elements.speedNumber, (value) => Number(value) | 0);

  elements.gridSize.addEventListener("change", () => {
    state.gridSize = Number(elements.gridSize.value);
    activePreset = "";
    updatePressedStates();
    resetSimulation();
  });

  elements.dx.addEventListener("change", () => {
    state.dx = Math.max(0.001, Number(elements.dx.value) || state.dx);
    elements.dx.value = state.dx.toFixed(4);
    activePreset = "";
    updatePressedStates();
    resetSimulation();
  });

  elements.seed.addEventListener("change", () => {
    state.seed = Math.max(1, Number(elements.seed.value) >>> 0);
    elements.seed.value = state.seed;
    activePreset = "";
    updatePressedStates();
    resetSimulation();
  });

  elements.boundary.addEventListener("change", () => {
    state.boundary = elements.boundary.value;
    resetSimulation();
  });

  elements.runPause.addEventListener("click", () => setRunning(!running));
  elements.reset.addEventListener("click", resetSimulation);
  elements.volumeMode.addEventListener("click", () => setRenderMode("volume"));
  elements.surfaceMode.addEventListener("click", () => setRenderMode("surface"));
  document.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.nudge;
      const amount = Number(button.dataset.amount);
      const numberInput = elements[`${key}Number`];
      const updater = controlUpdaters.get(key);
      if (!numberInput || !updater) return;
      const min = Number(numberInput.min);
      const max = Number(numberInput.max);
      const current = Number(numberInput.value || state[key]);
      const next = Math.min(max, Math.max(min, current + amount));
      updater(next);
    });
  });
  elements.randomSeed.addEventListener("click", () => {
    state.seed = Math.floor(Math.random() * 4294967295) + 1;
    elements.seed.value = state.seed;
    activePreset = "";
    updatePressedStates();
    resetSimulation();
  });
  elements.exportImage.addEventListener("click", exportImage);
}

function applyState(nextState, includeSeed = false) {
  Object.assign(state, nextState);
  if (!includeSeed && nextState.seed === undefined) {
    state.seed = Number(elements.seed.value) || state.seed;
  }
  syncControls();
  renderer?.setThreshold(state.threshold);
  sendConfig();
}

function syncControls() {
  for (const key of ["feed", "kill", "du", "dv", "threshold", "speed"]) {
    const value = displayValue(key, state[key]);
    elements[key].value = value;
    elements[`${key}Number`].value = value;
  }
  elements.gridSize.value = String(state.gridSize);
  elements.dx.value = displayValue("dx", state.dx);
  elements.seed.value = state.seed;
  elements.boundary.value = state.boundary;
  updatePressedStates();
}

function updatePressedStates() {
  document.querySelectorAll(".preset").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.preset === activePreset));
  });
}

function sendConfig() {
  worker.postMessage({ type: "configure", payload: { ...state } });
}

function resetSimulation() {
  worker.postMessage({ type: "reset", payload: { ...state } });
}

function setRunning(nextRunning) {
  running = nextRunning;
  worker.postMessage({ type: "run", payload: running });
  syncDynamicText();
}

function setRenderMode(nextMode) {
  renderMode = nextMode === "surface" ? "surface" : "volume";
  renderer?.setMode(renderMode);
  elements.volumeMode.setAttribute("aria-pressed", String(renderMode === "volume"));
  elements.surfaceMode.setAttribute("aria-pressed", String(renderMode === "surface"));
}

function updateMetrics(metrics) {
  elements.maxV.textContent = metrics.max.toFixed(3);
  elements.avgV.textContent = metrics.avg.toFixed(3);
  elements.activeV.textContent = `${Math.round(metrics.active * 100)}%`;
}

function updateStepCounter() {
  const locale = getLocale() === "jp" ? "ja-JP" : "en-US";
  elements.stepCounter.textContent = `${translate("step.label")} ${latestStep.toLocaleString(locale)}`;
}

function syncDynamicText() {
  elements.runPause.textContent = running ? translate("button.pause") : translate("button.play");
  elements.runningBadge.textContent = running ? translate("status.running") : translate("status.stopped");
  updateStepCounter();
}

function handleLocaleChange() {
  setupPresets();
  syncDynamicText();
}

function drawSlices(volume, size) {
  drawSlice(elements.sliceXY, volume, size, "xy");
  drawSlice(elements.sliceXZ, volume, size, "xz");
  drawSlice(elements.sliceYZ, volume, size, "yz");
}

function drawSlice(canvas, volume, size, plane) {
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const mid = Math.floor(size / 2);

  for (let a = 0; a < size; a += 1) {
    for (let b = 0; b < size; b += 1) {
      let index;
      if (plane === "xy") {
        index = a * size * size + b * size + mid;
      } else if (plane === "xz") {
        index = a * size * size + mid * size + b;
      } else {
        index = mid * size * size + a * size + b;
      }

      const value = volume[index] / 255;
      const pixel = (b * size + a) * 4;
      const color = colorRamp(value);
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = 255;
    }
  }

  const temp = new OffscreenCanvas(size, size);
  temp.getContext("2d").putImageData(image, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, canvas.width, canvas.height);
}

function colorRamp(value) {
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(14 + t * 230);
  const g = Math.round(24 + Math.pow(t, 0.7) * 174);
  const b = Math.round(26 + (1 - Math.abs(t - 0.6)) * 116);
  return [r, g, b];
}

function exportImage() {
  if (!renderer) return;
  const link = document.createElement("a");
  link.download = `gray-scott-3d-${Date.now()}.png`;
  link.href = renderer.capturePng();
  link.click();
}

function animate() {
  renderer?.render();
  requestAnimationFrame(animate);
}

setupPresets();
bindControls();
applyState(state, true);
setRenderMode(renderMode);
setRunning(false);
animate();
