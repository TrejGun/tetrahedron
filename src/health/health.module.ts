import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller";

@Module({
  imports: [
    TerminusModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        timeout: ~~configService.get<string>("HEALTH_PING_TIMEOUT_MS", "1200"),
        maxRedirects: 0,
      }),
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
