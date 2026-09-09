// **The summary panel, asserted as a structure** — A1, R-N4, R-N5, R-N7, R-N8.
//
// T-E7 makes "four tiles and nothing else" a claim about the running page, and it is the right
// layer for it: only the real route can prove that no other panel reached the document. What is
// asserted here is what the *component* owes — that every tile it is handed becomes one tile,
// that the tile is a link to the evidence page the ViewModel named, that the change figure and
// its suppression are rendered as the domain layer decided them, and that the breakdown tile's
// chart goes through `ChartFrame` and arrives unstacked.
//
// **The ViewModels are literals.** `src/components/**` may import `src/domain` for types only
// (R-T6), so a component test cannot call `summaryPage()` to build its input and should not want
// to — what the ViewModel owes is `src/data`'s and `src/domain`'s claim, over the real functions.
//
// The chart is deliberately asserted through its R-X1 mirror and its R-X2 label rather than
// through SVG geometry: geometry is `chart-frame.test.tsx`'s subject and is where T-C0's fixed
// dimensions belong. What this file needs to know is that the chart is *there*, that it is the
// breakdown tile's, and that it carries the WorkType grouping.

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
  current: { key: "2026-08", value: 136, partial: false },
  prior: { key: "2026-07", value: 43, partial: false },
  absolute: 93,
  ratio: 2.1444,
  direction: "up",
  incomplete: false,
};

const fell: Change = { ...rose, absolute: -34, ratio: -0.6938, direction: "down" };

const noBasis: Change = {
  shown: false,
  reason: "prior-period-holds-nothing",
  message: "2026-07 holds nothing to compare 2026-08 against",
  current: { key: "2026-08", value: 3, partial: false },
  prior: { key: "2026-07", value: 0, partial: false },
  incomplete: false,
};

/** C13 as ticket 39 amended it: the month on screen is a fragment, so there is no figure. */
const unfinished: Change = {
  shown: false,
  reason: "current-period-incomplete",
  message: "2026-09 is unfinished, so no change is shown against 2026-08",
  current: { key: "2026-09", value: 20, partial: true },
  prior: { key: "2026-08", value: 80, partial: false },
  incomplete: true,
};

/**
 * R-N8's tile chart after C11: all five WorkTypes, no "Other", **one bucket** — the reported
 * month — and `stackable: false`, because WorkType partitions sessions and this tile counts
 * Tasks. The series are in R-V5's ranked order, which at one bucket is "longest first".
 */
const WORK_TYPE_MIX: ChartViewModel = chartFixture({
  title: "Completed Jobs by template",
  rollUpLevel: "WorkType",
  buckets: ["Aug 2026"],
  series: [
    { key: "bugfix", label: "Bug fix", values: [58] },
    { key: "implementation", label: "Implementation", values: [35] },
    { key: "refactor", label: "Refactor", values: [32] },
    { key: "review", label: "Review", values: [25] },
    { key: "deploy", label: "Deploy", values: [12] },
  ],
  stackable: false,
});

type FigureTile = Extract<SummaryTile, { kind: "figure" }>;

const tile = (over: Partial<FigureTile> & Pick<FigureTile, "key" | "title">): SummaryTile => ({
  kind: "figure",
  value: 1,
  unit: "count",
  caption: null,
  period: AUGUST,
  change: fell,
  href: "/demo/work",
  ...over,
});

/**
 * The four tiles of R-N4, in the order the ViewModel builds them — **the breakdown third**
 * (ticket 39), beside the count it breaks down.
 *
 * Over a *finished* month, so the change figures are shown: under C13 as amended, a part-month
 * suppresses all three, and the tiles that assert formatting need a figure to format.
 */
const TILES: readonly SummaryTile[] = [
  tile({ key: "total-spend", title: "Total spend", value: 813.45, unit: "usd", href: "/demo/spend" }),
  tile({ key: "completed-tasks", title: "Completed Jobs", value: 137 }),
  {
    kind: "breakdown",
    key: "completed-tasks-by-work-type",
    title: "Completed Jobs by template",
    href: "/demo/work",
    period: AUGUST,
    chart: WORK_TYPE_MIX,
  },
  tile({
    key: "cost-per-completed-task",
    title: "Cost per completed Job",
    value: 135.575,
    unit: "usd_per_task",
    href: "/demo/spend",
    change: rose,
  }),
];

/** The same four over the month in progress: every figure tile's change is withheld (C13). */
const PARTIAL_TILES: readonly SummaryTile[] = TILES.map((held) =>
  held.kind === "breakdown"
    ? { ...held, period: SEPTEMBER }
    : { ...held, period: SEPTEMBER, change: unfinished },
);

const tiles = () => screen.getAllByRole("listitem");

describe("R-N4 — four tiles, and one tile per tile the ViewModel carries", () => {
  it("renders one list item per tile and nothing else in the list", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(tiles()).toHaveLength(4);
  });

  it("renders the four titles in the ViewModel's order — the argument, in sequence", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Total spend",
      "Completed Jobs",
      "Completed Jobs by template",
      "Cost per completed Job",
    ]);
  });

  it("formats each figure in its own unit", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(tiles()[0]).toHaveTextContent("$813.45");
    expect(tiles()[1]).toHaveTextContent("137");
    expect(tiles()[3]).toHaveTextContent("$135.58");
  });

  it("renders an undefined figure as a dash beside the metric module's own words", () => {
    const undefinedRatio = tile({
      key: "cost-per-completed-task",
      title: "Cost per completed Job",
      value: null,
      unit: "usd_per_task",
      caption: "No completed Job in Aug 2026 to divide by",
    });

    render(<SummaryTiles tiles={[undefinedRatio]} period={AUGUST} />);

    expect(tiles()[0]).toHaveTextContent("—");
    expect(tiles()[0]).toHaveTextContent("No completed Job in Aug 2026 to divide by");
  });
});

