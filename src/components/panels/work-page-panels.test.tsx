// **R-N12 — the six panels, in order** — and **R-T6 — they compute nothing**, asserted over the
// modules' own source because a rendering test cannot prove an absence.
//
// The order is a requirement rather than a layout preference (`spec.md` § 3.3), so it is asserted
// on the one thing a reader actually meets in order: the six `<h2>` headings, top to bottom.
//
// **T-C8 — the overlap statement is rendered once.** Where the subject control groups by Team the
// ViewModel carries `overlapNote`, and `ChartFrame` renders it for every chart in the product
// (R-V3). A panel that also rendered it would print the same sentence twice, which is why the
// assertion is on the *count* and not on the presence.
//
// **T-C7 — an emptying filter empties the charts and not the page.** Every heading, every
// restriction and the whole shell stay exactly where they were (R-V9).

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_TEXT } from "@/components/charts/chart-frame";
import type { ChartViewModel } from "@/domain/viewmodel";
import { chartFixture } from "../charts/chart-viewmodels.fixture";
import { WorkPanels } from "./work-page-panels";
import { PANEL_TITLES, WORK_VIEW } from "./work-viewmodels.fixture";

const OVERLAP_NOTE = "3 Members belong to more than one Team; totals overlap.";

/** The same chart, emptied — what a filter that matches nothing leaves behind (R-V9). */
const emptied = (chart: ChartViewModel): ChartViewModel =>
  chartFixture({ title: chart.title, rollUpLevel: chart.rollUpLevel, series: [] });

const EMPTY_VIEW = {
  ...WORK_VIEW,
  velocity: { ...WORK_VIEW.velocity, chart: emptied(WORK_VIEW.velocity.chart) },
  acceptance: WORK_VIEW.acceptance.map((panel) => ({ ...panel, chart: emptied(panel.chart) })),
  taskRates: { ...WORK_VIEW.taskRates, chart: emptied(WORK_VIEW.taskRates.chart) },
  incompleteAges: { ...WORK_VIEW.incompleteAges, chart: emptied(WORK_VIEW.incompleteAges.chart) },
  duration: { ...WORK_VIEW.duration, chart: emptied(WORK_VIEW.duration.chart) },
  presenceSpans: { ...WORK_VIEW.presenceSpans, chart: emptied(WORK_VIEW.presenceSpans.chart) },
};

const headings = (): readonly (string | null)[] =>
  screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("R-N12 — the panels, in this order", () => {
  it("renders six panels, top to bottom, in the order the spec declares", () => {
    render(<WorkPanels view={WORK_VIEW} />);

    expect(headings()).toEqual(PANEL_TITLES);
  });

  it("gives every panel an accessible name a reader can navigate by", () => {
    render(<WorkPanels view={WORK_VIEW} />);

    for (const title of PANEL_TITLES) {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
  });

  it("puts the acceptance small multiples second, all five of them", () => {
    render(<WorkPanels view={WORK_VIEW} />);

    const acceptance = screen.getByRole("region", { name: PANEL_TITLES[1] });

    expect(within(acceptance).getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });
});

describe("T-C7 — an emptying filter empties the charts, not the page", () => {
  it("keeps every heading and every note while the charts say there is no data", () => {
    render(<WorkPanels view={EMPTY_VIEW} />);

    expect(headings()).toEqual(PANEL_TITLES);
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(10);
    expect(screen.getByText("interactive sessions only")).toBeInTheDocument();
  });
});

describe("T-C8 — a Team grouping states the overlap once", () => {
  it("renders the ViewModel's overlap statement exactly once", () => {
    render(
      <WorkPanels
        view={{
          ...WORK_VIEW,
          velocity: {
            ...WORK_VIEW.velocity,
            chart: chartFixture({
              title: WORK_VIEW.velocity.chart.title,
              rollUpLevel: "Team",
              overlapNote: OVERLAP_NOTE,
            }),
          },
        }}
      />,
    );

    expect(screen.getAllByText(OVERLAP_NOTE)).toHaveLength(1);
  });
});

describe("R-T6 — the panel modules compute nothing", () => {
  const sources = import.meta.glob("./work-*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  const authored = Object.entries(sources).filter(
    ([path]) => !path.includes(".test.") && !path.includes(".fixture."),
  ) as readonly (readonly [string, string])[];

  /** Comments argue about aggregation; code must not perform it. Only code is scanned. */
  const codeLines = (source: string): readonly string[] =>
    source.split("\n").filter((line) => !line.trimStart().startsWith("//"));

  const code = (source: string): string => codeLines(source).join("\n");

  it("reads every authored module in this directory", () => {
    expect(authored.map(([path]) => path)).toEqual([
      "./work-acceptance.tsx",
      "./work-format.ts",
      "./work-page-panels.tsx",
      "./work-panels.tsx",
      "./work-presence.tsx",
      "./work-section.tsx",
    ]);
  });

  it.each(authored)("%s aggregates nothing", (_path, source) => {
    expect(code(source)).not.toMatch(/\.(reduce|filter|sort|concat|flatMap)\(|Math\.(max|min)\(/);
  });

  it.each(authored)("%s reaches the domain layer for types only (R-T33)", (_path, source) => {
    const reaching = codeLines(source).filter(
      (line) => line.startsWith("import ") && line.includes('"@/domain'),
    );

    for (const line of reaching) expect(line).toMatch(/^import type /);
  });

  /** A21, structurally: no module here holds an expression that could pool the five rates. */
  it.each(authored)("%s synthesises no cross-WorkType acceptance figure", (_path, source) => {
    expect(code(source)).not.toMatch(/panels\.length|acceptance\.length|acceptance\.reduce/);
  });
});
