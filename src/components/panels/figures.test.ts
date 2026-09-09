// The tile formatters — presentation, asserted as presentation.
//
// Two properties matter here and neither is arithmetic. **Every unit has a formatter**, because
// `FigureUnit` is a closed domain vocabulary and a tile handed an unformatted unit would print
// `[object Object]` rather than fail. And **the change is decimal-free**, which is a legibility
// choice (R-N4's ten-second read) that is simultaneously load-bearing for T-E4: a change of
// −0.7% rendered as `0.7` would put a literal into the payload that is a real session cost in
// the committed fixture, and the T-E4 scan cannot tell a percentage from a price.
//
// **Ticket 41 — one money formatter, and the People table reads it too.** `usd` was written three
// times in `src/components/panels/` (here, `money-figure.tsx`, `projection-panel.tsx`) and a
// fourth rendering — a bare `Intl.NumberFormat` in `data-table.tsx` — put the People table's Cost
// column on screen as `310.5` beside a tile reading `$310.50`. The tests below pin the one
// formatter that replaced them: a symbol, grouped thousands, and **exactly** two decimals, so a
// money figure is recognisable as money wherever it is rendered.

import { describe, expect, it } from "vitest";
import type { Change, ChangeShown } from "@/domain/change";
import type { FigureUnit } from "@/domain/viewmodel";
import { changeText, figureText, NO_FIGURE, usd, usdTick } from "./figures";

const shown = (ratio: number): ChangeShown => ({
  shown: true,
  current: { key: "2026-09", value: 3, partial: true },
  prior: { key: "2026-08", value: 1, partial: false },
  absolute: 2,
  ratio,
  direction: ratio > 0 ? "up" : "down",
  incomplete: true,
});

const suppressed: Change = {
  shown: false,
  reason: "prior-period-holds-nothing",
  message: "2026-08 holds nothing to compare 2026-09 against",
  current: { key: "2026-09", value: 3, partial: true },
  prior: { key: "2026-08", value: 0, partial: false },
  incomplete: true,
};

describe("figureText", () => {
  // Every member of `FigureUnit`, once. Exhaustiveness itself is the type's job — `FORMATTERS`
  // is a total `Record<FigureUnit, …>`, so a seventh unit does not compile until it is
  // formatted — and `src/components/**` may not import the vocabulary at runtime (R-T6).
  it.each<readonly [FigureUnit, number, string]>([
    ["usd", 813.45, "$813.45"],
    ["usd_per_task", 135.575, "$135.58"],
    ["count", 1500, "1,500"],
    // Written out in full, not compacted: `12.3m` would put the bare literal `12.3` in
    // the payload T-E4 scans, and the Tokens column is read by comparing Members.
    ["tokens", 12_345_678, "12,345,678"],
    ["share", 0.18, "18%"],
    ["seconds", 1234, "1,234s"],
  ])("formats %s", (unit, value, expected) => {
    expect(figureText(value, unit)).toBe(expected);
  });

  it("renders an undefined figure as a dash, never as zero", () => {
    expect(figureText(null, "usd_per_task")).toBe(NO_FIGURE);
  });
});

describe("usd — the one money formatter in the product (ticket 41)", () => {
  // The shape the People table's Cost cell is asserted against end to end:
  // `/^\$[\d,]+\.\d{2}$/`. Two decimals **always**, so `310.5` and `310` are not two different
  // kinds of figure on one column.
  it.each<readonly [number, string]>([
    [0, "$0.00"],
    [1.5, "$1.50"],
    [310, "$310.00"],
    [310.5, "$310.50"],
    [813.45, "$813.45"],
    [135.575, "$135.58"],
    [1_234_567.891, "$1,234,567.89"],
  ])("renders %d as money", (value, expected) => {
    expect(usd(value)).toBe(expected);
    expect(expected).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it("agrees with the `usd` and `usd_per_task` units, because it is the same formatter", () => {
    expect(usd(813.45)).toBe(figureText(813.45, "usd"));
    expect(usd(135.575)).toBe(figureText(135.575, "usd_per_task"));
  });

  it("renders a withheld figure as the dash, never as $0.00", () => {
    expect(usd(null)).toBe(NO_FIGURE);
  });

  // A measure-axis tick is decimal-free for `chart-shapes.tsx`'s reason: `e2e/payload.spec.ts`
  // scans the payload for two-decimal cost literals, and a tick is serialised into it.
  it("renders an axis tick in whole dollars, grouped and never compact", () => {
    expect(usdTick(1650)).toBe("$1,650");
    expect(usdTick(2200.4)).toBe("$2,200");
    expect(usdTick(1650)).not.toMatch(/\d\.\d/);
  });
});

describe("changeText", () => {
  it("carries the direction in the sign, which a screen reader reads out", () => {
    expect(changeText(shown(2.1444))).toBe("+214%");
    expect(changeText(shown(-0.6938))).toBe("-69%");
  });

  // The T-E4 property. `-0.7%` would contribute the literal `0.7`, which is a session cost in
  // the committed fixture and belongs to a Member the restricted account holds no scope over.
  it("rounds to whole percentages, so no change figure contributes a bare decimal", () => {
    const texts = [-0.00703, 0.004, 1.5551, -0.125].map((ratio) => changeText(shown(ratio)));

    expect(texts.filter((text) => /\d\.\d/.test(text))).toEqual([]);
    expect(texts).toEqual(["-1%", "0%", "+156%", "-13%"]);
  });

  it("is not expressible for a suppressed change", () => {
    // The union is the guard: a suppressed change carries no `ratio`, so the caller has
    // nothing to print and renders the domain layer's own words instead.
    expect(suppressed.shown).toBe(false);
    expect(suppressed).not.toHaveProperty("ratio");
  });
});
