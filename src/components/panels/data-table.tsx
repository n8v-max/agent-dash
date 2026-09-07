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

import type { TableCell, TableRow, TableViewModelOf } from "@/domain/viewmodel";
import { cn } from "@/lib/utils";

/** Deterministic and locale-pinned: a server's locale must not decide what a figure reads as. */
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

const cellText = (cell: TableCell): string =>
  typeof cell === "number" ? number.format(cell) : (cell ?? "—");

export function DataTable<Row extends TableRow>(props: {
  readonly table: TableViewModelOf<Row>;
  readonly caption: string;
}) {
  if (props.table.empty) {
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
              {props.table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    props.table.sort.column === column.key
                      ? (`${props.table.sort.direction}ending` as "ascending" | "descending")
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
                    column.numeric ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.table.rows.map((row) => (
              <tr key={row.key} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                {props.table.columns.map((column, at) => (
                  <td
                    key={column.key}
                    title={row.cells[at] === null ? "Withheld — outside your grants" : undefined}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-foreground",
                      column.numeric && "text-right tabular-nums",
                      row.cells[at] === null && "text-muted-foreground",
                    )}
                  >
                    {cellText(row.cells[at] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.table.note ? (
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {props.table.note}
        </p>
      ) : null}
    </div>
  );
}
