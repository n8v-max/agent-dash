// **T-C20 — one sentence per panel is visible; the rest is folded, never cut** (R-V14, A38).
//
// The valuable claim here is the second one. "The panel shows one sentence" is easy to assert and
// easy to satisfy by *deleting* the other three, which is exactly what R-V14 forbids: several of
// these paragraphs carry an ADR's argument — why a ratio is not stacked, why seat cost is charged
// by the month, why a token volume does not predict the spend above it — and a panel that shortened
// one would lose the reason the product's own docs record. So the test that matters is the
// **round trip**: `lead` plus `rest` is the paragraph that was handed in, word for word.
//
// It is asserted over `splitProse`, the one expression that decides the fold, for the reason
// T-C11 asserts `stackIdOf` and T-C12 asserts `furnitureFor` — the rule is a decision, and a
// decision is assertable directly. The rendering claims below are the other half: the fold is a
// native `<details>`, so the disclosure costs no client JavaScript and works with none.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PanelProse, WHY_THIS_NUMBER, splitProse } from "./panel-prose";

/** A real panel's copy, three sentences of it, so the case under test is the shipped one. */
const QUESTION =
  "What one finished Job costs. Every session's cost is in the numerator and only Completed " +
  "Jobs are in the denominator, so work that had to be redone raises it. A bucket that spent " +
  "money and finished nothing has no reading at all, and draws nothing rather than a zero.";

describe("T-C20 — the fold keeps every word (R-V14)", () => {
  it("leaves the first sentence standing, terminator included", () => {
    expect(splitProse(QUESTION).lead).toBe("What one finished Job costs.");
  });

  it("folds the rest, and the rest is the whole of the rest", () => {
    const { lead, rest } = splitProse(QUESTION);

    // The round trip. A fold that shortened an argument rather than relocating it fails here,
    // and no assertion about what is *on screen* could have caught that.
    expect(`${lead} ${rest}`).toBe(QUESTION);
  });

  it("has nothing to fold where the copy is already one sentence", () => {
    expect(splitProse("Where the money went, by Repository.")).toEqual({
      lead: "Where the money went, by Repository.",
      rest: null,
    });
  });

  it("keeps an unterminated line whole rather than folding it into nothing", () => {
    expect(splitProse("Interactive sessions only")).toEqual({
      lead: "Interactive sessions only",
      rest: null,
    });
  });

  it("reads a decimal, an abbreviation and a colon as part of the sentence they sit in", () => {
    // `.` is not a sentence end unless whitespace follows it, which is what keeps "42.5" and
    // "p95." from cutting a figure in half.
    expect(splitProse("The median is 42.5 hours. The p95 is 4.4× it.").lead).toBe(
      "The median is 42.5 hours.",
    );
    expect(splitProse("Interactive sessions only: 30 of 42. 12 are excluded.").lead).toBe(
      "Interactive sessions only: 30 of 42.",
    );
  });
});

describe("T-C20 — the disclosure is native, and holds what the sentence does not", () => {
  it("shows one paragraph and hides the rest behind `Why this number`", async () => {
    render(<PanelProse text={QUESTION} />);

    // Exactly one paragraph is on screen. The other is in the document and not visible, which is
    // the difference between folding an argument and deleting it.
    const paragraphs = screen.getAllByText(/./, { selector: "p" });
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBeVisible();
    expect(paragraphs[0]).toHaveTextContent("What one finished Job costs.");
    expect(paragraphs[1]).not.toBeVisible();

    // `<details>` exposes the `group` role, which is how the disclosure is reachable without
    // touching the DOM tree directly.
    const disclosure = screen.getByRole("group");
    const summary = screen.getByText(WHY_THIS_NUMBER);
    expect(summary.tagName).toBe("SUMMARY");
    // Closed by default: the sentence is the reading, the argument is the offer.
    expect(disclosure).not.toHaveAttribute("open");
    expect(within(disclosure).getByText(/Every session's cost/)).not.toBeVisible();

    await userEvent.click(summary);
    expect(within(disclosure).getByText(/Every session's cost/)).toBeVisible();
  });

  it("is a `<details>` and not a button, so it needs no client JavaScript", () => {
    render(<PanelProse text={QUESTION} />);

    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByText(WHY_THIS_NUMBER).tagName).toBe("SUMMARY");
    // No handler, no hydration: the disclosure is markup, so it works with scripting off.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no disclosure where there is nothing behind it", () => {
    render(<PanelProse text="Where the money went, by Repository." />);

    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByText("Where the money went, by Repository.")).toBeVisible();
  });

  it("renders nothing at all for a panel carrying no prose", () => {
    const { container } = render(<PanelProse text={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
