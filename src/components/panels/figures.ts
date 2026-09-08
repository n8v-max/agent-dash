// **Copy and formatting for a tile's figure and its change.** Presentation, and only presentation.
//
// `viewmodel.ts` settles the split this module lives on: *"Presentation formats it; the unit is a
// domain fact, because whether a number is money or a count is not a styling choice."* So what
// arrives here is a resolved `number | null` and a `FigureUnit`, and what leaves is a string.
// Nothing here filters, sums, compares or decides anything about a figure (R-T6) — the sign, the
// direction and the suppression were all decided in `src/domain/change.ts` and are carried.
//
// **Every formatter is decimal-free where it can be, and pinned where it cannot.** Two reasons,
// and the second is the load-bearing one:
//
//   * A number a viewer reads in ten seconds should not ask them to parse a decimal (R-N4's
//     ten-second read). A change of −0.7% is "−1%" at a glance and nothing is lost.
//   * `e2e/payload.spec.ts` (T-E4) scans the response payload for ungranted cost literals, and
//     the search is over **bare decimals**. A change ratio rendered as "0.7%" contributes the
//     literal `0.7` — which is a real session cost in the committed fixture and would fail T-E4
//     on a figure that is not a cost at all. `chart-shapes.tsx` makes the same choice for its
//     ticks and its fills, and for the same reason. Money is the one place a decimal is
//     unavoidable: a bill is a bill (R-V8), so it is rendered at exactly two places.
//
// Locales are pinned, exactly as `data-table.tsx` and `table-mirror.tsx` pin them: a server's
// locale must not decide what a figure reads as.

import type { ChangeShown } from "@/domain/change";
import type { FigureUnit } from "@/domain/viewmodel";

/** Money, at two places. An attributed figure is the bill, not an estimate of it (R-V8). */
const MONEY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Volumes, at a glance: `12M`, never `12.3M` — see the header on why the decimal is dropped. */
const COMPACT = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 0 });

const SHARE = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });

/**
 * The change figure. **`signDisplay: "exceptZero"` is the direction**, in the one form a screen
 * reader reads out correctly — the arrow beside it is decorative and carries `aria-hidden`.
 */
const CHANGE = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/** Durations, in the unit's own notation rather than a hand-glued suffix. */
const SECONDS = new Intl.NumberFormat("en-GB", {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  notation: "compact",
  maximumFractionDigits: 0,
});

/**
 * **Total over `FigureUnit`**, so a unit the domain layer adds cannot reach a tile unformatted:
 * the record is exhaustive by type, and a seventh unit would not compile until it is formatted.
 */
const FORMATTERS: Readonly<Record<FigureUnit, Intl.NumberFormat>> = {
  usd: MONEY,
  usd_per_task: MONEY,
  count: COUNT,
  tokens: COMPACT,
  share: SHARE,
  seconds: SECONDS,
};

/**
 * What stands where a figure would have been. Undefined is not zero, and the tile carries the
 * metric module's own words for why beside it (`TileViewModel.caption`).
 */
export const NO_FIGURE = "—";

export const figureText = (value: number | null, unit: FigureUnit): string =>
  value === null ? NO_FIGURE : FORMATTERS[unit].format(value);

/**
 * The change, as a percentage. **It takes `ChangeShown`, not `Change`** — `ratio` exists on one
 * arm of the union alone, so a suppressed change is not expressible here and this function
 * cannot be the thing that prints "∞" or "NaN" where R-M12's floor said there is no basis. The
 * caller renders `change.message` instead, in the domain layer's own words.
 */
export const changeText = (change: ChangeShown): string => CHANGE.format(change.ratio);
