import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, Validate } from "class-validator";

import type { IReservationPatch } from "../../reservations/interfaces/index";
import { EndsAfterStartConstraint } from "./ends-after-start.constraint";
import { HOLDER_MAX_LENGTH, HOLDER_PATTERN } from "./holder";

export class PatchReservationDto implements IReservationPatch {
  @ApiPropertyOptional({ example: 1, description: "Catalog resource this reservation is held against" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  resourceId?: number;

  @ApiPropertyOptional({
    example: "bob@example.com",
    maxLength: HOLDER_MAX_LENGTH,
    description: "Opaque holder identifier, 1–256 of [A-Za-z0-9._@+-]",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(HOLDER_MAX_LENGTH)
  @Matches(HOLDER_PATTERN)
  holder?: string;

  @ApiPropertyOptional({ example: "2026-06-01T09:00:00Z", description: "Inclusive start instant in UTC" })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(EndsAfterStartConstraint)
  startsAt?: string;

  @ApiPropertyOptional({ example: "2026-06-01T10:00:00Z", description: "Exclusive end instant in UTC" })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(EndsAfterStartConstraint)
  endsAt?: string;
}
