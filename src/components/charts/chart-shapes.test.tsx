// **T-C11 — chart-shape rules** (A12, R-V1, R-V2). Two claims, asserted differently.
//
// **No pie chart is imported anywhere.** A static assertion over the authored modules, because a
// rendering test cannot prove an absence across a codebase.
//
// **Stacking follows the partition, not the panel.** A chart stacks **if and only if** its
// ViewModel carries `stackable: true`. Table-driven over every grouping the product has, and the
// table is typed `Record<Grouping, boolean>`, so a grouping added to the domain layer fails to
// compile here until someone decides whether its geometry may assert a partition.
//
// This is the test that keeps R-V1's narrowing honest. Ticket 10 wrote the rule as "no stacking,
// anywhere" and `spec.md` § 11 C8 narrowed it to its own reasoning — *stacking encodes a
// partition; Team is not one* — because WorkType and the three duration spans **are** partitions
// and two shipped panels depend on stacking them (R-N8's fourth summary tile, R-N12 panel 6). A
// blanket `no stackId` assertion would have been easier and would have forbidden both. So the
// dangerous direction is asserted precisely: **Team never stacks, and a Team-grouped ViewModel
// carrying `stackable: true` is itself the failure.**
//
// The other half of the same rule — that the *domain layer* decides `stackable` correctly, and
// that `stackable({grouping: "team", ...})` is false for every measure and every partition flag —
// is `src/domain/viewmodel.test.ts`'s claim, over the real function. It has to be: a component
// test may not import `src/domain` at runtime (R-T6). Together they close the loop, and the
// static assertion below is what stops a panel from reaching around both.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Grouping } from "@/domain/viewmodel";
import { ChartFrame } from "./chart-frame";
import { CHART_SHAPES, STACKING_SHAPES, STACK_ID, stackIdOf } from "./chart-shapes";
import { chartFixture, MEMBER_SERIES } from "./chart-viewmodels.fixture";

const SIZE = { width: 640, height: 320 };

/**
 * **R-V1's table**, as `spec.md` § 6 states it. Exhaustive over `Grouping` by type, so this file
 * is where a new grouping's geometry gets decided rather than where it gets forgotten.
 */
const STACKABLE_BY_GROUPING: Readonly<Record<Grouping, boolean>> = {
  work_type: true,
  model: true,
  execution_mode: true,
  presence_span: true,
  machine_spec: true,
  cost_component: true,
  repository: false,
  team: false,
  member: false,
  organization: false,
  measure: false,
};

const GROUPINGS = Object.keys(STACKABLE_BY_GROUPING) as readonly Grouping[];

describe("T-C11 — a chart stacks if and only if its ViewModel says it may", () => {
  it.each(GROUPINGS)("%s", (grouping) => {
    const stackable = STACKABLE_BY_GROUPING[grouping];

    for (const shape of STACKING_SHAPES) {
      expect(stackIdOf({ shape, stackable })).toBe(stackable ? STACK_ID : undefined);
    }
  });

  it("never stacks a Team grouping", () => {
    expect(STACKABLE_BY_GROUPING.team).toBe(false);

    for (const shape of CHART_SHAPES) {
      expect(stackIdOf({ shape, stackable: STACKABLE_BY_GROUPING.team })).toBeUndefined();
    }
  });

  it("never stacks a non-partitioning grouping, whatever the shape", () => {
    const nonPartitions = GROUPINGS.filter((grouping) => !STACKABLE_BY_GROUPING[grouping]);

    expect(nonPartitions).toEqual(["repository", "team", "member", "organization", "measure"]);
    for (const grouping of nonPartitions) {
      for (const shape of CHART_SHAPES) {
        expect(stackIdOf({ shape, stackable: STACKABLE_BY_GROUPING[grouping] })).toBeUndefined();
      }
    }
  });

  // `stackable` is a permission, not an instruction (`viewmodel.ts`): a partition may be drawn
  // side by side. What it can never do is stack something that is not a partition.
  it("refuses to stack in the two shapes whose geometry cannot claim a part of a whole", () => {
    for (const shape of ["line", "grouped-bar"] as const) {
      expect(stackIdOf({ shape, stackable: true })).toBeUndefined();
    }
  });
});

describe("T-C11 — the absence assertions, over the chart modules", () => {
  const sources = import.meta.glob("../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  // Vite normalises a glob key relative to *this* file, so the chart modules come back as
  // `./name.tsx` and everything else as `../…`. They are globbed separately rather than
  // filtered out of the broad set, which would depend on that normalisation holding.
  const chartSources = import.meta.glob("./*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  const withoutTests = (entries: readonly (readonly [string, string])[]) =>
    entries.filter(([path]) => !path.includes(".test.") && !path.includes(".spec."));

  const chartModules = withoutTests(Object.entries(chartSources));
  const authored = [...withoutTests(Object.entries(sources)), ...chartModules];

  it("reads the whole of src, and the chart modules within it", () => {
    expect(authored.length).toBeGreaterThan(40);
    expect(chartModules.length).toBeGreaterThanOrEqual(5);
    expect(authored.map(([path]) => path)).toContain("../ui/chart.tsx");
  });

  // R-V2. Side-by-side charts and grouped bars are how a composition is shown here.
  it.each(authored)("%s imports no pie chart", (_path, source) => {
    expect(source).not.toMatch(/\bPie\b|\bPieChart\b/);
  });

  /**
   * The other end of the `if and only if`. `stackIdOf` is proved above; this proves it is the
   * only thing a Recharts mark can get a `stackId` from, so no panel and no shape can hard-code
   * one past it.
   */
  it.each(chartModules)("%s passes Recharts only the guarded stack id", (_path, source) => {
    const uses = source.match(/stackId=\{[^}]*\}/g) ?? [];

    for (const use of uses) expect(use).toBe("stackId={stackId}");
  });

  it("finds the guarded stack id actually in use", () => {
    const uses = chartModules.flatMap(([, source]) => source.match(/stackId=\{[^}]*\}/g) ?? []);

    expect(uses.length).toBeGreaterThan(0);
  });
});

describe("the five shapes render from a ViewModel and nothing else", () => {
  it.each(CHART_SHAPES)("%s draws every series the ViewModel carries", (shape) => {
    render(
      <ChartFrame
        chart={chartFixture({ series: MEMBER_SERIES, stackable: true })}
        shape={shape}
        dimension={SIZE}
      />,
    );

    expect(screen.getAllByLabelText(/legend icon/)).toHaveLength(MEMBER_SERIES.length);
    expect(screen.getByRole("application")).toBeInTheDocument();
  });
});
