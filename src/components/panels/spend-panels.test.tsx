// `/demo/spend`'s five money panels: the order (R-N9), the opener (R-N10), A25's monthly grain,
// and the two things a panel must **not** do — re-render `ChartFrame`'s overlap note (T-C8) or
// its empty state (T-C7).
//
// Every assertion goes through rendered text, an `aria-label` or the R-X1 mirror. None goes
// through SVG geometry: the mirror is the assertion target (T-C1, P2), and a panel's job is to
// hand a ViewModel to `ChartFrame` unchanged, which the mirror shows directly.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chartFixture } from "@/components/charts/chart-viewmodels.fixture";
import { SpendPanels } from "./spend-panels";
import {
  MONTHLY_NOTE,
  MONTH_BUCKETS,
  OVERLAP_NOTE,
  WEEK_BUCKETS,
  spendPageFixture,
} from "./spend.fixture";

/** T-C0 / R-T29 — fixed numbers, never `initialDimension`. */
const SIZE = { width: 640, height: 320 };

/** R-N9's order, as the panels' own headings read. */
const PANEL_TITLES = [
  "Cost per completed Job",
  "Total spend",
  "Cost per session",
  "Cost per completed Job by template",
  "Cost by Repository",
];

const headings = (): readonly string[] =>
  screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");

/** One chart's mirror row headers — the bucket labels, as a screen reader reads them out. */
const bucketsOf = (chartName: string): readonly string[] =>
  within(screen.getByRole("group", { name: chartName }))
    .getAllByRole("rowheader")
    .map((header) => header.textContent ?? "");

describe("R-N9 — the panels render in the order the spec declares", () => {
  it("renders the five money panels in order", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(headings()).toEqual(PANEL_TITLES);
  });

  it("opens with the ratio and not with Total spend (R-N10)", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    // The claim is positional: Total spend is on the page, and it is not what the page opens on.
    expect(headings()[0]).toBe("Cost per completed Job");
    expect(headings()).toContain("Total spend");
  });

  it("renders Cost by Repository flat, with no work-domain roll-up (§ 11 C2, ADR-0004)", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(screen.getByText("Cost by Repository")).toBeVisible();
    expect(screen.queryByText(/work domain/i)).toBeNull();
  });
});

describe("A25 / A36 — the two monthly panels, and the three that read the page's grain", () => {
  it("reads months on Total spend and Cost by Repository, weeks on the ratios (R-M5, R-N9.1)", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(bucketsOf("Total spend, grouped by Organization")).toEqual(MONTH_BUCKETS);
    expect(bucketsOf("Cost by Repository, grouped by Repository")).toEqual(MONTH_BUCKETS);
    expect(bucketsOf("Cost per session, grouped by Organization")).toEqual(WEEK_BUCKETS);
    expect(bucketsOf("Cost per completed Job, grouped by Organization")).toEqual(WEEK_BUCKETS);
  });

  /**
   * **One sentence, on both panels** (ticket 44). It is one claim about the same buckets, so the
   * ViewModel carries one constant and hands it to both — a second sentence here would be two
   * answers to why these two panels are not on the page's grain. Asserted as *two* rendered
   * copies of the *same* string, because that is the difference between reuse and duplication.
   */
  it("states why, in the ViewModel's own words, on both panels and in the same words", () => {
    const page = spendPageFixture();
    render(<SpendPanels page={page} dimension={SIZE} />);

    expect(page.costByRepository.note).toBe(page.totalSpend.note);
    expect(screen.getAllByText(new RegExp(MONTHLY_NOTE, "i"))).toHaveLength(2);
  });

  it("renders the seat split the monthly figure is made of", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(screen.getByText("$13,000.00")).toBeVisible();
    expect(screen.getByText("$3,600.00")).toBeVisible();
    expect(screen.getByText("22%")).toBeVisible();
  });

  /**
   * **Ticket 41 — the seat-month sentence says what the number is.** It read "20 human Members ·
   * 60 seat-months" against a fixture whose *month* count is 3, so a reader who checked the
   * arithmetic against the $39 fee could not reach the $3,600 above it. A seat-month is one month
   * held by one seat, and the sentence now names all three quantities in the order they multiply.
   */
  it("says what a seat-month is, in the arithmetic the seat charge is made of", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(screen.getByText("20 human Members × 3 months = 60 seat-months")).toBeVisible();
  });
});

describe("the panels hand the ViewModel over unchanged (R-T6)", () => {
  it("names each chart's own roll-up level in its aria-label (R-X2)", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    const labels = [
      "Cost per completed Job, grouped by Organization",
      "Total spend, grouped by Organization",
      "Cost per session, grouped by Organization",
      "Cost per completed Job by template, grouped by WorkType",
      "Cost by Repository, grouped by Repository",
    ];

    for (const label of labels) {
      expect(screen.getByRole("group", { name: label })).toBeVisible();
    }
  });

  it("says which outcome filter the Cost per session panel is under (R-M1)", () => {
    render(<SpendPanels page={spendPageFixture()} dimension={SIZE} />);

    expect(screen.getByText(/counting accepted sessions only/i)).toBeVisible();
  });
});

describe("T-C7 — a filter that empties a panel renders 'no data for this selection' (R-V9)", () => {
  it("keeps the panel, its heading and the other panels, and says it once", () => {
    const page = spendPageFixture({
      costByRepository: {
        chart: chartFixture({
          title: "Cost by Repository",
          rollUpLevel: "Repository",
          buckets: MONTH_BUCKETS,
          series: [],
        }),
        note: MONTHLY_NOTE,
      },
    });

    render(<SpendPanels page={page} dimension={SIZE} />);

    expect(screen.getByText("No data for this selection.")).toBeVisible();
    expect(headings()).toEqual(PANEL_TITLES);
  });
});

describe("T-C8 — a Team-grouped panel states the overlap, once (R-V3)", () => {
  it("renders the note the ViewModel carried and does not repeat it", () => {
    const page = spendPageFixture({
      costPerCompletedTask: chartFixture({
        title: "Cost per completed Job",
        rollUpLevel: "Team",
        buckets: WEEK_BUCKETS,
        overlapNote: OVERLAP_NOTE,
      }),
    });

    render(<SpendPanels page={page} dimension={SIZE} />);

    // `ChartFrame` owns R-V3's sentence (R-T28). A panel rendering it again would read as two
    // different qualifications on one chart.
    expect(screen.getAllByText(OVERLAP_NOTE)).toHaveLength(1);
  });
});
