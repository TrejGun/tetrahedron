import { describe, expect, it } from "@jest/globals";

import { isoStartBeforeEnd, windowsOverlap } from "./windows-overlap";

describe("windowsOverlap", () => {
  const nine = new Date("2026-06-01T09:00:00Z");
  const ten = new Date("2026-06-01T10:00:00Z");
  const eleven = new Date("2026-06-01T11:00:00Z");
  const noon = new Date("2026-06-01T12:00:00Z");

  it("detects an interior overlap", () => {
    expect(windowsOverlap(nine, eleven, ten, noon)).toBe(true);
  });

  it("allows back-to-back half-open windows", () => {
    expect(windowsOverlap(nine, ten, ten, eleven)).toBe(false);
  });

  it("does not overlap a disjoint later window", () => {
    expect(windowsOverlap(nine, ten, eleven, noon)).toBe(false);
  });
});

describe("isoStartBeforeEnd", () => {
  it("accepts a strictly ordered ISO pair", () => {
    expect(isoStartBeforeEnd("2026-06-01T09:00:00Z", "2026-06-01T10:00:00Z")).toBe(true);
  });

  it("rejects equal, reversed, or unparseable instants", () => {
    expect(isoStartBeforeEnd("2026-06-01T10:00:00Z", "2026-06-01T10:00:00Z")).toBe(false);
    expect(isoStartBeforeEnd("2026-06-01T11:00:00Z", "2026-06-01T10:00:00Z")).toBe(false);
    expect(isoStartBeforeEnd("not-iso", "2026-06-01T10:00:00Z")).toBe(false);
  });
});
