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
// and one shipped panel depends on stacking them (R-N12 panel 6, the human-presence spans). A
// blanket `no stackId` assertion would have been easier and would have forbidden it. So the
// dangerous direction is asserted precisely: **Team never stacks, and a Team-grouped ViewModel
// carrying `stackable: true` is itself the failure.**
//
// The other half of the same rule — that the *domain layer* decides `stackable` correctly, and
// that `stackable({grouping: "team", ...})` is false for every measure and every partition flag —
// is `src/domain/viewmodel.test.ts`'s claim, over the real function. It has to be: a component
// test may not import `src/domain` at runtime (R-T6). Together they close the loop, and the
// static assertion below is what stops a panel from reaching around both.

import { render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Grouping } from "@/domain/viewmodel";
import { ChartFrame } from "./chart-frame";
import { BUCKET_TICK_INTERVAL, CHART_INTERPOLATION } from "./chart-config";
import {
  CHART_SHAPES,
  STACKING_SHAPES,
  STACK_ID,
  chartElementFor,
  chartRows,
  furnitureFor,
  shapeFor,
  stackIdOf,
  type ChartShape,
} from "./chart-shapes";
import { chartFixture, MEMBER_SERIES } from "./chart-viewmodels.fixture";
import { LEGEND_LABEL, LEGEND_LAYOUT } from "./series-legend";

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
 * **R-V11 — a chart inside a tile is a bare line.**
 *
 * The failure this pins is what `/demo/work`'s acceptance multiples shipped as: five 144px charts,
 * each carrying a tick strip, a dashed grid and a one-entry legend restating a heading two lines
 * above them, leaving the line itself perhaps forty pixels tall.
 *
 * **Asserted over the element tree rather than the DOM**, for the same reason the stack rule above
 * is asserted over `stackIdOf`: what R-V11 governs is *which marks the shape factory emits*, and
 * an SVG query would additionally depend on jsdom, on a dimension, and on Recharts' class names —
 * three ways for this test to go quiet without the rule being broken. The default arm is the
 * control: everything absent below is present when `bare` is off.
 */
