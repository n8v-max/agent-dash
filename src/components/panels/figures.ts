// How a resolved figure reads. **Copy and formatting, nothing else** (R-T6).
//
// The *unit* is a domain fact — `viewmodel.ts` settles the split this module lives on:
// *"Presentation formats it; the unit is a domain fact, because whether a number is money or a
// count is not a styling choice."* So what arrives here is a resolved `number | null` and a
// `FigureUnit`, and what leaves is a string. Nothing here filters, sums, compares or decides
// anything about a figure: the sign, the direction and the suppression were all settled in
// `src/domain/change.ts` and are carried, not recomputed.
//
// **Locale-pinned to `en-GB`**, exactly as `data-table.tsx` and `table-mirror.tsx` pin it: a
// server's locale must not decide what a figure reads as, and `e2e/support/costs.ts` builds
// T-E4's search set against that same pinning.
//
// **Decimal-free wherever it can be, and pinned where it cannot.** Two reasons, the second
// load-bearing:
//
//   * A number read in ten seconds should not ask anyone to parse a decimal (R-N4). A change of
//     −0.7% is "−1%" at a glance and nothing is lost.
//   * T-E4 scans the response payload for ungranted cost literals, and the search is over bare
//     decimals. A change rendered "0.7%" contributes the literal `0.7`, which is a real session
//     cost in the committed fixture — so it would fail T-E4 on a figure that is not a cost at
//     all. `chart-shapes.tsx` and `figures`' callers make the same choice.
//
// **Ticket 69 — tokens are the one exception, and it is a bounded one.** A token figure reads in
// K, M and B (`75K`, `1.3M`, `2.1B`) rather than as an eight-digit integer, because eight digits
// is not a figure anyone reads in ten seconds and a column of them compares nothing. That does
// put a decimal on screen — but never a *bare* one: a unit letter is always against it, and
// `e2e/support/costs.ts` excludes a decimal that a `K`, `M` or `B` sits on from its candidate
// cost literals, for the same reason it already excludes `gemini-3.1-pro`'s `3.1`. A leaked cost
// reaches the wire as `,24.39]`, `"24.39"` or `>24.39<` and still matches every one of those.
// The exclusion is written down in the scanner rather than worked around here, which is what
// makes compact notation available at all — and it is why this is the only unit that takes it.
//
// Money is the one place a decimal is unavoidable, and it is rendered at exactly two places
// because **an attributed figure is the bill, not an estimate of it** (R-V8/A17). Projected cost
// is `/demo/projection`'s panel and carries its own "estimated" marker there; nothing this module
// formats carries one.
//
// **Ticket 41 — this module owns the money formatter, and it is the only one.** Four renderings
// of the same figure had accumulated: this file's `$` + two decimals, `money-figure.tsx`'s
// `style: "currency"`, `projection-panel.tsx`'s own copy of the first, and — the one a reader
// actually noticed — `data-table.tsx`'s bare `maximumFractionDigits: 2`, which put the People
// table's Cost column on screen as `310.5` beside a summary tile reading `$310.50`. `usd` and
// `usdTick` below are what the other three now call, and a table column reaches them through its
// `unit` (`TableColumn.unit`, a domain fact) rather than by hard-coding a currency in a cell.
//
// `style: "currency"` is the surviving spelling because it is the one that cannot drift: the
// symbol, its position and the two decimals all come from the locale and the currency code
// rather than from a template literal that happens to agree with them today.

import type { Change, ChangeShown } from "@/domain/change";
import type { FigureUnit } from "@/domain/viewmodel";

/** `null` is *withheld*, not zero (R-A6) — the em dash `data-table.tsx` renders. */
export const WITHHELD = "—";

/** The same value under the name the summary tiles reach for. */
export const NO_FIGURE = WITHHELD;

const WHOLE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const UP_TO_TWO = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** The money formatter. Exactly two decimals, always, so a Cost column reads as one column. */
const MONEY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
});

/**
 * A measure-axis tick. **Whole dollars, and deliberately not compact.**
 *
 * Decimal-free for `chart-shapes.tsx`'s reason: a tick is serialised into the response payload
 * and `e2e/payload.spec.ts` searches that payload for two-decimal cost literals, so `$1,650`
 * cannot collide with a figure while `$1.65K` can. But *compact* and decimal-free together are
 * worse than either: Recharts' ticks at 550 / 1,100 / 1,650 / 2,200 render as "$1k, $2k, $2k",
 * two of them identical, and an axis with two ticks reading the same is unreadable. Grouped
 * thousands are decimal-free and never collapse.
 */
const MONEY_TICK = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

/**
 * **The token units** (ticket 69), largest first — the order `inTokenUnits` picks from.
 *
 * Uppercase and hand-rolled rather than `Intl`'s `notation: "compact"`, which is the obvious
 * spelling and the wrong one *at this locale*: `en-GB` compacts to `75k`, `1.2m` and `1bn`, and
 * `1bn` beside `1.2m` in one column reads as two different kinds of figure. The locale pinning is
 * not negotiable (it is what keeps a server's environment out of what a figure says), so the
 * suffix is the product's and only the mantissa is the locale's.
 *
 * **B, not `bn` and not T.** Above a trillion this reads `1,000B`, which is deliberate: the
 * product's whole committed fixture is under 1e9 tokens, and a fourth unit nobody will see is a
 * fourth thing a reader has to know.
 */
const TOKEN_BANDS = [
  { suffix: "B", scale: 1_000_000_000 },
  { suffix: "M", scale: 1_000_000 },
  { suffix: "K", scale: 1_000 },
] as const;

