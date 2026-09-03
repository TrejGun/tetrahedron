import { tz } from "@date-fns/tz";
import { differenceInMinutes, format, parseISO } from "date-fns";

import type { ICatalogResource } from "../catalog/interfaces/index";
import type { IReservation } from "../reservations/interfaces/index";
import type { IHydratedReservation } from "./interfaces/index";

const ISO_OFFSET = "yyyy-MM-dd'T'HH:mm:ssXXX";
const utc = tz("UTC");

export function hydrateReservation(reservation: IReservation, resource: ICatalogResource): IHydratedReservation {
  const start = parseISO(reservation.startsAt);
  const end = parseISO(reservation.endsAt);
  const zone = tz(resource.timezone);

  return {
    id: reservation.id,
    resourceId: reservation.resourceId,
    resource: {
      name: resource.name,
      kind: resource.kind,
      capacity: resource.capacity,
      timezone: resource.timezone,
    },
    holder: reservation.holder,
    startsAt: format(start, ISO_OFFSET, { in: utc }),
    endsAt: format(end, ISO_OFFSET, { in: utc }),
    localStartsAt: format(start, ISO_OFFSET, { in: zone }),
    localEndsAt: format(end, ISO_OFFSET, { in: zone }),
    durationMinutes: differenceInMinutes(end, start),
  };
}
