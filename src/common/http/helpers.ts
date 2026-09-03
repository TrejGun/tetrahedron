import { BadGatewayException, BadRequestException } from "@nestjs/common";
import type { AxiosRequestConfig } from "axios";
import { isAxiosError } from "axios";
import type { ClassConstructor } from "class-transformer";

import { HttpValidationPipe } from "../http-validation.pipe";

const upstreamPipe = new HttpValidationPipe({
  forbidNonWhitelisted: false,
  forbidUnknownValues: false,
});

export const IDEMPOTENT_METHODS = new Set(["get", "head", "options"]);

export function axiosRequestKey(
  axios: { getUri: (config?: AxiosRequestConfig) => string },
  config: AxiosRequestConfig,
): string {
  const method = (config.method ?? "get").toLowerCase();
  return `${method} ${axios.getUri(config)}`;
}

export function isRetryableAxiosError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  const method = error.config?.method?.toLowerCase();
  if (!method || !IDEMPOTENT_METHODS.has(method)) {
    return false;
  }

  const status = error.response?.status;
  if (status !== undefined && status < 500) {
    return false;
  }

  if (error.code === "ERR_BAD_RESPONSE" && status === undefined) {
    return false;
  }

  if (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNRESET" ||
    error.code === "ERR_NETWORK"
  ) {
    return true;
  }

  if (status === undefined) {
    return true;
  }

  return status >= 500 && status < 600;
}

export interface ICanRetry {
  retryable: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  delayMs: number;
  deadlineAt: number;
  circuitOpen: boolean;
  now?: number;
}

export function canRetry(input: ICanRetry): boolean {
  if (!input.retryable || input.circuitOpen) {
    return false;
  }
  if (input.attemptsUsed >= input.maxAttempts) {
    return false;
  }
  const now = input.now ?? Date.now();
  return now + input.delayMs < input.deadlineAt;
}

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

export function isUncertainWrite(error: unknown): boolean {
  if (error instanceof BadGatewayException) {
    return true;
  }
  if (!isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  if (status !== undefined && status >= 400 && status < 500) {
    return false;
  }
  return true;
}

export async function parseUpstream<T extends object>(cls: ClassConstructor<T>, payload: unknown): Promise<T> {
  try {
    return (await upstreamPipe.transform(payload, { type: "body", metatype: cls })) as T;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new BadGatewayException("Malformed upstream payload");
    }
    throw error;
  }
}
