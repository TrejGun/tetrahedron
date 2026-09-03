import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

import type { IIdempotencyHeaders } from "../interfaces/index";
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_PATTERN } from "./idempotency-key";

export class IdempotencyHeadersDto implements IIdempotencyHeaders {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(IDEMPOTENCY_KEY_MAX_LENGTH)
  @Matches(IDEMPOTENCY_KEY_PATTERN)
  [IDEMPOTENCY_KEY_HEADER]?: string;
}
