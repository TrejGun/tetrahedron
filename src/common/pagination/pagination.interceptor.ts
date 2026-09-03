import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, type Observable } from "rxjs";

import type { IPaginationResult } from "./interfaces/index";

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<IPaginationResult<unknown>> {
    return next.handle().pipe(map(([rows, count]: [unknown[], number]) => ({ rows, count })));
  }
}
