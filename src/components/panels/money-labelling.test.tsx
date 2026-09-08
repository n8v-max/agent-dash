// **T-C9 — money labelling** (A17, R-V8, `spec.md` § 11 C3).
//
// R-V8 is three claims, not one, and they are asserted as three separate statements because a
// single "the labels are right" test would pass while any two of them were wrong:
//
//   1. **No attributed money figure carries an "estimated" marker.** An attributed figure is the
//      bill (R-M4, ADR-0005); labelling it an estimate would understate the one solid number on
//      the page. This is asserted over the whole of `/demo/spend` — every money panel, the
//      Adoption section and the rate card — because it is a claim about a surface, not about a
//      component. Ticket 07 required the opposite; § 11 C3 resolves it in favour of ADR-0005.
//   2. **Projected cost does carry it**, because a forecast is the one money figure here that
//      really is an estimate. Projected cost renders on `/demo/projection` (R-M1 scopes it
//      there, and ticket 36 owns that surface), so what is assertable here is the rule itself,
//      in the layer `technical-spec.md` § 7 puts it in: the same component that refuses the
//      marker on an attributed figure applies it to a forecast. Both arms, because a marker that
//      is always on and a marker that is never on are both wrong.
//   3. **The token rate card carries "illustrative rates"** (R-N11), because those rates are
//      invented and the card is the evidence for every money figure in the product.
//
// The first claim is asserted over the rendered text *and* the rendered markup: a marker hiding
// in an `aria-label` or a `title` would satisfy a text query and still be read out.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AdoptionSection } from "./adoption-section";
import { ESTIMATED_MARKER, Figure, FigureList, ILLUSTRATIVE_RATES } from "./money-figure";
import { RateCard } from "./rate-card";
import { SpendPanels } from "./spend-panels";
import { adoptionFixture, rateCardFixture, spendPageFixture } from "./spend.fixture";

/** T-C0 / R-T29 — fixed numbers, never `initialDimension`. */
const SIZE = { width: 640, height: 320 };

const ESTIMATED = /estimat/i;

/** The whole page, panel for panel, exactly as `src/app/[org]/spend/page.tsx` composes it. */
const renderSpendPage = () => {
  const page = spendPageFixture();
  return render(
    <>
      <SpendPanels page={page} dimension={SIZE} />
      <AdoptionSection adoption={page.adoption} dimension={SIZE} />
      <RateCard card={page.adoption.rateCard} />
    </>,
  );
};

describe("T-C9.1 — no attributed money figure carries an 'estimated' marker (R-V8)", () => {
  it("renders the page's money figures", () => {
    renderSpendPage();

    // The non-vacuity guard: the assertion below is only worth making over a page that really
    // did render attributed money.
    expect(screen.getByText("$16,600.00")).toBeVisible();
    expect(screen.getByText("$9.20")).toBeVisible();
  });

  it("says 'estimated' nowhere in the rendered text", () => {
    const { container } = renderSpendPage();

    expect(container.textContent).not.toMatch(ESTIMATED);
  });

  it("says 'estimated' nowhere in the markup either, so no label or title carries it", () => {
    const { container } = renderSpendPage();

    expect(container.innerHTML).not.toMatch(ESTIMATED);
  });
});

describe("T-C9.2 — Projected cost carries the marker, and only a forecast does (R-V8)", () => {
  it("marks a forecast figure 'Estimated'", () => {
    render(
      <FigureList>
        <Figure label="Projected month-end spend" value="$18,400.00" basis="forecast" />
      </FigureList>,
    );

    expect(screen.getByText(ESTIMATED_MARKER)).toBeVisible();
  });

  it("leaves an attributed figure of the same shape unmarked", () => {
    render(
      <FigureList>
        <Figure label="Spend to date" value="$18,400.00" basis="attributed" />
      </FigureList>,
    );

    expect(screen.queryByText(ESTIMATED_MARKER)).toBeNull();
  });
});

describe("T-C9.3 — the token rate card carries 'illustrative rates' (R-N11, R-V8)", () => {
  it("labels the card 'Illustrative rates'", () => {
    render(<RateCard card={rateCardFixture()} />);

    expect(screen.getByText(ILLUSTRATIVE_RATES)).toBeVisible();
  });

  it("renders the rates as a collapsed table, which the label opens", async () => {
    const user = userEvent.setup();
    render(<RateCard card={rateCardFixture()} />);

    // R-N11's "collapsed": the table is in the document and closed, not absent.
    expect(screen.getByRole("table")).not.toBeVisible();

    await user.click(screen.getByText(ILLUSTRATIVE_RATES));

    const table = screen.getByRole("table");
    expect(table).toBeVisible();
    expect(within(table).getByText("claude-opus-5")).toBeVisible();
  });

  it("carries no compute rate card — the ViewModel holds one card and it is the token one", () => {
    render(<AdoptionSection adoption={adoptionFixture()} dimension={SIZE} />);

    // A18 / T-E9 crawls all six routes for the compute card's values; this is the local half:
    // the Adoption section renders no machine-specification rates at all.
    expect(screen.queryByText(/machine/i)).toBeNull();
    expect(screen.queryByText(/per hour/i)).toBeNull();
  });
});
