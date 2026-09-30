/** Bounded, allocation-free frame sampling. CPU time is not GPU execution time. */
export class RenderPerformance {
  private frameMs = new Float32Array(240);
  private cpuMs = new Float32Array(240);
  private index = 0;
  private count = 0;
  private previous = 0;
  record(timestamp: number, cpu: number) {
    const interval = timestamp - this.previous;
    if (this.previous && interval > 0) {
      this.frameMs[this.index] = interval;
      this.cpuMs[this.index] = cpu;
      this.index = (this.index + 1) % this.frameMs.length;
      this.count = Math.min(this.count + 1, this.frameMs.length);
    }
    this.previous = timestamp;
  }
  reset() { this.previous = 0; this.count = 0; this.index = 0; }
  suspend() { this.previous = 0; }
  snapshot() {
    const frames = Array.from(this.frameMs.subarray(0, this.count)).sort((a, b) => a - b);
    const cpu = Array.from(this.cpuMs.subarray(0, this.count)).sort((a, b) => a - b);
    const quantile = (values: number[], p: number) => values.length ? Number(values[Math.floor((values.length - 1) * p)].toFixed(2)) : null;
    const p50 = quantile(frames, .5);
    return { samples: this.count, fpsMedian: p50 ? Math.round(1000 / p50) : null,
      frameMs: { p50, p95: quantile(frames, .95), p99: quantile(frames, .99), max: quantile(frames, 1) },
      cpuSubmissionMsP95: quantile(cpu, .95), gpuTimeMeasured: false };
  }
}
