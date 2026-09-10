// The one clock read in the application, and the two answers derived from it.
//
// **`now` is the wall clock, clamped to the end of the observation window.** The clamp is a
// property of a fixture-backed deployment, and it is here rather than hidden because it is the
// difference between an artefact that still demonstrates `/demo/projection` next year and one
// that acquires a zero-data state R-E1 says it does not have.
//
// **The window is the declared window cut at `now`** (R-D2, ticket 62), so a period control can
// never offer a month the product has no data for yet and a date input's `max` can never be a
// day in the future. Asserted at three instants: inside the window, on its last day, and — the
// case ticket 66 creates — with the fixture running past `now`.
//
// **T-U23's other half — `dataAsOf` over the committed rows** (R-N3.1, A39). `observation.ts`
// proves the rule against constructed rows; this proves it against the data the product actually
// serves, which is what P6 asks of every unit target: the assertions below fail against a fixture
// whose last session moved, and could not pass against an empty one. Since ticket 62 the stamp
// reads the **slice**, so a `now` mid-window moves it back to a session that had finished by then
// — which is the whole claim, and it is asserted rather than described.

import { afterEach, describe, expect, it, vi } from "vitest";
import { latestObservation } from "@/domain/observation";
import { datasetAsOf } from "./as-of";
import { dataAsOf, observationWindow, requestNow } from "./clock";
import { instantIn } from "./instant";
import { loadDataset } from "./load";

const { organization } = loadDataset();

/** Midday UTC on the window's last day — what the clamp resolves to, and what e2e pins. */
const LAST_DAY = `${organization.window_end}T12:00:00.000Z`;

afterEach(() => {
  vi.useRealTimers();
  delete process.env.AGENT_DASH_NOW;
});

const nowAt = (instant: string): string => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
  return requestNow();
};

describe("observationWindow — the declared window, cut at `now` (R-D2)", () => {
  it("is the Organization's own window while `now` is on its last day", () => {
    expect(observationWindow(LAST_DAY)).toEqual({
      start: organization.window_start,
      end: organization.window_end,
    });
  });

  it("ends on the civil day `now` falls on, once the window runs past it", () => {
    // The case ticket 66 creates: a window declared past today. The end is the *current* civil
    // day, so no period option, no bucket and no date bound reaches a day with nothing in it.
    expect(observationWindow("2026-07-15T09:30:00Z")).toEqual({
      start: organization.window_start,
      end: "2026-07-15",
    });
  });

  it("reads the civil day in the Organization's timezone, not in UTC (R-M10)", () => {
    // 22:30Z on 14 July is already the 15th in Europe/Madrid. A UTC reading would cut the
    // window a day short and lose every session worked that evening.
    expect(observationWindow("2026-07-14T22:30:00Z").end).toBe("2026-07-15");
  });

  it("never inverts, however early `now` is pinned", () => {
    const before = observationWindow("2020-01-01T00:00:00Z");

    expect(before.end).toBe(organization.window_start);
    expect(before.start <= before.end).toBe(true);
  });
});

describe("requestNow", () => {
  it("is the wall clock inside the window", () => {
    expect(nowAt("2026-06-15T09:30:00Z")).toBe("2026-06-15T09:30:00.000Z");
  });

  it("is the window's last day once the wall clock has passed it", () => {
    expect(nowAt("2027-03-01T00:00:00Z")).toBe(LAST_DAY);
  });

  it("clamps to midday, so the ceiling falls on the window's last civil day in any zone", () => {
    const clamped = nowAt("2030-01-01T00:00:00Z");
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(
      new Date(clamped),
    );

    expect(local).toBe(organization.window_end);
  });

  it("takes `AGENT_DASH_NOW` in place of the wall clock (ticket 62)", () => {
    // The server-side pin e2e uses, so a suite asserting figures reads the same product every
    // day. It is never set in a committed production config; on Vercel the variable is absent.
    process.env.AGENT_DASH_NOW = "2026-06-01T08:00:00Z";

    expect(nowAt("2026-06-15T09:30:00Z")).toBe("2026-06-01T08:00:00.000Z");
  });

  it("clamps the override too — it stands in for the clock, it does not escape the ceiling", () => {
    process.env.AGENT_DASH_NOW = "2027-01-01T00:00:00Z";

    expect(nowAt("2026-06-15T09:30:00Z")).toBe(LAST_DAY);
  });

  it("ignores an override that is not an instant, leaving the wall clock standing", () => {
    process.env.AGENT_DASH_NOW = "yesterday afternoon";

    expect(nowAt("2026-06-15T09:30:00Z")).toBe("2026-06-15T09:30:00.000Z");
  });
});

describe("dataAsOf — R-N3.1's freshness stamp, over the committed fixture", () => {
  const asOf = dataAsOf(LAST_DAY);
  const { sessions } = datasetAsOf(LAST_DAY);

  it("reads the session that ended last, out of the rows observed by `now`", () => {
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

  it("never names a session that has not finished as of `now` (ticket 62)", () => {
    // The defect this closes: over the unsliced fixture the stamp named a session that ran on
    // until 01:15 the next morning, while every control beside it was bounded by `now`.
    expect(Date.parse(asOf?.observedTo ?? "")).toBeLessThanOrEqual(Date.parse(LAST_DAY));
    expect(Date.parse(asOf?.observedTo ?? "")).toBeGreaterThan(Date.parse(asOf?.instant ?? ""));
  });

  it("stays inside the observation window this request reads", () => {
    // The stamp is checked against `/demo/history`, whose date inputs carry that window as their
    // bounds (R-N20). A freshness claim past the window's end would contradict every control on
    // the page beside it — which is the reason it prints the start rather than the end instant.
    expect(asOf?.label.slice(0, 10) ?? "").toBe(observationWindow(LAST_DAY).end);
  });

  it("moves back with `now`, because it is read off the slice", () => {
    const midWindow = "2026-07-15T09:30:00Z";
    const earlier = dataAsOf(midWindow);
    const expected = latestObservation(datasetAsOf(midWindow).sessions);

    expect(earlier?.sessionId).toBe(expected?.sessionId);
    expect(earlier?.sessionId).not.toBe(asOf?.sessionId);
    expect(Date.parse(earlier?.observedTo ?? "")).toBeLessThanOrEqual(Date.parse(midWindow));
  });

  it("is the same string on every request at the same instant, because it reads no clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-05-05T00:00:00Z"));

    expect(dataAsOf(LAST_DAY)).toEqual(asOf);
  });
});
