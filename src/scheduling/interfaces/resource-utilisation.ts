import type { IHydratedResource } from "./hydrated-resource";

export interface IResourceUtilisation {
  resourceId: number;
  resource: IHydratedResource;
  from: string;
  to: string;
  windowMinutes: number;
  bookedMinutes: number;
  busyMinutes: number;
  utilisation: number;
  distinctHolders: number;
  reservationCount: number;
  peakConcurrency: number;
}
