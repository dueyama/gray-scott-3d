import * as THREE from "three";

import { atlasPixelIndex, createAtlasLayout } from "./gpuAtlasLayout.js";
import { createInitialFields } from "./initialConditions.js";

const SNAPSHOT_INTERVAL_MS = 500;

const vertexShader = /* glsl */ `
  in vec3 position;

  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp int;
  precision highp sampler2D;

  uniform sampler2D stateMap;
  uniform int size;
  uniform int tileColumns;
  uniform int boundaryMode;
  uniform float feed;
  uniform float kill;
  uniform float du;
  uniform float dv;
  uniform float dt;
  uniform float invDx2;

  out vec4 outState;

  ivec2 coordOf(int x, int y, int z) {
    int tileColumn = x % tileColumns;
    int tileRow = x / tileColumns;
    return ivec2(tileColumn * size + z, tileRow * size + y);
  }

  int neighborMinus(int value) {
    if (boundaryMode == 1) {
      return value > 0 ? value - 1 : size - 1;
    }
    return max(value - 1, 0);
  }

  int neighborPlus(int value) {
    if (boundaryMode == 1) {
      return value < size - 1 ? value + 1 : 0;
    }
    return min(value + 1, size - 1);
  }

  vec2 fieldAt(int x, int y, int z) {
    return texelFetch(stateMap, coordOf(x, y, z), 0).rg;
  }

  void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    int tileColumn = coord.x / size;
    int tileRow = coord.y / size;
    int x = tileRow * tileColumns + tileColumn;
    int z = coord.x - tileColumn * size;
    int y = coord.y - tileRow * size;

    if (x >= size) {
      outState = vec4(1.0, 0.0, 0.0, 1.0);
      return;
    }

    int xm = neighborMinus(x);
    int xp = neighborPlus(x);
    int ym = neighborMinus(y);
    int yp = neighborPlus(y);
    int zm = neighborMinus(z);
    int zp = neighborPlus(z);

    vec2 center = fieldAt(x, y, z);
    float u = center.r;
    float v = center.g;

    float lapU =
      (fieldAt(xm, y, z).r +
        fieldAt(xp, y, z).r +
        fieldAt(x, ym, z).r +
        fieldAt(x, yp, z).r +
        fieldAt(x, y, zm).r +
        fieldAt(x, y, zp).r -
        6.0 * u) *
      invDx2;
    float lapV =
      (fieldAt(xm, y, z).g +
        fieldAt(xp, y, z).g +
        fieldAt(x, ym, z).g +
        fieldAt(x, yp, z).g +
        fieldAt(x, y, zm).g +
        fieldAt(x, y, zp).g -
        6.0 * v) *
      invDx2;
    float reaction = u * v * v;

    float nextU = clamp(u + dt * (du * lapU - reaction + feed * (1.0 - u)), 0.0, 1.0);
    float nextV = clamp(v + dt * (dv * lapV + reaction - (feed + kill) * v), 0.0, 1.0);
    outState = vec4(nextU, nextV, 0.0, 1.0);
  }
`;

