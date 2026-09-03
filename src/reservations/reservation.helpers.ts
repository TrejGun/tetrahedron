import { parseISO } from "date-fns";

import type { IReservation, IReservationPatch, IReservationWrite } from "./interfaces/index";

export function sameReservationIntent(a: IReservationWrite, b: IReservationWrite): boolean {
  return (
    a.resourceId === b.resourceId &&
    a.holder === b.holder &&
    parseISO(a.startsAt).getTime() === parseISO(b.startsAt).getTime() &&
    parseISO(a.endsAt).getTime() === parseISO(b.endsAt).getTime()
  );
}

export function reservationFingerprint(body: IReservationWrite): string {
  return JSON.stringify({
    resourceId: body.resourceId,
    holder: body.holder,
    startsAt: parseISO(body.startsAt).toISOString(),
    endsAt: parseISO(body.endsAt).toISOString(),
  });
}

export function findIntent(listed: IReservation[], body: IReservationWrite): IReservation | undefined {
  const matches = listed.filter(row => sameReservationIntent(row, body));
  if (matches.length === 0) {
    return undefined;
  }
  return matches.reduce((best, row) => (row.id > best.id ? row : best));
}

export function mergeReservation(current: IReservation, patch: IReservationPatch): IReservationWrite {
  return {
    resourceId: patch.resourceId ?? current.resourceId,
    holder: patch.holder ?? current.holder,
    startsAt: patch.startsAt ?? current.startsAt,
    endsAt: patch.endsAt ?? current.endsAt,
  };
}
