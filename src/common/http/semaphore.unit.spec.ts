import { describe, expect, it } from "@jest/globals";

import { Semaphore } from "./semaphore";

describe("Semaphore", () => {
  it("caps concurrent work at max and runs the rest after a slot frees", async () => {
    const semaphore = new Semaphore(2);
    let inflight = 0;
    let peak = 0;

    const job = async () => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise(resolve => {
        setTimeout(resolve, 20);
      });
      inflight -= 1;
    };

    await Promise.all([1, 2, 3, 4].map(() => semaphore.run(job)));

    expect(peak).toBe(2);
  });
});
