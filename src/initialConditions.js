import { MT19937 } from "./mt19937.js";

export const LEGACY_DX = 0.01;

const LEGACY_WIDTH = 0.1;
const LEGACY_RADIUS = LEGACY_WIDTH / 2;
const LEGACY_EDGE_WIDTH = 0.01;
const LEGACY_AMP_U = 0.1;
const LEGACY_AMP_V = 0.1;
const LEGACY_ROD_LONG_SCALE = 1.8;
const LEGACY_ROD_THIN_SCALE = 0.75;

export function indexOf(x, y, z, size) {
  return x * size * size + y * size + z;
}

export function createInitialFields(config) {
  const size = Math.max(4, Number(config.gridSize) | 0);
  const count = size * size * size;
  const u = new Float32Array(count);
  const v = new Float32Array(count);
  const rng = new MT19937(Math.max(1, Number(config.seed) >>> 0));
  const dx = Math.max(1e-6, Number(config.dx) || LEGACY_DX);

  const at = (x, y, z) => indexOf(x, y, z, size);

  u.fill(1);
  v.fill(0);

  const seedLegacyCube = () => {
    const width = Math.max(1, Math.floor(LEGACY_WIDTH / dx));
    const half = Math.floor(width / 2);
    const center = Math.floor(size / 2);
    const start = Math.max(0, center - half);
    const end = Math.min(size, center + half);

    for (let x = start; x < end; x += 1) {
      for (let y = start; y < end; y += 1) {
        for (let z = start; z < end; z += 1) {
          const i = at(x, y, z);
          u[i] = 1 + rng.next() * LEGACY_AMP_U;
          v[i] = 1 + rng.next() * LEGACY_AMP_V;
        }
      }
    }
  };

  const seedLegacySmoothSphere = (centerIndex, jitterWidth) => {
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          const xx = dx * (x + 0.5 - centerIndex);
          const yy = dx * (y + 0.5 - centerIndex);
          const zz = dx * (z + 0.5 - centerIndex);
          const jitter = jitterWidth > 0 ? (rng.next() - 0.5) * jitterWidth : 0;
          const rr = Math.sqrt(xx * xx + yy * yy + zz * zz) + jitter;
          const profile = (1 - Math.tanh((rr - LEGACY_RADIUS) / LEGACY_EDGE_WIDTH)) / 2;
          v[at(x, y, z)] = profile;
        }
      }
    }
  };

  const seedLegacyHardEllipsoid = (centerX, centerY, centerZ, options = {}) => {
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
            const i = at(x, y, z);
            u[i] = 1;
            v[i] = 1;
          }
        }
      }
    }
  };

  const seedCenteredRodAndSphere = () => {
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
  };

  const seedLegacyMultipleSpheres = (spots = 5, rodSpots = 0) => {
    const margin = Math.floor(size / 20);
    const span = Math.max(1, size - Math.floor(size / 10));
    const total = Math.max(1, Math.min(12, Number(spots) | 0));
    const rods = Math.max(0, Math.min(total, Number(rodSpots) | 0));

    for (let q = 0; q < total; q += 1) {
      const cx = margin + Math.floor(rng.next() * span);
      const cy = margin + Math.floor(rng.next() * span);
      const cz = margin + Math.floor(rng.next() * span);
      const isRod = q < rods;

      for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
          for (let z = 0; z < size; z += 1) {
            const xx = (dx * (x + 0.5 - cx)) / (isRod ? LEGACY_ROD_LONG_SCALE : 1);
            const yy = (dx * (y + 0.5 - cy)) / (isRod ? LEGACY_ROD_THIN_SCALE : 1);
            const zz = (dx * (z + 0.5 - cz)) / (isRod ? LEGACY_ROD_THIN_SCALE : 1);
            const rr =
              Math.sqrt(xx * xx + yy * yy + zz * zz) +
              (rng.next() - 0.5) * LEGACY_WIDTH * 0.1;

            if (rr - LEGACY_RADIUS < 0) {
              const i = at(x, y, z);
              u[i] = 1;
              v[i] = 1;
            }
          }
        }
      }
    }
  };

  if (config.initMode === "discNTestFs" || config.initMode === "noisySphere") {
    seedLegacySmoothSphere(size / 3, LEGACY_WIDTH * 0.1);
  } else if (config.initMode === "rodAndSphere") {
    seedCenteredRodAndSphere();
  } else if (config.initMode === "multipleSpheres") {
    seedLegacyMultipleSpheres(config.initSpots, config.initRodSpots);
  } else if (config.initMode === "cube") {
    seedLegacyCube();
  } else if (config.initMode === "sphere") {
    seedLegacySmoothSphere(size / 2, 0);
  } else {
    seedLegacyMultipleSpheres();
  }

  return { u, v, size, count };
}
