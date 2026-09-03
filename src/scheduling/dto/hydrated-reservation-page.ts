import { ApiProperty } from "@nestjs/swagger";

import type { IPaginationResult } from "../../common/pagination/interfaces/index";
import type { IHydratedReservation } from "../interfaces/index";
import { HydratedReservationDto } from "./hydrated-reservation";

export class HydratedReservationPageDto implements IPaginationResult<IHydratedReservation> {
  @ApiProperty({ type: [HydratedReservationDto], description: "Hydrated reservations on this page" })
  rows: HydratedReservationDto[];

  @ApiProperty({ example: 42, description: "Total matching rows before skip/take" })
  count: number;
}
