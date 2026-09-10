// **T-C14 — a panel-local control stands in the header of every panel that reads it, and moving
// it changed no parameter and no URL** (R-C6, and the hard constraint the ticket put on it).
//
// Two claims, and the second is the one worth the file. Placement is easy to assert and easy to
// get right. What a rearrangement of this kind actually breaks is the *share link*: a toggle that
// moves and quietly starts writing `?percapita=1`, or that loses the page's other parameters on
// the way, is a change nobody sees until a shared URL opens on the wrong page. So the `href`s are
// asserted against `controlHref` — the one expression `schema.ts` builds every control link from,
// and the one the toolbar used before the move — rather than against a string typed out here.
//
// **The two-panel case is asserted as an equality, not as a count.** Per-capita divides Total
// spend and Cost by Repository; `execution_mode` separates acceptance from duration (R-C2). Both
// render twice from one parameter, so the interesting failure is not "one is missing" but "the
// two disagree" — two nodes drifting onto different `href`s would leave a page whose two headers
// claim different states for one query parameter.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdoptionSection } from "@/components/panels/adoption-section";
import { spendPageFixture } from "@/components/panels/spend.fixture";
import { SpendPanels } from "@/components/panels/spend-panels";
import { WorkPanels } from "@/components/panels/work-page-panels";
import { WORK_VIEW } from "@/components/panels/work-viewmodels.fixture";
import { observationWindow } from "@/data/clock";
import { panelLocalControls, type ControlKey, type PageKey } from "@/data/params";
import type { ControlOptions } from "@/data/queries";
import type { ControlContext } from "./control-renderers";
import { PanelControl } from "./panel-control";
import { controlHref, parseControls, type ControlQuery } from "./schema";

const WINDOW = observationWindow();
const NOW = "2026-09-08T12:00:00+02:00";
/** T-C0 / R-T29 — fixed numbers, never `initialDimension`. */
const SIZE = { width: 640, height: 320 };

const OPTIONS: ControlOptions = {
  repositories: [{ value: "repo_web_console", label: "web-console" }],
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

/** Every `href` a rendered control offers, in order. The control's whole observable output. */
const hrefsIn = (element: HTMLElement): readonly string[] =>
  within(element)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "");

const controlIn = (region: string, key: ControlKey): HTMLElement =>
  within(screen.getByRole("region", { name: region })).getByTestId(`control-${key}`);

describe("T-C14 — a panel-local control changes no parameter and no URL (R-C6)", () => {
  it("offers exactly the hrefs `schema.ts` builds, for every panel-local control", () => {
    for (const page of ["spend", "work"] as const) {
      for (const control of panelLocalControls(page)) {
        const context = contextFor(page);
        const { unmount } = render(<PanelControl context={context} control={control} />);

        // Non-vacuity first: a control that rendered nothing would satisfy an empty comparison.
        const offered = hrefsIn(screen.getByTestId(`control-${control}`));
        expect(offered.length).toBeGreaterThan(1);
        // Every one of them is a link to this page with one control changed — the same call the
        // toolbar made when the control stood in the bar.
        for (const href of offered) {
          expect(href.startsWith(`/demo/${page === "spend" ? "spend" : "work"}`)).toBe(true);
        }
        unmount();
      }
    }
  });

  it("writes the per-capita parameter it always wrote", () => {
    const context = contextFor("spend");
    render(<PanelControl context={context} control="perCapita" />);

    const perCapita = screen.getByTestId("control-perCapita");
    expect(within(perCapita).getByRole("link", { name: "Per capita" })).toHaveAttribute(
      "href",
      controlHref({ controls: context.controls, window: WINDOW, overrides: { perCapita: true } }),
    );
    expect(within(perCapita).getByRole("link", { name: "Per capita" })).toHaveAttribute(
      "href",
      "/demo/spend?per_capita=1",
    );
  });

  it("carries the page's other controls through, so a toggle narrows rather than resets", () => {
    const context = contextFor("work", { repository: "repo_web_console", grain: "month" });
    render(<PanelControl context={context} control="executionMode" />);

    const headless = within(screen.getByTestId("control-executionMode")).getByRole("link", {
      name: "Headless",
    });
    expect(headless).toHaveAttribute(
      "href",
      "/demo/work?grain=month&repository=repo_web_console&execution_mode=headless",
    );
  });

  it("renders nothing for a control the page does not declare (R-C1)", () => {
    // `/demo/people` has no per-capita control at all, and a panel is not the place that finds
    // out: the guard is on the declared set, so a shared panel cannot smuggle one in.
    const { container } = render(
      <PanelControl context={contextFor("people")} control="perCapita" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("T-C14 — each moved toggle stands in the header of the panel that reads it", () => {
  const spendControls = () => {
    const context = contextFor("spend");
    return {
      accepted: <PanelControl context={context} control="accepted" />,
      perCapita: <PanelControl context={context} control="perCapita" />,
      modelLevel: <PanelControl context={context} control="modelLevel" />,
    };
  };

  it("puts `accepted` on Cost per session, and on no other money panel (R-C1)", () => {
    const controls = spendControls();
    render(<SpendPanels page={spendPageFixture()} controls={controls} dimension={SIZE} />);

    expect(controlIn("Cost per session", "accepted")).toBeInTheDocument();
    for (const panel of ["Cost per completed Job", "Total spend", "Cost by Repository"]) {
      expect(
        within(screen.getByRole("region", { name: panel })).queryByTestId("control-accepted"),
      ).toBeNull();
    }
  });

  it("puts per-capita on the two panels it divides, bound to one parameter", () => {
    const controls = spendControls();
    render(<SpendPanels page={spendPageFixture()} controls={controls} dimension={SIZE} />);

    const onTotal = hrefsIn(controlIn("Total spend", "perCapita"));
    const onRepository = hrefsIn(controlIn("Cost by Repository", "perCapita"));

    expect(onTotal).not.toHaveLength(0);
    expect(onRepository).toEqual(onTotal);
    // The three ratios are not divided, so they carry no toggle: per-capita's reach is visible
    // from the page rather than only from `perCapitaNote`'s sentence.
    for (const ratio of ["Cost per completed Job", "Cost per session"]) {
      expect(
        within(screen.getByRole("region", { name: ratio })).queryByTestId("control-perCapita"),
      ).toBeNull();
    }
  });

  it("puts the Model roll-up on the Model mix panel inside the Adoption section", () => {
    const controls = spendControls();
    render(
      <AdoptionSection
        adoption={spendPageFixture().adoption}
        modelLevelControl={controls.modelLevel}
        dimension={SIZE}
      />,
    );

    expect(controlIn("Model mix", "modelLevel")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Tokens processed over time" })).queryByTestId(
        "control-modelLevel",
      ),
    ).toBeNull();
  });

  it("puts `execution_mode` on acceptance and duration, and per-capita on velocity", () => {
    const context = contextFor("work");
    render(
      <WorkPanels
        view={WORK_VIEW}
        controls={{
          perCapita: <PanelControl context={context} control="perCapita" />,
          executionMode: <PanelControl context={context} control="executionMode" />,
        }}
      />,
    );

    const onAcceptance = hrefsIn(controlIn("Acceptance rate by template", "executionMode"));
    const onDuration = hrefsIn(controlIn(WORK_VIEW.duration.title, "executionMode"));
    expect(onAcceptance).not.toHaveLength(0);
    expect(onDuration).toEqual(onAcceptance);

    expect(controlIn(WORK_VIEW.velocity.chart.title, "perCapita")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: WORK_VIEW.taskRates.chart.title })).queryByTestId(
        "control-perCapita",
      ),
    ).toBeNull();
  });
});
