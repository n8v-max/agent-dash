// The zero-denominator rule — ticket 40. Unit tests for the one expression every ratio in the
// product divides through, and the seed for ticket 51's property 4.

import { describe, expect, it } from "vitest";
import { ratio } from "./ratio";

describe("ratio", () => {
  it("divides where the denominator is not zero", () => {
    expect(ratio(10, 4)).toBe(2.5);
    expect(ratio(0, 4)).toBe(0);
  });

  it("is null over a zero denominator, never zero", () => {
    expect(ratio(120, 0)).toBeNull();
    // 0 ÷ 0 too: a bucket that spent nothing and finished nothing has no reading either.
    expect(ratio(0, 0)).toBeNull();
  });

  it("treats negative zero as zero, because it is", () => {
    expect(ratio(1, -0)).toBeNull();
  });

  it("is null iff the denominator is zero — ticket 51's property, over a fixed grid", () => {
    const numerators = [-3, 0, 1, 7.5, 1_000_000];
    const denominators = [-4, -1, 0, 1, 3, 250];

    for (const numerator of numerators) {
      for (const denominator of denominators) {
        expect(ratio(numerator, denominator) === null).toBe(denominator === 0);
      }
    }
  });

  it("does not round, clamp or floor a defined reading", () => {
    // Exactly representable, so the expectation is a literal rather than a tolerance.
    expect(ratio(3, 8)).toBe(0.375);
    expect(ratio(-9, 2)).toBe(-4.5);
  });
});
