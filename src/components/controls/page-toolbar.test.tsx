// **T-C6 — the toolbar renders exactly this page's global controls, and no greyed control appears
// anywhere** (R-C1, R-C6). Table-driven over the six pages.
//
// The claim narrowed when R-C6 split the declared set in two. It used to read "only its declared
// controls", and the declared set was the whole of what a page could show; the bar now holds the
// controls that narrow the *population* — period, grain, subject, Repository, template — and the
// four panel-local toggles render in the header of each panel that reads them
// (`panel-control.test.tsx`, T-C14). Both halves are asserted here: the bar shows every toolbar
// control, in order, **and** it shows no panel-local one. A control that was quietly dropped
// altogether therefore fails one file or the other rather than passing both.
//
// It also carries the structural half of **R-T25 — the query string is the single source of
// truth**. "No React state mirrors it" is asserted as an *absence over the directory*, not by
// reading the diff: `components/controls/` contains no `"use client"` and no state hook, so every
// module in it is a Server Component, where `useState` is not in scope and a mirror of the URL is
// not expressible. A future edit that reaches for one fails here.
//
// **The options are a literal, not a query.** `controlOptions` is a data-layer function taking a
// `Viewer`, and a component test may not build one: `src/components/**` imports `src/domain` for
// types only (R-T6), which is the rule that keeps access decisions out of the rendering layer.
// What the toolbar owes is "render the options it was handed, all of them, none of them greyed";
// what the *options* owe — that the Member list is a grant and the grain list is R-M11's answer —
// is `src/data/queries/controls.test.ts`'s claim, over the committed fixture and a real Viewer.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dataAsOf, observationWindow, type DataAsOf } from "@/data/clock";
import {
  DECLARED_CONTROLS,
  PAGES,
  PANEL_LOCAL_CONTROLS,
  panelLocalControls,
  tableControls,
  toolbarControls,
  type ControlKey,
  type PageKey,
} from "@/data/params";
import type { ControlOptions } from "@/data/queries";
import { AS_OF_PREFIX, PageToolbar, asOfText } from "./page-toolbar";
import { parseControls, periodOptions, type ControlQuery } from "./schema";

const NOW = "2026-09-08T12:00:00+02:00";
const WINDOW = observationWindow(NOW);

/**
 * R-N3.1's stamp, read off the committed fixture rather than invented (P6). It is a data-layer
 * value and takes no viewer, so a component test may hold it — what it *is* is asserted in
 * `src/data/clock.test.ts`, over the same rows the product serves.
 */
const AS_OF = dataAsOf(NOW);

const optionsWith = (grains: ControlOptions["grains"]): ControlOptions => ({
  repositories: [
    { value: "repo_web_console", label: "web-console" },
    { value: "repo_api_gateway", label: "api-gateway" },
  ],
  workTypes: [
    { value: "implementation", label: "Implementation" },
    { value: "bugfix", label: "Bug fix" },
  ],
  teams: [{ value: "team_platform", label: "Platform" }],
  members: [{ value: "mem_0001", label: "Ada Lovelace" }],
  grains,
});

const toolbar = (
  page: PageKey,
  query: ControlQuery = {},
  grains: ControlOptions["grains"] = ["week", "month"],
) => {
  const controls = parseControls({ page, orgSlug: "demo", window: WINDOW, now: NOW, query });
  return render(
    <PageToolbar
      controls={controls}
      options={optionsWith(grains)}
      window={WINDOW}
      asOf={AS_OF}
    />,
  );
};

/** The controls actually on screen, in the order they appear. */
const rendered = (): readonly (string | null)[] =>
  screen.queryAllByTestId(/^control-/).map((node) => node.getAttribute("data-testid"));

const testIds = (page: PageKey): readonly string[] =>
  toolbarControls(page).map((key) => `control-${key}`);

const CONTROLLED = PAGES.filter((page) => toolbarControls(page).length > 0);

