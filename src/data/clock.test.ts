// The one clock read in the application, and the decision recorded with it.
//
// **`now` is the wall clock, clamped to the end of the observation window.** The clamp is a
// property of a fixture-backed deployment, and it is here rather than hidden because it is the
// difference between an artefact that still demonstrates `/demo/projection` next year and one
// that acquires a zero-data state R-E1 says it does not have.
//
// **T-U23's other half — `dataAsOf` over the committed rows** (R-N3.1, A39). `observation.ts`
// proves the rule against constructed rows; this proves it against the data the product actually
// serves, which is what P6 asks of every unit target: the assertions below fail against a fixture
// whose last session moved, and could not pass against an empty one.

import { afterEach, describe, expect, it, vi } from "vitest";
import { dataAsOf, observationWindow, requestNow } from "./clock";
import { instantIn } from "./instant";
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

describe("dataAsOf — R-N3.1's freshness stamp, over the committed fixture", () => {
  const asOf = dataAsOf();
  const { sessions } = loadDataset();

  it("reads the session that ended last, out of the whole dataset", () => {
    const last = [...sessions].sort(
      (left, right) => Date.parse(left.ended_at) - Date.parse(right.ended_at),
    )[sessions.length - 1];

    expect(sessions.length).toBeGreaterThan(700);
    expect(asOf?.sessionId).toBe(last?.id);
    expect(asOf?.observedTo).toBe(last?.ended_at);
  });

  it("prints that session's start, in the Organization's timezone", () => {
    const printed = instantIn(organization.timezone);

    expect(asOf?.instant).toBe(sessions.find((row) => row.id === asOf?.sessionId)?.started_at);
    expect(asOf?.label).toBe(printed(asOf?.instant ?? ""));
    expect(asOf?.label).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("stays inside the Organization's own observation window", () => {
    // The stamp is checked against `/demo/history`, whose date inputs carry the window as their
    // bounds (R-N20). A freshness claim past `window_end` would contradict every control on the
    // page beside it — which is the reason it prints the start rather than the end instant.
    expect(asOf?.label.slice(0, 10) ?? "").toBe(organization.window_end);
    expect(Date.parse(asOf?.observedTo ?? "")).toBeGreaterThan(Date.parse(asOf?.instant ?? ""));
  });

  it("is the same string on every request, because it reads no clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-05-05T00:00:00Z"));

    expect(dataAsOf()).toEqual(asOf);
  });
});
