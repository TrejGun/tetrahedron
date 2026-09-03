import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { useContainer } from "class-validator";

import { AppController } from "../app.controller";
import { CatalogModule } from "../catalog/catalog.module";
import { HttpExceptionFilter } from "../common/filters/http";
import { HttpValidationPipe } from "../common/http-validation.pipe";
import { HealthModule } from "../health/health.module";
import { HttpMetricsInterceptor } from "../metrics/http-metrics.interceptor";
import { MetricsModule } from "../metrics/metrics.module";
import { ReservationsModule } from "../reservations/reservations.module";
import { SchedulingModule } from "../scheduling/scheduling.module";

export interface IInitAppOptions {
  config?: Record<string, string>;
}

export async function initApp(options: IInitAppOptions = {}): Promise<NestExpressApplication> {
  const testModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: `.env.${process.env.NODE_ENV}`,
        load: [
          () => ({
            UPSTREAM_RETRY_DELAY_MS: "0",
            CATALOG_CACHE_TTL_MS: "0",
            ...(options.config ?? {}),
          }),
        ],
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
  }).compile();

  const app = testModule.createNestApplication<NestExpressApplication>();
  useContainer(app, { fallbackOnErrors: true });
  await app.listen(0);
  return app;
}
