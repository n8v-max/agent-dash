// **T-C3 — series identity is pinned across a roll-up switch** (A14, R-T8, R-V5).
//
// The most valuable component test in the suite, and the reason is specific. shadcn's vendored
// `chart.tsx` ships `key={index}` at two sites — `ChartLegendContent` and `ChartTooltipContent` —
// and with it live **React reconciles "Ada Lovelace" into "Platform" in place**: the legend's DOM
// node survives the switch and is re-used for a different series.
//
// Ticket 18 ran that experiment on `prototype/18-rollup-spike` (`c378fc9`) and found the reuse is
// **real but silent**: `firstNodeIdentical: true`, every surviving entry the same node object —
// and yet the label and the colour both updated, because `ChartLegendContent` writes both as
// controlled attributes on every render. Nothing errors, nothing looks wrong, and so nothing will
// ever surface it "on encounter" (R-T32). It stops being harmless the moment a legend entry
// carries anything React preserves across reuse — and `ChartConfig` already permits an `icon`
// component, which `chart-config.tsx` now supplies.
//
// Two further facts make this test the only guard there is. `react/no-array-index-key` is an
// error in this repo (R-T8), but ticket 17 global-ignores `src/components/ui/**` as vendored, so
// **lint cannot see the one file that commits the bug**. And the reuse is invisible to any
// assertion about rendered output. That leaves node identity, which is what this file asserts.
//
// **Written before patch 3 was applied, and it failed** — four reused legend nodes across the
// switch. It must fail again if `key={index}` is ever reintroduced.
//
// The switch is "20 series to 4" as the product actually performs it: R-V4 caps a 20-Member
// grouping at four named series plus "Other", so five entries become four Teams.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartFrame } from "./chart-frame";
import { chartFixture, MEMBER_HOLDS, MEMBER_SERIES, TEAM_SERIES } from "./chart-viewmodels.fixture";
import { LEGEND_LABEL } from "./series-legend";

// R-T29 / T-C0 — fixed numeric dimensions, never `initialDimension`.
const SIZE = { width: 640, height: 320 };

const BY_MEMBER = chartFixture({
  rollUpLevel: "Member",
  series: MEMBER_SERIES,
  holds: MEMBER_HOLDS,
});

const BY_TEAM = chartFixture({
  rollUpLevel: "Team",
  series: TEAM_SERIES,
  overlapNote: "3 Members belong to more than one Team; totals overlap.",
});

/** The four named Member series — the positions that exist on both sides of the switch. */
const MEMBER_LABELS = MEMBER_SERIES.filter((series) => series.key !== "other").map(
  (series) => series.label,
);
const TEAM_LABELS = TEAM_SERIES.map((series) => series.label);

const legend = () => screen.getByRole("group", { name: LEGEND_LABEL });

/** One legend entry, as the element the label is rendered in. Scoped, because the R-X1 mirror
 *  carries the same labels as column headings. */
const entries = (labels: readonly string[]): readonly HTMLElement[] =>
  labels.map((label) => within(legend()).getByText(label));

const mirrorHeadings = (): readonly (string | null)[] =>
  within(screen.getByRole("table"))
    .getAllByRole("columnheader")
    .map((cell) => cell.textContent);

describe("T-C3 — series identity across a roll-up switch", () => {
  it("gives every legend entry an identity a query can hold on to", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(within(legend()).getAllByLabelText(/legend icon/)).toHaveLength(
      MEMBER_SERIES.length,
    );
  });

  it("changes the legend entry set's identity, not just its length", () => {
    const { rerender } = render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);
    const before = entries(MEMBER_LABELS);

    rerender(<ChartFrame chart={BY_TEAM} shape="bar" dimension={SIZE} />);
    const after = entries(TEAM_LABELS);

    // The whole test. With `key={index}` live these are the same four DOM nodes, and the
    // failure reads as the Team labels now living in the Members' nodes — which is exactly the
    // reconciliation R-T8 forbids and patch 3 removes.
    const reused = after.filter((node) => before.includes(node));

    expect({ reconciledInPlace: reused.map((node) => node.textContent) }).toEqual({
      reconciledInPlace: [],
    });
  });

  it("changes the legend's length and labels too", () => {
    const { rerender } = render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(within(legend()).getAllByLabelText(/legend icon/)).toHaveLength(5);

    rerender(<ChartFrame chart={BY_TEAM} shape="bar" dimension={SIZE} />);

    expect(within(legend()).getAllByLabelText(/legend icon/)).toHaveLength(4);
    for (const label of TEAM_LABELS) expect(within(legend()).getByText(label)).toBeInTheDocument();
    expect(within(legend()).queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("changes the mirror's column headers in step with the legend", () => {
    const { rerender } = render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(mirrorHeadings()).toEqual(["Period", ...MEMBER_SERIES.map((s) => s.label)]);

    rerender(<ChartFrame chart={BY_TEAM} shape="bar" dimension={SIZE} />);

    expect(mirrorHeadings()).toEqual(["Period", ...TEAM_LABELS]);
  });
});
