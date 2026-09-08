// **The zero-denominator rule, expressed once** — ticket 40, `spec.md` R-M18. Tested by
// `ratio.test.ts`, and the function ticket 51's property 4 binds to.
//
// *A ratio with a zero denominator is `null`, never `0`.*
//
// A bucket that finished nothing has no Cost per completed Job. Drawn at zero it claims the work
// was free; drawn as a gap it claims nothing at all, which is the truth. The same reading applies
// to Cost per session over a week with no session, to an Acceptance rate for a WorkType that ran
// nothing, to the Rework and Decomposition rates over an empty Task population, to a per-capita
// figure over a population holding no seat, and to a Projection before any of the period has
// elapsed. Every one of them divides through here.
//
// **Why one function rather than nine guards.** Nine `denominator === 0 ? null : …` expressions
// are nine chances to write `: 0` instead, and a reviewer cannot tell by reading one of them
// whether the product's rule is what it says. With one expression the rule has a single site, a
// single test, and something for a property test to be about: *`ratio(n, d) === null` if and only
// if `d === 0`*, for every `n`. That biconditional is why there is deliberately **no** guard here
// for a `NaN` or infinite denominator — adding one would make the property false in the direction
// nobody could then state simply, and no measure in this product produces either (every
// denominator is a count of rows, of Members or of days, or an elapsed share in `0..1`).
//
// **It is not a formatter.** `null` reaches the surface as an em dash beside a reason, and that
// copy lives in `components/` (`figures.ts`, `work-format.ts`, `table-mirror.tsx`) exactly as R-V8's
// labels do. What crosses the seam is the absence itself, typed.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

/**
 * A reading that may not exist. `null` is *undefined over this population* — never zero, and
 * never a withheld grant, which is `TableCell`'s `null` and a different absence (R-A6).
 */
export type Ratio = number | null;

/**
 * **The rule.** `numerator / denominator`, or `null` where there is nothing to divide by.
 *
 * `-0 === 0` in JavaScript, so a negative zero denominator is caught by the same comparison and
 * cannot slip through to produce `-Infinity`.
 */
export const ratio = (numerator: number, denominator: number): Ratio =>
  denominator === 0 ? null : numerator / denominator;
