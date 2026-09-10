// **`/demo/projection`** — R-N23's four parts, R-N24's absence, and R-V8's one label.
//
// The three claims R-V8 makes are asserted as three claims, because they are three claims:
// **Projected cost carries "estimated"**, **the attributed figure beside it does not**, and the
// token rate card — which carries "illustrative rates" — **does not render on this page at all**.
// The third is the half a `/demo/spend` test cannot make.
//
// **R-N24 is asserted as an absence over the rendered text**, not as "we did not write one". The
// domain layer already proves no band is *produced* (T-U21, over the module's own return shape);
// what is left for a component test is that nothing here dresses the figure in one anyway — a
// "±", a range, or the word itself.
//
// **T-C17 (ticket 42) — both figures are printed beside the two components they are the sum of**,
// and the projection's arithmetic is on the page with the month's real numbers in it. The two
// sums are not the same sum: only session Cost is extrapolated, and the seat charge crosses whole
// (R-M5, R-D2), which is why the seat figure is asserted *identical* in both tiles. R-N24's
// "one figure, no bound" claim is restated over the new layout rather than dropped.
//
// **The ViewModel is a literal** (R-T6): `src/components/**` imports `src/domain` for types only,
// so this test cannot call `projectionPage`, and the faithfulness of the figures is
// `src/data/queries`' claim over the real fixture.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chartFixture } from "@/components/charts/chart-viewmodels.fixture";
import { LEGEND_LABEL } from "@/components/charts/series-legend";
import type { ProjectionPageViewModel } from "@/data/queries";
import type { TileViewModel } from "@/domain/viewmodel";
import { ProjectionPanel } from "./projection-panel";

const PERIOD = { key: "2026-09", label: "Sep 2026", partial: true };

/**
 * Ticket 64 — the daily chart as the query now assembles it: four civil days, two stacked
 * series, and the domain fact naming which of them is the forecast. The 8th is "today" — part
 * spent, part still owed — and the 9th has not happened, which is why it carries a projected
 * bar on no attributed one.
 */
const DAILY_CHART = chartFixture({
  title: "Daily session cost",
  rollUpLevel: "Organization",
  bucketColumn: "Day",
  buckets: ["6 Sep 2026", "7 Sep 2026", "8 Sep 2026", "9 Sep 2026"],
  series: [
    { key: "actual", label: "Session cost", values: [10, 12, 5, 0] },
    { key: "projected", label: "Projected (estimated)", values: [0, 0, 4, 9] },
  ],
  stackable: true,
  estimated: "projected",
});

const METHOD =
  "Spend to date, extrapolated to the end of the period in proportion to the period elapsed.";

const tile = (key: string, title: string, value: number | null): TileViewModel => ({
  key,
  title,
  value,
  unit: "usd",
  caption: null,
  period: PERIOD,
  change: {
    shown: false,
    reason: "no-prior-period",
    message: "This page reports one month against its own elapsed share.",
    current: { key: PERIOD.key, value: value ?? 0, partial: true },
    prior: null,
    incomplete: true,
  },
});

const VIEW: ProjectionPageViewModel = {
  orgSlug: "demo",
  period: PERIOD,
  // 8 of 30 days — the share R-N23 asks to be shown beside the figure.
  elapsed: { days: 8, totalDays: 30, fraction: 8 / 30 },
  method: METHOD,
  incomplete: true,
  // Ticket 42 — the four figures, as four figures. 1,240.50 × (30 ÷ 8) = 4,651.88.
  components: {
    sessionToDate: 1_240.5,
    seat: 468,
    projectedSession: 4_651.88,
    projectedTotal: 5_119.88,
  },
  tiles: [
    tile("spend-to-date", "Spend to date", 1_708.5),
    tile("projected-cost", "Projected month-end spend", 5_119.88),
  ],
  chart: DAILY_CHART,
  note:
    "A seat is charged by whole months and is never pro-rated across days, so it is stated here " +
    "rather than spread over the bars. Projected bars share the method above: today's spend " +
    "rate, carried to the end of the month.",
  unavailable: null,
};

const DIMENSION = { width: 640, height: 320 };

const panel = (view: ProjectionPageViewModel = VIEW) =>
  render(<ProjectionPanel view={view} dimension={DIMENSION} />);

/** Everything the panel put on screen, as one string — an absence is a claim about all of it. */
const text = (): string => screen.getByTestId("projection-panel").textContent ?? "";

