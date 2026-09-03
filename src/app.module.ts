import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { HttpExceptionFilter } from "./common/filters/http";
import { HttpValidationPipe } from "./common/http-validation.pipe";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthModule } from "./health/health.module";
import { HttpMetricsInterceptor } from "./metrics/http-metrics.interceptor";
import { MetricsModule } from "./metrics/metrics.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { SchedulingModule } from "./scheduling/scheduling.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? "development"}`,
    }),
    HealthModule,
    MetricsModule,
    CatalogModule,
    ReservationsModule,
    SchedulingModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: HttpValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
