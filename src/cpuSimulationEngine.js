export class CpuSimulationEngine {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.worker = new Worker(new URL("./simWorker.js", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event) => {
      if (event.data.type !== "frame") return;
      this.onFrame({
        backend: "cpu",
        size: event.data.size,
        step: event.data.step,
        volume: new Uint8Array(event.data.buffer),
        metrics: event.data.metrics,
        performance: event.data.performance ?? null
      });
    });
  }

  configure(config) {
    this.worker.postMessage({ type: "configure", payload: { ...config } });
  }

  reset(config) {
    this.worker.postMessage({ type: "reset", payload: { ...config } });
  }

  setRunning(running) {
    this.worker.postMessage({ type: "run", payload: Boolean(running) });
  }

  dispose() {
    this.worker.terminate();
  }
}
