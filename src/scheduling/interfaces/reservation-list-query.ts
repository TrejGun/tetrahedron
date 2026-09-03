import type { IPaginationDto } from "../../common/pagination/interfaces/index";

export interface IReservationListQuery extends IPaginationDto {
  resourceId?: number;
  from?: string;
  to?: string;
}
