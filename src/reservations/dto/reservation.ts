import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsISO8601, IsNotEmpty, IsString } from "class-validator";

import type { IReservation } from "../interfaces/index";

export class ReservationDto implements IReservation {
  @ApiProperty({ example: 1, description: "Reservation id assigned by the reservations upstream" })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: "Catalog resource this reservation is held against" })
  @IsInt()
  resourceId: number;

  @ApiProperty({ example: "alice@example.com", description: "Opaque holder identifier" })
  @IsString()
  @IsNotEmpty()
  holder: string;

  @ApiProperty({ example: "2026-06-01T09:00:00Z", description: "Inclusive start instant in UTC" })
  @IsISO8601()
  startsAt: string;

  @ApiProperty({ example: "2026-06-01T10:00:00Z", description: "Exclusive end instant in UTC" })
  @IsISO8601()
  endsAt: string;
}
