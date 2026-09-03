import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

import type { IPaginationDto } from "../interfaces/index";

export class PaginationDto implements IPaginationDto {
  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0, description: "Number of rows to skip" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100, default: 10, description: "Page size" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 10;
}
