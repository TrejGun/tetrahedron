import { HttpService } from "@nestjs/axios";
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
  HttpHealthIndicator,
} from "@nestjs/terminus";

@ApiTags("Health")
@Controller("/health")
export class HealthController {
  private readonly catalogBase: string;
  private readonly reservationsBase: string;
  private readonly pingTimeoutMs: number;

  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.catalogBase = configService.get<string>("CATALOG_BASE_URL", "http://127.0.0.1:4040");
    this.reservationsBase = configService.get<string>("RESERVATIONS_BASE_URL", "http://127.0.0.1:5050");
    this.pingTimeoutMs = ~~configService.get<string>("HEALTH_PING_TIMEOUT_MS", "1200");
  }

  @Get("/liveness")
  @ApiOperation({ summary: "Liveness check: process is up, no upstream calls" })
  @HealthCheck()
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      (): HealthIndicatorResult => ({
        schedulingApi: { status: "up" },
      }),
    ]);
  }

  @Get("/readiness")
  @ApiOperation({ summary: "Readiness check: catalog and reservations HTTP connectivity" })
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.ping("catalog", this.catalogBase),
      () => this.ping("reservations", this.reservationsBase),
    ]);
  }

  private ping(name: string, baseUrl: string): Promise<HealthIndicatorResult> {
    const url = `${baseUrl.replace(/\/$/, "")}/`;
    return this.http.responseCheck(name, url, response => response.status < 500, {
      timeout: this.pingTimeoutMs,
      httpClient: this.httpService,
    });
  }
}
