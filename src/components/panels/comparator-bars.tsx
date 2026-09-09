// **R-N17 — the comparator: paired bars.** The Member's value beside the Comparison group's
// median, for Completed Jobs per period, Cost per completed Job and Tokens processed.
//
// **Paired bars, not a distribution strip.** A strip shows a position within a spread, which is
// a percentile *drawn* rather than written — and R-M15 forbids a computed percentile label on
// any Member, whichever alphabet it is written in. Two bars make one comparison and support one
// reading: heavier or lighter than the middle of the people doing work like mine. There is no
// rank here, no spread, no quartile and no "you are in the top N%", because the ViewModel
// carries exactly two numbers per metric and there is nothing else in scope to draw.
//
// **R-N18 — acceptance rate does not join the comparator.** A Member's comparison group spans
// several WorkTypes and one acceptance figure would average incommensurable criteria, so there
// are three bars and the ViewModel has no fourth field for a fourth to arrive in.
//
// **The key is named in words** — "api-gateway · implementation, 6 members" — because a
// comparison against an unnamed population is a number the reader cannot argue with. The label
// is `Repository × WorkType` plus the size of the group (`spec.md` § 11 C4).
//
// **This is not a `ChartFrame` chart, and that is deliberate.** R-T28 wraps every *chart* —
// something with series, buckets, a roll-up level and an R-X1 mirror — and a `ChartViewModel` is
// the only thing it renders. The comparator carries none of those: it is six numbers in three
// unlike units (a count, money-per-Job, and tokens), so it has no shared measure axis and no
// bucket axis, and putting three unlike units on one Recharts chart would be the false claim
// R-V1 is written against. Building a `ChartViewModel` here instead would mean calling into
// `src/domain` from a component, which R-T6/R-T33 forbid outright. So the geometry is CSS, and
// **every figure it draws is also written out as text beside it** — which is the accessibility
// property the R-X1 mirror exists to provide, obtained here without a hidden second table.
//
// **It computes nothing** (R-T6). The one arithmetic expression below turns a value into a bar
// *length* — the same mapping Recharts performs inside its own `<Bar>` — and no figure the
// reader sees passes through it.

import type { ComparatorBar, ComparatorViewModel } from "@/data/queries";
import { cn } from "@/lib/utils";
import { formatFigure } from "./figures";

/** The two series of every pair. Named once, so the legend and the bars cannot disagree. */
const MEMBER_SERIES_CLASS = "bg-chart-1";
const GROUP_SERIES_CLASS = "bg-chart-2";

export const GROUP_SERIES_LABEL = "Comparison group median";

/** The drawn bar's handle: it carries no text of its own, because the figure beside it does. */
export const BAR_TEST_ID = "comparator-bar";

/** R-V9's words, for a Member with no session in the period and therefore no pair to key on. */
export const NO_GROUP_TEXT =
  "No Repository and template pair to compare on in this period, so there is no comparison group.";

/**
 * A bar's length as a percentage of the longer of the pair, rounded to a whole number.
 *
 * Whole numbers for the same reason `chart-shapes.tsx` avoids `fillOpacity={0.2}`: a decimal in
 * a style attribute is a decimal in the response payload, and `e2e/payload.spec.ts` searches
 * that payload for bare decimals matching an ungranted cost. `62%` cannot collide with a figure.
 */
const lengthOf = (value: number | null, longest: number): number =>
  value === null || longest <= 0 ? 0 : Math.round((value / longest) * 100);

function PairedBar(props: {
  readonly label: string;
  readonly value: number | null;
  readonly unit: ComparatorBar["unit"];
  readonly longest: number;
  readonly barClass: string;
}) {
  return (
    /*
      **R-V15 — below `sm` the pair is two lines, because otherwise it is no bars at all**
      (ticket 46). The three fixed tracks want 304px and the card offers 286 on a phone, so the
      `1fr` middle track — the bar itself — collapsed to zero width and R-N17's *paired bars*
      rendered as a two-column table of figures. The name and the figure keep the first line and
      the bar takes the whole of the second, where a length is a length again. The placement is
      explicit rather than left to auto-flow, because the reading order is name, bar, figure at
      both widths and auto-flow would put the figure under the name.
    */
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11rem_1fr_6.5rem] sm:gap-y-0">
      <span className="truncate text-xs text-muted-foreground">{props.label}</span>
      <span
        className="col-span-2 row-start-2 h-3 w-full overflow-hidden rounded-full bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1"
        aria-hidden="true"
      >
        <span
          data-testid={BAR_TEST_ID}
          className={cn("block h-full rounded-full", props.barClass)}
          style={{ width: `${lengthOf(props.value, props.longest)}%` }}
        />
      </span>
      <span className="col-start-2 row-start-1 text-right text-sm tabular-nums text-foreground sm:col-start-3">
        {formatFigure(props.value, props.unit)}
      </span>
    </div>
  );
}

/** One metric: the Member's bar, the group's median bar, and both figures in words. */
function ComparatorMetric(props: {
  readonly bar: ComparatorBar;
  readonly memberName: string;
}) {
  const { bar } = props;
  const longest = Math.max(bar.member ?? 0, bar.groupMedian ?? 0);

  return (
    <div
      role="group"
      aria-label={`${bar.label}: ${props.memberName} beside the ${GROUP_SERIES_LABEL.toLowerCase()}`}
      className="space-y-2 rounded-lg border border-border/70 p-4"
    >
      <p className="text-sm font-medium text-foreground">{bar.label}</p>
      <PairedBar
        label={props.memberName}
        value={bar.member}
        unit={bar.unit}
        longest={longest}
        barClass={MEMBER_SERIES_CLASS}
      />
      <PairedBar
        label={GROUP_SERIES_LABEL}
        value={bar.groupMedian}
        unit={bar.unit}
        longest={longest}
        barClass={GROUP_SERIES_CLASS}
      />
    </div>
  );
}

/**
 * **The comparator panel.** Its heading is the group, named in words; its body is three pairs;
 * its footnote is R-N18, in the domain layer's own sentence.
 */
export function ComparatorPanel(props: {
  readonly comparator: ComparatorViewModel;
  readonly memberName: string;
}) {
  const { comparator } = props;

  return (
    <section aria-label="Comparator" className="space-y-4 rounded-xl border border-border p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Beside work like this
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {comparator.group ? comparator.group.label : NO_GROUP_TEXT}
        </p>
      </div>

      {comparator.bars.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {comparator.bars.map((bar) => (
            <ComparatorMetric key={bar.key} bar={bar} memberName={props.memberName} />
          ))}
        </div>
      ) : null}

      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{comparator.note}</p>
    </section>
  );
}
