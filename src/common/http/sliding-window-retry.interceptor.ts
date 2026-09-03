import { HttpService } from "@nestjs/axios";
import {
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { upstreamCircuitOpen, upstreamRequestDuration, upstreamRetriesTotal } from "../../metrics/metrics";
import { canRetry, isRetryableAxiosError } from "./helpers";
import { SlidingWindow } from "./sliding-window";

export const UPSTREAM_NAME = "UPSTREAM_NAME";

type RetryConfig = InternalAxiosRequestConfig & {
  retryCount?: number;
  deadlineAt?: number;
  startedAt?: number;
};

@Injectable()
export class SlidingWindowRetryInterceptor implements OnModuleInit {
  private readonly logger = new Logger(SlidingWindowRetryInterceptor.name);
  private readonly window: SlidingWindow;
  private readonly maxAttempts: number;
  private readonly delayMs: number;
  private readonly deadlineMs: number;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
    @Inject(UPSTREAM_NAME) private readonly upstreamName: string,
  ) {
    this.maxAttempts = ~~configService.get<string>("UPSTREAM_RETRY_MAX_ATTEMPTS", "3");
    this.delayMs = ~~configService.get<string>("UPSTREAM_RETRY_DELAY_MS", "50");
    this.deadlineMs = ~~configService.get<string>("UPSTREAM_RETRY_DEADLINE_MS", "2000");
    this.window = new SlidingWindow(
      ~~configService.get<string>("UPSTREAM_RETRY_WINDOW_MS", "10000"),
      ~~configService.get<string>("UPSTREAM_RETRY_MAX_FAILURES", "8"),
    );
  }

  onModuleInit(): void {
    const axios = this.httpService.axiosRef;

    axios.interceptors.request.use(config => {
      if (this.window.isOpen()) {
        this.setCircuitGauge();
        throw new ServiceUnavailableException("Upstream circuit open");
      }

      const retryConfig = config as RetryConfig;
      retryConfig.deadlineAt ??= Date.now() + this.deadlineMs;
      const remaining = retryConfig.deadlineAt - Date.now();
      if (remaining <= 0) {
        throw new GatewayTimeoutException("Upstream deadline exceeded");
      }
      retryConfig.timeout = Math.min(retryConfig.timeout ?? remaining, remaining);
      retryConfig.startedAt = Date.now();
      this.setCircuitGauge();
      return retryConfig;
    });

    axios.interceptors.response.use(
      response => {
        this.observeAttempt(response.config as RetryConfig, response.status);
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as RetryConfig | undefined;
        if (!config) {
          return Promise.reject(error);
        }

        this.observeAttempt(config, error.response?.status ?? 0);

        const retryable = isRetryableAxiosError(error);
        if (retryable) {
          const wasOpen = this.window.isOpen();
          this.window.recordFailure();
          this.setCircuitGauge();
          if (!wasOpen && this.window.isOpen()) {
            this.logger.warn(`Circuit opened for ${axios.defaults.baseURL}`);
          }
        }

        const retryCount = config.retryCount ?? 0;
        const deadlineAt = config.deadlineAt ?? Date.now() + this.deadlineMs;
        if (
          !canRetry({
            retryable,
            attemptsUsed: retryCount + 1,
            maxAttempts: this.maxAttempts,
            delayMs: this.delayMs,
            deadlineAt,
            circuitOpen: this.window.isOpen(),
          })
        ) {
          return Promise.reject(error);
        }

        config.retryCount = retryCount + 1;
        config.deadlineAt = deadlineAt;
        const method = (config.method ?? "get").toUpperCase();
        upstreamRetriesTotal.inc({ upstream: this.upstreamName, method });
        this.logger.warn(`Retry ${method} ${axios.getUri(config)} attempt ${config.retryCount}`);
        if (this.delayMs > 0) {
          await new Promise(resolve => {
            setTimeout(resolve, this.delayMs);
          });
        }
        return axios.request(config);
      },
    );
  }

  private observeAttempt(config: RetryConfig, status: number): void {
    const startedAt = config.startedAt ?? Date.now();
    const method = (config.method ?? "get").toUpperCase();
    upstreamRequestDuration.observe(
      { upstream: this.upstreamName, method, status: String(status) },
      (Date.now() - startedAt) / 1000,
    );
    this.setCircuitGauge();
  }

  private setCircuitGauge(): void {
    upstreamCircuitOpen.set({ upstream: this.upstreamName }, this.window.isOpen() ? 1 : 0);
  }
}
