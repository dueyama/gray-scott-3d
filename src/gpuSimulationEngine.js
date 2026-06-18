import { createInitialFields } from "./initialConditions.js";

const vertexShaderSource = `#version 300 es
const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D stateMap;
uniform int size;
uniform int boundaryMode;
uniform float feed;
uniform float kill;
uniform float du;
uniform float dv;
uniform float dt;
uniform float invDx2;

out vec4 outState;

ivec2 coordOf(int x, int y, int z) {
  return ivec2(z, x * size + y);
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
  int z = coord.x;
  int x = coord.y / size;
  int y = coord.y - x * size;

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
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl2", {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    });

    if (!this.gl) {
      throw new Error("WebGL2 is required for the GPGPU simulation backend.");
    }

    if (!this.gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for the GPGPU simulation backend.");
    }

    this.program = createProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    this.uniforms = readUniformLocations(this.gl, this.program, [
      "stateMap",
      "size",
      "boundaryMode",
      "feed",
      "kill",
      "du",
      "dv",
      "dt",
      "invDx2"
    ]);
    this.framebuffer = this.gl.createFramebuffer();
    this.vao = this.gl.createVertexArray();
    this.textures = [this.gl.createTexture(), this.gl.createTexture()];
    this.currentTexture = 0;
    this.config = null;
    this.size = 0;
    this.count = 0;
    this.width = 0;
    this.height = 0;
    this.stepCount = 0;
    this.running = false;
    this.timer = 0;
    this.readBuffer = new Float32Array(0);
  }

  configure(config) {
    const previousSize = this.size;
    this.config = { ...this.config, ...config };
    const requestedSize = Math.max(4, Number(this.config.gridSize) | 0);

    if (!previousSize || requestedSize !== previousSize) {
      this.reset(this.config);
    } else {
      this.postFrame({
        steps: 0,
        computeMs: 0,
        readbackMs: 0,
        totalMs: 0,
        cellsPerSecond: null
      });
    }
  }

  reset(config = this.config) {
    this.config = { ...this.config, ...config };
    const fields = createInitialFields(this.config);
    this.size = fields.size;
    this.count = fields.count;
    this.width = this.size;
    this.height = this.size * this.size;
    this.stepCount = 0;
    this.ensureCapacity();
    this.uploadState(fields.u, fields.v);
    this.postFrame({
      steps: 0,
      computeMs: 0,
      readbackMs: 0,
      totalMs: 0,
      cellsPerSecond: null
    });
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
    const gl = this.gl;
    for (const texture of this.textures) {
      gl.deleteTexture(texture);
    }
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }

  ensureCapacity() {
    const gl = this.gl;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    if (
      this.width > maxTextureSize ||
      this.height > maxTextureSize ||
      this.width > maxViewportDims[0] ||
      this.height > maxViewportDims[1]
    ) {
      throw new Error(`GPGPU backend cannot allocate ${this.width}x${this.height} textures.`);
    }
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  uploadState(u, v) {
    const gl = this.gl;
    const pixels = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i += 1) {
      const offset = i * 4;
      pixels[offset] = u[i];
      pixels[offset + 1] = v[i];
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 1;
    }

    for (let i = 0; i < this.textures.length; i += 1) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        this.width,
        this.height,
        0,
        gl.RGBA,
        gl.FLOAT,
        i === 0 ? pixels : null
      );
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.currentTexture = 0;
  }

  loop() {
    if (!this.running) return;

    const steps = Math.max(1, Number(this.config.speed) | 0);
    const startedAt = performance.now();
    this.advance(steps);
    const computeMs = performance.now() - startedAt;
    this.stepCount += steps;

    const frameStartedAt = performance.now();
    this.postFrame({
      steps,
      computeMs,
      readbackMs: 0,
      totalMs: 0,
      cellsPerSecond:
        computeMs > 0 ? (steps * this.count) / (computeMs / 1000) : Number.POSITIVE_INFINITY
    });
    const totalMs = performance.now() - startedAt;
    const delay = Math.max(0, 16 - totalMs);
    this.timer = window.setTimeout(() => this.loop(), delay);
  }

  advance(steps) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uniforms.stateMap, 0);
    gl.uniform1i(this.uniforms.size, this.size);
    gl.uniform1i(this.uniforms.boundaryMode, this.config.boundary === "periodic" ? 1 : 0);
    gl.uniform1f(this.uniforms.feed, Number(this.config.feed));
    gl.uniform1f(this.uniforms.kill, Number(this.config.kill));
    gl.uniform1f(this.uniforms.du, Number(this.config.du));
    gl.uniform1f(this.uniforms.dv, Number(this.config.dv));
    gl.uniform1f(this.uniforms.dt, Number(this.config.dt));
    const dx = Math.max(1e-6, Number(this.config.dx) || 0.01);
    gl.uniform1f(this.uniforms.invDx2, 1 / (dx * dx));

    for (let i = 0; i < steps; i += 1) {
      const source = this.currentTexture;
      const target = 1 - source;
      gl.bindTexture(gl.TEXTURE_2D, this.textures[source]);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.textures[target],
        0
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.currentTexture = target;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  }

  postFrame(performanceInfo) {
    if (!this.count) return;

    const gl = this.gl;
    if (this.readBuffer.length !== this.count * 4) {
      this.readBuffer = new Float32Array(this.count * 4);
    }

    const readStartedAt = performance.now();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.textures[this.currentTexture],
      0
    );
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.readBuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const readbackMs = performance.now() - readStartedAt;

    const bytes = new Uint8Array(this.count);
    let max = 0;
    let sum = 0;
    let active = 0;
    const threshold = Number(this.config.threshold);

    for (let i = 0; i < this.count; i += 1) {
      const value = this.readBuffer[i * 4 + 1];
      if (value > max) max = value;
      sum += value;
      if (value >= threshold) active += 1;
      bytes[i] = Math.max(0, Math.min(255, Math.round(value * 255)));
    }

    this.onFrame({
      backend: "gpgpu",
      size: this.size,
      step: this.stepCount,
      volume: bytes,
      metrics: {
        max,
        avg: sum / this.count,
        active: active / this.count
      },
      performance: {
        ...performanceInfo,
        readbackMs,
        totalMs: (performanceInfo?.computeMs ?? 0) + readbackMs
      }
    });
  }
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unable to link GPGPU program.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unable to compile GPGPU shader.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function readUniformLocations(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}
