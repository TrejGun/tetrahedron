import { describe, expect, it } from "@jest/globals";
import { hydrateReservation } from "./hydrate-reservation";

const reservation = {
  id: 1,
  resourceId: 1,
  holder: "alice@example.com",
  startsAt: "2026-06-01T09:00:00Z",
  endsAt: "2026-06-01T10:00:00Z",
};

const resource = {
  id: 1,
  name: "Conference Room A",
  kind: "room",
  capacity: 8,
  timezone: "Europe/Lisbon",
};

describe("hydrateReservation", () => {
  it("joins resource metadata and projects UTC instants into the resource timezone", () => {
    expect(hydrateReservation(reservation, resource)).toEqual({
      id: 1,
      resourceId: 1,
      holder: "alice@example.com",
      startsAt: "2026-06-01T09:00:00Z",
      endsAt: "2026-06-01T10:00:00Z",
      localStartsAt: "2026-06-01T10:00:00+01:00",
      localEndsAt: "2026-06-01T11:00:00+01:00",
      durationMinutes: 60,
      resource: {
        name: "Conference Room A",
        kind: "room",
        capacity: 8,
        timezone: "Europe/Lisbon",
      },
    });
  });
});
