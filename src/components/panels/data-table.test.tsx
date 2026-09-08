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
      "human",
      "42",
      "90",
      "1,240,000",
      "310.5",
    ]);
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

  it("carries R-A9's sentence under the restricted account's table", () => {
    renderTable(RESTRICTED_TABLE);

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText(/counted and not named/)).toBeInTheDocument();
  });

  it("renders R-V9's fallback where the ViewModel says the selection is empty", () => {
    renderTable({ ...PEOPLE_TABLE, rows: [], empty: true });

    expect(screen.getByText("No data for this selection.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
