// **T-C6 — a page renders only its declared controls, and no greyed control appears anywhere**
// (R-C1). Table-driven over the six pages.
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
import { observationWindow } from "@/data/clock";
import { DECLARED_CONTROLS, PAGES, type ControlKey, type PageKey } from "@/data/params";
import type { ControlOptions } from "@/data/queries";
import { PageToolbar } from "./page-toolbar";
import { parseControls, periodOptions, type ControlQuery } from "./schema";

const WINDOW = observationWindow();
const NOW = "2026-09-08T12:00:00+02:00";

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
  sortColumns: [
    { value: "completedTasks", label: "Completed Jobs" },
    { value: "cost", label: "Cost" },
  ],
});

const toolbar = (
  page: PageKey,
  query: ControlQuery = {},
  grains: ControlOptions["grains"] = ["week", "month"],
) => {
  const controls = parseControls({ page, orgSlug: "demo", window: WINDOW, now: NOW, query });
  return render(
    <PageToolbar controls={controls} options={optionsWith(grains)} window={WINDOW} />,
  );
};

/** The controls actually on screen, in the order they appear. */
const rendered = (): readonly (string | null)[] =>
  screen.queryAllByTestId(/^control-/).map((node) => node.getAttribute("data-testid"));

const testIds = (page: PageKey): readonly string[] =>
  DECLARED_CONTROLS[page].map((key) => `control-${key}`);

const CONTROLLED = PAGES.filter((page) => DECLARED_CONTROLS[page].length > 0);

describe("T-C6 — a page renders only its declared controls (R-C1)", () => {
  it.each(CONTROLLED)("%s renders exactly its declared set, in declaration order", (page) => {
    toolbar(page);
    expect(rendered()).toEqual(testIds(page));
  });

  it.each(CONTROLLED)("%s puts the period control first (R-N3)", (page) => {
    toolbar(page);
    const [firstControl] = rendered();
    expect(["control-period", "control-dateRange"]).toContain(firstControl);
  });

  it("renders no toolbar at all where a page declares none (R-N3)", () => {
    expect(DECLARED_CONTROLS.projection).toEqual([]);
    const { container } = toolbar("projection");
    // Absent, not empty: no landmark, no bar, no element of any kind.
    expect(screen.queryByTestId("page-toolbar")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it.each(CONTROLLED)("%s greys nothing — every offered value is a live link", (page) => {
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
      for (const key of everyControl) {
        expect(shown.has(`control-${key}`)).toBe(DECLARED_CONTROLS[page].includes(key));
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
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
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
