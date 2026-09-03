import type { CodeErrorEnum } from "../../constants/code-error.enum";

export interface IHttpError {
  statusCode: number;
  error: string;
  message: string;
  code?: CodeErrorEnum;
}
