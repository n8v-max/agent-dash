// **T-C0, T-C1, T-C2, T-C10** — `ChartFrame`'s four responsibilities (R-T28), asserted.
//
// **T-C0 — fixed numeric dimensions, never `initialDimension`** (R-T29). shadcn's
// `ChartContainer` hard-codes `<ResponsiveContainer initialDimension={{width: 320, height: 200}}>`.
// That construct works in jsdom *today* and stops working the moment a `ResizeObserver` polyfill
// lands in `vitest.setup.ts`, and ticket 04 recorded that the resulting failure is confusing
// rather than loud. So every chart under test is given an explicit `dimension`, and this file
// asserts three things: the rendered surface carries those exact numbers rather than
// `initialDimension`'s, `ResizeObserver` is still absent from the environment, and no polyfill
// has appeared in the setup file. The second and third are the alarm.
//
// **T-C1 — the mirror is the assertion target** (R-X1, A15, P2). Chart output is asserted as a
// plain DOM table, with no SVG parsing. The mirror was summed out of the aggregation grid on a
// path that never read a `SeriesPoint` (R-T7), so comparing it to the series is a cross-check
// rather than one array printed twice.
//
// **T-C2 — the `aria-label` names the current roll-up level** (R-X2, A16), and changes with it.
//
// **T-C10 — "Other" is inert** (R-V6): not clickable, does not expand, and its tooltip lists what
// it holds.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartFrame, EMPTY_TEXT, chartAriaLabel } from "./chart-frame";
import { CHART_SHAPES } from "./chart-shapes";
import {
  chartFixture,
  MEMBER_HOLDS,
  MEMBER_SERIES,
  TEAM_SERIES,
} from "./chart-viewmodels.fixture";
import { LEGEND_LABEL } from "./series-legend";
import { NO_READING } from "./table-mirror";

const SIZE = { width: 640, height: 320 };

const BY_MEMBER = chartFixture({
  title: "Cost per session",
  rollUpLevel: "Member",
  series: MEMBER_SERIES,
  holds: MEMBER_HOLDS,
});

const frame = () => screen.getByRole("group", { name: chartAriaLabel(BY_MEMBER) });
const legend = () => screen.getByRole("group", { name: LEGEND_LABEL });

/** The mirror's body, as strings, exactly as a screen reader would read it out. */
const mirrorRows = (): readonly (readonly string[])[] =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [...within(row).getAllByRole("rowheader"), ...within(row).getAllByRole("cell")].map(
        (cell) => cell.textContent ?? "",
      ),
    );

describe("T-C0 — charts under test render at fixed numeric width/height", () => {
  it("renders at the dimension it was given, not at initialDimension's 320x200", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    // R-X3's `accessibilityLayer` is what puts `role="application"` on the surface.
    const surface = screen.getByRole("application");

    expect(surface).toHaveAttribute("width", "640");
    expect(surface).toHaveAttribute("height", "320");
  });

  // The alarm. `initialDimension`'s advantage evaporates the moment a polyfill lands, so its
  // absence is asserted rather than assumed.
  it("runs in an environment with no ResizeObserver", () => {
    expect(globalThis.ResizeObserver).toBeUndefined();
  });

  it("has no ResizeObserver polyfill in vitest.setup.ts", () => {
    const setup = import.meta.glob("../../../vitest.setup.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const sources = Object.values(setup);

    expect(sources).toHaveLength(1);
    expect(sources[0]).not.toContain("ResizeObserver");
  });
});

