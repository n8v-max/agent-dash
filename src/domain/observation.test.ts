// **T-U23 — the dataset's own edge: the last session it observed** (R-N3.1, A39).
//
// The rule is "the greatest `ended_at`", and every case below is a way of getting that wrong:
// reading `started_at` instead (the two orders differ, and the fixture has a row that proves
// it), taking the last row of an already-ordered list (`load.ts` orders by `started_at`), or
// letting an unreadable timestamp win by sorting as a `NaN`.
//
// **No clock is read** (P5), here or in the module under test. The observation is a property of
// the rows, so it takes no `now` and cannot drift with the day the suite runs.

import { describe, expect, it } from "vitest";
import { latestObservation, type ObservedSession } from "./observation";

const row = (id: string, started: string, ended: string): ObservedSession => ({
  id,
  started_at: started,
  ended_at: ended,
});

describe("T-U23 — the latest observation is the greatest `ended_at`", () => {
  it("is the row that ended last, not the row that started last", () => {
    // The discriminating shape, and the committed fixture holds it: a long session started
    // before a short one and finished after it. Ordering on `started_at` picks the wrong row.
    const rows = [
      row("ses_long", "2026-09-08T20:00:00+02:00", "2026-09-09T01:15:00+02:00"),
      row("ses_short", "2026-09-08T23:00:00+02:00", "2026-09-08T23:30:00+02:00"),
    ];

    expect(latestObservation(rows)).toEqual({
      sessionId: "ses_long",
      startedAt: "2026-09-08T20:00:00+02:00",
      endedAt: "2026-09-09T01:15:00+02:00",
    });
  });

  it("does not depend on the order the rows arrive in", () => {
    const rows = [
      row("ses_a", "2026-04-12T09:00:00+02:00", "2026-04-12T10:00:00+02:00"),
      row("ses_c", "2026-09-08T09:00:00+02:00", "2026-09-08T10:00:00+02:00"),
      row("ses_b", "2026-06-01T09:00:00+02:00", "2026-06-01T10:00:00+02:00"),
    ];

    expect(latestObservation(rows)?.sessionId).toBe("ses_c");
    expect(latestObservation([...rows].reverse())?.sessionId).toBe("ses_c");
  });

  it("compares instants rather than strings, across two offsets", () => {
    // `+02:00` and `Z` are the same civil text and different instants. A lexicographic maximum
    // would take the later-looking string; the earlier instant is the one that ends last here.
    const rows = [
      row("ses_utc", "2026-09-08T20:00:00Z", "2026-09-08T23:00:00Z"),
      row("ses_madrid", "2026-09-08T21:00:00+02:00", "2026-09-08T23:30:00+02:00"),
    ];

    expect(latestObservation(rows)?.sessionId).toBe("ses_utc");
  });

  it("breaks a genuine tie by id, so the answer is one row and always the same row", () => {
    const rows = [
      row("ses_b", "2026-09-08T09:00:00+02:00", "2026-09-08T10:00:00+02:00"),
      row("ses_a", "2026-09-08T08:00:00+02:00", "2026-09-08T10:00:00+02:00"),
    ];

    expect(latestObservation(rows)?.sessionId).toBe("ses_a");
    expect(latestObservation([...rows].reverse())?.sessionId).toBe("ses_a");
  });

  it("skips a row carrying no readable instant rather than ranking it", () => {
    const rows = [
      row("ses_junk", "not-an-instant", "not-an-instant"),
      row("ses_real", "2026-09-08T09:00:00+02:00", "2026-09-08T10:00:00+02:00"),
    ];

    expect(latestObservation(rows)?.sessionId).toBe("ses_real");
  });

  it("has no observation over no rows, and none over rows it cannot read", () => {
    expect(latestObservation([])).toBeNull();
    expect(latestObservation([row("ses_junk", "", "")])).toBeNull();
  });
});
