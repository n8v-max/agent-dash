// How a resolved figure reads. **Copy and formatting, nothing else** (R-T6).
//
// The *unit* is a domain fact — `viewmodel.ts` says whether a number is money, a count, tokens
// or a ratio — and this module is the one place that decides what each of those looks like on
// screen. Nothing here sums, compares or derives a figure: every function takes one number the
// domain layer computed and returns a string.
//
// **Locale-pinned to `en-GB`**, exactly as `data-table.tsx` and `table-mirror.tsx` pin it: a
// server's locale must not decide what a figure reads as, and `e2e/support/costs.ts` builds
// T-E4's search set against that same pinning.
//
// **No compact notation, deliberately.** `1.2M` puts the literal `1.2` in the response payload,
// and T-E4 searches that payload for bare decimals that match an ungranted session cost. A
// grouped integer (`1,234,567`) carries no decimal point and cannot collide, so token volumes
// are written out in full and the money figures are the only decimals this page emits.
//
// **R-V8 / A17 — no "estimated" marker.** Every money figure this module formats is an
// attributed one (R-M3): a rate-carded session cost, already incurred. Projected cost is
// `/demo/projection`'s panel and carries its own marker there.

import type { Change } from "@/domain/change";
import type { FigureUnit } from "@/domain/viewmodel";

/** `null` is *withheld*, not zero (R-A6) — the same em dash `data-table.tsx` renders. */
export const WITHHELD = "—";

const WHOLE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const UP_TO_TWO = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const MONEY = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * One formatter per unit, as a total lookup rather than a switch: a `FigureUnit` the domain
 * layer adds is a type error here rather than a figure that silently renders as a bare number.
 *
 * The formatters are named bindings rather than inline arrows because two units share one
 * of them, and because `usd_per_task` is a domain key: as a property holding an identifier it is
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

/**
 * R-N7's period-over-period change, in words.
 *
 * `change.ratio` arrives as a fraction and `change.ts` says in terms that "formatting belongs
 * upstream", so turning `0.5` into `+50%` is this module's job and the sign is read off the
 * ratio rather than recomputed from the two figures. Where R-M12 suppressed the figure there is
 * no ratio to print and the domain layer's own sentence stands in its place.
 */
const signOf = (ratio: number): string => (ratio < 0 ? "−" : "+");

export const changeText = (change: Change): string =>
  change.shown
    ? `${signOf(change.ratio)}${WHOLE.format(Math.abs(change.ratio) * 100)}%`
    : change.message;

/**
 * The change, as a tile prints it. The comparison is *named* rather than left to be inferred:
 * "−95%" under a period label reads as a fact about that period until you know what it is
 * measured against. Direction carries no colour — a cost falling and output falling are the same
 * arrow, and the product does not tell a reader which of them is good news.
 */
export const changeCaption = (change: Change): string =>
  change.shown ? `${changeText(change)} on the prior period` : change.message;