describe("T-C1 — every chart renders a visually-hidden table mirror", () => {
  it.each(CHART_SHAPES)("%s carries the mirror", (shape) => {
    render(<ChartFrame chart={BY_MEMBER} shape={shape} dimension={SIZE} />);

    const table = screen.getByRole("table");

    // Visually hidden, and still in the accessibility tree: `hidden` or `aria-hidden` would
    // satisfy the markup and remove the affordance R-X1 exists for.
    expect(table).toHaveClass("sr-only");
    expect(within(table).getByText(/Cost per session, grouped by Member/)).toBeInTheDocument();
  });

  it("names the bucket column and every series, in series order", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="line" dimension={SIZE} />);

    const headings = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);

    expect(headings).toEqual(["Period", ...MEMBER_SERIES.map((series) => series.label)]);
  });

  it("carries the values the rendered series carry, bucket by bucket", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    // The cross-check: the series' own points, read off the ViewModel the chart drew.
    const expected = BY_MEMBER.buckets.map((bucket, index) => [
      bucket.label,
      ...BY_MEMBER.series.map((series) => String(series.points[index]?.value)),
    ]);

    expect(mirrorRows()).toEqual(expected);
  });

  it("mirrors an inert Other column as a column like any other", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(
      within(screen.getByRole("table")).getByRole("columnheader", { name: "Other" }),
    ).toBeInTheDocument();
  });

  /**
   * **R-M18 — a cell with no reading is an em dash, never a zero** (ticket 40).
   *
   * The chart beside this table breaks its line at the same bucket (`connectNulls={false}`), and
   * the two have to make one claim: a week the restricted account finished no Job in has no Cost
   * per completed Job, so the table says so rather than saying the work was free.
   */
  it("prints an em dash where the chart has no reading, and zero where it has one", () => {
    const gappy = chartFixture({
      title: "Cost per completed Job",
      rollUpLevel: "Organization",
      buckets: ["Week 15, 2026", "Week 16, 2026", "Week 17, 2026"],
      series: [{ key: "organization", label: "Equilibrio", values: [null, 0, 14.83] }],
    });
    render(<ChartFrame chart={gappy} shape="line" dimension={SIZE} />);

    expect(mirrorRows()).toEqual([
      ["Week 15, 2026", NO_READING],
      // A measured zero is still a measurement, and stays a zero.
      ["Week 16, 2026", "0"],
      ["Week 17, 2026", "14.83"],
    ]);
  });
});

describe("T-C2 — every chart's aria-label names the current roll-up level", () => {
  it("names the level the ViewModel is rolled up to", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(frame()).toHaveAccessibleName("Cost per session, grouped by Member");
  });

  it("changes when the level changes", () => {
    const byTeam = chartFixture({
      title: "Cost per session",
      rollUpLevel: "Team",
      series: TEAM_SERIES,
    });
    const { rerender } = render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(screen.getByLabelText(/grouped by Member/)).toBeInTheDocument();

    rerender(<ChartFrame chart={byTeam} shape="bar" dimension={SIZE} />);

    expect(screen.getByLabelText(/grouped by Team/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/grouped by Member/)).not.toBeInTheDocument();
  });

  it("keeps the label on a chart a filter emptied", () => {
    const empty = chartFixture({ title: "Cost per session", rollUpLevel: "Team", series: [] });
    render(<ChartFrame chart={empty} shape="bar" dimension={SIZE} />);

    expect(screen.getByLabelText("Cost per session, grouped by Team")).toBeInTheDocument();
  });
});

describe("R-X3 — Recharts' accessibility layer is on", () => {
  it.each(CHART_SHAPES)("%s exposes a keyboard-reachable application surface", (shape) => {
    render(<ChartFrame chart={BY_MEMBER} shape={shape} dimension={SIZE} />);

    expect(screen.getByRole("application")).toHaveAttribute("tabindex", "0");
  });
});

describe("R-V9 — an emptied panel renders plain text, not a chart", () => {
  it("says so in words and draws nothing", () => {
    const empty = chartFixture({ series: [] });
    render(<ChartFrame chart={empty} shape="bar" dimension={SIZE} />);

    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("R-V3 — a Team grouping states the overlap in words", () => {
  it("renders the note the domain layer computed with the totals", () => {
    const note = "3 Members belong to more than one Team; totals overlap.";
    render(
      <ChartFrame
        chart={chartFixture({ rollUpLevel: "Team", series: TEAM_SERIES, overlapNote: note })}
        shape="bar"
        dimension={SIZE}
      />,
    );

    expect(screen.getByText(note)).toBeInTheDocument();
  });
});

describe("T-C10 — Other is inert", () => {
  const otherEntry = () => within(legend()).getByTitle(/^Other holds/);

  it("lists what it holds, as a tooltip", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(otherEntry()).toHaveAttribute("title", `Other holds ${MEMBER_HOLDS.join(", ")}`);
    for (const held of MEMBER_HOLDS) expect(otherEntry().title).toContain(held);
  });

  it("is not clickable and offers nothing to expand", () => {
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);

    expect(otherEntry()).not.toHaveAttribute("aria-expanded");
    expect(within(legend()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(legend()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(frame()).queryAllByRole("button")).toEqual([]);
  });

  it("does not expand when it is clicked", async () => {
    const user = userEvent.setup();
    render(<ChartFrame chart={BY_MEMBER} shape="bar" dimension={SIZE} />);
    const before = mirrorRows();

    await user.click(otherEntry());

    expect(within(legend()).getAllByLabelText(/legend icon/)).toHaveLength(MEMBER_SERIES.length);
    expect(mirrorRows()).toEqual(before);
    expect(within(legend()).queryByText(MEMBER_HOLDS[0] ?? "")).not.toBeInTheDocument();
  });
});
