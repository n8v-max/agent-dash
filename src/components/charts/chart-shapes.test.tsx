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
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Grouping } from "@/domain/viewmodel";
import { ChartFrame } from "./chart-frame";
import {
  CHART_SHAPES,
  chartRows,
  furnitureFor,
  STACKING_SHAPES,
  STACK_ID,
  stackIdOf,
} from "./chart-shapes";
import { chartFixture, MEMBER_SERIES } from "./chart-viewmodels.fixture";

/** A Recharts component's own name, which is what its element's type is identified by. */
const nameOf = (element: ReactElement): string => {
  const { type } = element;
  if (typeof type === "string") return type;
  const named = type as { readonly displayName?: string; readonly name?: string };
  return named.displayName ?? named.name ?? "";
};

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

/**
 * **R-V10 — a chart inside a tile is a bare line.**
 *
 * The failure this pins is what `/demo/work`'s acceptance multiples shipped as: five 144px charts,
 * each carrying a tick strip, a dashed grid and a one-entry legend restating a heading two lines
 * above them, leaving the line itself perhaps forty pixels tall.
 *
 * **Asserted over the element tree rather than the DOM**, for the same reason the stack rule above
 * is asserted over `stackIdOf`: what R-V10 governs is *which marks the shape factory emits*, and
 * an SVG query would additionally depend on jsdom, on a dimension, and on Recharts' class names —
 * three ways for this test to go quiet without the rule being broken. The default arm is the
 * control: everything absent below is present when `bare` is off.
 */
describe("R-V10 — a tile chart carries no axes, no grid and no legend", () => {
  const CHART = chartFixture({ series: MEMBER_SERIES.slice(0, 1) });

  /** The furniture `furnitureFor` puts in a chart, by Recharts component name. */
  const marksIn = (bare: boolean): readonly string[] =>
    furnitureFor({ chart: CHART, shape: "line", tickFormat: String, bare }).map(nameOf);

  it("draws all of it by default — the panel-sized chart is unchanged", () => {
    const drawn = marksIn(false);

    expect(drawn).toContain("CartesianGrid");
    expect(drawn).toContain("XAxis");
    expect(drawn).toContain("YAxis");
    expect(drawn).toContain("Legend");
    expect(drawn).toContain("Tooltip");
  });

  it("draws none of it at tile size, and still draws the line", () => {
    const drawn = marksIn(true);

    expect(drawn).not.toContain("CartesianGrid");
    expect(drawn).not.toContain("XAxis");
    expect(drawn).not.toContain("YAxis");
    expect(drawn).not.toContain("Legend");
    // The tooltip stays: what goes is the chrome, never the values or the way into them.
    expect(drawn).toContain("Tooltip");
  });

  it("still draws the series — `bare` reaches the furniture and not the marks", () => {
    render(<ChartFrame chart={CHART} shape="line" dimension={SIZE} bare />);

    expect(screen.getByRole("application")).toBeInTheDocument();
    // A legend entry is furniture and is gone; the mark it described is not.
    expect(screen.queryAllByLabelText(/legend icon/)).toEqual([]);
    expect(chartRows(CHART)).toHaveLength(CHART.buckets.length);
  });

  /** R-X1, R-X2 and R-X3 are `ChartFrame`'s, and `bare` reaches none of them. */
  it("keeps the mirror, the roll-up label and the accessibility layer", () => {
    render(<ChartFrame chart={CHART} shape="line" dimension={SIZE} bare />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /grouped by/ })).toBeInTheDocument();
    expect(screen.getByRole("application")).toBeInTheDocument();
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
