import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsISO8601, IsInt, IsOptional, Min, Validate } from "class-validator";

import { PaginationDto } from "../../common/pagination/dto/index";
import type { IReservationListQuery } from "../interfaces/index";
import { CompleteOverlapWindowConstraint } from "./complete-overlap-window.constraint";

export class ReservationListQueryDto extends PaginationDto implements IReservationListQuery {
  @ApiPropertyOptional({ example: 1, description: "When set, only reservations for this catalog resource" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  resourceId?: number;

  @ApiPropertyOptional({
    example: "2026-06-01T00:00:00Z",
    description: "Inclusive start of the overlap window (UTC). Requires `to`.",
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(CompleteOverlapWindowConstraint)
  from?: string;

  @ApiPropertyOptional({
    example: "2026-06-02T00:00:00Z",
    description: "Exclusive end of the overlap window (UTC). Requires `from`.",
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(CompleteOverlapWindowConstraint)
  to?: string;
}
