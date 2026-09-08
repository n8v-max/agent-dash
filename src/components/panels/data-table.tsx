// A `TableViewModelOf<Row>`, rendered. **It computes nothing** (R-T6): the rows arrived sorted,
// the note arrived written, and the "no data" arm arrived as a boolean the domain layer set. There
// is no comparator in scope and no array method here that could reorder anything.
//
// **R-T8 — every row is keyed on `row.key`**, the identity the domain layer gave it. Column and
// cell keys come from `column.key`, not from a position, which is what keeps a cell attached to
// its heading when a sort changes the row order.
//
// **`null` is *withheld*, not zero** (R-A6). It renders as an em dash carrying its reason, so a
// restricted account can see that a figure exists and is not theirs, rather than reading a blank
// as an absence of activity.
//
// **Two optional links, and both are `href`s rather than handlers** (R-T25, R-C3):
//
//   * `sortHrefOf` makes a sortable heading a link to the same page with `?sort=` changed —
//     R-N15's "every numeric column sortable", offered on the thing being sorted rather than only
//     in the toolbar's menu. **The component still does not sort**: the link produces a URL, the
//     URL produces a `ControlSet`, and `tableViewModel` orders the rows in the domain layer.
//   * `linkFor` makes one column's cell address another surface — `?member=` on `/demo/people`
//     (R-N16). It returns `null` for a row with no surface to reach, so a withheld cell is plain
//     text rather than a dead link.
//
// Both are absent by default, so a table declaring neither renders exactly what it did before.

import Link from "next/link";
import type { TableCell, TableColumn, TableRow, TableViewModelOf } from "@/domain/viewmodel";
import { cn } from "@/lib/utils";

/** Deterministic and locale-pinned: a server's locale must not decide what a figure reads as. */
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

const cellText = (cell: TableCell): string =>
  typeof cell === "number" ? number.format(cell) : (cell ?? "—");

const WITHHELD_TITLE = "Withheld — outside your grants";

/** Which way this column is sorted, or nothing at all where it is not the sorted one. */
const ariaSortFor = (
  column: TableColumn,
  sort: TableViewModelOf<TableRow>["sort"],
): "ascending" | "descending" | undefined =>
  sort.column === column.key
    ? (`${sort.direction}ending` as "ascending" | "descending")
    : undefined;

/** The sorted column's direction, drawn. Absent everywhere else, so it says which column. */
const SORT_GLYPH = { asc: "↑", desc: "↓" } as const;

function HeadingContent(props: {
  readonly column: TableColumn;
  readonly sorted: boolean;
  readonly direction: "asc" | "desc";
  readonly href: string | null;
}) {
  const glyph = props.sorted ? (
    <span aria-hidden="true"> {SORT_GLYPH[props.direction]}</span>
  ) : null;

  if (!props.href) {
    return (
      <>
        {props.column.label}
        {glyph}
      </>
    );
  }
  return (
    <Link href={props.href} className="hover:text-foreground">
      {props.column.label}
      {glyph}
    </Link>
  );
}

/**
 * One cell. A `null` cell is the withheld em dash carrying its reason (R-A6), and it is never a
 * link: there is no surface behind a figure the viewer holds no grant over.
 */
function BodyCell(props: {
  readonly column: TableColumn;
  readonly cell: TableCell;
  readonly href: string | null;
}) {
  const text = cellText(props.cell);

  return (
    <td
      title={props.cell === null ? WITHHELD_TITLE : undefined}
      className={cn(
        "whitespace-nowrap px-3 py-2 text-foreground",
        props.column.numeric && "text-right tabular-nums",
        props.cell === null && "text-muted-foreground",
      )}
    >
      {props.href ? (
        <Link href={props.href} className="underline underline-offset-4">
          {text}
        </Link>
      ) : (
        text
      )}
    </td>
  );
}

export function DataTable<Row extends TableRow>(props: {
  readonly table: TableViewModelOf<Row>;
  readonly caption: string;
  readonly sortHrefOf?: (column: TableColumn) => string | null;
  readonly linkFor?: {
    readonly column: string;
    readonly hrefOf: (row: Row) => string | null;
  };
}) {
  const { table } = props;

  const headingHref = (column: TableColumn): string | null =>
    column.sortable ? (props.sortHrefOf?.(column) ?? null) : null;

  const cellHref = (row: Row, column: TableColumn, cell: TableCell): string | null =>
    props.linkFor && props.linkFor.column === column.key && cell !== null
      ? props.linkFor.hrefOf(row)
      : null;

  if (table.empty) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No data for this selection.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{props.caption}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSortFor(column, table.sort)}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
                    column.numeric ? "text-right" : "text-left",
                  )}
                >
                  <HeadingContent
                    column={column}
                    sorted={table.sort.column === column.key}
                    direction={table.sort.direction}
                    href={headingHref(column)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-border/60 last:border-0 hover:bg-muted/40"
              >
                {table.columns.map((column, at) => (
                  <BodyCell
                    key={column.key}
                    column={column}
                    cell={row.cells[at] ?? null}
                    href={cellHref(row, column, row.cells[at] ?? null)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? (
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{table.note}</p>
      ) : null}
    </div>
  );
}
