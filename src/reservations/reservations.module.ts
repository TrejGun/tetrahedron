import { Module } from "@nestjs/common";

import { UpstreamHttpModule } from "../common/http/upstream-http.module";
import { ReservationsService } from "./reservations.service";

@Module({
  imports: [
    UpstreamHttpModule.register({
      name: "reservations",
      baseUrlKey: "RESERVATIONS_BASE_URL",
      defaultBaseUrl: "http://127.0.0.1:5050",
    }),
  ],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
