import { expect } from "@jest/globals";

import type { IValidationError } from "../common/errors/interfaces/validation-error";

export function expectDtoConstraint(body: IValidationError, property: string, constraint: string, text: string): void {
  expect(body).toMatchObject({ statusCode: 400, error: "Bad Request" });
  expect(body.message).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        property,
        constraints: expect.objectContaining({ [constraint]: text }),
      }),
    ]),
  );
}
