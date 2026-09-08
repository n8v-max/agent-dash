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
