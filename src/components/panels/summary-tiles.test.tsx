// **The summary panel, asserted as a structure** — A1, R-N4, R-N5, R-N7, R-N8.
//
// T-E7 makes "four tiles and nothing else" a claim about the running page, and it is the right
// layer for it: only the real route can prove that no other panel reached the document. What is
// asserted here is what the *component* owes — that every tile it is handed becomes one tile,
// that the tile is a link to the evidence page the ViewModel named, that the change figure and
// its suppression are rendered as the domain layer decided them, and that the fourth tile's
// chart goes through `ChartFrame` and arrives stacked.
//
// **The ViewModels are literals.** `src/components/**` may import `src/domain` for types only
// (R-T6), so a component test cannot call `summaryPage()` to build its input and should not want
// to — what the ViewModel owes is `src/data`'s and `src/domain`'s claim, over the real functions.
//
// The chart is deliberately asserted through its R-X1 mirror and its R-X2 label rather than
// through SVG geometry: geometry is `chart-frame.test.tsx`'s subject and is where T-C0's fixed
// dimensions belong. What this file needs to know is that the chart is *there*, that it is the
// fourth tile's, and that it carries the WorkType grouping.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chartFixture } from "@/components/charts/chart-viewmodels.fixture";
import type { SummaryTile } from "@/data/queries";
import type { Change } from "@/domain/change";
import type { BucketViewModel, ChartViewModel } from "@/domain/viewmodel";
import { PERIOD_TESTID, SummaryTiles } from "./summary-tiles";

const SEPTEMBER: BucketViewModel = { key: "2026-09", label: "Sep 2026", partial: true };
const AUGUST: BucketViewModel = { key: "2026-08", label: "Aug 2026", partial: false };

const rose: Change = {
  shown: true,
  current: { key: "2026-09", value: 136, partial: true },
  prior: { key: "2026-08", value: 43, partial: false },
  absolute: 93,
  ratio: 2.1444,
  direction: "up",
  incomplete: true,
};

const fell: Change = { ...rose, absolute: -34, ratio: -0.6938, direction: "down" };

const noBasis: Change = {
  shown: false,
  reason: "prior-period-holds-nothing",
  message: "2026-08 holds nothing to compare 2026-09 against",
  current: { key: "2026-09", value: 3, partial: true },
  prior: { key: "2026-08", value: 0, partial: false },
  incomplete: true,
};

/** R-N8's tile chart: all five WorkTypes, no "Other", and a partition it may assert. */
const WORK_TYPE_MIX: ChartViewModel = chartFixture({
  title: "Completed Jobs by template",
  rollUpLevel: "WorkType",
  buckets: ["Aug 2026", "Sep 2026"],
  series: [
    { key: "implementation", label: "Implementation", values: [15, 6] },
    { key: "bugfix", label: "Bug fix", values: [17, 6] },
    { key: "refactor", label: "Refactor", values: [13, 2] },
    { key: "review", label: "Review", values: [7, 1] },
    { key: "deploy", label: "Deploy", values: [3, 0] },
  ],
  stackable: true,
});

const tile = (over: Partial<SummaryTile> & Pick<SummaryTile, "key" | "title">): SummaryTile => ({
  value: 1,
  unit: "count",
  caption: null,
  period: SEPTEMBER,
  change: fell,
  href: "/demo/work",
  chart: null,
  ...over,
});

/** The four tiles of R-N4, in the order the ViewModel builds them. */
const TILES: readonly SummaryTile[] = [
  tile({ key: "total-spend", title: "Total spend", value: 813.45, unit: "usd", href: "/demo/spend" }),
  tile({ key: "completed-tasks", title: "Completed Jobs", value: 15 }),
  tile({
    key: "cost-per-completed-task",
    title: "Cost per completed Job",
    value: 135.575,
    unit: "usd_per_task",
    href: "/demo/spend",
    change: rose,
  }),
  tile({
    key: "completed-tasks-by-work-type",
    title: "Completed Jobs by template",
    value: 15,
    chart: WORK_TYPE_MIX,
  }),
];

