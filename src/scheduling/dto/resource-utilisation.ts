import { ApiProperty } from "@nestjs/swagger";

import type { IResourceUtilisation } from "../interfaces/index";
import { HydratedResourceDto } from "./hydrated-resource";

export class ResourceUtilisationDto implements IResourceUtilisation {
  @ApiProperty({ example: 1, description: "Catalog resource id" })
  resourceId: number;

  @ApiProperty({ type: HydratedResourceDto })
  resource: HydratedResourceDto;

  @ApiProperty({ example: "2026-06-01T09:00:00Z", description: "Inclusive start of the query window (UTC)" })
  from: string;

  @ApiProperty({ example: "2026-06-01T12:00:00Z", description: "Exclusive end of the query window (UTC)" })
  to: string;

  @ApiProperty({ example: 180, description: "Length of `[from, to)` in minutes" })
  windowMinutes: number;

  @ApiProperty({
    example: 120,
    description: "Sum of reservation minutes clipped to the window. Overlaps add; can exceed windowMinutes.",
  })
  bookedMinutes: number;

  @ApiProperty({
    example: 120,
    description: "Minutes the resource was occupied by at least one reservation (union of clipped intervals).",
  })
  busyMinutes: number;

  @ApiProperty({ example: 0.667, description: "busyMinutes / windowMinutes, in `[0, 1]`" })
  utilisation: number;

  @ApiProperty({ example: 2, description: "Distinct holders on reservations that overlap the window" })
  distinctHolders: number;

  @ApiProperty({ example: 2, description: "Reservations that overlap the window" })
  reservationCount: number;

  @ApiProperty({
    example: 1,
    description: "Maximum overlapping reservations inside the window (sweep line; back-to-back is 1).",
  })
  peakConcurrency: number;
}
