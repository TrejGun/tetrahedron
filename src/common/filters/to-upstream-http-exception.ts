import { BadGatewayException, GatewayTimeoutException, HttpException, NotFoundException } from "@nestjs/common";
import { AxiosError, isAxiosError } from "axios";

export function toUpstreamHttpException(error: unknown): HttpException {
  if (!isAxiosError(error)) {
    return new BadGatewayException("Upstream error");
  }

  if (error.response?.status === 404) {
    return new NotFoundException();
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new GatewayTimeoutException("Upstream timeout");
  }

  return new BadGatewayException("Upstream error");
}

export function isUpstreamAxiosError(error: unknown): error is AxiosError {
  return isAxiosError(error);
}
