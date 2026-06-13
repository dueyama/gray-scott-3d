import { MT19937 } from "./mt19937.js";

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
let rng = new MT19937(1);
let neighborMinus = new Int32Array(0);
let neighborPlus = new Int32Array(0);
let neighborKey = "";

const LEGACY_DX = 0.01;
const LEGACY_WIDTH = 0.1;
const LEGACY_RADIUS = LEGACY_WIDTH / 2;
const LEGACY_EDGE_WIDTH = 0.01;
const LEGACY_AMP_U = 0.1;
const LEGACY_AMP_V = 0.1;
const LEGACY_ROD_LONG_SCALE = 1.8;
const LEGACY_ROD_THIN_SCALE = 0.75;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const indexOf = (x, y, z) => x * size * size + y * size + z;
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
  rng = new MT19937(Math.max(1, Number(config.seed) >>> 0));
  stepCount = 0;
  initializeFields(config.initMode);
  postFrame();
}

function initializeFields(mode) {
  u.fill(1);
  v.fill(0);

  if (mode === "discNTestFs" || mode === "noisySphere") {
    seedLegacySmoothSphere(size / 3, LEGACY_WIDTH * 0.1);
  } else if (mode === "rodAndSphere") {
    seedCenteredRodAndSphere();
  } else if (mode === "multipleSpheres") {
    seedLegacyMultipleSpheres(config.initSpots, config.initRodSpots);
  } else if (mode === "cube") {
    seedLegacyCube();
  } else if (mode === "sphere") {
    seedLegacySmoothSphere(size / 2, 0);
  } else {
    seedLegacyMultipleSpheres();
  }
}

function seedCenteredRodAndSphere() {
  const rodCenter = { x: size * 0.35, y: size * 0.45, z: size * 0.5 };
  const sphereCenter = { x: size * 0.65, y: size * 0.55, z: size * 0.5 };
  const rodAngle =
    Math.atan2(sphereCenter.y - rodCenter.y, sphereCenter.x - rodCenter.x) + Math.PI / 2;

  seedLegacyHardEllipsoid(rodCenter.x, rodCenter.y, rodCenter.z, {
    longScale: LEGACY_ROD_LONG_SCALE,
    thinScale: LEGACY_ROD_THIN_SCALE,
    angle: rodAngle
  });
  seedLegacyHardEllipsoid(sphereCenter.x, sphereCenter.y, sphereCenter.z);
}

function seedLegacyCube() {
  const width = Math.max(1, Math.floor(LEGACY_WIDTH / currentDx()));
  const half = Math.floor(width / 2);
  const center = Math.floor(size / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(size, center + half);

  for (let x = start; x < end; x += 1) {
    for (let y = start; y < end; y += 1) {
      for (let z = start; z < end; z += 1) {
        const i = indexOf(x, y, z);
        u[i] = 1 + rng.next() * LEGACY_AMP_U;
        v[i] = 1 + rng.next() * LEGACY_AMP_V;
      }
    }
  }
}

function seedLegacySmoothSphere(centerIndex, jitterWidth) {
  const dx = currentDx();
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const xx = dx * (x + 0.5 - centerIndex);
        const yy = dx * (y + 0.5 - centerIndex);
        const zz = dx * (z + 0.5 - centerIndex);
        const jitter = jitterWidth > 0 ? (rng.next() - 0.5) * jitterWidth : 0;
        const rr = Math.sqrt(xx * xx + yy * yy + zz * zz) + jitter;
        const profile = (1 - Math.tanh((rr - LEGACY_RADIUS) / LEGACY_EDGE_WIDTH)) / 2;
        v[indexOf(x, y, z)] = profile;
      }
    }
  }
}

function seedLegacyHardEllipsoid(centerX, centerY, centerZ, options = {}) {
  const dx = currentDx();
  const longScale = options.longScale ?? 1;
  const thinScale = options.thinScale ?? 1;
  const angle = options.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const rx = dx * (x + 0.5 - centerX);
        const ry = dx * (y + 0.5 - centerY);
        const rz = dx * (z + 0.5 - centerZ);
        const long = rx * cos + ry * sin;
        const side = -rx * sin + ry * cos;
        const rr =
          Math.sqrt(
            (long / longScale) * (long / longScale) +
              (side / thinScale) * (side / thinScale) +
              (rz / thinScale) * (rz / thinScale)
          ) +
          (rng.next() - 0.5) * LEGACY_WIDTH * 0.1;

        if (rr - LEGACY_RADIUS < 0) {
          const i = indexOf(x, y, z);
          u[i] = 1;
          v[i] = 1;
        }
      }
    }
  }
}

function seedLegacyMultipleSpheres(spots = 5, rodSpots = 0) {
  const margin = Math.floor(size / 20);
  const span = Math.max(1, size - Math.floor(size / 10));
  const total = Math.max(1, Math.min(12, Number(spots) | 0));
  const rods = Math.max(0, Math.min(total, Number(rodSpots) | 0));
  const dx = currentDx();

  for (let q = 0; q < total; q += 1) {
    const cx = margin + Math.floor(rng.next() * span);
    const cy = margin + Math.floor(rng.next() * span);
    const cz = margin + Math.floor(rng.next() * span);
    const isRod = q < rods;

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          const xx =
            (dx * (x + 0.5 - cx)) / (isRod ? LEGACY_ROD_LONG_SCALE : 1);
          const yy =
            (dx * (y + 0.5 - cy)) / (isRod ? LEGACY_ROD_THIN_SCALE : 1);
          const zz =
            (dx * (z + 0.5 - cz)) / (isRod ? LEGACY_ROD_THIN_SCALE : 1);
          const rr =
            Math.sqrt(xx * xx + yy * yy + zz * zz) +
            (rng.next() - 0.5) * LEGACY_WIDTH * 0.1;

          if (rr - LEGACY_RADIUS < 0) {
            const i = indexOf(x, y, z);
            u[i] = 1;
            v[i] = 1;
          }
        }
      }
    }
  }
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
        const i = indexOf(x, y, z);

        const uc = u[i];
        const vc = v[i];
        const lapU =
          (u[indexOf(xm, y, z)] +
            u[indexOf(xp, y, z)] +
            u[indexOf(x, ym, z)] +
            u[indexOf(x, yp, z)] +
            u[indexOf(x, y, zm)] +
            u[indexOf(x, y, zp)] -
            6 * uc) *
          invDx2;
        const lapV =
          (v[indexOf(xm, y, z)] +
            v[indexOf(xp, y, z)] +
            v[indexOf(x, ym, z)] +
            v[indexOf(x, yp, z)] +
            v[indexOf(x, y, zm)] +
            v[indexOf(x, y, zp)] -
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

function postFrame() {
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
      }
    },
    [bytes.buffer]
  );
}

function loop() {
  if (!running) return;
  const steps = Math.max(1, Number(config.speed) | 0);
  for (let i = 0; i < steps; i += 1) {
    simulateStep();
  }
  postFrame();
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
