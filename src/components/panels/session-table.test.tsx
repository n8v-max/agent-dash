// **`/demo/history`'s flat table** — R-N19's ten columns, R-N20's newest-first default and
// client pagination at 50, R-N20.1's expandable row, and R-N21's plain-text Task key.
//
// **What is asserted here and what is not.** The sort and the filters are *not* this component's
// claim: they were resolved in the domain layer and arrived on the ViewModel (R-T6), and
// `src/domain/viewmodel.test.ts` owns them. What this component owes is that it renders the rows
// in the order it was given, that the slice it shows is the slice the pager says it is, that a
// row expands to R-N20.1's detail, and that the Task key is text.
//
// **The 50 is for readability, not performance** (R-N20, R-T36) — so the assertion is about what
// is on screen, not about what was fetched. Every row is in the component's hands; only fifty are
// in the reader's eyes.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HistoryRow } from "@/data/queries";
import type { TableColumn, TableViewModelOf } from "@/domain/viewmodel";
import { SessionTable } from "./session-table";

const COLUMNS = [
  { key: "startedAt", label: "Started", numeric: false, sortable: true },
  { key: "member", label: "Member", numeric: false, sortable: true },
  { key: "workType", label: "Template", numeric: false, sortable: true },
  { key: "repository", label: "Repository", numeric: false, sortable: true },
  { key: "taskKey", label: "Job", numeric: false, sortable: true },
  { key: "executionMode", label: "Mode", numeric: false, sortable: true },
  { key: "accepted", label: "Accepted", numeric: false, sortable: true },
  { key: "duration", label: "Duration (s)", numeric: true, sortable: true },
  { key: "tokens", label: "Tokens", numeric: true, sortable: true, unit: "tokens" },
  { key: "cost", label: "Cost", numeric: true, sortable: true, unit: "usd" },
] as const satisfies readonly TableColumn[];

const rowAt = (at: number): HistoryRow => ({
  key: `ses_${String(at).padStart(4, "0")}`,
  cells: [
    `${at} Sep 2026, 09:00`,
    "Ada Lovelace",
    "Implementation",
    "web-console",
    `equilibrio/web-console#${400 + at}`,
    "headless",
    at % 2 === 0 ? "yes" : "no",
    620 + at,
    110_660,
    12.34,
  ],
  detail: {
    sessionId: `ses_${String(at).padStart(4, "0")}`,
    taskKey: `equilibrio/web-console#${400 + at}`,
    tokensByClass: {
      uncached_input: 12_400,
      cache_read: 88_100,
      cache_write: 6_250,
      output: 3_910,
    },
    tokensProcessed: 110_660,
    modelMix: [{ key: "claude-opus-5", label: "Claude Opus 5", value: 110_660 }],
  },
  // R-N20.2 — every third attempt fanned out to two sub-agents.
  children:
    at % 3 === 0
      ? [1, 2].map((child) => ({
          key: `ses_${String(at).padStart(4, "0")}_${child}`,
          startedAt: `${at} Sep 2026, 09:${String(child * 10).padStart(2, "0")}`,
          durationSeconds: 120 * child,
          cost: 1.5 * child,
          detail: {
            sessionId: `ses_${String(at).padStart(4, "0")}_${child}`,
            taskKey: `equilibrio/web-console#${400 + at}`,
            tokensByClass: {
              uncached_input: 1_240,
              cache_read: 8_810,
              cache_write: 625,
              output: 391,
            },
            tokensProcessed: 11_066,
            modelMix: [{ key: "gpt-5-nano", label: "GPT-5 nano", value: 11_066 }],
          },
        }))
      : [],
});

const tableOf = (count: number): TableViewModelOf<HistoryRow> => ({
  columns: [...COLUMNS],
  rows: Array.from({ length: count }, (_unused, at) => rowAt(at + 1)),
  sort: { column: "startedAt", direction: "desc" },
  empty: count === 0,
  note: null,
});

const table = (count: number, pageSize = 50) =>
  render(
    <SessionTable table={tableOf(count)} pageSize={pageSize} caption="Agent sessions, newest first" />,
  );

/** Body rows only, and only the session rows — an expanded row is a `<tr>` too. */
const sessionRows = (): readonly HTMLElement[] =>
  screen.getAllByRole("button", { name: /Token classes and Model mix/ });

describe("R-N19 — one row per AgentSession, in ten columns", () => {
  /**
   * **The raw rows read as the same kind of figure the aggregates do** (ticket 41). The Cost
   * column carried a bare `maximumFractionDigits: 2`, so `/demo/history` said `12.34` where
   * `/demo/spend` said `$12.34` over the same sessions.
   */
  it("renders the Cost column as money, in the unit its column declares", () => {
    table(1);

    expect(screen.getByRole("cell", { name: "$12.34" })).toBeInTheDocument();
    // Tokens read in their own unit (ticket 69) — `111K`, not six digits in a column nobody
    // compares — and the duration column, which names its unit in its own label, is untouched.
    expect(screen.getByRole("cell", { name: "111K" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "621" })).toBeInTheDocument();
  });

  it("renders the ten columns the ViewModel declares, in that order", () => {
    table(3);

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent?.trim()),
    ).toEqual(["Expand", ...COLUMNS.map((column) => column.label)]);
  });

  it("renders the rows in the order it was handed them, and reorders nothing", () => {
    table(3);

    const started = screen.getAllByRole("row").slice(1).map((row) => row.textContent);

    expect(started[0]).toContain("1 Sep 2026");
    expect(started[2]).toContain("3 Sep 2026");
  });

  it("marks the sorted column with the direction the ViewModel resolved (R-N20)", () => {
    table(3);

    expect(screen.getByRole("columnheader", { name: "Started" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: "Member" })).not.toHaveAttribute("aria-sort");
  });
});

