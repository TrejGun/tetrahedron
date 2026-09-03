import { describe, expect, it } from "@jest/globals";

import { bookedMinutes, busyMinutes, clipInterval, minutesBetween, peakConcurrency } from "./utilisation";

const nine = new Date("2026-06-01T09:00:00Z");
const ten = new Date("2026-06-01T10:00:00Z");
const eleven = new Date("2026-06-01T11:00:00Z");
const noon = new Date("2026-06-01T12:00:00Z");

describe("utilisation", () => {
  it("clips a reservation to the query window", () => {
    expect(clipInterval(nine, eleven, ten, noon)).toEqual({ start: ten, end: eleven });
    expect(clipInterval(nine, ten, ten, noon)).toBeUndefined();
  });

  it("sums booked minutes including overlaps", () => {
    expect(
      bookedMinutes([
        { start: nine, end: eleven },
        { start: ten, end: noon },
      ]),
    ).toBe(240);
  });

  it("measures busy minutes as the union", () => {
    expect(
      busyMinutes([
        { start: nine, end: eleven },
        { start: ten, end: noon },
      ]),
    ).toBe(180);
    expect(
      busyMinutes([
        { start: nine, end: ten },
        { start: ten, end: eleven },
      ]),
    ).toBe(120);
  });

  it("computes peak concurrency with back-to-back as 1", () => {
    expect(
      peakConcurrency([
        { start: nine, end: ten },
        { start: ten, end: eleven },
      ]),
    ).toBe(1);
    expect(
      peakConcurrency([
        { start: nine, end: eleven },
        { start: ten, end: noon },
      ]),
    ).toBe(2);
  });

  it("counts window minutes in UTC", () => {
    expect(minutesBetween(nine, noon)).toBe(180);
  });
});
