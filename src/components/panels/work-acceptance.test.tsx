// **R-N13 and A21 — acceptance rate as small multiples, and never as one cross-WorkType figure.**
//
// A21 is an **absence**, and an absence needs a set of things that would be present if it were
// violated. There are exactly three ways a component could synthesise a cross-WorkType acceptance
// figure — a mean of the five rates, a pooled `accepted ÷ sessions` over all five, or a sixth
// "all templates" tile — so the fixture is built with five distinct rates over five equal
// denominators, and this file asserts that none of the three appears: not the value (66%), not
// the pooled counts it would have been made of (328 of 500), and not a tile, heading or chart
// whose name spans more than one template.
//
// The other half of the same claim is structural and is asserted over the module's source in
// `work-page-panels.test.tsx`: this module holds no aggregation at all, so there is no expression
// in it that could have produced the figure in the first place.
//
// **R-N13's layout claim** is asserted as five charts rendered *at once*, all five named, and no
// control anywhere in the panel — a selector would hide four of the five values and make a viewer
// click to discover that the comparison is not offered.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcceptanceMultiples, ACCEPTANCE_TITLE } from "./work-acceptance";
import { ACCEPTANCE_AXIS, ACCEPTANCE_PANELS } from "./work-viewmodels.fixture";

/** The five, in the order `WORK_TYPE_KEYS` declares and the query returns. */
const TEMPLATES = ["Implementation", "Refactor", "Bug fix", "Review", "Deploy"];
const RATES = ["71%", "58%", "79%", "86%", "34%"];

/** What a cross-WorkType figure would have read as. 328 accepted of 500 sessions is 65.6%. */
const POOLED = { percent: "66%", accepted: "328", sessions: "500" };

const renderPanel = () =>
  render(<AcceptanceMultiples panels={ACCEPTANCE_PANELS} axis={ACCEPTANCE_AXIS} />);

const panel = () => screen.getByRole("region", { name: ACCEPTANCE_TITLE });

const tiles = () =>
  ACCEPTANCE_PANELS.map((held) =>
    screen.getByRole("region", { name: held.chart.title }),
  );

describe("R-N13 — five multiples, all of them rendered, on one screen", () => {
  it("renders one tile per WorkType, in the order the query returned them", () => {
    renderPanel();

    const headings = within(panel())
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(TEMPLATES);
  });

  it("renders one chart per WorkType, each naming the WorkType it was measured within", () => {
    renderPanel();

    // `ChartFrame`'s own container, not the legend group inside it — R-X2's label is on the frame.
    const charts = within(panel())
      .getAllByRole("group", { name: /^Acceptance rate/ })
      .map((frame) => frame.getAttribute("aria-label"));

    expect(charts).toEqual(
      TEMPLATES.map((name) => `Acceptance rate — ${name}, grouped by WorkType: ${name}`),
    );
  });

  it("shows each WorkType's own rate and the counts it was measured over", () => {
    renderPanel();

    for (const [at, tile] of tiles().entries()) {
      expect(within(tile).getByText(RATES[at])).toBeInTheDocument();
      expect(
        within(tile).getByText(`${ACCEPTANCE_PANELS[at].rate.accepted} of 100 sessions accepted`),
      ).toBeInTheDocument();
    }
  });

  /**
   * The alternative R-N13 rules out. A selector is a control, so its absence is assertable
   * without naming what it would have looked like.
   */
  it("offers no control that could hide a WorkType", () => {
    renderPanel();

    for (const role of ["combobox", "listbox", "radio", "button", "link", "tab"] as const) {
      expect(within(panel()).queryAllByRole(role)).toEqual([]);
    }
  });

  /**
   * The shared axis (`acceptanceAxis`). Every rail carries the *same* endpoints and its own
   * value, which is what "on a shared axis" means when it is a fact rather than a convention.
   */
  it("draws every rate against the same axis", () => {
    renderPanel();

    const rails = within(panel()).getAllByRole("meter");

    expect(rails.map((rail) => rail.getAttribute("aria-valuetext"))).toEqual(RATES);
    for (const rail of rails) {
      expect(rail).toHaveAttribute("aria-valuemin", String(ACCEPTANCE_AXIS.min));
      expect(rail).toHaveAttribute("aria-valuemax", String(ACCEPTANCE_AXIS.max));
    }
  });
});