describe("R-N23 — actual spend to date, and the month-end figure extrapolated from the share", () => {
  it("renders both figures, the attributed one and the forecast", () => {
    panel();

    expect(screen.getByTestId("figure-spend-to-date")).toHaveTextContent("$1,708.50");
    expect(screen.getByTestId("figure-projected-cost")).toHaveTextContent("$5,119.88");
  });

  it("states the method in one sentence", () => {
    panel();

    expect(screen.getByTestId("projection-method")).toHaveTextContent(METHOD);
    expect(METHOD).toMatch(/^[^.]+\.$/);
  });

  it("shows the elapsed fraction as a share, and the days it is a share of", () => {
    panel();

    expect(screen.getByTestId("elapsed-share")).toHaveTextContent("27%");
    expect(screen.getByText("8 of 30 days")).toBeInTheDocument();
  });

  it("carries the incomplete-period flag", () => {
    panel();

    expect(screen.getByTestId("incomplete-flag")).toHaveTextContent("Incomplete period");
  });

  it("drops the flag on a period that has closed", () => {
    panel({ ...VIEW, incomplete: false });

    expect(screen.queryByTestId("incomplete-flag")).toBeNull();
  });
});

describe("R-V8 / A17 — 'estimated' is on Projected cost and on nothing else", () => {
  it("labels the forecast, because a forecast really is an estimate", () => {
    panel();

    expect(within(screen.getByTestId("figure-projected-cost")).getByText("Estimated")).toBeInTheDocument();
  });

  it("leaves the attributed figure unlabelled — an attributed figure is the bill", () => {
    panel();

    expect(screen.getByTestId("figure-spend-to-date")).not.toHaveTextContent(/estimat/i);
  });

  // Ticket 64 put the marker in a second place — on the forecast **series** of the daily chart,
  // where the query spells its label `Projected (estimated)`. That is the same forecast said per
  // day rather than a second claim, so the count is no longer the assertion. What R-V8 actually
  // forbids is the marker reaching an *attributed* figure, and that is asserted directly: once
  // among the two headline figures, and everywhere else only on text that names the forecast.
  it("uses the marker once among the figures, and on nothing attributed anywhere", () => {
    panel();

    const figures = ["figure-spend-to-date", "figure-projected-cost"]
      .map((id) => screen.getByTestId(id).textContent ?? "")
      .join(" ");

    expect(figures.match(/estimated/gi) ?? []).toHaveLength(1);
    // Every other place the word appears is the forecast series naming itself — in the legend
    // and in the R-X1 mirror heading that states what the legend claims.
    expect(new Set(screen.getAllByText(/estimated/i).map((node) => node.textContent))).toEqual(
      new Set(["Estimated", "Projected (estimated)"]),
    );
  });

  it("does not render the token rate card — that lives on /demo/spend only (R-N11)", () => {
    panel();

    expect(text()).not.toMatch(/illustrative/i);
    expect(text()).not.toMatch(/per million tokens|usd_per_hour|machine spec/i);
  });
});

describe("R-N24 — no confidence band", () => {
  it("renders no band, interval, bound or ± of any kind", () => {
    panel();

    expect(text()).not.toMatch(/band|confidence|interval|±|margin of error/i);
  });

  it("renders one projected figure and its two named components, and nothing else", () => {
    panel();

    // Not "one money figure in the tile" — ticket 42 puts three there on purpose. The claim
    // R-N24 makes is that the *extra* figures are the components of the total, each labelled as
    // one, and that there is no fourth number that could be read as a bound.
    const tile = within(screen.getByTestId("figure-projected-cost"));

    expect(tile.getAllByText(/^\$/).map((node) => node.textContent)).toEqual([
      "$5,119.88",
      "$4,651.88",
      "$468.00",
    ]);
  });
});

