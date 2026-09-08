// **`/demo` — the four tiles, and nothing below them** (R-N4, R-N5, R-N7, R-N8).
//
// The page is one argument read in ten seconds: *this is the total, this is what we got, this is
// the rate, this is what kind of work it was.* Everything here serves that reading, and the
// layout is what makes it: four cards of equal height on one row, **three** figures at the same
// size, three changes in the same place. A tile that were louder than its neighbours would be a
// claim about which figure matters, and the third — Cost per completed Job, the differentiator —
// earns its place by being third in a sentence rather than by being bigger.
//
// **The fourth clause of that sentence is a shape, not a number** (C11). It carries no headline
// figure, because it used to carry the Completed Jobs tile's — the same number and the same
// delta, printed twice on the one page graded for a glance. `SummaryTile` is a union on `kind`,
// so this module cannot render a figure on the breakdown tile even by accident.
//
// **Each tile is itself the link** (R-N5), and the link is the tile's *title*, stretched over the
// whole card by `after:absolute after:inset-0`. That is not a styling flourish; it is what keeps
// the card clickable without putting interactive content inside an `<a>`. Recharts'
// `accessibilityLayer` (R-X3) makes the chart surface focusable, and a focusable element inside
// an anchor is invalid and unreachable by keyboard. With the stretched pseudo-element the anchor
// contains only its own text, the pointer target is the whole card, and the chart keeps its own
// place in the focus order.
//
// **It computes nothing** (R-T6). The figures, the change, the suppression, the series, the
// palette, the stack decision and the mirror all arrived resolved on `SummaryPageViewModel`;
// this module chooses type sizes and formats strings. `figures.ts` holds the formatting, and
// says there why every formatter it can is decimal-free.
//
// **The change carries no colour.** Up is good for Completed Jobs and bad for Cost per completed
// Job, and the ViewModel carries no polarity — deciding one here would be the component
// editorialising a figure (R-M15's spirit), so direction is a sign, an arrow and nothing else.

import Link from "next/link";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { SummaryTile } from "@/data/queries";
import type { Change, ChangeDirection } from "@/domain/change";
import type { BucketViewModel } from "@/domain/viewmodel";
import { cn } from "@/lib/utils";
import { changeText, figureText } from "./figures";

/** One triangle, turned. Decorative: `signDisplay` already says which way in words. */
const ARROW_ROTATION: Readonly<Record<ChangeDirection, string>> = {
  up: "",
  down: "rotate-180",
  flat: "rotate-90",
};

function ChangeArrow(props: { readonly direction: ChangeDirection }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn("size-3 shrink-0 fill-current", ARROW_ROTATION[props.direction])}
    >
      <path d="M6 1 11 10 1 10Z" />
    </svg>
  );
}

/**
 * R-N7's figure, or R-M12's suppression in the domain layer's own words.
 *
 * `Change` is a discriminated union, so the suppressed arm has no `ratio` in scope: there is
 * nothing here that could print "∞" or "NaN" where the floor said there is no basis.
 */
function ChangeFigure(props: { readonly change: Change }) {
  const { change } = props;

  if (!change.shown) {
    return <p className="text-xs leading-snug text-muted-foreground">{change.message}</p>;
  }

  return (
    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <ChangeArrow direction={change.direction} />
      <span className="tabular-nums">{changeText(change)}</span>
      <span className="sr-only">against the prior month</span>
    </p>
  );
}

/**
 * R-N8's breakdown, at tile size: sorted horizontal bars over the reported month (C11).
 *
 * **No axis labels**: the ticks are hidden, and so is the grid they would have indexed — at this
 * size the bars and the legend are the reading, and the exact figures are one click away on
 * `/demo/work` and already in the R-X1 mirror `ChartFrame` renders. The height is pinned rather
 * than left to `aspect-video`, so the tile stays a tile at any column width.
 *
 * **Neither the sort nor the absence of a stack is decided here.** The order is R-V5's
 * whole-range ranking over a single-bucket chart, which is the same thing as "longest first";
 * `chart-shapes.tsx` stacks if and only if the ViewModel carries `stackable: true` (R-V1,
 * T-C11), and C11 made this ViewModel say `false`. This panel names a shape and nothing more.
 */
