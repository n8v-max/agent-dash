// **R-N15, A24, R-T6, R-A6** — the People table, rendered.
//
// **A24 is asserted twice, in two layers, deliberately.** `src/data/queries.test.ts` asserts that
// `peoplePage` *resolves* the default sort to Completed Jobs descending; this file asserts that
// the resolved sort is what the rendered table *announces* — `aria-sort` on the column the
// ViewModel names, and on no other. A default that never reached the markup would satisfy the
// first and fail a reader, and no surface may default to sort-by-cost.
//
// **The component does not sort** (R-T6). The clearest way to assert that is to hand it rows in
// an order the sort contradicts and require them back unchanged: a component holding a comparator
// would "fix" them, and there is nothing here that could.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TableColumn, TableRow, TableViewModelOf } from "@/domain/viewmodel";
import { DataTable } from "./data-table";
import { figureText } from "./figures";
import { PEOPLE_TABLE, RESTRICTED_TABLE } from "./people-viewmodels.fixture";

const CAPTION = "Members, with their Jobs, tokens and cost";

const sortHref = (column: TableColumn): string => `/demo/people?sort=${column.key}:asc`;
const profileHref = (row: TableRow): string => `/demo/people?member=${row.key}`;

const renderTable = (table: TableViewModelOf<TableRow> = PEOPLE_TABLE) =>
  render(
    <DataTable
      table={table}
      caption={CAPTION}
      sortHrefOf={sortHref}
      linkFor={{ column: "member", hrefOf: profileHref }}
    />,
  );

/** The body rows, as the strings a reader sees. The heading row is not one of them. */
const bodyRows = (): readonly (readonly string[])[] =>
  within(screen.getByRole("table", { name: CAPTION }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent ?? ""));

const heading = (name: string | RegExp): HTMLElement =>
  screen.getByRole("columnheader", { name });

describe("A24 — the default sort is Completed Jobs descending, and never cost", () => {
  it("announces the sorted column, and only that column, with `aria-sort`", () => {
    renderTable();

    expect(heading(/Completed Jobs/)).toHaveAttribute("aria-sort", "descending");
    expect(heading(/^Cost/)).not.toHaveAttribute("aria-sort");
    expect(heading(/^Tokens/)).not.toHaveAttribute("aria-sort");
    expect(
      screen.getAllByRole("columnheader").filter((cell) => cell.hasAttribute("aria-sort")),
    ).toHaveLength(1);
  });

  it("offers every numeric column as a sort link, and no text column as one (R-N15)", () => {
    renderTable();

    for (const column of PEOPLE_TABLE.columns) {
      const link = within(heading(new RegExp(`^${column.label}`))).queryByRole("link");
      expect(column.sortable ? link : link === null).toBeTruthy();
    }
    expect(within(heading(/^Cost/)).getByRole("link")).toHaveAttribute(
      "href",
      "/demo/people?sort=cost:asc",
    );
  });
});

describe("R-T6 — the table renders the order it was given and produces none of its own", () => {
  it("keeps rows in the ViewModel's order even where the sort contradicts them", () => {
    const outOfOrder: TableViewModelOf<TableRow> = {
      ...PEOPLE_TABLE,
      rows: [...PEOPLE_TABLE.rows].reverse(),
    };
    renderTable(outOfOrder);

    expect(bodyRows().map((cells) => cells[0])).toEqual([
      "Alan Turing",
      "Grace Hopper",
      "Ada Lovelace",
    ]);
  });

  it("renders each figure in the column it was handed, locale-pinned", () => {
    renderTable();

    expect(bodyRows()[0]).toEqual([
      "Ada Lovelace",
      "Platform",
      "Human",
      "42",
      "90",
      "1,240,000",
      "$310.50",
    ]);
  });
});

/**
 * **Ticket 41 — a column's `unit` decides how its figures read, and the domain layer supplies it.**
 *
 * The Cost column used to render through a bare `maximumFractionDigits: 2`, which printed `310.5`
 * on a money column and `220.25` beside it: two different shapes of the same quantity, on one
 * column, next to a summary tile reading `$310.50`. The `unit` is the fix, and it is the *same*
 * `FigureUnit` a tile carries, so the two surfaces cannot disagree about what money looks like.
 */
describe("R-N15 — the Cost column is money, and it is the tiles' money", () => {
  const costCells = (): readonly string[] => bodyRows().map((cells) => cells[6]);

  it("renders every granted cost with a symbol and exactly two decimals", () => {
    renderTable();

    for (const cell of costCells().filter((text) => text !== "—")) {
      expect(cell).toMatch(/^\$[\d,]+\.\d{2}$/);
    }
    expect(costCells()).toEqual(["$310.50", "$220.25", "—"]);
  });

  it("renders the same figure the tile formatter would, because it is that formatter", () => {
    renderTable();

    expect(costCells()[0]).toBe(figureText(310.5, "usd"));
  });

  it("leaves a column carrying no unit exactly as it was", () => {
    renderTable();

    // Completed Jobs, Sessions and Tokens are counts: grouped, decimal-free, no symbol.
    expect(bodyRows()[0].slice(3, 6)).toEqual(["42", "90", "1,240,000"]);
  });
});

/**
 * **Ticket 41 — `kind` reaches the DOM as words.** `human` and `service_account` are a closed
 * domain vocabulary and a URL value; neither is English, and `service_account` on screen reads as
 * a leaked column name. The label arrives resolved on the cell (`MEMBER_KIND_LABELS`, in the
 * query layer beside the column it fills), so there is nothing here that maps an enum.
 */
describe("R-N15 — the Kind column reads as words, never as the raw enum", () => {
  it("renders no raw enum value in any cell", () => {
    renderTable();

    const text = screen.getByRole("table", { name: CAPTION }).textContent ?? "";
    expect(text).not.toContain("service_account");
    expect(text).toContain("Human");
  });
});

describe("R-N16 / R-A6 — what a cell links to, and what it withholds", () => {
  it("makes the Member cell the link to that Member's profile surface", () => {
    renderTable();

    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/demo/people?member=mem_0001",
    );
  });

  it("renders a withheld figure as an em dash carrying its reason, and never as a link", () => {
    renderTable();
    const withheld = within(screen.getByRole("table", { name: CAPTION })).getByTitle(
      "Withheld — outside your grants",
    );

    expect(withheld).toHaveTextContent("—");
    expect(within(withheld).queryByRole("link")).toBeNull();
  });

  it("renders the restricted account's table as one row and no note (C10)", () => {
    renderTable(RESTRICTED_TABLE);

    expect(bodyRows()).toHaveLength(1);
    // C10 — an aggregate beside a named row in one column set is the subtraction R-M17 forbids.
    // What explains the single row is the page's visibility sentence, not a note under the table.
    expect(screen.queryByText(/counted and not named/)).toBeNull();
  });

  it("renders R-V9's fallback where the ViewModel says the selection is empty", () => {
    renderTable({ ...PEOPLE_TABLE, rows: [], empty: true });

    expect(screen.getByText("No data for this selection.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
