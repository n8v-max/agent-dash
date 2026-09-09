// **R-X1 — the visually-hidden `<table>` mirror of a chart's grouped data.**
//
// It is a product requirement first: a screen-reader user gets the chart's actual figures as a
// table rather than an SVG they cannot read. That it is simultaneously the most robust assertion
// target in the suite — chart *output* as queryable DOM, with no SVG parsing (`testing-spec.md`
// P2, T-C1) — is a consequence, not the reason.
//
// **`sr-only`, not `hidden`.** The table is removed from the visual layout and kept in the
// accessibility tree. `display: none` or `aria-hidden` would take it out of the tree and leave
// the requirement satisfied only in the markup.
//
// **The `sr-only` box is a wrapping `<div>`, not the `<table>` itself** (R-V15, ticket 46). A
// table's used width is never less than its min-content width, so `width: 1px` does not hold it
// and `overflow: hidden` clips its *contents* rather than its own box. An absolutely positioned
// box that wide still counts towards the document's scroll width, which is how a mirror nobody
// can see was the widest thing on `/demo/work` at 390px — 784px of hidden table pushing every
// visible surface sideways. Moving the class onto a `<div>` gives the clip something with a real
// 1px box to clip against; the table inside is unchanged, and so is what a screen reader reads.
//
// **The values are the domain layer's** (R-T7). `mirror` is summed out of the aggregation grid
// on a path that never reads a `SeriesPoint`, so this component prints a second, independent
// statement of what the chart claims — which is what makes T-C1 a cross-check rather than one
// array printed twice. Nothing here recomputes, reorders or re-derives a cell.

import type { MirrorViewModel } from "@/domain/viewmodel";

/** Deterministic and locale-pinned: a server's locale must not decide what a figure reads as. */
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/**
 * **R-M18 — a cell the chart has no reading for is an em dash, never a zero** (ticket 40).
 *
 * `null` reaches here from the domain layer for a ratio whose denominator was zero: a week
 * with no Completed Job has no Cost per completed Job. The chart beside this table breaks its
 * line at the same bucket (`connectNulls={false}`), so the two make one claim; printing `0`
 * here would make the table say the work was free while the line said nothing at all.
 *
 * `undefined` — a row shorter than the column set — stays blank. That is a malformed mirror
 * rather than an absent reading, and the two should not read alike.
 */
export const NO_READING = "—";

/**
 * The wrapper's handle. The `sr-only` box is a `<div>` rather than the `<table>` (see the header),
 * and a test asserting "the mirror is visually hidden" has to reach that `<div>` — through a
 * testid, because reaching it from the table would be DOM traversal.
 */
export const MIRROR_TEST_ID = "chart-mirror";

const text = (cell: string | number | null): string => {
  if (cell === null) return NO_READING;
  return typeof cell === "number" ? number.format(cell) : cell;
};

export function TableMirror(props: {
  readonly mirror: MirrorViewModel;
  /** What the table is of — the chart's title and its roll-up level, said in words. */
  readonly caption: string;
}) {
  const { columns, rows } = props.mirror;

  return (
    <div data-testid={MIRROR_TEST_ID} className="sr-only">
      <table>
        <caption>{props.caption}</caption>
        <thead>
          <tr>
            {/*
              Keyed by the column heading, never by position (R-T8). The mirror's headings are
              the bucket column plus the series labels, and a repeated heading would be an
              unreadable table before it was a duplicate key.
            */}
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {columns.map((column, at) => {
                const cell = row[at];
                return at === 0 ? (
                  <th key={column} scope="row">
                    {cell === undefined ? "" : text(cell)}
                  </th>
                ) : (
                  <td key={column}>{cell === undefined ? "" : text(cell)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