const MIX_CHART = cn(
  "[&_[data-slot=chart]]:aspect-auto [&_[data-slot=chart]]:h-32",
  // Recharts 3 renders tick labels in their own z-index layer, outside the axis group, so both
  // selectors are needed to leave the tile with no axis labels on it at all.
  "[&_.recharts-cartesian-axis]:hidden [&_.recharts-cartesian-axis-tick-labels]:hidden",
  "[&_.recharts-cartesian-grid]:hidden",
  // shadcn's legend is a single unwrapped flex row. Five WorkTypes do not fit the width of a
  // tile, and without this they render outside the card rather than on a second line.
  "[&_.recharts-legend-wrapper>div>div]:flex-wrap",
);

const CARD = cn(
  "group relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5",
  "transition-colors hover:border-foreground/30 hover:bg-muted/30",
  "focus-within:border-foreground/40",
);

function Tile(props: { readonly tile: SummaryTile }) {
  const { tile } = props;

  return (
    <li className={cn(CARD, tile.kind === "breakdown" && "xl:col-span-2")}>
      <h2 className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        <Link href={tile.href} className="rounded-sm after:absolute after:inset-0">
          {tile.title}
        </Link>
      </h2>
      {tile.kind === "breakdown" ? (
        // Two columns wide, and the bars have the whole of it. Before C11 this card was a figure
        // beside a chart; the figure was the neighbouring tile's, so what is left is the width.
        <ChartFrame
          chart={tile.chart}
          shape="horizontal-bar"
          className={cn("min-w-0", MIX_CHART)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
            {figureText(tile.value, tile.unit)}
          </p>
          {tile.caption ? (
            <p className="text-xs leading-snug text-muted-foreground">{tile.caption}</p>
          ) : null}
          <ChangeFigure change={tile.change} />
        </div>
      )}
      {/*
        The affordance, and the reason the tiles need no link row under them (R-N5): the whole
        card is the link, and this says so at a glance. It carries no text because the link's own
        text is the tile's title — an arrow that repeated it would be a second name for one
        destination — and it is `aria-hidden` for the same reason.
      */}
      <span
        aria-hidden="true"
        className="mt-auto self-end text-muted-foreground transition-colors group-hover:text-foreground"
      >
        {/*
          The stroke width is an integer, and deliberately. T-E4 scans the response payload for
          bare decimal literals, and `stroke-width="1.5"` puts `1.5` into the markup — a value
          that is a real session cost in the committed fixture and belongs to a Member the
          restricted account holds no scope over. The scan cannot tell a stroke from a price, so
          a decimal in an attribute fails T-E4 on a figure that is not a figure. `figures.ts`
          makes the same choice for the change percentages, and says so at more length.
        */}
        <svg viewBox="0 0 20 20" strokeWidth="2" className="size-4 fill-none stroke-current">
          <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </li>
  );
}

/** The handle the month line is asserted through, in this directory's tests and in T-E7. */
export const PERIOD_TESTID = "summary-period";

/**
 * The month, said once (R-N6, R-E2).
 *
 * Four tiles reporting the same month and the same comparison would repeat "September, against
 * August" four times; stating it above the row leaves each tile carrying only what differs. The
 * partial flag is R-E2's, and it is flagged rather than withheld or pro-rated — September is
 * unfinished in the committed window and the figures below are the month so far.
 */
function PeriodLine(props: { readonly period: BucketViewModel }) {
  return (
    <p
      data-testid={PERIOD_TESTID}
      className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
    >
      <span className="text-sm font-semibold tracking-tight text-foreground">
        {props.period.label}
      </span>
      {props.period.partial ? (
        <span className="rounded-full border border-border px-2 py-1 font-medium">
          Partial month
        </span>
      ) : null}
      <span>Every change is measured against the month before.</span>
    </p>
  );
}

/**
 * **The summary, whole.** Four tiles, and nothing below them — T-E7 asserts the absence as a
 * structural claim about the page, so there is deliberately nothing here to add a fifth panel to.
 */
export function SummaryTiles(props: {
  readonly tiles: readonly SummaryTile[];
  readonly period: BucketViewModel;
}) {
  return (
    <section aria-label="Summary tiles">
      <PeriodLine period={props.period} />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {props.tiles.map((tile) => (
          <Tile key={tile.key} tile={tile} />
        ))}
      </ul>
    </section>
  );
}
