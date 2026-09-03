import { BeforeApplicationShutdown, Injectable } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { Server } from "node:http";

@Injectable()
export class DrainIdleConnections implements BeforeApplicationShutdown {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  beforeApplicationShutdown(): void {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer() as Server;
    server.closeIdleConnections?.();
  }
}
