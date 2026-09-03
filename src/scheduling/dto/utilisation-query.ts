import { ApiProperty } from "@nestjs/swagger";
import { IsISO8601, Validate } from "class-validator";

import type { IUtilisationQuery } from "../interfaces/index";
import { CompleteOverlapWindowConstraint } from "./complete-overlap-window.constraint";

export class UtilisationQueryDto implements IUtilisationQuery {
  @ApiProperty({
    example: "2026-06-01T00:00:00Z",
    description: "Inclusive start of the utilisation window (UTC). Requires `to`.",
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Validate(CompleteOverlapWindowConstraint)
  from: string;

  @ApiProperty({
    example: "2026-06-02T00:00:00Z",
    description: "Exclusive end of the utilisation window (UTC). Requires `from`.",
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  to: string;
}
