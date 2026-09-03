import { BadGatewayException, BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { isAxiosError } from "axios";

import { CodeErrorEnum } from "../common/constants/code-error.enum";
import type { IHttpError } from "../common/errors/interfaces/index";
import { isNotFound } from "../common/http/helpers";

type CatalogFailureCode =
  CodeErrorEnum.CATALOG_UNAVAILABLE | CodeErrorEnum.CATALOG_NOT_FOUND | CodeErrorEnum.MALFORMED_PAYLOAD;

function httpError(statusCode: number, error: string, message: string, code: CodeErrorEnum): IHttpError {
  return { statusCode, error, message, code };
}

function isMissingCatalog(error: unknown): boolean {
  return isNotFound(error) || error instanceof NotFoundException;
}

function catalogFailureCode(error: unknown): CatalogFailureCode | undefined {
  if (isMissingCatalog(error)) {
    return CodeErrorEnum.CATALOG_NOT_FOUND;
  }

  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 200 || (error.code === "ERR_BAD_RESPONSE" && status === undefined)) {
      return CodeErrorEnum.MALFORMED_PAYLOAD;
    }
    return CodeErrorEnum.CATALOG_UNAVAILABLE;
  }

  if (error instanceof BadGatewayException) {
    return CodeErrorEnum.MALFORMED_PAYLOAD;
  }
  if (error instanceof HttpException) {
    return CodeErrorEnum.CATALOG_UNAVAILABLE;
  }

  return undefined;
}

export function toHydrationFailedException(error: unknown): never {
  const mapped = catalogFailureCode(error);
  if (mapped === undefined) {
    throw error;
  }
  throw new BadGatewayException(httpError(502, "Bad Gateway", "Reservation hydration failed", mapped));
}

export function toWriteResourceError(error: unknown): never {
  if (isMissingCatalog(error)) {
    throw new BadRequestException(
      httpError(400, "Bad Request", "Catalog resource not found", CodeErrorEnum.RESOURCE_NOT_FOUND),
    );
  }
  const mapped = catalogFailureCode(error);
  if (mapped === undefined) {
    throw error;
  }
  throw new BadGatewayException(httpError(502, "Bad Gateway", "Catalog resource could not be loaded", mapped));
}

export function toReadResourceError(error: unknown): never {
  if (isMissingCatalog(error)) {
    throw new NotFoundException();
  }
  throw toWriteResourceError(error);
}
