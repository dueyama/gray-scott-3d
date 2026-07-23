import test from "node:test";
import assert from "node:assert/strict";

test("time-slices a GPGPU display batch without dropping simulation steps", async () => {
  globalThis.window = globalThis;
  const { GpuSimulationEngine } = await import("../src/gpuSimulationEngine.js");
  const fakeRenderer = new FakeRenderer();
  let engine;

  const completedFrame = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for a batch")), 1000);
    engine = new GpuSimulationEngine(
      (frame) => {
        if (frame.step < 20) return;
        clearTimeout(timeout);
        resolve(frame);
      },
      reject,
      fakeRenderer
    );
  });

  engine.setPerformanceProfile({
    snapshotIntervalMs: 10000,
    computeBudgetMs: 6,
    maxStepsPerChunk: 3
  });
  engine.reset({
    gridSize: 4,
    feed: 0.02,
    kill: 0.0555,
    du: 0.00002,
    dv: 0.00001,
    dt: 0.5,
    dx: 0.01,
    threshold: 0.4,
    speed: 20,
    boundary: "neumann",
    initMode: "discNTestFs",
    seed: 5
  });
  engine.setRunning(true);

  const frame = await completedFrame;
  engine.setRunning(false);
  engine.dispose();

  assert.equal(frame.step, 20);
  assert.equal(fakeRenderer.renderCalls, 20);
  assert.equal(engine.stepCount, 20);
  delete globalThis.window;
});

class FakeRenderer {
  constructor() {
    this.currentTarget = null;
    this.renderCalls = 0;
    this.gl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      MAX_VIEWPORT_DIMS: 0x0d3a,
      getExtension: () => ({}),
      getParameter: (parameter) =>
        parameter === 0x0d3a ? [4096, 4096] : 4096,
      finish: () => {}
    };
  }

  getContext() {
    return this.gl;
  }

  getRenderTarget() {
    return this.currentTarget;
  }

  setRenderTarget(target) {
    this.currentTarget = target;
  }

  render() {
    this.renderCalls += 1;
  }

  readRenderTargetPixels(_target, _x, _y, _width, _height, buffer) {
    buffer.fill(0);
  }
}

