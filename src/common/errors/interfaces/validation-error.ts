import type { ValidationError } from "class-validator";

export interface IValidationError {
  statusCode: 400;
  error: "Bad Request";
  message: ValidationError[];
}
