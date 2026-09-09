// How a figure on `/[org]/work` reads. **Formatting only** — no figure here is derived, compared,
// summed or ranked (R-T6); every function takes one number the domain layer already resolved and
// returns the string a reader sees.
//
// **Locale-pinned**, exactly as `table-mirror.tsx` and `data-table.tsx` pin theirs: a server's
// locale must not decide what a figure reads as, and the mirror is an assertion target (T-C1).
//
// **No decimal is printed anywhere.** Rates render as whole percentages and durations as whole
// hours and minutes. That is partly legibility — "86%" and "3 hr 10 min" are what the page is
// read in — and partly `e2e/payload.spec.ts`, which scans the *rendered* HTML as well as the
// flight payload for two-decimal cost literals: 57 of the fixture's session costs are under 1,
// so a rate printed as `0.86` would be a decimal in the money range with no way to tell it from
// a leak. A percentage cannot collide with one.
//
// The seconds → hours/minutes conversion is a unit, not a computation: seconds are the unit the
// domain layer stores a duration in (`duration.ts`), and hours and minutes are the unit a person
// reads one in. Nothing about which sessions were counted, or how, happens here.

/** A figure the ViewModel had nothing to put in — an empty population, never a zero. */
export const NO_FIGURE = "—";

const PERCENT = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

/** A share of one, as a whole percentage. `null` is *no population*, and reads as one. */
export const percentText = (share: number | null): string =>
  share === null ? NO_FIGURE : PERCENT.format(share);

export const countText = (value: number): string => COUNT.format(value);

/** A count the domain layer may have had no population for. `null` is an absence (R-M18). */
export const countOrAbsence = (value: number | null): string =>
  value === null ? NO_FIGURE : countText(value);

/** Seconds, in the units a reader reads a session in. `null` where there was no population. */
export function durationText(seconds: number | null): string {
  if (seconds === null) return NO_FIGURE;
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${countText(minutes)} min`;
  return rest === 0 ? `${countText(hours)} hr` : `${countText(hours)} hr ${countText(rest)} min`;
}

/** A measure-axis tick on a rate chart. Acceptance, Rework and Decomposition are all shares. */
export const percentTick = (value: number): string => PERCENT.format(value);

/** A measure-axis tick on a duration chart. Whole hours, for the reason at the top of the file. */
export const hoursTick = (value: number): string => `${countText(value / SECONDS_PER_HOUR)} hr`;
