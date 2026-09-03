import type { IHydratedResource } from "./hydrated-resource";

export interface IHydratedReservation {
  id: number;
  resourceId: number;
  resource: IHydratedResource;
  holder: string;
  startsAt: string;
  endsAt: string;
  localStartsAt: string;
  localEndsAt: string;
  durationMinutes: number;
}
