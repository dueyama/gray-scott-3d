import "./styles.css";
import "./pageSignals.js";
import { CpuSimulationEngine } from "./cpuSimulationEngine.js";
import { GpuSimulationEngine } from "./gpuSimulationEngine.js";
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
let computeBackend = "cpu";
let engine = null;
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
  cpuBackend: document.querySelector("#cpuBackend"),
  gpuBackend: document.querySelector("#gpuBackend"),
  runningBadge: document.querySelector("#runningBadge"),
  engineBadge: document.querySelector("#engineBadge"),
  stepCounter: document.querySelector("#stepCounter"),
  backendMetric: document.querySelector("#backendMetric"),
  computeMs: document.querySelector("#computeMs"),
  readbackMs: document.querySelector("#readbackMs"),
  cellsPerSecond: document.querySelector("#cellsPerSecond"),
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
  elements.cpuBackend.addEventListener("click", () => setComputeBackend("cpu"));
  elements.gpuBackend.addEventListener("click", () => setComputeBackend("gpgpu"));
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
  engine?.configure({ ...state });
}

function resetSimulation() {
  engine?.reset({ ...state });
}

function setRunning(nextRunning) {
  running = nextRunning;
  engine?.setRunning(running);
  syncDynamicText();
}

function setComputeBackend(nextBackend) {
  const requestedBackend = nextBackend === "gpgpu" ? "gpgpu" : "cpu";
  if (engine && requestedBackend === computeBackend) return;

  const shouldResume = running;
  engine?.setRunning(false);
  engine?.dispose();

  try {
    engine =
      requestedBackend === "gpgpu"
        ? new GpuSimulationEngine(handleSimulationFrame)
        : new CpuSimulationEngine(handleSimulationFrame);
    computeBackend = requestedBackend;
    elements.gpuBackend.disabled = false;
    engine.reset({ ...state });
  } catch (error) {
    console.warn(error);
    engine?.dispose();
    engine = new CpuSimulationEngine(handleSimulationFrame);
    computeBackend = "cpu";
    elements.gpuBackend.disabled = true;
    engine.reset({ ...state });
  }

  if (shouldResume) {
    engine.setRunning(true);
  }
  updateBackendUi();
  syncDynamicText();
}

function handleSimulationFrame(frame) {
  latestSize = frame.size;
  latestStep = frame.step;
  latestVolume = frame.volume;
  renderer?.updateVolume(latestVolume, latestSize);
  drawSlices(latestVolume, latestSize);
  updateMetrics(frame.metrics);
  updatePerformance(frame.performance);
  updateStepCounter();
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

function updatePerformance(performanceInfo) {
  if (!performanceInfo || !performanceInfo.steps) {
    elements.computeMs.textContent = "—";
    elements.readbackMs.textContent = "—";
    elements.cellsPerSecond.textContent = "—";
    return;
  }

  elements.computeMs.textContent = `${performanceInfo.computeMs.toFixed(1)} ms`;
  elements.readbackMs.textContent = `${performanceInfo.readbackMs.toFixed(1)} ms`;
  elements.cellsPerSecond.textContent = formatThroughput(performanceInfo.cellsPerSecond);
}

function formatThroughput(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}G/s`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M/s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k/s`;
  return `${Math.round(value)}/s`;
}

function updateStepCounter() {
  const locale = getLocale() === "jp" ? "ja-JP" : "en-US";
  elements.stepCounter.textContent = `${translate("step.label")} ${latestStep.toLocaleString(locale)}`;
}

function syncDynamicText() {
  elements.runPause.textContent = running ? translate("button.pause") : translate("button.play");
  elements.runningBadge.textContent = running ? translate("status.running") : translate("status.stopped");
  updateBackendUi();
  updateStepCounter();
}

function handleLocaleChange() {
  setupPresets();
  syncDynamicText();
}

function updateBackendUi() {
  const label = computeBackend === "gpgpu" ? "GPGPU" : "CPU";
  elements.cpuBackend.setAttribute("aria-pressed", String(computeBackend === "cpu"));
  elements.gpuBackend.setAttribute("aria-pressed", String(computeBackend === "gpgpu"));
  elements.engineBadge.textContent = label;
  elements.backendMetric.textContent = label;
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
setComputeBackend(computeBackend);
applyState(state, true);
setRenderMode(renderMode);
setRunning(false);
animate();
