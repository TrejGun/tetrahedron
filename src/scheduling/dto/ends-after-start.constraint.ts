import { ValidatorConstraint, type ValidatorConstraintInterface, type ValidationArguments } from "class-validator";

import { isoStartBeforeEnd } from "../windows-overlap";

export const ENDS_AFTER_START = "endsAfterStart";
export const ENDS_AFTER_START_MESSAGE = "endsAt must be after startsAt";

@ValidatorConstraint({ name: ENDS_AFTER_START, async: false })
export class EndsAfterStartConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { startsAt, endsAt } = args.object as { startsAt?: string; endsAt?: string };
    if (startsAt === undefined || endsAt === undefined) {
      return true;
    }
    return isoStartBeforeEnd(startsAt, endsAt);
  }

  defaultMessage(): string {
    return ENDS_AFTER_START_MESSAGE;
  }
}
