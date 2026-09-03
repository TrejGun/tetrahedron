import type { Request, Response } from "express";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { type Observable } from "rxjs";

import { httpRequestsTotal } from "./metrics";

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const path = (req.originalUrl ?? req.url).split("?")[0];

    if (path === "/" || path === "/metrics" || path.startsWith("/health") || path.startsWith("/swagger")) {
      return next.handle();
    }

    res.on("finish", () => {
      httpRequestsTotal.inc({ method: req.method, status: String(res.statusCode) });
    });

    return next.handle();
  }
}
