import { describe, expect, it } from "@jest/globals";

import { KeyedMutex } from "./keyed-mutex";

describe("KeyedMutex", () => {
  it("runs work for the same key one at a time", async () => {
    const mutex = new KeyedMutex<number>();
    const order: number[] = [];

    const slow = mutex.run(1, async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 30);
      });
      order.push(1);
    });
    const fast = mutex.run(1, async () => {
      order.push(2);
    });

    await Promise.all([slow, fast]);
    expect(order).toEqual([1, 2]);
  });

  it("does not serialize different keys", async () => {
    const mutex = new KeyedMutex<number>();
    let firstReleased = false;

    const a = mutex.run(1, async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 30);
      });
      firstReleased = true;
    });
    const b = mutex.run(2, async () => {
      expect(firstReleased).toBe(false);
    });

    await Promise.all([a, b]);
  });
});
