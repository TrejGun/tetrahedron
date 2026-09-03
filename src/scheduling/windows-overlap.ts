import { parseISO } from "date-fns";

/** Half-open windows `[start, end)` overlap when each starts before the other ends. Back-to-back is not an overlap. */
export function windowsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

/** Invalid ISO strings compare as false (`NaN < n` is false). */
export function isoStartBeforeEnd(start: string, end: string): boolean {
  return parseISO(start) < parseISO(end);
}
