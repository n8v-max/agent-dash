// **R-N16, R-N17, R-N18, R-M15** — the Member profile and the comparator, rendered.
//
// The claims here are all "the ViewModel reached the screen intact and nothing was added to it".
// The arithmetic — that the median is a median, that the comparison group is the Members who
// worked that `Repository × WorkType` pair, that the tiles are read at this Member's scope — is
// `src/data/queries.test.ts`'s and `src/domain`'s, over the committed fixture.
//
// **The R-M15 assertion is an absence**, which is why it is written as a scan of the rendered
// text rather than as a query for a node: "no Member carries a computed percentile label" cannot
// be proved by looking for something. The scan is over the whole profile, so a badge added to a
// tile, the comparator or the header all fail it.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chartAriaLabel } from "../charts/chart-frame";
import { BAR_TEST_ID, GROUP_SERIES_LABEL, NO_GROUP_TEXT } from "./comparator-bars";
import { BACK_TEXT, MemberProfile, TILES_LABEL } from "./member-profile";
import { COMPARATOR_NOTE, MEMBER_PROFILE } from "./people-viewmodels.fixture";

const LIST_HREF = "/demo/people";

const renderProfile = (profile = MEMBER_PROFILE) =>
  render(<MemberProfile profile={profile} backHref={LIST_HREF} />);

/** The four headline tiles, scoped: a figure also appears in the comparator beside its median. */
const tiles = () => within(screen.getByRole("group", { name: TILES_LABEL }));

/** Every drawn bar, in render order: the Member's then the group's, for each of the metrics. */
const barWidths = (): readonly string[] =>
  screen.queryAllByTestId(BAR_TEST_ID).map((bar) => bar.style.width);

/** Every metric group of the comparator, by its accessible name. */
const comparatorGroups = (): readonly HTMLElement[] =>
  within(screen.getByRole("region", { name: "Comparator" })).getAllByRole("group");

describe("R-N16 — the profile surface", () => {
  it("names the Member, their kind and their Teams, and offers the way back to the list", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText(/Human · Platform/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `← ${BACK_TEXT}` })).toHaveAttribute("href", LIST_HREF);
  });

  it("renders the four headline tiles, each figure in its own unit", () => {
    renderProfile();

    // usd and usd_per_task carry two decimals; tokens are grouped whole numbers with no
    // compact notation, which would put a bare decimal in the payload T-E4 searches.
    expect(tiles().getByText("$310.50")).toBeInTheDocument();
    expect(tiles().getByText("42")).toBeInTheDocument();
    expect(tiles().getByText("$7.39")).toBeInTheDocument();
    expect(tiles().getByText("1,240,000")).toBeInTheDocument();
  });

  it("carries R-N7's change on a tile, and R-M12's reason where the figure is suppressed", () => {
    renderProfile();

    expect(tiles().getByText("+17% on the prior period")).toBeInTheDocument();
    expect(tiles().getByText("+24% on the prior period")).toBeInTheDocument();
    expect(tiles().getByText("-10% on the prior period")).toBeInTheDocument();
    expect(tiles().getByText("No prior period to compare against.")).toBeInTheDocument();
  });

  it("flags a partial period rather than withholding or pro-rating it (R-E2)", () => {
    renderProfile();

    expect(screen.getByText(/Sep 2026 · partial period/)).toBeInTheDocument();
    // The three complete months carry the label alone — the flag is a fact about the period,
    // not decoration on every tile.
    expect(screen.getAllByText("Aug 2026")).toHaveLength(3);
  });

  it("puts the WorkType mix through `ChartFrame`, which names the roll-up level (R-T28, R-X2)", () => {
    renderProfile();

    expect(
      screen.getByRole("group", { name: chartAriaLabel(MEMBER_PROFILE.workTypeMix) }),
    ).toBeInTheDocument();
    // R-X1 — the frame supplies the mirror, so the chart's figures are queryable DOM.
    expect(screen.getByRole("table", { name: /Template mix, grouped by WorkType/ })).toBeInTheDocument();
  });
});

describe("R-N17 — the comparator is paired bars", () => {
  it("names the comparison group in words: Repository, template, and how many Members", () => {
    renderProfile();

    expect(screen.getByText("api-gateway · implementation, 6 members")).toBeInTheDocument();
  });

  it("renders three metrics, each as the Member's value beside the group's median", () => {
    renderProfile();
    const groups = comparatorGroups();

    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Completed Jobs per period: Ada Lovelace beside the comparison group median",
      "Cost per completed Job: Ada Lovelace beside the comparison group median",
      "Tokens processed: Ada Lovelace beside the comparison group median",
    ]);

    // Both figures of a pair are written out, not only drawn: the bar is the comparison and the
    // text is the evidence, which is what a hidden mirror would otherwise have to supply.
    const cost = within(groups[1]);
    expect(cost.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(cost.getByText(GROUP_SERIES_LABEL)).toBeInTheDocument();
    expect(cost.getByText("$7.39")).toBeInTheDocument();
    expect(cost.getByText("$9.50")).toBeInTheDocument();
  });

  it("draws each bar as a whole-number percentage of the longer of its pair", () => {
    renderProfile();
    const bars = barWidths();

    // 8 against 5, 7.39 against 9.50, 1.24M against 0.9M — the longer of each pair is 100%.
    expect(bars).toEqual(["100%", "63%", "78%", "100%", "100%", "73%"]);
    // No decimal reaches a style attribute: `e2e/payload.spec.ts` searches the payload for bare
    // decimals matching an ungranted cost, and a rounded percentage cannot collide with one.
    expect(bars.some((width) => width.includes("."))).toBe(false);
  });

  it("says in the domain layer's own words why acceptance rate is not a fourth bar (R-N18)", () => {
    renderProfile();

    expect(screen.getByText(COMPARATOR_NOTE)).toBeInTheDocument();
    // Three bars, and none of them is acceptance rate. The note names the absence, which is why
    // the assertion is over the metric labels rather than over the rendered text.
    expect(comparatorGroups()).toHaveLength(3);
    const labels = comparatorGroups().map((group) => group.getAttribute("aria-label") ?? "");
    expect(labels.filter((label) => /accept/i.test(label))).toEqual([]);
  });

  it("renders the no-group state where the Member worked no pair in the period (R-V9)", () => {
    renderProfile({ ...MEMBER_PROFILE, comparator: { group: null, bars: [], note: COMPARATOR_NOTE } });

    expect(screen.getByText(NO_GROUP_TEXT)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Comparator" })).queryAllByRole("group"),
    ).toEqual([]);
  });
});

describe("R-M15 — ranking exists, and is never editorialised", () => {
  it("carries no rank, no percentile, no quartile and no 'top spender' anywhere on the profile", () => {
    const { container } = renderProfile();
    const text = container.textContent ?? "";

    for (const editorial of [
      /percentile/i,
      /\btop\s+\d/i,
      /top spend/i,
      /\brank(ed|ing)?\b/i,
      /\bquartile\b/i,
      /\bbottom\b/i,
      /\bleaderboard\b/i,
      /\b\d+(st|nd|rd|th)\s+of\b/i,
    ]) {
      expect(text).not.toMatch(editorial);
    }
  });

  it("draws two bars per metric and no distribution strip — a spread it does not have", () => {
    renderProfile();

    // The ViewModel carries exactly two numbers per metric, so a strip has nothing to draw a
    // position within. Two bars per group, three groups.
    expect(barWidths()).toHaveLength(6);
  });
});
