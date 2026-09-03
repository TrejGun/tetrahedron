import { ApiProperty } from "@nestjs/swagger";

import type { IHydratedReservation } from "../interfaces/index";
import { HydratedResourceDto } from "./hydrated-resource";

export class HydratedReservationDto implements IHydratedReservation {
  @ApiProperty({ example: 42, description: "Reservation id" })
  id: number;

  @ApiProperty({ example: 1, description: "Catalog resource id" })
  resourceId: number;

  @ApiProperty({ type: HydratedResourceDto, description: "Identifying metadata of the reserved resource" })
  resource: HydratedResourceDto;

  @ApiProperty({ example: "alice@example.com", description: "Opaque holder identifier" })
  holder: string;

  @ApiProperty({ example: "2026-06-01T09:00:00Z", description: "Inclusive start instant in UTC" })
  startsAt: string;

  @ApiProperty({ example: "2026-06-01T10:00:00Z", description: "Exclusive end instant in UTC" })
  endsAt: string;

  @ApiProperty({
    example: "2026-06-01T10:00:00+01:00",
    description: "Start instant projected into the resource IANA timezone",
  })
  localStartsAt: string;

  @ApiProperty({
    example: "2026-06-01T11:00:00+01:00",
    description: "End instant projected into the resource IANA timezone",
  })
  localEndsAt: string;

  @ApiProperty({ example: 60, description: "Reservation length in minutes" })
  durationMinutes: number;
}
