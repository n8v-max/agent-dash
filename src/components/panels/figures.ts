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
//     all. No compact notation for the same reason: `1.2M` contributes `1.2`, where the grouped
//     integer `1,234,567` carries no decimal point and cannot collide. `chart-shapes.tsx` and
//     `figures`' callers make the same choice.
//
// Money is the one place a decimal is unavoidable, and it is rendered at exactly two places
// because **an attributed figure is the bill, not an estimate of it** (R-V8/A17). Projected cost
// is `/demo/projection`'s panel and carries its own "estimated" marker there; nothing this module
// formats carries one.

import type { Change, ChangeShown } from "@/domain/change";
import type { FigureUnit } from "@/domain/viewmodel";

/** `null` is *withheld*, not zero (R-A6) — the em dash `data-table.tsx` renders. */
export const WITHHELD = "—";

/** The same value under the name the summary tiles reach for. */
export const NO_FIGURE = WITHHELD;

const WHOLE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const UP_TO_TWO = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const MONEY = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * One formatter per unit, as a total lookup rather than a switch: a `FigureUnit` the domain layer
 * adds is a type error here rather than a figure that silently renders as a bare number.
 *
 * The formatters are named bindings rather than inline arrows because two units share one of
 * them, and because `usd_per_task` is a domain key: as a property holding an identifier it is
 * data, where an inline function would make it a method name and a `naming-convention` error.
 */
const money = (value: number): string => `$${MONEY.format(value)}`;
const counted = (value: number): string => UP_TO_TWO.format(value);
const whole = (value: number): string => WHOLE.format(value);
const percent = (value: number): string => `${WHOLE.format(value * 100)}%`;
const seconds = (value: number): string => `${UP_TO_TWO.format(value)}s`;

const FORMATTERS: Readonly<Record<FigureUnit, (value: number) => string>> = {
  usd: money,
  usd_per_task: money,
  count: counted,
  tokens: whole,
  share: percent,
  seconds,
};

/** A figure, in its unit. `null` is the withheld em dash and never a zero. */
export const formatFigure = (value: number | null, unit: FigureUnit): string =>
  value === null ? WITHHELD : FORMATTERS[unit](value);

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
