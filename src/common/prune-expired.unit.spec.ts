import { describe, expect, it } from "@jest/globals";

import { pruneExpired } from "./prune-expired";

describe("pruneExpired", () => {
  it("drops entries whose expiresAt is in the past", () => {
    const entries = new Map<string, { expiresAt: number }>([
      ["live", { expiresAt: 2_000 }],
      ["dead", { expiresAt: 1_000 }],
    ]);

    pruneExpired(entries, 1_000);

    expect([...entries.keys()]).toEqual(["live"]);
  });

  it("keeps entries that expire after now", () => {
    const entries = new Map([[1, { expiresAt: 5 }]]);

    pruneExpired(entries, 4);

    expect(entries.has(1)).toBe(true);
  });
});
