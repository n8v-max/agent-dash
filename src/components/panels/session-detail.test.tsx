// **T-C9.1 — the `/demo/history` expandable row** (R-N20.1, R-M7, R-M9).
//
// It shows that session's **four disjoint token class volumes** and its **Model mix**, and the
// four volumes **sum to the row's Tokens processed figure**.
//
// **This is the only surface in the product carrying either**, which is why the sum is asserted
// here and not only in the domain layer: `src/domain/metrics/adoption.ts` proves the classes are
// disjoint and that they add up, but nothing else in the product ever *renders* them, so this is
// the one place the claim is checkable against what a viewer actually sees.
//
// **The sum is taken off the rendered output, never off the fixture literal.** Reading the four
// numbers back out of the DOM and adding them is the whole assertion: a component that dropped
// one class, rendered it twice, or printed the total in place of a class would still satisfy a
// test that added up its own input.
//
// **The ViewModel is a literal.** `src/components/**` may import `src/domain` for types only
// (R-T6), so a component test cannot call a query to build its input — and should not want to.
// What this component owes is faithfulness to the ViewModel it was handed.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SessionDetail } from "@/data/queries";
import { SessionDetailPanel } from "./session-detail";

/** The four classes are disjoint, so 12,400 + 88,100 + 6,250 + 3,910 is Tokens processed. */
const DETAIL: SessionDetail = {
  sessionId: "ses_0412",
  taskKey: "equilibrio/web-console#412",
  tokensByClass: {
    uncached_input: 12_400,
    cache_read: 88_100,
    cache_write: 6_250,
    output: 3_910,
  },
  tokensProcessed: 110_660,
  modelMix: [
    { key: "claude-opus-5", label: "Claude Opus 5", value: 74_260 },
    { key: "claude-haiku-4-5", label: "Claude Haiku 4.5", value: 36_400 },
  ],
};

/** `12,400` → `12400`. The formatter groups thousands; the assertion is about the figure. */
const figure = (text: string): number => Number(text.replaceAll(",", ""));

const volumesIn = (testId: string): readonly number[] =>
  within(screen.getByTestId(testId))
    .getAllByRole("cell")
    .map((cell) => figure(cell.textContent ?? ""));

describe("T-C9.1 — the four disjoint token class volumes", () => {
  it("renders exactly four classes, each named", () => {
    render(<SessionDetailPanel detail={DETAIL} />);

    const classes = within(screen.getByTestId("token-class-volumes")).getAllByRole("rowheader");

    expect(classes.map((row) => row.textContent)).toEqual([
      "Uncached input",
      "Cache read",
      "Cache write",
      "Output",
    ]);
  });

  it("renders volumes that sum to the row's Tokens processed figure", () => {
    render(<SessionDetailPanel detail={DETAIL} />);

    const volumes = volumesIn("token-class-volumes");
    const processed = volumesIn("token-class-total");

    expect(volumes).toHaveLength(4);
    expect(processed).toHaveLength(1);
    expect(volumes.reduce((total, value) => total + value, 0)).toBe(processed[0]);
  });

  it("puts the total where a reader can check the sum, labelled as Tokens processed", () => {
    render(<SessionDetailPanel detail={DETAIL} />);

    const total = within(screen.getByTestId("token-class-total")).getByRole("rowheader");

    expect(total).toHaveTextContent("Tokens processed");
    expect(screen.getByTestId("token-class-total")).toHaveTextContent("110,660");
  });
});

describe("T-C9.1 — the per-session Model mix (R-M7)", () => {
  it("names every Model the session spanned, with its volume", () => {
    render(<SessionDetailPanel detail={DETAIL} />);

    const mix = within(screen.getByTestId("model-mix"));

    expect(mix.getAllByRole("rowheader").map((row) => row.textContent)).toEqual([
      "Claude Opus 5",
      "Claude Haiku 4.5",
    ]);
    expect(volumesIn("model-mix")).toEqual([74_260, 36_400]);
  });

  it("shows volumes and no share: a share would be a division, and components do not compute", () => {
    render(<SessionDetailPanel detail={DETAIL} />);

    expect(screen.getByTestId("session-detail").textContent).not.toMatch(/%/);
  });

  it("renders nothing for the mix where a session spanned no Model at all", () => {
    render(<SessionDetailPanel detail={{ ...DETAIL, modelMix: [] }} />);

    expect(screen.queryByTestId("model-mix")).toBeNull();
    expect(screen.getByTestId("token-class-volumes")).toBeInTheDocument();
  });
});

describe("a session the viewer's grants reach only in aggregate (R-A6)", () => {
  const withheld: SessionDetail = {
    ...DETAIL,
    tokensByClass: null,
    tokensProcessed: null,
    modelMix: null,
  };

  it("says the figures are withheld rather than rendering zeroes", () => {
    render(<SessionDetailPanel detail={withheld} />);

    expect(screen.queryByTestId("token-class-volumes")).toBeNull();
    expect(screen.queryByTestId("model-mix")).toBeNull();
    expect(screen.getByTestId("session-detail")).toHaveTextContent(/outside your grants/i);
  });
});