describe("T-C6 — the toolbar renders exactly this page's global controls (R-C1, R-C6)", () => {
  it.each(CONTROLLED)("%s renders exactly its toolbar set, in declaration order", (page) => {
    toolbar(page);
    expect(rendered()).toEqual(testIds(page));
  });

  it.each(CONTROLLED)("%s holds no panel-local control in the bar (R-C6)", (page) => {
    toolbar(page);
    const shown = new Set(rendered());
    for (const key of PANEL_LOCAL_CONTROLS) expect(shown.has(`control-${key}`)).toBe(false);
  });

  it("moves controls out of the bar and loses none of them (R-C6)", () => {
    // The three placements are a partition of the declared set, on every page. Without this the
    // split could drop a control from all three lists and every placement assertion would still
    // pass — which is exactly how `sort` could have stopped being a parameter when ticket 63
    // took its widget out of the bar.
    for (const page of PAGES) {
      expect(
        [...toolbarControls(page), ...panelLocalControls(page), ...tableControls(page)].sort(),
      ).toEqual([...DECLARED_CONTROLS[page]].sort());
    }
    expect(panelLocalControls("spend")).toEqual(["accepted", "perCapita", "modelLevel"]);
    expect(panelLocalControls("work")).toEqual(["executionMode", "perCapita"]);
    expect(tableControls("people")).toEqual(["sort"]);
    for (const page of PAGES.filter((candidate) => candidate !== "people")) {
      expect(tableControls(page)).toEqual([]);
    }
  });

  it("holds three groups on `/demo/people`: period, Team and kind (ticket 63)", () => {
    // The bar used to carry a fourth, a Sort menu listing every column twice. The table's own
    // headings already show the ordering and change it (R-N15), so the menu was a second control
    // for one parameter — and the only one of the two that could disagree with what was on screen.
    toolbar("people");

    expect(rendered()).toEqual(["control-period", "control-team", "control-memberKind"]);
    expect(screen.queryByTestId("control-sort")).toBeNull();
  });

  it("offers `/demo/people` months only, opening on the current one (ticket 63)", () => {
    // "All data" does not scale on this page: the table is one row per Member over the period,
    // and a period of everything is a figure nobody can act on. Months are what the Organization
    // is billed in (R-M5) and what `/demo` already reports.
    toolbar("people");
    const control = within(screen.getByTestId("control-period"));

    expect(control.getAllByRole("link").map((link) => link.textContent)).toEqual(
      periodOptions("people", WINDOW).map((option) => option.label),
    );
    expect(control.queryByRole("link", { name: "All data" })).toBeNull();
    expect(screen.getByTestId("control-period")).toHaveTextContent("September 2026");
  });

  it.each(CONTROLLED)("%s puts the period control first (R-N3)", (page) => {
    toolbar(page);
    const [firstControl] = rendered();
    expect(["control-period", "control-dateRange"]).toContain(firstControl);
  });

  it("renders the bar with no control at all where a page declares none (R-N3.1)", () => {
    // **Amended by ticket 45.** R-N3 made the bar *absent* here, on the argument that an empty
    // toolbar promises controls that never arrive. It is no longer empty: R-N3.1 puts the as-of
    // stamp in it on every surface, and a freshness claim missing from one of six reads as that
    // one being stale. What survives of the old rule is asserted instead — the bar holds **no
    // control**, so the page still offers nothing its panels cannot use.
    expect(DECLARED_CONTROLS.projection).toEqual([]);
    toolbar("projection");

    expect(screen.getByTestId("page-toolbar")).toBeInTheDocument();
    expect(rendered()).toEqual([]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("data-as-of")).toBeVisible();
  });

  it.each(CONTROLLED)("%s greys nothing — every offered value is a live link", (page) => {
    // The stamp is not a control and carries no link, so it cannot satisfy this on its own.
    toolbar(page);
    const bar = screen.getByTestId("page-toolbar");

    expect(within(bar).queryAllByRole("link", { hidden: true }).length).toBeGreaterThan(0);
    for (const link of within(bar).queryAllByRole("link", { hidden: true })) {
      expect(link).not.toHaveAttribute("aria-disabled");
      expect(link).toHaveAttribute("href");
    }
    for (const button of within(bar).queryAllByRole("button", { hidden: true })) {
      expect(button).toBeEnabled();
    }
  });

  it("shows no control a page's panels cannot use, on any page", () => {
    const everyControl = new Set<ControlKey>();
    for (const page of PAGES) for (const key of DECLARED_CONTROLS[page]) everyControl.add(key);

    for (const page of PAGES) {
      const { unmount } = toolbar(page);
      const shown = new Set(rendered());
      // A set of strings rather than `toolbarControls(page).includes(key)`, because the sweep is
      // over *every* control the product has and the bar's list no longer holds all of them:
      // `sort` is declared on `/demo/people` and rendered by its table (ticket 63), so it must
      // come out of this loop false rather than fail to typecheck against a narrower list.
      const inBar = new Set<string>(toolbarControls(page));
      for (const key of everyControl) {
        expect(shown.has(`control-${key}`)).toBe(inBar.has(key));
      }
      unmount();
    }
  });
});