describe("a month with no elapsed share to extrapolate from", () => {
  it("prints no figure, says why, and still states the method", () => {
    panel({
      ...VIEW,
      elapsed: { days: 0, totalDays: 30, fraction: 0 },
      components: { sessionToDate: 0, seat: 468, projectedSession: null, projectedTotal: null },
      tiles: [VIEW.tiles[0] as TileViewModel, tile("projected-cost", "Projected month-end spend", null)],
      unavailable: "This period cannot be projected: there is no elapsed share to extrapolate from.",
    });

    expect(screen.getByTestId("figure-projected-cost")).toHaveTextContent("—");
    expect(screen.getByTestId("projection-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("projection-method")).toHaveTextContent(METHOD);
  });
});

describe("T-C17 — the figure is verifiable from what is on screen (R-N23.1, R-M5)", () => {
  it("breaks both tiles into session cost and seat cost, under the headline", () => {
    panel();

    expect(screen.getByTestId("spend-to-date-session")).toHaveTextContent("$1,240.50");
    expect(screen.getByTestId("spend-to-date-seat")).toHaveTextContent("$468.00");
    expect(screen.getByTestId("projected-cost-session")).toHaveTextContent("$4,651.88");
    expect(screen.getByTestId("projected-cost-seat")).toHaveTextContent("$468.00");
  });

  it("prints the same seat charge in both tiles — a seat is not extrapolated (R-M5)", () => {
    panel();

    expect(screen.getByTestId("projected-cost-seat").textContent).toBe(
      screen.getByTestId("spend-to-date-seat").textContent,
    );
  });

  it("shows the arithmetic with the real numbers, in place of the prose", () => {
    panel();

    expect(screen.getByTestId("projection-arithmetic")).toHaveTextContent(
      "$1,240.50 × (30 ÷ 8) + $468.00 = $5,119.88",
    );
  });

  it("states the seat charge beside the daily bars rather than in them (R-M5)", () => {
    panel();

    const note = screen.getByTestId("chart-seat-note");

    expect(note).toHaveTextContent("$468.00");
    expect(note).toHaveTextContent(/never pro-rated across days/);
    // Ticket 64 — and one sentence for the lighter bars, naming the method rather than restating
    // it. The method sentence itself is unchanged (T-U21).
    expect(note).toHaveTextContent("Projected bars share the method above");
    expect(screen.getByTestId("projection-method")).toHaveTextContent(METHOD);
  });

  it("prints no arithmetic where there is no projection to verify", () => {
    panel({
      ...VIEW,
      elapsed: { days: 0, totalDays: 30, fraction: 0 },
      components: { sessionToDate: 0, seat: 468, projectedSession: null, projectedTotal: null },
      tiles: [
        VIEW.tiles[0] as TileViewModel,
        tile("projected-cost", "Projected month-end spend", null),
      ],
      unavailable: "This period cannot be projected: there is no elapsed share to extrapolate from.",
    });

    expect(screen.queryByTestId("projection-arithmetic")).toBeNull();
    expect(screen.getByTestId("projected-cost-session")).toHaveTextContent("—");
  });
});

describe("R-T28 — the one chart on the page goes through ChartFrame", () => {
  it("renders it inside the frame, labelled with its roll-up level", () => {
    panel();

    expect(
      screen.getByRole("group", { name: "Daily session cost, grouped by Organization" }),
    ).toBeInTheDocument();
  });
});

/**
 * **Ticket 64 — the projected remainder, stacked on the days already spent.**
 *
 * What a *component* owes here is that both series reach the reader: two legend entries, the
 * forecast carrying R-V8's marker, and a day still to come rendered as a projected figure on no
 * attributed one. That the two marks share a stack id is `chart-shapes.test.tsx`'s claim, over
 * the one expression that produces one; that they sum to the tile's figure is
 * `src/data/queries.test.ts`'s, over the real fixture.
 */
describe("the daily chart carries both series, and says which one is the forecast", () => {
  const legend = () => screen.getByRole("group", { name: LEGEND_LABEL });

  it("names two series in the legend, with a swatch each", () => {
    panel();

    expect(within(legend()).getAllByLabelText(/legend icon/)).toHaveLength(2);
    expect(within(legend()).getByText("Session cost")).toBeInTheDocument();
    expect(within(legend()).getByText("Projected (estimated)")).toBeInTheDocument();
  });

  it("marks the forecast series and leaves the attributed one unmarked (R-V8)", () => {
    panel();

    expect(within(legend()).getByText("Session cost")).not.toHaveTextContent(/estimat/i);
    expect(within(legend()).getByText("Projected (estimated)")).toHaveTextContent(/estimated/i);
  });

  it("gives the R-X1 mirror a column for each series, headed by the day", () => {
    panel();

    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Day", "Session cost", "Projected (estimated)"]);
  });

  it("draws a day still to come as a projected figure on no attributed one", () => {
    panel();

    // The row reads: 9 Sep 2026, nothing spent, 9 projected — the shape of every future bar.
    expect(screen.getByRole("row", { name: "9 Sep 2026 0 9" })).toBeInTheDocument();
    // And today carries both halves, which is the only bar that does.
    expect(screen.getByRole("row", { name: "8 Sep 2026 5 4" })).toBeInTheDocument();
  });
});
