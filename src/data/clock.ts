// The application's three answers to "when": the wall clock, the Organization's observation
// window, and the instant the data runs out. The first two are *inputs* to a query, and P5 makes
// an input an argument — `src/domain/**` may not read a clock at all, and `queries.ts` takes
// `now` on the `ControlSet`. The third is a reading of the loaded fixture and takes nothing.
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
// Not in `params.ts`: that module is pure and is imported by `src/domain`-adjacent tests that
// pin `now` themselves. This one is impure by definition.

import { latestObservation } from "@/domain/observation";
import type { PeriodRange } from "@/domain/periods";
import { instantIn } from "./instant";
import { loadDataset } from "./load";

/** The Organization's declared observation window — the default period of every page (R-C4). */
export const observationWindow = (): PeriodRange => {
  const { organization } = loadDataset();
  return { start: organization.window_start, end: organization.window_end };
};

/**
 * The instant every query on this request is read against, as an ISO 8601 string.
 *
 * The ceiling is **midday UTC on the window's last day**, not midnight: the window is stated in
 * civil dates in the Organization's timezone, and midday is the one instant that falls on the
 * same civil day in every zone the fixture could plausibly declare. An end-of-day ceiling in UTC
 * lands on the *following* local day in Europe/Madrid, which would silently move the projection
 * period's elapsed share.
 */
export const requestNow = (): string => {
  const { organization } = loadDataset();
  const wall = Date.now();
  const ceiling = Date.parse(`${organization.window_end}T12:00:00Z`);
  return new Date(Math.min(wall, ceiling)).toISOString();
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

export const dataAsOf = (): DataAsOf | null => {
  const { organization, sessions } = loadDataset();
  const observation = latestObservation(sessions);
  if (!observation) return null;

  return {
    sessionId: observation.sessionId,
    instant: observation.startedAt,
    observedTo: observation.endedAt,
    label: instantIn(organization.timezone)(observation.startedAt),
  };
};
