import { createInitialFields, indexOf, LEGACY_DX } from "./initialConditions.js";

let config;
let size = 0;
let count = 0;
let u;
let v;
let nextU;
let nextV;
let running = false;
let stepCount = 0;
let timer = 0;
let neighborMinus = new Int32Array(0);
let neighborPlus = new Int32Array(0);
let neighborKey = "";

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const fieldIndex = (x, y, z) => indexOf(x, y, z, size);
const currentDx = () => Math.max(1e-6, Number(config?.dx) || LEGACY_DX);

function configure(nextConfig) {
  const previousBoundary = config?.boundary;
  config = { ...config, ...nextConfig };
  const requestedSize = Number(config.gridSize);
  if (requestedSize !== size || !u) {
    size = requestedSize;
    count = size * size * size;
    u = new Float32Array(count);
    v = new Float32Array(count);
    nextU = new Float32Array(count);
    nextV = new Float32Array(count);
    updateNeighbors();
    reset();
    return;
  }
  if (previousBoundary !== config.boundary) {
    updateNeighbors();
  }
  postFrame();
}

function updateNeighbors() {
  const boundary = config?.boundary === "periodic" ? "periodic" : "neumann";
  const key = `${size}:${boundary}`;
  if (key === neighborKey) return;

  neighborMinus = new Int32Array(size);
  neighborPlus = new Int32Array(size);

  for (let i = 0; i < size; i += 1) {
    if (boundary === "periodic") {
      neighborMinus[i] = i > 0 ? i - 1 : size - 1;
      neighborPlus[i] = i < size - 1 ? i + 1 : 0;
    } else {
      neighborMinus[i] = i > 0 ? i - 1 : i;
      neighborPlus[i] = i < size - 1 ? i + 1 : i;
    }
  }

  neighborKey = key;
}

function reset() {
  const fields = createInitialFields(config);
  u = fields.u;
  v = fields.v;
  size = fields.size;
  count = fields.count;
  nextU = new Float32Array(count);
  nextV = new Float32Array(count);
  updateNeighbors();
  stepCount = 0;
  postFrame();
}

function simulateStep() {
  const f = Number(config.feed);
  const k = Number(config.kill);
  const du = Number(config.du);
  const dv = Number(config.dv);
  const dt = Number(config.dt);
  const dx = currentDx();
  const invDx2 = 1 / (dx * dx);

  for (let x = 0; x < size; x += 1) {
    const xm = neighborMinus[x];
    const xp = neighborPlus[x];
    for (let y = 0; y < size; y += 1) {
      const ym = neighborMinus[y];
      const yp = neighborPlus[y];
      for (let z = 0; z < size; z += 1) {
        const zm = neighborMinus[z];
        const zp = neighborPlus[z];
        const i = fieldIndex(x, y, z);

        const uc = u[i];
        const vc = v[i];
        const lapU =
          (u[fieldIndex(xm, y, z)] +
            u[fieldIndex(xp, y, z)] +
            u[fieldIndex(x, ym, z)] +
            u[fieldIndex(x, yp, z)] +
            u[fieldIndex(x, y, zm)] +
            u[fieldIndex(x, y, zp)] -
            6 * uc) *
          invDx2;
        const lapV =
          (v[fieldIndex(xm, y, z)] +
            v[fieldIndex(xp, y, z)] +
            v[fieldIndex(x, ym, z)] +
            v[fieldIndex(x, yp, z)] +
            v[fieldIndex(x, y, zm)] +
            v[fieldIndex(x, y, zp)] -
            6 * vc) *
          invDx2;
        const reaction = uc * vc * vc;

        nextU[i] = clamp01(uc + dt * (du * lapU - reaction + f * (1 - uc)));
        nextV[i] = clamp01(vc + dt * (dv * lapV + reaction - (f + k) * vc));
      }
    }
  }

  [u, nextU] = [nextU, u];
  [v, nextV] = [nextV, v];
  stepCount += 1;
}

function postFrame(performanceInfo = null) {
  const readStartedAt = performance.now();
  const bytes = new Uint8Array(count);
  let max = 0;
  let sum = 0;
  let active = 0;
  const threshold = Number(config.threshold);

  for (let i = 0; i < count; i += 1) {
    const value = v[i];
    if (value > max) max = value;
    sum += value;
    if (value >= threshold) active += 1;
    bytes[i] = Math.max(0, Math.min(255, Math.round(value * 255)));
  }
  const packMs = performance.now() - readStartedAt;

  self.postMessage(
    {
      type: "frame",
      size,
      step: stepCount,
      buffer: bytes.buffer,
      metrics: {
        max,
        avg: sum / count,
        active: active / count
      },
      performance: performanceInfo
        ? {
            ...performanceInfo,
            readbackMs: packMs,
            totalMs: performanceInfo.computeMs + packMs
          }
        : null
    },
    [bytes.buffer]
  );
}

function loop() {
  if (!running) return;
  const steps = Math.max(1, Number(config.speed) | 0);
  const startedAt = performance.now();
  for (let i = 0; i < steps; i += 1) {
    simulateStep();
  }
  const computeMs = performance.now() - startedAt;
  postFrame({
    steps,
    computeMs,
    readbackMs: 0,
    totalMs: computeMs,
    cellsPerSecond:
      computeMs > 0 ? (steps * count) / (computeMs / 1000) : Number.POSITIVE_INFINITY
  });
  timer = self.setTimeout(loop, 16);
}

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type === "configure") {
    configure(payload);
  } else if (type === "reset") {
    if (payload) configure(payload);
    reset();
  } else if (type === "run") {
    running = Boolean(payload);
    self.clearTimeout(timer);
    if (running) loop();
  } else if (type === "step") {
    simulateStep();
    postFrame();
  }
};
