export class SlidingWindow {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly windowMs: number,
    private readonly maxFailures: number,
  ) {}

  recordFailure(now = Date.now()): void {
    this.prune(now);
    this.timestamps.push(now);
  }

  isOpen(now = Date.now()): boolean {
    if (this.maxFailures <= 0) {
      return false;
    }
    this.prune(now);
    return this.timestamps.length >= this.maxFailures;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! <= cutoff) {
      this.timestamps.shift();
    }
  }
}
