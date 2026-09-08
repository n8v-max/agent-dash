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
// **The ViewModel is a literal** (R-T6): `src/components/**` imports `src/domain` for types only,
// so this test cannot call `projectionPage`, and the faithfulness of the figures is
// `src/data/queries`' claim over the real fixture.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chartFixture } from "@/components/charts/chart-viewmodels.fixture";
import type { ProjectionPageViewModel } from "@/data/queries";
import type { TileViewModel } from "@/domain/viewmodel";
import { ProjectionPanel } from "./projection-panel";

const PERIOD = { key: "2026-09", label: "Sep 2026", partial: true };

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
  actual: { sessionCost: 1_240.5, seatCost: 468, total: 1_708.5 },
  projected: { sessionCost: 4_651.88, seatCost: 468, total: 5_119.88 },
  tiles: [
    tile("spend-to-date", "Spend to date", 1_708.5),
    tile("projected-cost", "Projected month-end spend", 5_119.88),
  ],
  chart: chartFixture({ title: "Actual spend to date", rollUpLevel: "Organization" }),
  note: "Only session Cost is extrapolated. A seat is charged by whole months (R-M5).",
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

  it("uses the marker exactly once on the page", () => {
    panel();

    expect(text().match(/estimated/gi) ?? []).toHaveLength(1);
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

  it("renders one projected figure and no second one beside it", () => {
    panel();

    expect(within(screen.getByTestId("figure-projected-cost")).getAllByText(/^\$/)).toHaveLength(1);
  });
});

describe("a month with no elapsed share to extrapolate from", () => {
  it("prints no figure, says why, and still states the method", () => {
    panel({
      ...VIEW,
      elapsed: { days: 0, totalDays: 30, fraction: 0 },
      projected: null,
      tiles: [VIEW.tiles[0] as TileViewModel, tile("projected-cost", "Projected month-end spend", null)],
      unavailable: "This period cannot be projected: there is no elapsed share to extrapolate from.",
    });

    expect(screen.getByTestId("figure-projected-cost")).toHaveTextContent("—");
    expect(screen.getByTestId("projection-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("projection-method")).toHaveTextContent(METHOD);
  });
});

describe("R-T28 — the one chart on the page goes through ChartFrame", () => {
  it("renders it inside the frame, labelled with its roll-up level", () => {
    panel();

    expect(
      screen.getByRole("group", { name: "Actual spend to date, grouped by Organization" }),
    ).toBeInTheDocument();
  });
});
