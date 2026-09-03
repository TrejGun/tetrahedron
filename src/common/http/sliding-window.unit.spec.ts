import { describe, expect, it } from "@jest/globals";

import { SlidingWindow } from "./sliding-window";

describe("SlidingWindow", () => {
  it("opens after maxFailures inside the window and closes when they age out", () => {
    const window = new SlidingWindow(1_000, 3);
    const t0 = 10_000;

    window.recordFailure(t0);
    window.recordFailure(t0 + 10);
    expect(window.isOpen(t0 + 20)).toBe(false);

    window.recordFailure(t0 + 20);
    expect(window.isOpen(t0 + 30)).toBe(true);

    expect(window.isOpen(t0 + 1_021)).toBe(false);
  });

  it("never opens when maxFailures is not positive", () => {
    const window = new SlidingWindow(1_000, 0);
    window.recordFailure(0);
    window.recordFailure(1);
    expect(window.isOpen(2)).toBe(false);
  });
});
