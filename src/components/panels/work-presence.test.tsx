// **Panel 6 — T-C1 and A27** (R-N12 item 6, R-N14, R-V1).
//
// **A27 — the spans render for `interactive` sessions only, and say so.** Twice, and neither
// sentence is written in the rendering layer: the pill reads `composition.executionMode`, whose
// type is the literal `"interactive"`, and the sentence is the ViewModel's own `note`, computed
// in the same pass as the figures. The restriction survives an empty selection, because R-V9's
// fallback replaces the chart and not the panel.
//
// **T-C1 — the mirror's values equal the rendered series.** The mirror is built in the domain
// layer on a path that never reads a `SeriesPoint` (R-T7), so on real data the two agree only if
// the same arithmetic produced both. What this file adds is the panel-level cross-check the
// mirror makes possible: the three span columns, summed out of the mirror, equal the three span
// totals the panel prints beside it, and their sum equals the machine allocation figure — which
// is T-U20's claim (`interactive + idle + afk = machine_allocation_duration_s`) as it reaches a
// reader. T-U20 proper is `src/domain/metrics/duration.test.ts` and `src/data/duration.fixture.test.ts`,
// over the real functions and the committed rows; a component may not import them (R-T6).
//
// **R-V1 — a chart stacks iff its ViewModel says `stackable: true`, and this panel never decides
// it.** Asserted as an absence over the module's source: no `stackable`, no `stackId`, no shape
// switch. `chart-shapes.tsx` is the only producer of a `stackId` in the product (T-C11).

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_TEXT } from "@/components/charts/chart-frame";
import { chartFixture } from "../charts/chart-viewmodels.fixture";
import { PresenceSpans } from "./work-presence";
import { PRESENCE_NOTE, PRESENCE_SPANS } from "./work-viewmodels.fixture";

const TITLE = PRESENCE_SPANS.chart.title;

const panel = () => screen.getByRole("region", { name: TITLE });

/** The mirror, as strings: the bucket row header first, then one cell per span. */
const mirrorRows = (): readonly (readonly string[])[] =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [...within(row).getAllByRole("rowheader"), ...within(row).getAllByRole("cell")].map(
        (cell) => cell.textContent ?? "",
      ),
    );

describe("A27 — the panel is interactive-only and says so", () => {
  it("names the restriction in the one word the ViewModel's type permits", () => {
    render(<PresenceSpans panel={PRESENCE_SPANS} />);

    expect(within(panel()).getByText("interactive sessions only")).toBeInTheDocument();
  });

  it("renders the ViewModel's note, with the counts it was computed beside", () => {
    render(<PresenceSpans panel={PRESENCE_SPANS} />);

    expect(within(panel()).getByText(PRESENCE_NOTE)).toBeInTheDocument();
    expect(PRESENCE_NOTE).toContain("30 of 42");
    expect(PRESENCE_NOTE).toContain("12 headless sessions are excluded");
  });

  it("keeps the restriction on screen where a filter empties the chart (R-V9)", () => {
    render(
      <PresenceSpans
        panel={{
          ...PRESENCE_SPANS,
          chart: chartFixture({ title: TITLE, rollUpLevel: "Presence span", series: [] }),
        }}
      />,
    );

    expect(within(panel()).getByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(within(panel()).getByText("interactive sessions only")).toBeInTheDocument();
    expect(within(panel()).getByText(PRESENCE_NOTE)).toBeInTheDocument();
  });
});

describe("the three spans and the whole they partition", () => {
  it("renders each span's duration and share, and the machine allocation they sum to", () => {
    render(<PresenceSpans panel={PRESENCE_SPANS} />);

    const labels = within(panel())
      .getAllByRole("term")
      .map((term) => term.textContent);
    const figures = within(panel())
      .getAllByRole("definition")
      .map((definition) => definition.textContent);

    expect(labels).toEqual(["Interactive", "Idle", "AFK", "Machine allocation"]);
    expect(figures).toEqual([
      "35 hr",
      "42% of machine time",
      "15 hr",
      "18% of machine time",
      "33 hr 20 min",
      "40% of machine time",
      "83 hr 20 min",
      "30 interactive sessions",
    ]);
  });
});

describe("T-C1 — the mirror, and what it cross-checks", () => {
  it("mirrors the three span series under the chart's own caption", () => {
    render(<PresenceSpans panel={PRESENCE_SPANS} />);

    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);

    expect(headers).toEqual(["Period", "Interactive", "Idle", "AFK"]);
    expect(mirrorRows()).toEqual([
      ["April", "40,000", "18,000", "40,000"],
      ["May", "43,000", "18,000", "40,000"],
      ["June", "43,000", "18,000", "40,000"],
    ]);
  });

  /** The panel-level shape of T-U20: the columns sum to the figures printed beside them. */
  it("agrees with the composition the panel prints: the spans sum to machine allocation", () => {
    render(<PresenceSpans panel={PRESENCE_SPANS} />);

    const seconds = mirrorRows().map((row) => row.slice(1).map((cell) => Number(cell.replace(/,/g, ""))));
    const columnTotal = (at: number) => seconds.reduce((running, row) => running + row[at], 0);

    for (const [at, slice] of PRESENCE_SPANS.composition.slices.entries()) {
      expect(columnTotal(at)).toBe(slice.total);
    }
    expect(columnTotal(0) + columnTotal(1) + columnTotal(2)).toBe(
      PRESENCE_SPANS.composition.total,
    );
  });
});

describe("R-V1 — the panel never decides whether it stacks", () => {
  const sources = import.meta.glob("./work-presence.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("holds no stacking expression at all", () => {
    const source = Object.values(sources)[0] as string;

    expect(source).toBeTruthy();
    expect(source.replace(/^\/\/.*$/gm, "")).not.toMatch(/stackId|stackable/);
  });
});