describe("R-N5 — each tile is itself the link to the page carrying its evidence", () => {
  it("gives every tile exactly one link, pointing where the ViewModel said", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    const links = tiles().map((held) => within(held).getAllByRole("link"));

    expect(links.map((held) => held.length)).toEqual([1, 1, 1, 1]);
    expect(links.map(([link]) => link?.getAttribute("href"))).toEqual([
      "/demo/spend",
      "/demo/work",
      "/demo/work",
      "/demo/spend",
    ]);
  });
});

describe("R-N7 / R-M12 — the change figure, and its suppression", () => {
  it("renders the change as a whole percentage carrying its own sign", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(tiles()[3]).toHaveTextContent("+214%");
    expect(tiles()[1]).toHaveTextContent("-69%");
  });

  it("renders the domain layer's words where the floor suppressed the figure", () => {
    render(<SummaryTiles tiles={[tile({ key: "k", title: "Total spend", change: noBasis })]} period={AUGUST} />);

    expect(tiles()[0]).toHaveTextContent("2026-07 holds nothing to compare 2026-08 against");
    expect(tiles()[0]).not.toHaveTextContent("%");
  });
});

describe("C13 as amended — a part-month carries the flag, on every tile, and no figure", () => {
  it("flags all four tiles and prints no percentage anywhere", () => {
    render(<SummaryTiles tiles={PARTIAL_TILES} period={SEPTEMBER} />);

    // Four flags, not one: the badge stands where each tile's change figure would have been, so
    // a tile with no delta on it explains itself rather than looking like an omission. The
    // breakdown tile carries no change at all and is flagged for the same reason — the month it
    // draws is the same fragment.
    expect(tiles().filter((held) => held.textContent?.includes("Partial month"))).toHaveLength(4);
    for (const held of tiles()) expect(held).not.toHaveTextContent("%");
  });

  it("states the rule once, above the tiles, rather than four times inside them", () => {
    render(<SummaryTiles tiles={PARTIAL_TILES} period={SEPTEMBER} />);

    const line = screen.getByTestId(PERIOD_TESTID);

    expect(line).toHaveTextContent("Sep 2026");
    expect(line).toHaveTextContent(/unfinished, so no change is shown against the month before/);
    // The badge is the tiles' — the line names the month and gives the reason, once.
    expect(line).not.toHaveTextContent("Partial month");
  });

  it("keeps the flag off a finished month, and the figures on it", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(screen.queryAllByText("Partial month")).toHaveLength(0);
    expect(tiles().filter((held) => held.textContent?.includes("%"))).toHaveLength(3);
  });
});

describe("R-N8 — the third tile is the WorkType mix, and only that tile", () => {
  it("puts exactly one chart on the page, in the breakdown tile", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    const charts = screen.getAllByRole("group", { name: /grouped by/ });

    expect(charts).toHaveLength(1);
    expect(tiles()[2]).toContainElement(charts[0] ?? null);
  });

  it("names the WorkType roll-up in the chart's label (R-X2) and mirrors all five (R-V4)", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    expect(screen.getByRole("group", { name: /grouped by WorkType/ })).toBeInTheDocument();
    // In R-V5's ranked order, which at one bucket (C11) is the sorted order of the bars.
    expect(
      within(screen.getByRole("table")).getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["Period", "Bug fix", "Implementation", "Refactor", "Review", "Deploy"]);
  });

  it("prints no figure and no change on the mix tile (C11)", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    // Its neighbour carries the count and its delta; the mix tile used to carry the same two,
    // because the ViewModel built it from that tile's reading. The union makes that
    // unrepresentable now, and this asserts the rendered result: the mix tile prints neither.
    expect(tiles()[1]).toHaveTextContent("137");
    expect(tiles()[1]).toHaveTextContent("-69%");
    expect(tiles()[2]).not.toHaveTextContent("137");
    expect(tiles()[2]).not.toHaveTextContent("%");
  });

  it("labels every bar with its own value, so the tile reads without an axis (R-N8)", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    const mix = within(tiles()[2]);

    // The bars carry no axis at tile size (R-N8), so the figure has to be on the mark. Each of
    // the five is therefore inside this tile **twice**: once on its bar and once in the R-X1
    // mirror. Without the labels it would be there once, which is what this counts.
    for (const value of ["58", "35", "32", "25", "12"]) {
      expect(mix.getAllByText(value)).toHaveLength(2);
    }
  });
});

describe("R-N6 / R-E2 — the month is stated once, above the tiles", () => {
  it("names the reported month, and how the tiles below are compared", () => {
    render(<SummaryTiles tiles={TILES} period={AUGUST} />);

    const line = screen.getByTestId(PERIOD_TESTID);

    expect(line).toHaveTextContent("Aug 2026");
    expect(line).toHaveTextContent("Every change is measured against the month before.");
  });

  it("names the month in progress instead, where the month is unfinished", () => {
    render(<SummaryTiles tiles={PARTIAL_TILES} period={SEPTEMBER} />);

    const line = screen.getByTestId(PERIOD_TESTID);

    expect(line).toHaveTextContent("Sep 2026");
    expect(line).not.toHaveTextContent("Every change is measured against the month before.");
  });
});
