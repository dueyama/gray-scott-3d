import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const sizes = [
  ["public/favicon-16.png", 16],
  ["public/favicon-32.png", 32],
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512]
];

const sourceSize = 192;
const source = createGrayScottTexture(sourceSize);

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function png(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function createGrayScottTexture(size) {
  const total = size * size;
  let u = new Float32Array(total);
  let v = new Float32Array(total);
  let nextU = new Float32Array(total);
  let nextV = new Float32Array(total);
  u.fill(1);

  const seeds = [
    { x: 0.25, y: 0.34, rx: 0.11, ry: 0.055, angle: -0.65 },
    { x: 0.47, y: 0.44, rx: 0.12, ry: 0.05, angle: 0.35 },
    { x: 0.68, y: 0.3, rx: 0.09, ry: 0.06, angle: 0.9 },
    { x: 0.4, y: 0.68, rx: 0.13, ry: 0.052, angle: -0.2 },
    { x: 0.72, y: 0.68, rx: 0.075, ry: 0.075, angle: 0 }
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      for (const seed of seeds) {
        const dx = px - seed.x;
        const dy = py - seed.y;
        const ca = Math.cos(seed.angle);
        const sa = Math.sin(seed.angle);
        const qx = (dx * ca - dy * sa) / seed.rx;
        const qy = (dx * sa + dy * ca) / seed.ry;
        const d = qx * qx + qy * qy;
        if (d < 1) {
          const edge = smoothstep(1, 0.35, d);
          const n = valueNoise(x * 0.09, y * 0.09);
          const index = y * size + x;
          u[index] = 1 - edge * (0.52 + 0.08 * n);
          v[index] = edge * (0.31 + 0.09 * n);
        }
      }
    }
  }

  const du = 0.16;
  const dv = 0.08;
  const feed = 0.023;
  const kill = 0.056;
  const dt = 1.0;

  for (let step = 0; step < 3600; step += 1) {
    for (let y = 0; y < size; y += 1) {
      const ym = ((y + size - 1) % size) * size;
      const yp = ((y + 1) % size) * size;
      const row = y * size;
      for (let x = 0; x < size; x += 1) {
        const xm = (x + size - 1) % size;
        const xp = (x + 1) % size;
        const index = row + x;
        const lapU = u[row + xm] + u[row + xp] + u[ym + x] + u[yp + x] - 4 * u[index];
        const lapV = v[row + xm] + v[row + xp] + v[ym + x] + v[yp + x] - 4 * v[index];
        const reaction = u[index] * v[index] * v[index];
        nextU[index] = clamp01(u[index] + dt * (du * lapU - reaction + feed * (1 - u[index])));
        nextV[index] = clamp01(v[index] + dt * (dv * lapV + reaction - (feed + kill) * v[index]));
      }
    }
    [u, nextU] = [nextU, u];
    [v, nextV] = [nextV, v];
  }

  const sorted = Array.from(v).sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.56)];
  const high = sorted[Math.floor(sorted.length * 0.992)];
  return { size, values: v, low, high: Math.max(high, low + 0.001) };
}

