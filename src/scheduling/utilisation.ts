export interface IClippedInterval {
  start: Date;
  end: Date;
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

export function clipInterval(start: Date, end: Date, from: Date, to: Date): IClippedInterval | undefined {
  const clippedStart = start > from ? start : from;
  const clippedEnd = end < to ? end : to;
  if (!(clippedStart < clippedEnd)) {
    return undefined;
  }
  return { start: clippedStart, end: clippedEnd };
}

export function bookedMinutes(intervals: readonly IClippedInterval[]): number {
  return intervals.reduce((sum, interval) => sum + minutesBetween(interval.start, interval.end), 0);
}

export function busyMinutes(intervals: readonly IClippedInterval[]): number {
  if (intervals.length === 0) {
    return 0;
  }
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursorStart = sorted[0]!.start;
  let cursorEnd = sorted[0]!.end;
  let total = 0;
  for (const interval of sorted.slice(1)) {
    if (interval.start < cursorEnd) {
      if (interval.end > cursorEnd) {
        cursorEnd = interval.end;
      }
      continue;
    }
    total += minutesBetween(cursorStart, cursorEnd);
    cursorStart = interval.start;
    cursorEnd = interval.end;
  }
  return total + minutesBetween(cursorStart, cursorEnd);
}

export function peakConcurrency(intervals: readonly IClippedInterval[]): number {
  const events = intervals.flatMap(interval => [
    { at: interval.start.getTime(), delta: 1 },
    { at: interval.end.getTime(), delta: -1 },
  ]);
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let open = 0;
  let peak = 0;
  for (const event of events) {
    open += event.delta;
    if (open > peak) {
      peak = open;
    }
  }
  return peak;
}
