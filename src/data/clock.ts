// The application's three answers to "when": the wall clock, the Organization's observation
// window, and the instant the data runs out. All three are *inputs* to a query, and P5 makes an
// input an argument — `src/domain/**` may not read a clock at all, and `queries.ts` takes `now` on
// the `ControlSet`. This module is where the one clock read happens and where the other two are
// derived from it.
//
// **`now` is the wall clock, clamped to the end of the observation window.** The committed
// fixture carries a 150-day window ending `2026-09-08`; an unclamped clock would, the day after
// it closes, put `/demo/projection` in a month holding no sessions and `/demo` on a summary
// month holding none either. R-E1 says there is no designed zero-data state, so an artefact
// that reads its own clock unclamped acquires one by simply being looked at later.
//
// The clamp is a property of a **fixture-backed** deployment, and it is written down rather than
// left implicit. Inside the window the product uses the real time of day; outside it, the product
// reports the last instant it has data for. Nothing downstream can tell the difference, because
// everything downstream takes `now` as an argument.
//
// **And `now` cuts the data, not just the calendar** (ticket 62). From ticket 66 the fixture runs
// past today, so the window the product *reads* is the declared window cut at `now` (R-D2) and the
// rows it reads are `datasetAsOf(now)`. Both are here, in one module, because a window whose end
// and a dataset whose edge came from two different clocks is exactly the disagreement the as-of
// stamp exists to make visible.
//
// Not in `params.ts`: that module is pure and is imported by `src/domain`-adjacent tests that
// pin `now` themselves. This one is impure by definition.

import { latestObservation } from "@/domain/observation";
import { civilDayIn, type PeriodRange } from "@/domain/periods";
import { datasetAsOf } from "./as-of";
import { instantIn } from "./instant";
import { loadDataset } from "./load";

/**
 * **The window the product reads: the Organization's declared window, cut at `now`** (R-D2,
 * ticket 62). The default period of every page (R-C4), the bound every `?from=`/`?to=` range is
 * clipped into, and the list `periodOptions` builds its months from — so cutting it here is what
 * stops the period menu offering a month that has not happened and the History date inputs
 * accepting a `max` in the future. One cut, read by all four.
 *
 * The end is the **civil day** `now` falls on in the Organization's timezone, because the window
 * is stated in civil dates and R-M10 puts every boundary in that zone: a UTC day would move the
 * cut by two hours in Europe/Madrid and drop a whole day's sessions on the far side of midnight.
 *
 * A `now` before the window even opens would invert the range, so the end never falls below the
 * start. That is only reachable through the `AGENT_DASH_NOW` override, and an inverted range is a
 * shape no caller below is built to read.
 */
export const observationWindow = (now: string): PeriodRange => {
  const { organization } = loadDataset();
  const today = civilDayIn(organization.timezone, now);
  const cut = today !== undefined && today < organization.window_end ? today : organization.window_end;
  return {
    start: organization.window_start,
    end: cut < organization.window_start ? organization.window_start : cut,
  };
};

/**
 * **A pinned `now`, for a test that needs the product to be the same product tomorrow.**
 *
 * Server-side only and never `NEXT_PUBLIC_`: it decides which rows exist, so a browser that could
 * set it could ask for rows the server means to withhold. `playwright.config.ts` sets it on the
 * `webServer` it spawns, and it is set in **no** committed production config — on Vercel the
 * variable is absent and the wall clock stands.
 *
 * A value that is not an instant is ignored rather than fatal: a mistyped debugging aid should
 * leave the product working, and the clamp below still bounds whatever survives.
 */
const wallClock = (): number => {
  const pinned = Date.parse(process.env.AGENT_DASH_NOW ?? "");
  return Number.isNaN(pinned) ? Date.now() : pinned;
};

/**
 * The instant every query on this request is read against, as an ISO 8601 string.
 *
 * The ceiling is **midday UTC on the window's last day**, not midnight: the window is stated in
 * civil dates in the Organization's timezone, and midday is the one instant that falls on the
 * same civil day in every zone the fixture could plausibly declare. An end-of-day ceiling in UTC
 * lands on the *following* local day in Europe/Madrid, which would silently move the projection
 * period's elapsed share.
 *
 * The ceiling applies to the override too. `AGENT_DASH_NOW` substitutes for the wall clock; it is
 * not a way past the clamp, because a pinned instant outside the window would reintroduce exactly
 * the zero-data state the clamp exists to prevent.
 */
export const requestNow = (): string => {
  const { organization } = loadDataset();
  const ceiling = Date.parse(`${organization.window_end}T12:00:00Z`);
  return new Date(Math.min(wallClock(), ceiling)).toISOString();
};

/**
 * **R-N3.1 — how fresh the data is**, as a fact rather than as a component's formatting of a date.
 *
 * The rule is `src/domain/observation.ts`'s: the session with the greatest `ended_at`, because a
 * session's measures are observable at session end and that is therefore the last thing the
 * platform knows. What the stamp *prints* is that session's **start**, in the Organization's
 * declared timezone (R-M10) and through the one instant formatter — so the string is, character
 * for character, the top row of `/demo/history` under its default newest-first sort, which is the
 * page a reader checks it against. Printing the end instant would name a moment past the
 * observation window every other control on the page is bounded by (R-D2).
 *
 * **It is read off `datasetAsOf(now)`, not off the whole fixture** (ticket 62). The stamp says
 * how fresh the rows behind the page are, so it has to be read off the rows behind the page: over
 * the unsliced dataset it would name a session that, as of `now`, has not finished — or, once the
 * fixture runs past today, one that has not started. That is the one claim on the toolbar a
 * reader is invited to check against `/demo/history`, and the check is only meaningful if both
 * sides read the same slice.
 *
 * `sessionId` and `endedAt` ride along because they are what ticket 55's ingest sketch needs — a
 * watermark is an end-of-observation and a row to resume from — and recomputing either from the
 * label would be parsing a display string back into a fact.
 *
 * **It is not viewer-scoped, and that is deliberate.** The stamp is a property of the
 * Organization's dataset, not a reading about any Member: it carries no cost, no name and no
 * count, in the same way the observation window above it does, and both accounts already see that
 * window in `/demo/history`'s date bounds. R-A6 governs figures reaching a payload; this is the
 * calendar the figures were taken over.
 */
export type DataAsOf = {
  /** The session the stamp was read off — ticket 55's row to resume from. */
  readonly sessionId: string;
  /** ISO 8601. The instant printed: the last observed session's start. */
  readonly instant: string;
  /** ISO 8601. The dataset's true watermark — the last instant anything finished. */
  readonly observedTo: string;
  /** The instant, in the Organization's timezone, spelled as `/demo/history` spells it. */
  readonly label: string;
};

export const dataAsOf = (now: string): DataAsOf | null => {
  const { organization, sessions } = datasetAsOf(now);
  const observation = latestObservation(sessions);
  if (!observation) return null;

  return {
    sessionId: observation.sessionId,
    instant: observation.startedAt,
    observedTo: observation.endedAt,
    label: instantIn(organization.timezone)(observation.startedAt),
  };
};
