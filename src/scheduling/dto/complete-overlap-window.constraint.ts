import { ValidatorConstraint, type ValidatorConstraintInterface, type ValidationArguments } from "class-validator";

import { isoStartBeforeEnd } from "../windows-overlap";

@ValidatorConstraint({ name: "completeOverlapWindow", async: false })
export class CompleteOverlapWindowConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { from, to } = args.object as { from?: string; to?: string };
    if (from === undefined && to === undefined) {
      return true;
    }
    if (from === undefined || to === undefined) {
      return false;
    }
    return isoStartBeforeEnd(from, to);
  }

  defaultMessage(): string {
    return "from and to must both be present as ISO-8601 instants with from < to";
  }
}