const tiles = () => screen.getAllByRole("listitem");

describe("R-N4 — four tiles, and one tile per tile the ViewModel carries", () => {
  it("renders one list item per tile and nothing else in the list", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(tiles()).toHaveLength(4);
  });

  it("renders the four titles in the ViewModel's order — the argument, in sequence", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Total spend",
      "Completed Jobs",
      "Cost per completed Job",
      "Completed Jobs by template",
    ]);
  });

  it("formats each figure in its own unit", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    expect(tiles()[0]).toHaveTextContent("$813.45");
    expect(tiles()[1]).toHaveTextContent("15");
    expect(tiles()[2]).toHaveTextContent("$135.58");
  });

  it("renders an undefined figure as a dash beside the metric module's own words", () => {
    const undefinedRatio = tile({
      key: "cost-per-completed-task",
      title: "Cost per completed Job",
      value: null,
      unit: "usd_per_task",
      caption: "No completed Job in Sep 2026 to divide by",
    });

    render(<SummaryTiles tiles={[undefinedRatio]} period={SEPTEMBER} />);

    expect(tiles()[0]).toHaveTextContent("—");
    expect(tiles()[0]).toHaveTextContent("No completed Job in Sep 2026 to divide by");
  });
});

describe("R-N5 — each tile is itself the link to the page carrying its evidence", () => {
  it("gives every tile exactly one link, pointing where the ViewModel said", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    const links = tiles().map((held) => within(held).getAllByRole("link"));

    expect(links.map((held) => held.length)).toEqual([1, 1, 1, 1]);
    expect(links.map(([link]) => link?.getAttribute("href"))).toEqual([
      "/demo/spend",
      "/demo/work",
      "/demo/spend",
      "/demo/work",
    ]);
  });
});

describe("R-N7 / R-M12 — the change figure, and its suppression", () => {
  it("renders the change as a whole percentage carrying its own sign", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    expect(tiles()[2]).toHaveTextContent("+214%");
    expect(tiles()[1]).toHaveTextContent("-69%");
  });

  it("renders the domain layer's words where the floor suppressed the figure", () => {
    render(<SummaryTiles tiles={[tile({ key: "k", title: "Total spend", change: noBasis })]} period={SEPTEMBER} />);

    expect(tiles()[0]).toHaveTextContent("2026-08 holds nothing to compare 2026-09 against");
    expect(tiles()[0]).not.toHaveTextContent("%");
  });
});

describe("R-N8 — the fourth tile is the WorkType mix, and only the fourth", () => {
  it("puts exactly one chart on the page, in the fourth tile", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    const charts = screen.getAllByRole("group", { name: /grouped by/ });

    expect(charts).toHaveLength(1);
    expect(tiles()[3]).toContainElement(charts[0] ?? null);
  });

  it("names the WorkType roll-up in the chart's label (R-X2) and mirrors all five (R-V4)", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    expect(screen.getByRole("group", { name: /grouped by WorkType/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["Period", "Implementation", "Bug fix", "Refactor", "Review", "Deploy"]);
  });
});

describe("R-N6 / R-E2 — the month is stated once, and its incompleteness with it", () => {
  it("names the reported month and flags it as partial", () => {
    render(<SummaryTiles tiles={TILES} period={SEPTEMBER} />);

    const line = screen.getByTestId(PERIOD_TESTID);

    expect(line).toHaveTextContent("Sep 2026");
    expect(line).toHaveTextContent("Partial month");
  });

  it("carries no partial flag on a finished month", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    const line = screen.getByTestId(PERIOD_TESTID);

    expect(line).toHaveTextContent("Aug 2026");
    expect(line).not.toHaveTextContent("Partial month");
  });
});
