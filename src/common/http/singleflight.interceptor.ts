import { HttpService } from "@nestjs/axios";
import { Injectable, OnModuleInit } from "@nestjs/common";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { axiosRequestKey, IDEMPOTENT_METHODS } from "./helpers";

type RetryConfig = AxiosRequestConfig & { retryCount?: number };

@Injectable()
export class SingleflightInterceptor implements OnModuleInit {
  private readonly inflight = new Map<string, Promise<AxiosResponse>>();

  constructor(private readonly httpService: HttpService) {}

  onModuleInit(): void {
    const axios = this.httpService.axiosRef;
    const originalRequest = axios.request.bind(axios);

    axios.request = ((config: AxiosRequestConfig) => {
      const method = (config.method ?? "get").toLowerCase();
      if (!IDEMPOTENT_METHODS.has(method) || (config as RetryConfig).retryCount) {
        return originalRequest(config);
      }

      const key = axiosRequestKey(axios, config);
      const existing = this.inflight.get(key);
      if (existing) {
        return existing;
      }

      const pending = originalRequest(config).finally(() => {
        this.inflight.delete(key);
      });
      this.inflight.set(key, pending);
      return pending;
    }) as typeof axios.request;
  }
}
