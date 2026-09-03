import { describe, expect, it } from "@jest/globals";

import { findIntent, mergeReservation, reservationFingerprint, sameReservationIntent } from "./reservation.helpers";

const write = {
  resourceId: 1,
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
};

describe("reservation helpers", () => {
  it("treats equivalent ISO instants as the same intent", () => {
    expect(
      sameReservationIntent(write, {
        ...write,
        startsAt: "2026-06-01T09:00:00.000Z",
      }),
    ).toBe(true);
    expect(reservationFingerprint(write)).toBe(
      reservationFingerprint({ ...write, startsAt: "2026-06-01T09:00:00.000Z" }),
    );
  });

  it("treats a different holder as a different intent", () => {
    expect(sameReservationIntent(write, { ...write, holder: "bob@example.com" })).toBe(false);
  });

  it("picks the highest id when several rows match the intent", () => {
    const found = findIntent(
      [
        { id: 1, ...write },
        { id: 4, ...write },
        { id: 2, ...write, holder: "bob@example.com" },
      ],
      write,
    );
    expect(found?.id).toBe(4);
  });

  it("merges a patch onto the current row", () => {
    expect(mergeReservation({ id: 1, ...write }, { holder: "bob@example.com" })).toEqual({
      ...write,
      holder: "bob@example.com",
    });
  });
});