/** Below this a token count is small enough to read as itself. */
const SMALLEST_BAND = TOKEN_BANDS[TOKEN_BANDS.length - 1].scale;

/** One decimal while the mantissa has room for it, so `1.3M` is not flattened to `1M`. */
const MANTISSA = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** A mantissa of 10 or more has three digits of its own; a decimal on top of them is noise. */
const decimalsFor = (mantissa: number): number => (Math.abs(mantissa) < 10 ? 1 : 0);

/** An axis tick carries no decimal at all: four ticks of `1.2M / 1.4M` is a scale, not a reading. */
const noDecimals = (): number => 0;

const roundTo = (value: number, decimals: number): number => {
  const step = 10 ** decimals;
  return Math.round(value * step) / step;
};

/**
 * A token figure in the largest unit it is at least one of.
 *
 * **The recursion is the rounding rule, not a loop in disguise.** 999,999 tokens sit in the `K`
 * band, where the mantissa is 999.999 and rounds to a full thousand — and `1,000K` is a figure
 * nobody writes. So a mantissa that fills up re-reads in the band above, where it is `1M`. It can
 * recur at most twice, and never off the top: `B` is index 0 and has nothing to promote into.
 */
const banded = (value: number, index: number, decimals: (mantissa: number) => number): string => {
  const band = TOKEN_BANDS[index];
  const mantissa = roundTo(value / band.scale, decimals(value / band.scale));
  return Math.abs(mantissa) >= SMALLEST_BAND && index > 0
    ? banded(value, index - 1, decimals)
    : `${MANTISSA.format(mantissa)}${band.suffix}`;
};

const inTokenUnits = (value: number, decimals: (mantissa: number) => number): string => {
  if (Math.abs(value) < SMALLEST_BAND) return WHOLE.format(value);
  return banded(value, TOKEN_BANDS.findIndex((band) => Math.abs(value) >= band.scale), decimals);
};

/**
 * One formatter per unit, as a total lookup rather than a switch: a `FigureUnit` the domain layer
 * adds is a type error here rather than a figure that silently renders as a bare number.
 *
 * The formatters are named bindings rather than inline arrows because two units share one of
 * them, and because `usd_per_task` is a domain key: as a property holding an identifier it is
 * data, where an inline function would make it a method name and a `naming-convention` error.
 */
const money = (value: number): string => MONEY.format(value);
const counted = (value: number): string => UP_TO_TWO.format(value);
const percent = (value: number): string => `${WHOLE.format(value * 100)}%`;
const seconds = (value: number): string => `${UP_TO_TWO.format(value)}s`;
const tokens = (value: number): string => inTokenUnits(value, decimalsFor);

const FORMATTERS: Readonly<Record<FigureUnit, (value: number) => string>> = {
  usd: money,
  usd_per_task: money,
  count: counted,
  tokens,
  share: percent,
  seconds,
};

/** A figure, in its unit. `null` is the withheld em dash and never a zero. */
export const formatFigure = (value: number | null, unit: FigureUnit): string =>
  value === null ? WITHHELD : FORMATTERS[unit](value);

/**
 * **Money, and the only place in the product it is spelled.** `null` is *withheld* or *undefined*
 * — a figure with no Completed Job to divide by — and never a zero.
 */
export const usd = (value: number | null): string => formatFigure(value, "usd");

/** A money axis tick, in whole dollars. See `MONEY_TICK`. */
export const usdTick = (value: number): string => MONEY_TICK.format(value);

/**
 * **A token axis tick — the same units as the column, with no decimal at all** (ticket 69).
 *
 * An axis is read for its scale rather than for a value: four ticks reading `1.2M`, `1.4M`,
 * `1.6M`, `1.8M` spend three characters each restating the unit, and a tick is only ever a
 * position on the way to a figure the tooltip and the R-X1 mirror both carry exactly. It is a
 * separate export rather than an option on `formatFigure` because a tick is not a figure: no
 * column may reach it, and the withheld em dash has no meaning on an axis.
 */
export const tokensTick = (value: number): string => inTokenUnits(value, noDecimals);

/** The same function under the name the summary tiles reach for. */
export const figureText = formatFigure;

/**
 * The change figure. **`signDisplay: "exceptZero"` is the direction**, in the one form a screen
 * reader reads out correctly — the arrow beside it is decorative and carries `aria-hidden`.
 *
 * "exceptZero" rather than "always" because a change of nothing is not a positive one: a flat
 * period reads `0%`, not `+0%`.
 */
const CHANGE = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/**
 * R-N7's period-over-period change, in words.
 *
 * `change.ratio` arrives as a fraction and `change.ts` says in terms that "formatting belongs
 * upstream", so turning `0.5` into `+50%` is this module's job, and the sign comes from the
 * ratio rather than being recomputed from the two figures. Where R-M12's floor suppressed the
 * figure there is no ratio to print and the domain layer's own sentence stands in its place — so
 * this function cannot be the thing that prints "∞" or "NaN" where the floor said there is no
 * basis to compare against.
 */
export const changeText = (change: Change | ChangeShown): string =>
  change.shown ? CHANGE.format(change.ratio) : change.message;

/**
 * The change, as a tile prints it. The comparison is *named* rather than left to be inferred:
 * "−95%" under a period label reads as a fact about that period until you know what it is
 * measured against. Direction carries no colour — a cost falling and output falling are the same
 * arrow, and the product does not tell a reader which of them is good news.
 */
export const changeCaption = (change: Change): string =>
  change.shown ? `${changeText(change)} on the prior period` : change.message;