describe("A21 — no cross-WorkType acceptance figure is rendered", () => {
  it("renders no tile, heading or chart spanning more than one WorkType", () => {
    renderPanel();

    const spanning = /\ball\b|overall|average|combined|every|aggregate|total/i;
    const named = within(panel())
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label") ?? "");


    expect(named).toHaveLength(ACCEPTANCE_PANELS.length);
    for (const name of [...named, ...within(panel()).getAllByRole("heading").map((h) => h.textContent ?? "")]) {
      expect(name).not.toMatch(spanning);
    }
  });

  it("renders neither the mean of the five rates nor the pooled rate", () => {
    renderPanel();

    const text = panel().textContent ?? "";

    expect(text).not.toContain(POOLED.percent);
    expect(text).not.toContain(POOLED.accepted);
    expect(text).not.toContain(POOLED.sessions);
  });

  it("renders exactly the five rates it was handed, and no sixth figure", () => {
    renderPanel();

    const figures = tiles().map((tile) => within(tile).getByRole("meter"));

    expect(figures.map((rail) => rail.getAttribute("aria-valuenow"))).toEqual(
      ACCEPTANCE_PANELS.map((held) => String(held.rate.rate)),
    );
  });

  /** A22-shaped: the panel renders as many tiles as it was handed, and never one more. */
  it("renders one tile per panel it was handed, whatever the count", () => {
    render(
      <AcceptanceMultiples panels={ACCEPTANCE_PANELS.slice(0, 2)} axis={ACCEPTANCE_AXIS} />,
    );

    expect(within(panel()).getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});

/**
 * **R-V11 — the multiples are sparklines** (ticket 41).
 *
 * The panel's job is five trends read at once beside five figures. The axes, the grid and the
 * one-entry legends were furniture restating the `<h3>` above them and taking most of a 144px
 * tile to do it. `chart-shapes.test.tsx` proves what `bare` removes; this proves the panel asks
 * for it — asserted on the legend, because a legend entry is the one piece of that furniture that
 * carries an accessible name and is therefore reachable without querying the SVG.
 *
 * **The fixed dimension is load-bearing.** A Recharts chart given none in jsdom draws nothing at
 * all, so "there is no legend here" would pass against five blank tiles. The first test is the
 * control: the charts *are* drawn.
 */
describe("R-V11 — no axis, no grid and no legend inside a multiple", () => {
  const renderDrawn = () =>
    render(
      <AcceptanceMultiples
        panels={ACCEPTANCE_PANELS}
        axis={ACCEPTANCE_AXIS}
        dimension={{ width: 240, height: 144 }}
      />,
    );

  it("draws all five charts — the control the absence below is measured against", () => {
    renderDrawn();

    expect(screen.getAllByRole("application")).toHaveLength(ACCEPTANCE_PANELS.length);
  });

  it("renders no legend entry in any of the five tiles", () => {
    renderDrawn();

    expect(screen.queryAllByLabelText(/legend icon/)).toEqual([]);
  });

  it("keeps every figure a reader needs: the rate, the counts and the mirror", () => {
    renderDrawn();

    for (const [at, tile] of tiles().entries()) {
      expect(within(tile).getByText(RATES[at])).toBeInTheDocument();
      expect(within(tile).getByRole("table")).toBeInTheDocument();
    }
  });
});

describe("T-C1 — every multiple carries its own mirror", () => {
  it("mirrors each WorkType's series under that WorkType's caption", () => {
    renderPanel();

    for (const [at, tile] of tiles().entries()) {
      const table = within(tile).getByRole("table");
      const headers = within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent);
      const values = within(table)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);

      expect(headers).toEqual(["Period", TEMPLATES[at]]);
      expect(values).toEqual(ACCEPTANCE_PANELS[at].chart.series[0].points.map((point) => String(point.value)));
    }
  });
});