describe("R-N21 — the Task key is plain text", () => {
  it("renders `owner/repo#number` and builds no link from it", () => {
    table(3);

    expect(screen.getByText("equilibrio/web-console#401")).toBeInTheDocument();
    // The external tracker is imaginary, and a dead link is worse than none.
    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});

describe("R-N20 — client pagination at 50, for readability", () => {
  it("shows the first fifty of fifty-five, and says which fifty", () => {
    table(55);

    expect(sessionRows()).toHaveLength(50);
    expect(screen.getByTestId("pagination-summary")).toHaveTextContent(
      "Showing 1–50 of 55 sessions",
    );
  });

  it("shows the remainder on the next page", async () => {
    table(55);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(sessionRows()).toHaveLength(5);
    expect(screen.getByTestId("pagination-summary")).toHaveTextContent(
      "Showing 51–55 of 55 sessions",
    );
  });

  it("offers no pager at all where every row fits on one page", () => {
    table(50);

    expect(screen.queryByRole("navigation", { name: "Session pages" })).toBeNull();
    expect(sessionRows()).toHaveLength(50);
  });
});

describe("T-C23 / R-N20.2 — a root expands to the agents that worked it", () => {
  it("lists nothing extra for a session that fanned out to no sub-agent", async () => {
    table(3);
    // Rows 1 and 2 have no children; row 3 has two.
    const [first] = sessionRows();

    await userEvent.click(first as HTMLElement);

    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("session-children")).toBeNull();
  });

  it("names the fan-out in the expander's label, before anyone opens it", () => {
    table(3);

    expect(
      screen.getByRole("button", { name: /and 2 sub-agent sessions for session/ }),
    ).toBeInTheDocument();
    expect(sessionRows()).toHaveLength(3);
  });

  it("lists each child indented, with its own tokens, cost and Model mix", async () => {
    table(3);
    const rows = sessionRows();

    await userEvent.click(rows[2] as HTMLElement);

    const children = within(screen.getByTestId("session-children"));
    // Two children, one list item each.
    expect(children.getAllByRole("listitem")).toHaveLength(2);
    expect(children.getByText(/2 agents ran/)).toBeInTheDocument();
    // Its own Model, not its root's: a fan-out that reached for a cheaper model is the reading
    // this list exists for.
    expect(children.getAllByText("GPT-5 nano")).toHaveLength(2);
    expect(children.getByText("$1.50")).toBeInTheDocument();
    expect(children.getAllByText("11,066 tokens")).toHaveLength(2);
  });

  it("says the figures above already hold them, so nothing invites adding them up", async () => {
    table(3);
    const rows = sessionRows();

    await userEvent.click(rows[2] as HTMLElement);

    expect(
      within(screen.getByTestId("session-children")).getByText(
        /already in the row above/,
      ),
    ).toBeInTheDocument();
  });
});

describe("R-N20.1 — a row expands to its token classes and its Model mix", () => {
  it("shows neither until the row is expanded", () => {
    table(3);

    expect(screen.queryByTestId("session-detail")).toBeNull();
  });

  it("shows that session's four volumes and its Model mix on expansion", async () => {
    table(3);
    const [first] = sessionRows();

    await userEvent.click(first as HTMLElement);

    expect(first).toHaveAttribute("aria-expanded", "true");
    const detail = within(screen.getByTestId("session-detail"));
    expect(detail.getByText("Cache write")).toBeInTheDocument();
    expect(detail.getByText("Claude Opus 5")).toBeInTheDocument();
  });

  it("keeps one row open at a time, and closes the one that was", async () => {
    table(3);
    const rows = sessionRows();

    await userEvent.click(rows[0] as HTMLElement);
    await userEvent.click(rows[1] as HTMLElement);

    expect(rows[0]).toHaveAttribute("aria-expanded", "false");
    expect(rows[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("session-detail")).toHaveLength(1);
  });

  it("collapses again on a second click", async () => {
    table(3);
    const [first] = sessionRows();

    await userEvent.click(first as HTMLElement);
    await userEvent.click(first as HTMLElement);

    expect(screen.queryByTestId("session-detail")).toBeNull();
  });
});

describe("an emptied selection (R-V9)", () => {
  it("says there is no data for it, in the sentence every other surface uses", () => {
    table(0);

    expect(screen.getByText("No data for this selection.")).toBeInTheDocument();
  });
});

describe("R-A9 — rows that reached the totals without resolving to a name", () => {
  it("renders the note the ViewModel wrote, and writes none of its own", () => {
    const withNote = { ...tableOf(2), note: "3 sessions are counted and not listed." };
    render(<SessionTable table={withNote} pageSize={50} caption="Agent sessions" />);

    expect(screen.getByText("3 sessions are counted and not listed.")).toBeInTheDocument();
  });
});
