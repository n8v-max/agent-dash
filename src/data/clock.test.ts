// The one clock read in the application, and the decision recorded with it.
//
// **`now` is the wall clock, clamped to the end of the observation window.** The clamp is a
// property of a fixture-backed deployment, and it is here rather than hidden because it is the
// difference between an artefact that still demonstrates `/demo/projection` next year and one
// that acquires a zero-data state R-E1 says it does not have.

import { afterEach, describe, expect, it, vi } from "vitest";
import { observationWindow, requestNow } from "./clock";
import { loadDataset } from "./load";

const { organization } = loadDataset();

afterEach(() => {
  vi.useRealTimers();
});

const nowAt = (instant: string): string => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
  return requestNow();
};

describe("observationWindow", () => {
  it("is the Organization's declared window, not a literal", () => {
    expect(observationWindow()).toEqual({
      start: organization.window_start,
      end: organization.window_end,
    });
  });
});

describe("requestNow", () => {
  it("is the wall clock inside the window", () => {
    expect(nowAt("2026-06-15T09:30:00Z")).toBe("2026-06-15T09:30:00.000Z");
  });

  it("is the window's last day once the wall clock has passed it", () => {
    expect(nowAt("2027-03-01T00:00:00Z")).toBe(`${organization.window_end}T12:00:00.000Z`);
  });

  it("clamps to midday, so the ceiling falls on the window's last civil day in any zone", () => {
    const clamped = nowAt("2030-01-01T00:00:00Z");
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(
      new Date(clamped),
    );

    expect(local).toBe(organization.window_end);
  });
});
