// **`/demo/history`'s flat table** — one row per AgentSession (R-N19), newest first, paginated
// client-side at 50 (R-N20) and expandable per row (R-N20.1).
//
// **Why this is a Client Component and `data-table.tsx` is not.** Pagination and row expansion
// are *presentation* state: which slice is on screen and which row is open change nothing about
// what the figures are. They are the only two pieces of state in the product that R-T25 does not
// put in the URL, because neither is a claim about the data. Everything that *is* a claim — the
// sort, the filters, the date range — arrived resolved on the ViewModel and there is no
// comparator, no predicate and no arithmetic in this file that could re-decide any of it (R-T6).
//
// The generic `DataTable` stays a Server Component deliberately: making *it* client-side to
// serve this one page would push every page's table rows into the flight payload for a feature
// only this page has.
//
// **R-N20's 50 is for readability, not performance** (R-T36). ~750 rows are tractable in one
// response; 750 rows on one screen are not readable, and that is the whole of the argument.
//
// **R-N21 — the Task key is plain text.** It arrives as a `owner/repo#number` string in a cell
// and this file builds no `href` from it: the external tracker is imaginary, and a dead link is
// worse than none.

"use client";

import { useState } from "react";
import type { HistoryRow } from "@/data/queries";
import type { TableCell, TableColumn, TableViewModelOf } from "@/domain/viewmodel";
import { cn } from "@/lib/utils";
import { TABLE_SCROLLER, TABLE_SCROLLER_CLASS } from "./data-table";
import { formatFigure, WITHHELD } from "./figures";
import { SessionChildren, SessionDetailPanel } from "./session-detail";

/** Deterministic and locale-pinned: a server's locale must not decide what a figure reads as. */
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/**
 * A cell, in its column's unit — `data-table.tsx`'s rule, applied to the same `TableColumn` type
 * (ticket 41). The raw rows under an aggregate must read as the same kind of figure the aggregate
 * does, or `/demo/history`'s Cost column says `24.39` where `/demo/spend` says `$24.39`.
 */
const cellText = (cell: TableCell, unit: TableColumn["unit"]): string => {
  if (typeof cell !== "number") return cell ?? WITHHELD;
  return unit ? formatFigure(cell, unit) : number.format(cell);
};

/** R-V9's words, the same sentence every other empty surface uses. */
const EMPTY_TEXT = "No data for this selection.";

const HEAD =
  "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

function SessionRow(props: {
  readonly row: HistoryRow;
  readonly columns: TableViewModelOf<HistoryRow>["columns"];
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { row, columns } = props;
  // R-N20.2 — the fan-out is named in the label, so a reader who cannot see the indent still
  // learns that this attempt was worked by more than one agent *before* opening it.
  const agents = row.children.length;
  const sessionWord = agents === 1 ? "session" : "sessions";
  const fanOut = agents === 0 ? "" : ` and ${agents} sub-agent ${sessionWord}`;
  return (
    <>
      {/*
        `data-session` is the row's own identity — the AgentSession id the ViewModel keyed it by
        (R-T8) — put where a reader of the document can see it. R-N3.1's as-of stamp names the
        session it was read off in the same way, so "the stamp matches the History top row" is an
        identity between two ids rather than a coincidence between two formatted instants (T-E15).
      */}
      <tr
        data-session={row.key}
        className={cn("border-b border-border/60", props.open ? "bg-muted/50" : "hover:bg-muted/40")}
      >
        <td className="w-8 px-2 py-2">
          <button
            type="button"
            onClick={props.onToggle}
            aria-expanded={props.open}
            aria-label={`Token classes and Model mix${fanOut} for session ${row.detail.taskKey}`}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span aria-hidden className={cn("transition-transform", props.open && "rotate-90")}>
              ›
            </span>
          </button>
        </td>
        {columns.map((column, at) => (
          <td
            key={column.key}
            title={row.cells[at] === null ? "Withheld — outside your grants" : undefined}
            className={cn(
              "whitespace-nowrap px-3 py-2 text-foreground",
              column.numeric && "text-right tabular-nums",
              column.key === "taskKey" && "font-mono text-[13px]",
              row.cells[at] === null && "text-muted-foreground",
            )}
          >
            {cellText(row.cells[at] ?? null, column.unit)}
          </td>
        ))}
      </tr>
      {props.open ? (
        <tr className="border-b border-border/60 bg-muted/30">
          <td colSpan={columns.length + 1} className="px-6 py-5">
            <div className="space-y-6">
              <SessionDetailPanel detail={row.detail} />
              {/* R-N20.2 — the fan-out under the attempt, already inside the figures above. */}
              <SessionChildren rows={row.children} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Pager(props: {
  readonly page: number;
  readonly pages: number;
  readonly from: number;
  readonly to: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
}) {
  const step = "rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label="Session pages" className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground" data-testid="pagination-summary">
        Showing {props.from}–{props.to} of {props.total} sessions
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={step}
          disabled={props.page === 0}
          onClick={() => props.onPage(props.page - 1)}
        >
          Previous
        </button>
        <span className="text-xs tabular-nums text-muted-foreground">
          Page {props.page + 1} of {props.pages}
        </span>
        <button
          type="button"
          className={step}
          disabled={props.page >= props.pages - 1}
          onClick={() => props.onPage(props.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * `aria-sort` is on the column the ViewModel says it sorted by — R-N20's newest-first default
 * unless the URL said otherwise. Nothing here can reorder anything: the rows arrived sorted.
 */
function TableHead(props: { readonly table: TableViewModelOf<HistoryRow> }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/50">
        <th scope="col" className={HEAD}>
          <span className="sr-only">Expand</span>
        </th>
        {props.table.columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            aria-sort={
              props.table.sort.column === column.key
                ? (`${props.table.sort.direction}ending` as "ascending" | "descending")
                : undefined
            }
            className={cn(HEAD, column.numeric ? "text-right" : "text-left")}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function SessionTable(props: {
  readonly table: TableViewModelOf<HistoryRow>;
  readonly pageSize: number;
  readonly caption: string;
}) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  if (props.table.empty) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {EMPTY_TEXT}
      </p>
    );
  }

  const total = props.table.rows.length;
  const pages = Math.ceil(total / props.pageSize);
  const at = Math.min(page, pages - 1);
  const start = at * props.pageSize;
  const shown = props.table.rows.slice(start, start + props.pageSize);

  return (
    <div className="space-y-3">
      {/* R-V15 — the scroller `data-table.tsx` documents; ten columns need it most. */}
      <div data-testid={TABLE_SCROLLER} className={TABLE_SCROLLER_CLASS}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{props.caption}</caption>
          <TableHead table={props.table} />
          <tbody>
            {shown.map((row) => (
              <SessionRow
                key={row.key}
                row={row}
                columns={props.table.columns}
                open={open === row.key}
                onToggle={() => setOpen(open === row.key ? null : row.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <Pager
          page={at}
          pages={pages}
          from={start + 1}
          to={start + shown.length}
          total={total}
          onPage={setPage}
        />
      ) : null}
      {props.table.note ? (
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {props.table.note}
        </p>
      ) : null}
    </div>
  );
}
