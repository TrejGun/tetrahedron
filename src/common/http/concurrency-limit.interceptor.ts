import { HttpService } from "@nestjs/axios";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getAdapter, type InternalAxiosRequestConfig } from "axios";

import { Semaphore } from "./semaphore";

@Injectable()
export class ConcurrencyLimitInterceptor implements OnModuleInit {
  private readonly max: number;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.max = ~~configService.get<string>("UPSTREAM_MAX_CONCURRENT", "4");
  }

  onModuleInit(): void {
    if (this.max < 1) {
      return;
    }

    const axios = this.httpService.axiosRef;
    const dispatch = getAdapter(axios.defaults.adapter);
    const semaphore = new Semaphore(this.max);

    axios.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      semaphore.run(() => Promise.resolve(dispatch(config)));
  }
}