describe("R-V11 — a tile chart carries no axes, no grid and no legend", () => {
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

// --- R-M18 — a gap in the data is a gap in the chart (ticket 40) ----------------------------
//
// A series point is `null` where the domain layer had no reading for that bucket: a ratio whose
// denominator was zero. Two things must then be true of the marks, and neither is a default to
// be trusted — a connected line invents the readings it spans, and a zero claims the measure was
// taken and came to nothing.

describe("R-M18 — a null reading breaks the line rather than being drawn", () => {
  /** Bucket 2 has no reading; buckets 1 and 3 do. The shape of every gap in the product. */
  const GAPPY = [{ key: "organization", label: "Equilibrio", values: [12, null, 30] }];

  const propsOf = (element: ReactElement): Record<string, unknown> =>
    element.props as Record<string, unknown>;

  /** Destructured rather than read off `.children`, which reads to a linter as a DOM node. */
  const childrenOf = (element: ReactElement): ReactNode => {
    const { children } = propsOf(element) as { readonly children?: ReactNode };
    return children;
  };

  /** The marks of a shape's chart element — every child carrying one of the series' keys. */
  const marksFor = (shape: ChartShape): readonly ReactElement[] => {
    const element = chartElementFor({
      chart: chartFixture({ series: GAPPY }),
      shape,
      tickFormat: (value: number) => String(value),
    });
    const keys = new Set(GAPPY.map((series) => series.key));

    return Children.toArray(childrenOf(element))
      .filter((child): child is ReactElement => isValidElement(child))
      .filter((child) => keys.has(String(propsOf(child).dataKey)));
  };

  it("passes the null through to the mark rather than coercing it to zero", () => {
    const rows = chartRows(chartFixture({ series: GAPPY }));

    expect(rows.map((row) => row.organization)).toEqual([12, null, 30]);
  });

  it.each(["line", "area"] as const)("%s carries connectNulls={false}", (shape) => {
    const marks = marksFor(shape);

    expect(marks).toHaveLength(1);
    for (const mark of marks) expect(propsOf(mark).connectNulls).toBe(false);
  });

  it("is never passed as anything but false, anywhere in the chart layer", () => {
    const sources = import.meta.glob("./*.tsx", { query: "?raw", import: "default", eager: true });
    const uses = Object.entries(sources)
      .filter(([path]) => !path.includes(".test."))
      .flatMap(([, source]) => String(source).match(/connectNulls=\{[^}]*\}/g) ?? []);

    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(use).toBe("connectNulls={false}");
  });
});

/**
 * **T-C18 — the chart's *form* decides its shape, and the query decides the form** (R-V12, A36).
 *
 * Asserted over `shapeFor`, the one expression that resolves it, for the same reason T-C11
 * asserts `stackIdOf` and T-C12 asserts `furnitureFor`: what R-V12 governs is which element the
 * shape factory emits, and an SVG query would additionally depend on jsdom, on a dimension and
 * on Recharts' class names. The `series` arm is the control — every shape a panel names survives
 * unchanged, so this is a rule about ranked charts and not a rule the product acquired by
 * accident.
 */
describe("T-C18 — a ranked ViewModel draws horizontal bars, whatever shape the panel named", () => {
  const RANKED = chartFixture({ form: "ranked", buckets: ["Apr 2026 – Sep 2026"] });
  const SERIES = chartFixture();

  it.each(CHART_SHAPES)("overrides `%s` on a ranked chart", (shape) => {
    expect(shapeFor(RANKED, shape)).toBe("horizontal-bar");
  });

  it.each(CHART_SHAPES)("leaves `%s` alone on a series chart", (shape) => {
    expect(shapeFor(SERIES, shape)).toBe(shape);
  });

  it("draws bars and no line where the panel asked for a line", () => {
    const element = chartElementFor({ chart: RANKED, shape: "line", tickFormat: String });
    const props = element.props as { readonly layout?: string; readonly children?: ReactNode };
    // Recharts' chart containers carry no `displayName`; their marks do, so the marks are the
    // handle. A `Bar` under a `layout="vertical"` chart is a horizontal bar and nothing else.
    const marks = Children.toArray(props.children).flatMap((child) =>
      isValidElement(child) ? [nameOf(child)] : [],
    );

    expect(props.layout).toBe("vertical");
    expect(marks).toContain("Bar");
    expect(marks).not.toContain("Line");
  });

  /**
   * A ranked chart holds exactly one bucket — the whole selected period — so its category axis
   * has one tick and carries no reading. It is hidden rather than drawn, which is what gives the
   * bars the width the 120px category gutter would otherwise reserve. The measure axis stays:
   * unlike R-N8's tile, a full-width panel is big enough to be read against a scale.
   */
  it("hides the one-tick category axis and keeps the measure axis", () => {
    const drawn = furnitureFor({ chart: RANKED, shape: "line", tickFormat: String });
    const axes = drawn.filter((mark) => nameOf(mark).endsWith("Axis"));

    expect(axes.map((axis) => (axis.props as { readonly hide?: boolean }).hide)).toEqual([
      false,
      true,
    ]);
    expect(drawn.map(nameOf)).toContain("Legend");
  });
});

/**
 * **T-C19 — one interpolation, declared once and overridden by nobody** (R-V13, A37).
 *
 * Three claims, and the third is the one worth the file. The constant is `linear`; the marks are
 * drawn with it; and **no other module in the product names a curve at all** — which is what
 * "no panel overrides it" means, asserted as an absence over the source rather than as a promise
 * from the panels. A rendering assertion alone would pass against a product where one panel had
 * quietly gone back to a spline, because that panel's chart is not the one rendered here.
 *
 * The absence is spelled as the *shape of the prop* — `type=` followed by a curve name — rather
 * than as the bare word, because `step`, `natural` and `linear` are English and appear in the
 * prose of modules that draw nothing.
 */
describe("T-C19 — every line and area is interpolated `linear` (R-V13)", () => {
  const propsOf = (element: ReactElement): Record<string, unknown> =>
    element.props as Record<string, unknown>;

  const childrenOf = (element: ReactElement): ReactNode => {
    const { children } = propsOf(element) as { readonly children?: ReactNode };
    return children;
  };

  const marksFor = (shape: "line" | "area"): readonly ReactElement[] => {
    const chart = chartFixture();
    const keys = new Set(chart.series.map((series) => series.key));
    const element = chartElementFor({ chart, shape, tickFormat: String });

    return Children.toArray(childrenOf(element))
      .filter((child): child is ReactElement => isValidElement(child))
      .filter((child) => keys.has(String(propsOf(child).dataKey)));
  };

  it("is `linear`, and the constant is what the product means by an interpolation", () => {
    expect(CHART_INTERPOLATION).toBe("linear");
  });

  it.each(["line", "area"] as const)("draws every %s mark with it", (shape) => {
    const marks = marksFor(shape);

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(propsOf(mark).type).toBe(CHART_INTERPOLATION);
  });

  it("is the only curve the chart layer names", () => {
    const sources = import.meta.glob("./*.tsx", { query: "?raw", import: "default", eager: true });
    const uses = Object.entries(sources)
      .filter(([path]) => !path.includes(".test."))
      .flatMap(([, source]) => String(source).match(/\btype=\{[^}]*\}/g) ?? []);

    expect(uses).toContain("type={CHART_INTERPOLATION}");
    for (const use of uses) expect(use).toBe("type={CHART_INTERPOLATION}");
  });

  it("and no module anywhere in src spells a curve of its own", () => {
    const everything = import.meta.glob("../../**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const chartLayer = import.meta.glob("./*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const modules = [...Object.entries(everything), ...Object.entries(chartLayer)].filter(
      ([path]) => !path.includes(".test.") && !path.includes(".spec."),
    );
    // Recharts' whole `CurveType` union, less `linear` itself, matched in the one position that
    // makes a string a curve: the `type` prop of a mark. Built from the list rather than written
    // as one alternation, so each pattern stays readable and the union is the thing under review.
    const CURVES = [
      "monotone",
      "monotoneX",
      "monotoneY",
      "basis",
      "basisClosed",
      "basisOpen",
      "natural",
      "step",
      "stepBefore",
      "stepAfter",
      "bump",
      "bumpX",
      "bumpY",
      "linearClosed",
    ];
    const namesACurve = (source: string): boolean =>
      CURVES.some((curve) => new RegExp(`type=["{']?\\s*["']?${curve}\\b`).test(source));

    expect(modules.length).toBeGreaterThan(40);
    for (const [path, source] of modules) {
      expect({ path, curve: namesACurve(String(source)) }).toEqual({ path, curve: false });
    }
  });
});

/**
 * **T-C22 — the two things that make a chart fit a phone** (R-V15, A40, ticket 46).
 *
 * The e2e sweep asserts the *consequence* — no route scrolls sideways at 390px — and a
 * consequence is satisfiable by accident. These are the two mechanisms behind it, each asserted
 * over the one expression that decides it, in the same shape as T-C11 over `stackIdOf` and T-C12
 * over `furnitureFor`.
 *
 * **The tick interval is asserted with its exclusion**, because the failure that matters is not
 * a crowded axis: it is a `horizontal-bar`'s category axis thinning, which deletes a bar's own
 * name while leaving the bar. That is a chart that lies, where a crowded axis is only a chart
 * that is hard to read, so the negative arm is the one carrying the weight.
 */
describe("T-C22 — the period axis thins and the legend wraps (R-V15)", () => {
  const CHART = chartFixture();

  const axesOf = (input: Parameters<typeof furnitureFor>[0]) =>
    furnitureFor(input).filter((mark) => nameOf(mark).endsWith("Axis"));

  const intervalOf = (axis: ReactElement): unknown =>
    (axis.props as { readonly interval?: unknown }).interval;

  it("is `equidistantPreserveStart`, so the labels that survive are evenly spaced", () => {
    // `preserveEnd` — Recharts' own default — also thins, but unevenly: it drops whichever
    // labels collide, which can leave three weeks at three different distances and read as
    // three arbitrary buckets rather than as a sampled axis.
    expect(BUCKET_TICK_INTERVAL).toBe("equidistantPreserveStart");
  });

  it.each(["line", "area", "bar", "grouped-bar"] as const)(
    "puts it on %s's period axis and on no other axis",
    (shape) => {
      const axes = axesOf({ chart: CHART, shape, tickFormat: String });
      const [bucket, measure] = axes;

      expect(axes).toHaveLength(2);
      expect(nameOf(bucket as ReactElement)).toBe("XAxis");
      expect(intervalOf(bucket as ReactElement)).toBe(BUCKET_TICK_INTERVAL);
      // The measure axis is numeric: its ticks are Recharts' own and thinning them would move
      // the scale rather than sample it.
      expect(intervalOf(measure as ReactElement)).toBeUndefined();
    },
  );

  it("leaves a horizontal bar's category axis alone, so no bar loses its name", () => {
    const axes = axesOf({ chart: CHART, shape: "horizontal-bar", tickFormat: String });

    for (const axis of axes) expect(intervalOf(axis)).toBeUndefined();
  });

  it("wraps the legend, so five entries at 390px keep all five names", () => {
    // Asserted on the **rendered markup** rather than on the constant, because the class has to
    // survive two things to do anything: `SeriesLegend` forwarding it, and `cn`'s Tailwind merge
    // against `ChartLegendContent`'s own `flex ... gap-4` row, which is what it overrides. The
    // row carries no role and no name of its own — the named `group` is the wrapper around it —
    // so the assertion reads the legend's markup instead of walking into it.
    render(<ChartFrame chart={CHART} shape="line" dimension={SIZE} />);

    const legend = screen.getByRole("group", { name: LEGEND_LABEL });

    expect(legend.innerHTML).toContain("flex-wrap");
    expect(LEGEND_LAYOUT).toContain("flex-wrap");
  });
});
