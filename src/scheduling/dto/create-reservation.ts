import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsISO8601, IsInt, IsNotEmpty, IsString, Matches, MaxLength, Min, Validate } from "class-validator";

import type { IReservationWrite } from "../../reservations/interfaces/index";
import { EndsAfterStartConstraint } from "./ends-after-start.constraint";
import { HOLDER_MAX_LENGTH, HOLDER_PATTERN } from "./holder";

export class CreateReservationDto implements IReservationWrite {
  @ApiProperty({ example: 1, description: "Catalog resource this reservation is held against" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  resourceId: number;

  @ApiProperty({
    example: "alice@example.com",
    maxLength: HOLDER_MAX_LENGTH,
    description: "Opaque holder identifier, 1–256 of [A-Za-z0-9._@+-]",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(HOLDER_MAX_LENGTH)
  @Matches(HOLDER_PATTERN)
  holder: string;

  @ApiProperty({ example: "2026-06-01T09:00:00Z", description: "Inclusive start instant in UTC" })
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt: string;

  @ApiProperty({ example: "2026-06-01T10:00:00Z", description: "Exclusive end instant in UTC" })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(EndsAfterStartConstraint)
  endsAt: string;
}
