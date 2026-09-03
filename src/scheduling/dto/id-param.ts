import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

import type { IIdParam } from "../interfaces/index";

export class IdParamDto implements IIdParam {
  @ApiProperty({ example: 1, minimum: 1, description: "Positive integer path id" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}
