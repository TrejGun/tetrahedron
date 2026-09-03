import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { metricsRegistry } from "./metrics";

@ApiTags("Metrics")
@Controller()
export class MetricsController {
  @Get("/metrics")
  @ApiOperation({ summary: "Prometheus scrape" })
  @Header("Content-Type", metricsRegistry.contentType)
  scrape(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
