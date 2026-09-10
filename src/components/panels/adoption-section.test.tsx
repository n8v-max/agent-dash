// The Adoption section (R-N9 panels 6 and 7, R-M7, R-M9, R-N20.1).
//
// The section exists to keep two readings apart, so what is asserted is mostly what is *not*
// there: no money figure anywhere inside it (R-M9), and no per-session token-class volume
// (R-N20.1 puts those on `/demo/history` alone). The heading and its one line carry the claim in
// words, and they are asserted as text because that is the form the requirement takes.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdoptionSection } from "./adoption-section";
import { ADOPTION_STATEMENT, adoptionFixture } from "./spend.fixture";

/** T-C0 / R-T29 — fixed numbers, never `initialDimension`. */
const SIZE = { width: 640, height: 320 };

const section = () => screen.getByRole("region", { name: "Adoption" });

describe("R-N9 — the Adoption section sits under its own heading", () => {
  it("opens with the heading and the one line saying these measure use, not money (R-M9)", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    expect(screen.getByRole("heading", { level: 2, name: "Adoption" })).toBeVisible();
    expect(screen.getByText(ADOPTION_STATEMENT)).toBeVisible();
  });

  it("renders Tokens processed over time and Model mix, in that order", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    const titles = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);

    expect(titles).toEqual(["Tokens processed over time", "Model mix"]);
  });
});

describe("R-M9 — tokens are never presented beside a spend figure", () => {
  it("carries no money figure anywhere in the section", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    // The rate card is not part of this section; it is a separate element at the foot of the
    // page (R-N11), which is what keeps this assertion available at all.
    expect(section().textContent).not.toContain("$");
  });

  it("reports the volume as tokens and readings, not as classes (R-N20.1)", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    expect(within(section()).getByText("10,000,000")).toBeVisible();
    expect(within(section()).getByText("812")).toBeVisible();
    // The four disjoint classes are volumes, and `/demo/history` is the only surface carrying
    // them. Here they appear only as the rate card's columns.
    expect(within(section()).queryByText(/cache read/i)).toBeNull();
    expect(within(section()).queryByText(/uncached input/i)).toBeNull();
  });
});

/**
 * **Ticket 69 — both measure axes read in token units.**
 *
 * The ticks are the only rendered evidence that `tickFormat` reached the axis at all: a
 * `ChartFrame` left on its default draws the same chart with `4m` along its edge, at the `en-GB`
 * compact spelling, which is a different figure from the `4M` the Tokens column beside it reads.
 * So the assertion is on the tick text — found by text, like any other string on the page, rather
 * than by reaching into Recharts' SVG. The formatter itself is pinned in `figures.test.ts`.
 *
 * **One chart, not two, since ticket 70.** The Model mix beside it stopped being a volume: it
 * plots each Model's share of a period's tokens on a fixed 0–100% axis, so its ticks read `25%`
 * and `50%` and a token unit on them would be a category error. The two axes are asserted
 * together here so that a panel wired to the wrong formatter fails in one place.
 */
describe("ticket 69 — the token axis reads in K, M and B; ticket 70 — the mix axis in %", () => {
  it("labels the volume axis in units and the mix axis in per cent, never in seven digits", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    expect(screen.getAllByText("4M")).toHaveLength(1);
    expect(screen.getAllByText("2M")).toHaveLength(1);
    // The Model mix panel's own scale: pinned 0–100, so a filter that leaves one Model at 40%
    // does not redraw its line at the top of the card.
    for (const tick of ["0%", "50%", "100%"]) {
      expect(screen.getAllByText(tick).length).toBeGreaterThan(0);
    }
    // The spelling this replaced: `ChartFrame`'s own default, whose `en-GB` compact notation is
    // lower-case and reads as a different kind of figure from the `4M` in the column beside it.
    expect(screen.queryByText("4m")).toBeNull();
    // The R-X1 mirror is untouched and still holds the figure exactly — it is the chart's data
    // table, and a screen reader reading a rounded number would be reading a different chart.
    expect(screen.getAllByText("4,000,000").length).toBeGreaterThan(0);
  });
});

describe("R-M7 — Model is a breakdown at the level the viewer chose", () => {
  it("renders the current level's distribution with its shares", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    expect(screen.getByText(/rolled up by Model family/i)).toBeVisible();
    expect(screen.getByText("6,000,000 tokens · 60%")).toBeVisible();
    expect(screen.queryByText("frontier")).toBeNull();
  });

  it("follows the roll-up level it was handed, and looks up no other", () => {
    const adoption = adoptionFixture();
    render(
      <AdoptionSection
        adoption={{ ...adoption, modelMix: { ...adoption.modelMix, level: "tier" } }}
        dimension={SIZE}
      />,
    );

    expect(screen.getByText(/rolled up by Model tier/i)).toBeVisible();
    // The tier distribution's own slices, which the family one does not hold.
    expect(screen.getByText("frontier")).toBeVisible();
    expect(screen.getByText("workhorse")).toBeVisible();
  });
});
