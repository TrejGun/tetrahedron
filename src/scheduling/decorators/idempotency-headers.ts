import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { IDEMPOTENCY_KEY_HEADER } from "../dto/idempotency-key";
import type { IIdempotencyHeaders } from "../interfaces/index";

export const IdempotencyHeaders = createParamDecorator((_data: unknown, ctx: ExecutionContext): IIdempotencyHeaders => {
  const raw = ctx.switchToHttp().getRequest<Request>().headers[IDEMPOTENCY_KEY_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return { [IDEMPOTENCY_KEY_HEADER]: value };
});
