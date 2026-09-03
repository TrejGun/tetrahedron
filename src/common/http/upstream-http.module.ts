import { HttpModule } from "@nestjs/axios";
import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ConcurrencyLimitInterceptor } from "./concurrency-limit.interceptor";
import { SingleflightInterceptor } from "./singleflight.interceptor";
import { SlidingWindowRetryInterceptor, UPSTREAM_NAME } from "./sliding-window-retry.interceptor";

export interface IUpstreamHttpModuleOptions {
  name: string;
  baseUrlKey: string;
  defaultBaseUrl: string;
}

@Module({})
export class UpstreamHttpModule {
  static register(options: IUpstreamHttpModuleOptions): DynamicModule {
    @Module({
      imports: [
        HttpModule.registerAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            baseURL: configService.get<string>(options.baseUrlKey, options.defaultBaseUrl),
            timeout: ~~configService.get<string>("UPSTREAM_RETRY_DEADLINE_MS", "2000"),
            maxRedirects: 0,
          }),
        }),
      ],
      providers: [
        { provide: UPSTREAM_NAME, useValue: options.name },
        SlidingWindowRetryInterceptor,
        ConcurrencyLimitInterceptor,
        SingleflightInterceptor,
      ],
      exports: [HttpModule],
    })
    class ConfiguredUpstreamHttpModule {}

    return { module: ConfiguredUpstreamHttpModule };
  }
}
