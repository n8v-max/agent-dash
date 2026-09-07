// The one place the application reads a clock, and the one place the observation window is
// named. Both are here because both are *inputs* to a query, and P5 makes an input an argument:
// `src/domain/**` may not read a clock at all, and `queries.ts` takes `now` on the `ControlSet`.
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

import type { PeriodRange } from "@/domain/periods";
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
