import { describe, expect, it } from "@jest/globals";

import { IdempotencyStore } from "./idempotency-store";

describe("IdempotencyStore", () => {
  it("replays a live key", () => {
    const store = new IdempotencyStore<number>(1_000);
    store.set("k", "fp", 1);

    expect(store.get("k")).toEqual({ fingerprint: "fp", value: 1 });
  });

  it("drops expired keys when another key is stored", () => {
    const store = new IdempotencyStore<number>(1_000);
    const now = 10_000;
    store.set("old", "a", 1, now);
    store.set("new", "b", 2, now + 1_001);

    expect(store.get("old", now + 1_001)).toBeUndefined();
    expect(store.get("new", now + 1_001)).toEqual({ fingerprint: "b", value: 2 });
  });

  it("does not store when TTL is not positive", () => {
    const store = new IdempotencyStore<number>(0);
    store.set("k", "fp", 1);

    expect(store.get("k")).toBeUndefined();
  });
});