describe("The toolbar offers the grains it was given, and only those (R-C1, A3)", () => {
  const grainLabels = (): readonly string[] =>
    within(screen.getByTestId("control-grain"))
      .getAllByRole("link")
      .map((link) => link.textContent ?? "");

  it("offers week and month where day grain is not on offer", () => {
    toolbar("spend");
    expect(grainLabels()).toEqual(["Week", "Month"]);
  });

  it("offers day the moment the range can carry it", () => {
    toolbar("spend", { period: "2026-08" }, ["day", "week", "month"]);
    expect(grainLabels()).toEqual(["Day", "Week", "Month"]);
  });

  it("never renders an unavailable grain as a disabled control", () => {
    toolbar("spend");
    expect(screen.queryByText("Day")).toBeNull();
  });
});

describe("Controls are links, and the link is the whole mechanism (R-T25)", () => {
  it("writes the control it sets into the href, and nothing else", () => {
    toolbar("spend");
    const month = within(screen.getByTestId("control-grain")).getByRole("link", { name: "Month" });

    expect(month).toHaveAttribute("href", "/demo/spend?grain=month");
  });

  it("spells a filter's off state in words, and it is always reachable (ticket 63)", () => {
    // It read "All team" — the control's own label, lowercased, with a word in front of it — and
    // disagreed with the "all teams" R-C7's sentence prints for the same state. The link is the
    // bare route, which is what makes a filter undoable rather than merely re-selectable.
    toolbar("people");
    const team = within(screen.getByTestId("control-team"));

    expect(team.getByRole("link", { name: "All teams" })).toHaveAttribute("href", "/demo/people");
    expect(team.queryByRole("link", { name: "All team" })).toBeNull();
  });

  it("offers a reset to the bare route once a control leaves its default (R-C4)", () => {
    const { unmount } = toolbar("spend");
    expect(screen.queryByRole("link", { name: "Reset" })).toBeNull();
    unmount();

    toolbar("spend", { grain: "month" });
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/demo/spend");
  });

  it("names every period the observation window carries", () => {
    toolbar("spend");
    const labels = within(screen.getByTestId("control-period"))
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(labels).toEqual(periodOptions("spend", WINDOW).map((option) => option.label));
    expect(labels).toContain("All data");
  });

  it("offers `/demo` the fixture's months and no whole window (R-N6, ticket 39)", () => {
    // R-C1's other half, read from the surface: a page shows the options its own control has,
    // and "All data" is not one of `/demo`'s. The current month is selected, being its default.
    toolbar("summary");
    const control = within(screen.getByTestId("control-period"));

    expect(control.getAllByRole("link").map((link) => link.textContent)).toEqual(
      periodOptions("summary", WINDOW).map((option) => option.label),
    );
    expect(control.queryByRole("link", { name: "All data" })).toBeNull();
    expect(screen.getByTestId("control-period")).toHaveTextContent("September 2026");
  });

  it("carries the page's other parameters through the date-range form (R-N20)", () => {
    toolbar("history", { work_type: "bugfix" });

    expect(screen.getByLabelText("From")).toHaveValue(WINDOW.start);
    expect(screen.getByLabelText("To")).toHaveValue(WINDOW.end);
    // The carried parameter is what makes narrowing the dates a *narrowing* rather than a reset:
    // a `GET` form replaces the query string wholesale, so the template filter rides as a hidden
    // field or it is lost.
    expect(screen.getByDisplayValue("bugfix")).toHaveAttribute("name", "work_type");
  });

  it("applies the date range on change, with no Apply button (R-N20)", () => {
    toolbar("history");
    const bar = screen.getByTestId("page-toolbar");

    // The button is gone, and the two inputs are the native control in its place: `required` and
    // the window's own bounds are what `AutoSubmitForm` checks before it submits anything.
    expect(within(bar).queryByRole("button", { name: "Apply" })).toBeNull();
    for (const label of ["From", "To"]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("type", "date");
      expect(field).toBeRequired();
      expect(field).toHaveAttribute("min", WINDOW.start);
      expect(field).toHaveAttribute("max", WINDOW.end);
    }
  });
});