export class GpuSimulationEngine {
  constructor(onFrame, onError, renderer) {
    this.onFrame = onFrame;
    this.onError = onError;
    this.renderer = renderer;
    this.gl = renderer?.getContext();

    if (!this.gl) {
      throw new Error("A shared WebGL2 renderer is required for the GPGPU backend.");
    }
    if (!this.gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for the GPGPU backend.");
    }

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        stateMap: { value: null },
        size: { value: 64 },
        tileColumns: { value: 8 },
        boundaryMode: { value: 0 },
        feed: { value: 0.02 },
        kill: { value: 0.0555 },
        du: { value: 0.00002 },
        dv: { value: 0.00001 },
        dt: { value: 0.5 },
        invDx2: { value: 10000 }
      }
    });
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
    );
    this.quad = new THREE.Mesh(this.geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.Camera();

    this.targets = [];
    this.initialTexture = null;
    this.currentTexture = null;
    this.currentTarget = null;
    this.nextTarget = 0;
    this.config = null;
    this.layout = createAtlasLayout(64);
    this.size = 0;
    this.count = 0;
    this.stepCount = 0;
    this.running = false;
    this.timer = 0;
    this.readBuffer = new Float32Array(0);
    this.latestVolume = null;
    this.latestMetrics = null;
    this.lastSnapshotAt = 0;
  }

  configure(config) {
    const previousSize = this.size;
    this.config = { ...this.config, ...config };
    const requestedSize = Math.max(4, Number(this.config.gridSize) | 0);

    if (!previousSize || requestedSize !== previousSize) {
      this.reset(this.config);
    } else {
      this.emitFrame(null, true);
    }
  }

  reset(config = this.config) {
    this.config = { ...this.config, ...config };
    const fields = createInitialFields(this.config);
    this.size = fields.size;
    this.count = fields.count;
    this.layout = createAtlasLayout(this.size);
    this.stepCount = 0;
    this.ensureCapacity();
    this.uploadState(fields.u, fields.v);
    const snapshot = packField(fields.v, Number(this.config.threshold));
    this.latestVolume = snapshot.volume;
    this.latestMetrics = snapshot.metrics;
    this.lastSnapshotAt = performance.now();
    this.emitFrame(null, false, true);
  }

  setRunning(running) {
    this.running = Boolean(running);
    window.clearTimeout(this.timer);
    if (this.running) {
      this.loop();
    }
  }

  dispose() {
    window.clearTimeout(this.timer);
    this.initialTexture?.dispose();
    for (const target of this.targets) {
      target.dispose();
    }
    this.geometry.dispose();
    this.material.dispose();
  }

  ensureCapacity() {
    const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
    const maxViewportDimensions = this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS);
    if (
      this.layout.width > maxTextureSize ||
      this.layout.height > maxTextureSize ||
      this.layout.width > maxViewportDimensions[0] ||
      this.layout.height > maxViewportDimensions[1]
    ) {
      throw new Error(
        `GPGPU backend cannot allocate a ${this.layout.width}x${this.layout.height} atlas.`
      );
    }

    for (const target of this.targets) {
      target.dispose();
    }
    this.targets = [this.createRenderTarget(), this.createRenderTarget()];
    this.readBuffer = new Float32Array(this.layout.width * this.layout.height * 4);
  }

  createRenderTarget() {
    const target = new THREE.WebGLRenderTarget(this.layout.width, this.layout.height, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false
    });
    target.texture.internalFormat = "RGBA32F";
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.generateMipmaps = false;
    return target;
  }

  uploadState(u, v) {
    this.initialTexture?.dispose();
    const pixels = new Float32Array(this.layout.width * this.layout.height * 4);

    for (let pixel = 0; pixel < this.layout.width * this.layout.height; pixel += 1) {
      pixels[pixel * 4] = 1;
      pixels[pixel * 4 + 3] = 1;
    }

    for (let x = 0; x < this.size; x += 1) {
      for (let y = 0; y < this.size; y += 1) {
        for (let z = 0; z < this.size; z += 1) {
          const fieldOffset = x * this.size * this.size + y * this.size + z;
          const atlasOffset = atlasPixelIndex(this.layout, x, y, z) * 4;
          pixels[atlasOffset] = u[fieldOffset];
          pixels[atlasOffset + 1] = v[fieldOffset];
        }
      }
    }

    this.initialTexture = new THREE.DataTexture(
      pixels,
      this.layout.width,
      this.layout.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.initialTexture.internalFormat = "RGBA32F";
    this.initialTexture.minFilter = THREE.LinearFilter;
    this.initialTexture.magFilter = THREE.LinearFilter;
    this.initialTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.initialTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.initialTexture.generateMipmaps = false;
    this.initialTexture.colorSpace = THREE.NoColorSpace;
    this.initialTexture.needsUpdate = true;

    this.currentTexture = this.initialTexture;
    this.currentTarget = null;
    this.nextTarget = 0;
  }

  loop() {
    if (!this.running) return;

    try {
      const steps = Math.max(1, Number(this.config.speed) | 0);
      const shouldSample = performance.now() - this.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS;
      if (shouldSample) {
        this.gl.finish();
      }
      const startedAt = performance.now();
      this.advance(steps);
      if (shouldSample) {
        this.gl.finish();
      }
      const computeMs = performance.now() - startedAt;
      this.stepCount += steps;

      const performanceInfo = shouldSample
        ? {
            steps,
            computeMs,
            readbackMs: 0,
            totalMs: computeMs,
            cellsPerSecond: null
          }
        : undefined;
      this.emitFrame(performanceInfo, shouldSample);
      const totalMs = performance.now() - startedAt;
      const delay = Math.max(0, 16 - totalMs);
      this.timer = window.setTimeout(() => this.loop(), delay);
    } catch (error) {
      this.running = false;
      this.onError?.(error);
    }
  }

  advance(steps) {
    const previousTarget = this.renderer.getRenderTarget();
    const uniforms = this.material.uniforms;
    uniforms.size.value = this.size;
    uniforms.tileColumns.value = this.layout.columns;
    uniforms.boundaryMode.value = this.config.boundary === "periodic" ? 1 : 0;
    uniforms.feed.value = Number(this.config.feed);
    uniforms.kill.value = Number(this.config.kill);
    uniforms.du.value = Number(this.config.du);
    uniforms.dv.value = Number(this.config.dv);
    uniforms.dt.value = Number(this.config.dt);
    const dx = Math.max(1e-6, Number(this.config.dx) || 0.01);
    uniforms.invDx2.value = 1 / (dx * dx);

    for (let i = 0; i < steps; i += 1) {
      const target = this.targets[this.nextTarget];
      uniforms.stateMap.value = this.currentTexture;
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene, this.camera);
      this.currentTexture = target.texture;
      this.currentTarget = target;
      this.nextTarget = 1 - this.nextTarget;
    }

    this.renderer.setRenderTarget(previousTarget);
  }

  emitFrame(performanceInfo, forceSnapshot, initial = false) {
    if (!this.count) return;

    let volume;
    let metrics;
    let readbackMs = 0;

    if (initial) {
      volume = this.latestVolume;
      metrics = this.latestMetrics;
    } else if (forceSnapshot) {
      const readStartedAt = performance.now();
      if (this.currentTarget) {
        this.renderer.readRenderTargetPixels(
          this.currentTarget,
          0,
          0,
          this.layout.width,
          this.layout.height,
          this.readBuffer
        );
        const snapshot = this.packSnapshot();
        this.latestVolume = snapshot.volume;
        this.latestMetrics = snapshot.metrics;
      } else if (this.latestVolume) {
        this.latestMetrics = metricsFromBytes(
          this.latestVolume,
          Number(this.config.threshold)
        );
      }
      readbackMs = performance.now() - readStartedAt;
      this.lastSnapshotAt = performance.now();
      volume = this.latestVolume;
      metrics = this.latestMetrics;
    }

    const frame = {
      backend: "gpgpu",
      size: this.size,
      step: this.stepCount,
      gpuState: {
        texture: this.currentTexture,
        layout: this.layout
      }
    };
    if (volume) frame.volume = volume;
    if (metrics) frame.metrics = metrics;

    if (performanceInfo) {
      const totalMs = performanceInfo.computeMs + readbackMs;
      frame.performance = {
        ...performanceInfo,
        readbackMs,
        totalMs,
        cellsPerSecond:
          performanceInfo.steps && totalMs > 0
            ? (performanceInfo.steps * this.count) / (totalMs / 1000)
            : null
      };
    } else if (initial) {
      frame.performance = null;
    }

    this.onFrame(frame);
  }

  packSnapshot() {
    const volume = new Uint8Array(this.count);
    let max = 0;
    let sum = 0;
    let active = 0;
    const threshold = Number(this.config.threshold);

    for (let x = 0; x < this.size; x += 1) {
      for (let y = 0; y < this.size; y += 1) {
        for (let z = 0; z < this.size; z += 1) {
          const fieldOffset = x * this.size * this.size + y * this.size + z;
          const atlasOffset = atlasPixelIndex(this.layout, x, y, z) * 4;
          const value = this.readBuffer[atlasOffset + 1];
          if (value > max) max = value;
          sum += value;
          if (value >= threshold) active += 1;
          volume[fieldOffset] = Math.max(0, Math.min(255, Math.round(value * 255)));
        }
      }
    }

    return {
      volume,
      metrics: {
        max,
        avg: sum / this.count,
        active: active / this.count
      }
    };
  }
}

function packField(field, threshold) {
  const volume = new Uint8Array(field.length);
  let max = 0;
  let sum = 0;
  let active = 0;

  for (let i = 0; i < field.length; i += 1) {
    const value = field[i];
    if (value > max) max = value;
    sum += value;
    if (value >= threshold) active += 1;
    volume[i] = Math.max(0, Math.min(255, Math.round(value * 255)));
  }

  return {
    volume,
    metrics: {
      max,
      avg: sum / field.length,
      active: active / field.length
    }
  };
}

function metricsFromBytes(volume, threshold) {
  let max = 0;
  let sum = 0;
  let active = 0;

  for (const byte of volume) {
    const value = byte / 255;
    if (value > max) max = value;
    sum += value;
    if (value >= threshold) active += 1;
  }

  return {
    max,
    avg: sum / volume.length,
    active: active / volume.length
  };
}
