// **T-C15 — the active-filter sentence says what the page in front of you is** (R-C7).
//
// Two properties, and the second is the one that makes the sentence worth rendering:
//
//   * **every filter has a phrase, set or not.** "all templates" is in the sentence when nobody
//     chose a template, because the reading a viewer needs is *what population is this figure
//     over* — and an omitted phrase makes that answer depend on knowing what could have been
//     there. A sentence that only listed the narrowings would be shortest on the page where the
//     viewer most needs to know nothing is narrowed.
//   * **it reads the URL and nothing else.** Every phrase below is asserted against a
//     `ControlSet` parsed from a query string, so the sentence cannot drift from the controls: a
//     filter that changed the page and not the sentence fails here.
//
// Period and sort are asserted *absent* on purpose. The period control prints its own current
// value in the bar; sort is an ordering rather than a narrowing, and since ticket 63 its control
// is the People table's own headings.
//
// The phrases spell the controls' own labels — **Aggregation** and **Per** since ticket 63 — so
// the sentence and the bar above it read as one claim rather than as two vocabularies.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { observationWindow } from "@/data/clock";
import type { PageKey } from "@/data/params";
import type { ControlOptions } from "@/data/queries";
import { ActiveFilters, activeFilterPhrases } from "./active-filters";
import type { ControlContext } from "./control-renderers";
import { parseControls, type ControlQuery } from "./schema";

const NOW = "2026-09-08T12:00:00+02:00";
const WINDOW = observationWindow(NOW);

const OPTIONS: ControlOptions = {
  repositories: [
    { value: "repo_mobile_app", label: "mobile-app" },
    { value: "repo_web_console", label: "web-console" },
  ],
  workTypes: [{ value: "bugfix", label: "Bug fix" }],
  teams: [{ value: "team_platform", label: "Platform" }],
  members: [{ value: "mem_0001", label: "Ada Lovelace" }],
  grains: ["week", "month"],
};

const contextFor = (page: PageKey, query: ControlQuery = {}): ControlContext => ({
  controls: parseControls({ page, orgSlug: "demo", window: WINDOW, now: NOW, query }),
  options: OPTIONS,
  window: WINDOW,
});

const sentence = (page: PageKey, query: ControlQuery = {}): string => {
  render(<ActiveFilters context={contextFor(page, query)} />);
  return screen.getByTestId("active-filters").textContent ?? "";
};

describe("T-C15 — the active-filter sentence (R-C7)", () => {
  it("reads the spec's own example back, from the query string that produces it", () => {
    expect(
      sentence("spend", { grain: "week", subject: "team", repository: "repo_mobile_app" }),
    ).toBe("Week aggregation · per Team · mobile-app · all templates");
  });

  it("names the off state of every filter nobody set", () => {
    expect(sentence("spend")).toBe(
      "Week aggregation · per Organisation · all repositories · all templates",
    );
  });

  it("follows the page's own declared controls rather than one fixed list", () => {
    // `/demo/people` groups by neither grain nor subject and filters on Team and kind instead,
    // so its sentence is a different set of phrases — not the same set with blanks in it.
    expect(activeFilterPhrases(contextFor("people", { member_kind: "human" }))).toEqual([
      "all teams",
      "Humans only",
    ]);
    expect(activeFilterPhrases(contextFor("history"))).toEqual([
      "all Members",
      "all templates",
      "all repositories",
    ]);
  });

  it("names the Team that narrowed the page, as a Team (ticket 63)", () => {
    // A bare "Platform" reads as a Repository or a template beside the other phrases. The
    // sentence is the one place a reader is told *which dimension* narrowed the page, so the
    // phrase carries the dimension and the off state stays the plural the menu offers.
    expect(activeFilterPhrases(contextFor("people", { team: "team_platform" }))).toEqual([
      "Platform team",
      "all kinds",
    ]);
    expect(activeFilterPhrases(contextFor("people", { team: "team_nowhere" }))).toEqual([
      "all teams",
      "all kinds",
    ]);
  });

  it("says neither the period nor the sort", () => {
    const read = sentence("people", { period: "2026-08", sort: "-cost" });

    expect(read).not.toContain("August");
    expect(read).not.toContain("Cost");
  });

  it("renders nothing at all where the page filters nothing", () => {
    // `/demo` declares the period alone and `/demo/projection` declares nothing: a sentence
    // holding no phrase is an empty line under a heading, which is worse than no line.
    for (const page of ["summary", "projection"] as const) {
      expect(activeFilterPhrases(contextFor(page))).toEqual([]);
      const { container, unmount } = render(<ActiveFilters context={contextFor(page)} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("names a Member and a Team by the label the data layer resolved (R-A6)", () => {
    // The names come from `ControlOptions`, which the query built against the viewer's grants —
    // so a Member the viewer cannot resolve is not in the list and cannot be named here.
    expect(activeFilterPhrases(contextFor("history", { member: "mem_0001" }))).toContain(
      "Ada Lovelace",
    );
    expect(activeFilterPhrases(contextFor("history", { member: "mem_9999" }))).toContain(
      "all Members",
    );
  });
});