function hash(ix, iy) {
  let n = (ix * 374761393 + iy * 668265263) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix);
  const fy = smoothstep(0, 1, y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

function samplePattern(u, v) {
  const x = (u - Math.floor(u)) * source.size;
  const y = (v - Math.floor(v)) * source.size;
  const x0 = Math.floor(x) % source.size;
  const y0 = Math.floor(y) % source.size;
  const x1 = (x0 + 1) % source.size;
  const y1 = (y0 + 1) % source.size;
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  const a = source.values[y0 * source.size + x0];
  const b = source.values[y0 * source.size + x1];
  const c = source.values[y1 * source.size + x0];
  const d = source.values[y1 * source.size + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function patternIntensity(u, v) {
  const value = samplePattern(u * 0.96 + 0.02, v * 0.96 + 0.01);
  return smoothstep(source.low, source.high, value);
}

function drawIcon(size) {
  const supersample = size < 64 ? 5 : 2;
  const canvasSize = size * supersample;
  const pixel = { size: canvasSize, data: Buffer.alloc(canvasSize * canvasSize * 4) };

  for (let y = 0; y < canvasSize; y += 1) {
    for (let x = 0; x < canvasSize; x += 1) {
      const px = (x + 0.5) / canvasSize;
      const py = (y + 0.5) / canvasSize;
      if (!insideRoundedSquare(px, py, 0.22)) continue;

      const shade = 0.35 + 0.65 * py;
      let color = [lerp(6, 20, shade), lerp(8, 25, 1 - Math.abs(px - 0.52)), lerp(9, 16, shade)];

      const warpX = valueNoise(px * 7.5, py * 7.5) * 0.05 - 0.025;
      const warpY = valueNoise(px * 7.5 + 8.1, py * 7.5 - 3.7) * 0.05 - 0.025;
      const t = patternIntensity(px + warpX, py + warpY);
      const gx = Math.abs(patternIntensity(px + 0.004 + warpX, py + warpY) - patternIntensity(px - 0.004 + warpX, py + warpY));
      const gy = Math.abs(patternIntensity(px + warpX, py + 0.004 + warpY) - patternIntensity(px + warpX, py - 0.004 + warpY));
      const edge = smoothstep(0.02, 0.16, Math.hypot(gx, gy));
      const body = smoothstep(0.06, 0.34, t);
      const hot = smoothstep(0.58, 0.96, t);

      if (body > 0) {
        const cool = [44, 210, 195];
        const pale = [217, 239, 228];
        const warm = [240, 112, 84];
        color = mixColor(color, cool, body * 0.7);
        color = mixColor(color, pale, edge * 0.82);
        color = mixColor(color, warm, hot * 0.58);
      }

      const vignette = smoothstep(0.72, 0.26, Math.hypot(px - 0.5, py - 0.5));
      color = mixColor([4, 5, 6], color, 0.58 + 0.42 * vignette);

      const borderDistance = Math.min(px, py, 1 - px, 1 - py);
      if (borderDistance < 0.025) {
        color = mixColor(color, [52, 209, 197], 0.28);
      }

      put(pixel, x, y, color, 1);
    }
  }

  return downsample(pixel, size, supersample);
}

function downsample(pixel, size, supersample) {
  if (supersample === 1) return pixel.data;
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const total = [0, 0, 0, 0];
      for (let yy = 0; yy < supersample; yy += 1) {
        for (let xx = 0; xx < supersample; xx += 1) {
          const i = ((y * supersample + yy) * pixel.size + x * supersample + xx) * 4;
          total[0] += pixel.data[i];
          total[1] += pixel.data[i + 1];
          total[2] += pixel.data[i + 2];
          total[3] += pixel.data[i + 3];
        }
      }
      const samples = supersample * supersample;
      const o = (y * size + x) * 4;
      output[o] = Math.round(total[0] / samples);
      output[o + 1] = Math.round(total[1] / samples);
      output[o + 2] = Math.round(total[2] / samples);
      output[o + 3] = Math.round(total[3] / samples);
    }
  }
  return output;
}

function insideRoundedSquare(x, y, radius) {
  const px = Math.abs(x - 0.5);
  const py = Math.abs(y - 0.5);
  const edge = 0.5 - radius;
  const qx = Math.max(px - edge, 0);
  const qy = Math.max(py - edge, 0);
  return qx * qx + qy * qy <= radius * radius;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function put(pixel, x, y, color, alpha = 1) {
  const i = (y * pixel.size + x) * 4;
  const inv = 1 - alpha;
  pixel.data[i] = Math.round(pixel.data[i] * inv + color[0] * alpha);
  pixel.data[i + 1] = Math.round(pixel.data[i + 1] * inv + color[1] * alpha);
  pixel.data[i + 2] = Math.round(pixel.data[i + 2] * inv + color[2] * alpha);
  pixel.data[i + 3] = Math.round(pixel.data[i + 3] * inv + 255 * alpha);
}

for (const [path, size] of sizes) {
  writeFileSync(path, png(size, size, drawIcon(size)));
  console.log(`wrote ${path}`);
}
