// **The dataset's own edge — the last session the platform observed** (R-N3.1).
//
// Every page states a period, and none of them states how *fresh* the rows behind it are. A
// reader cannot tell a quiet week from a stalled ingest, and the two are the same picture: an
// empty bucket at the right-hand end of a chart. The as-of stamp is the one fact that separates
// them, and this is where it is decided.
//
// **The edge is `ended_at`, not `started_at`.** A session's measures are observable at session
// end (`CONTEXT.md` § Session measures) — that is what makes a row immutable and every metric
// free of an as-of date — so the last thing the platform *knows* is the last session that
// finished, not the last one that began. The two are different rows in general: a long session
// started before a short one can finish after it. Ticket 55's ingest sketch needs exactly this
// instant as its watermark, which is why the observation carries the row rather than a string.
//
// **It carries `startedAt` as well, and that is the field the stamp prints.** `/demo/history`
// lists sessions by their start (R-N19) and the Organization's window is stated in civil dates
// ending on the last day work *began* (R-D2), so a stamp reading the end instant of the final
// session would name a moment past the window every other control on the page is bounded by —
// and would match no row on the page that exists to be checked against it. The **selection** is
// the ticket's rule; the **printing** is the History page's top row. Both fields are here so
// neither reading has to be recomputed by a caller.
//
// **Nothing here reads a clock** (P5), and nothing here takes one: the observation is a property
// of the rows, so it cannot drift with the day the product is looked at.

/** The minimum an observation needs. A full `AgentSession` satisfies it structurally. */
export type ObservedSession = {
  readonly id: string;
  readonly started_at: string;
  readonly ended_at: string;
};

/** The last session the dataset holds, and the two instants a caller reads off it. */
export type Observation = {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string;
};

/** An ISO 8601 instant in milliseconds, or `undefined`. `Date.parse` is arithmetic, not a clock. */
const instantOf = (text: string): number | undefined => {
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : at;
};

/**
 * **The dataset's edge** — the session with the greatest `ended_at`, or `null` where the rows
 * hold no readable one.
 *
 * Instants are compared as numbers rather than as strings: `2026-09-08T23:00:00Z` sorts after
 * `2026-09-08T23:30:00+02:00` lexicographically and is the *later* instant, so a string maximum
 * would answer with the wrong row for exactly the population R-D5 seeds. A genuine tie breaks by
 * id ascending, so the answer is one row and always the same row.
 *
 * A row whose `ended_at` is not an instant is skipped rather than ranked — the same rule
 * `periods.ts` and `efficacy.ts` apply, and for the same reason: an unreadable timestamp that
 * compared as a `NaN` would win or lose by accident.
 */
export function latestObservation(sessions: readonly ObservedSession[]): Observation | null {
  let best: { readonly row: ObservedSession; readonly at: number } | undefined;

  for (const row of sessions) {
    const at = instantOf(row.ended_at);
    if (at === undefined) continue;
    if (best === undefined || at > best.at || (at === best.at && row.id < best.row.id)) {
      best = { row, at };
    }
  }

  if (!best) return null;
  return {
    sessionId: best.row.id,
    startedAt: best.row.started_at,
    endedAt: best.row.ended_at,
  };
}
