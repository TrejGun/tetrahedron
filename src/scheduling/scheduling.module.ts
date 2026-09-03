import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module";
import { HttpValidationPipe } from "../common/http-validation.pipe";
import { ReservationsModule } from "../reservations/reservations.module";
import { ResourcesController } from "./resources.controller";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";

@Module({
  imports: [CatalogModule, ReservationsModule],
  controllers: [SchedulingController, ResourcesController],
  providers: [SchedulingService, HttpValidationPipe],
})
export class SchedulingModule {}