describe("R-T25 — no React state mirrors the query string", () => {
  const sources = import.meta.glob("./*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  const authored = Object.entries(sources).filter(([path]) => !path.includes(".test."));

  it("reads every module in the control layer", () => {
    expect(authored.length).toBeGreaterThanOrEqual(4);
  });

  // The *directive*, not the phrase: these files discuss `"use client"` in their comments, and a
  // substring match would be satisfied by the prose rather than by the absence it asserts.
  const DIRECTIVE = /^[ \t]*["']use client["']/m;

  it.each(authored)("%s is a Server Component module — no 'use client'", (_path, source) => {
    expect(DIRECTIVE.test(source)).toBe(false);
  });

  it.each(authored)("%s holds no state hook and no client URL hook", (_path, source) => {
    for (const hook of [
      "useState",
      "useReducer",
      "useEffect",
      "useRef",
      "useContext",
      "createContext",
      "useSearchParams",
      "useRouter",
    ]) {
      expect(source).not.toContain(`${hook}(`);
    }
  });
});

/**
 * **T-C21 — the as-of stamp stands in the bar, on every surface** (R-N3.1, A39).
 *
 * Three claims, and the third is the one the requirement is actually about: the stamp names the
 * session it was read off, so "matches the History top row" is an identity the E2E layer can
 * assert (T-E15) rather than a coincidence between two formatted strings. What the *value* is —
 * the greatest `ended_at`, printed as that session's start in the Organization's timezone — is
 * `src/domain/observation.test.ts`'s and `src/data/clock.test.ts`'s, over real rows.
 */
describe("T-C21 — the as-of stamp (R-N3.1)", () => {
  const stamp = () => screen.getByTestId("data-as-of");

  it.each(PAGES)("stands in %s's bar, whatever that page declares", (page) => {
    toolbar(page);

    expect(stamp()).toBeVisible();
    expect(stamp()).toHaveTextContent(asOfText(AS_OF as DataAsOf));
  });

  it("reads as where the rows stop, not as a refresh the product does not do", () => {
    toolbar("spend");

    expect(AS_OF_PREFIX).toBe("Data to");
    expect(stamp().textContent).toMatch(/^Data to \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("names the session it was read off, which is what the History row is checked against", () => {
    toolbar("history");

    expect(stamp()).toHaveAttribute("data-session", (AS_OF as DataAsOf).sessionId);
  });

  it("is absent, not blank, for an Organization holding no session", () => {
    const controls = parseControls({
      page: "spend",
      orgSlug: "demo",
      window: WINDOW,
      now: NOW,
      query: {},
    });
    render(
      <PageToolbar controls={controls} options={optionsWith(["week"])} window={WINDOW} asOf={null} />,
    );

    expect(screen.queryByTestId("data-as-of")).toBeNull();
  });
});
