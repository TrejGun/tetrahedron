import type { Response } from "express";
import { BaseExceptionFilter } from "@nestjs/core";
import {
  type ArgumentsHost,
  Catch,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { CodeErrorEnum } from "../constants/code-error.enum";
import { isUpstreamAxiosError, toUpstreamHttpException } from "./to-upstream-http-exception";

@Catch(Error)
export class HttpExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    if (isUpstreamAxiosError(exception)) {
      const mapped = toUpstreamHttpException(exception);
      this.logServerError(mapped);
      return super.catch(mapped, host);
    }

    if (exception instanceof HttpException) {
      if (exception instanceof NotFoundException) {
        if (exception.message.startsWith("Cannot")) {
          const error = new NotFoundException(CodeErrorEnum.PAGE_NOT_FOUND);
          const res = host.switchToHttp().getResponse<Response>();
          res.status(error.getStatus()).json(error.getResponse());
          return;
        }
      }
      this.logServerError(exception);
      return super.catch(exception, host);
    }

    this.logger.error(exception);
    return super.catch(new InternalServerErrorException(CodeErrorEnum.INTERNAL_SERVER_ERROR), host);
  }

  private logServerError(exception: HttpException): void {
    if (exception.getStatus() >= 500) {
      this.logger.error(exception);
    }
  }
}
