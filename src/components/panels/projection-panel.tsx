// **`/demo/projection` — where the current month lands** (R-N23, R-N24, R-N25).
//
// Four things are on this page and they are the whole of R-N23: **actual spend to date**, the
// **month-end figure extrapolated in proportion to the period elapsed**, **the method in one
// sentence**, and **the elapsed fraction as a share** — beside the **incomplete-period flag**.
//
// **Each of the two figures is printed beside the two components it is the sum of** (ticket 42),
// because they are not the same sum: spend to date is session Cost **plus a whole month's seat
// charge**, and only the session part is extrapolated (R-M5, R-D2). Shown two totals alone, a
// reader cannot check either — so the tiles carry `Session cost` and `Seat cost` under the
// headline, and the method paragraph carries the sum with this month's real numbers in it. The
// prose it replaced explained the arithmetic; the arithmetic states it.
//
// **The seat charge is beside the daily chart, never in it** (R-M5). A monthly fee apportioned
// across days is invented precision, so the bars stay session Cost alone and the flat figure is
// said in words underneath.
//
// **R-N24 — there is no confidence band, and there is nothing here that could carry one.** The
// ViewModel has no bound, no interval and no low/high pair on it (T-U21 asserts that absence in
// the domain layer), so this component could not render a band if it wanted to. That is the
// point: a band computed over authored fixture data would be fabricated precision dressed as
// rigour, and the honest uncertainty statement available here is the method plus the share. **A
// projection at 10% elapsed and one at 90% are different claims**, and the share is what says
// which one a reader is looking at.
//
// **R-V8 — "Estimated" is on Projected cost and on nothing else.** The two labels do two
// different jobs, and neither is a hedge: "illustrative rates" marks invented *rates* and lives
// on the token card on `/demo/spend`; "estimated" marks a *forecast* and lives here. Spend to
// date is attributed (R-M4) — it is the bill, not an estimate of it — so it carries no marker.
//
// **The token rate card does not render on this page**, and the compute rate card renders on no
// page at all (R-N11, T-E9).
//
// **It computes nothing** (R-T6). The figures, the share, the method sentence and the flag all
// arrived on the ViewModel; percent and currency here are formatting, not arithmetic — and the
// arithmetic line *prints* operands that were resolved upstream rather than evaluating any of
// them. `projectedTotal` was assigned as `projectedSession + seat` in the query, so the sum on
// screen is the identity the ViewModel already holds and not a second, independent addition.
//
// **Money is `figures.ts`'s `usd`**, not a fourth local copy of it (ticket 41). A page that
// spells its own currency format is a page that can disagree with the tile a reader arrived from
// — and the four figures the arithmetic line sums have to read as the same kind of number.

import { ChartFrame } from "@/components/charts/chart-frame";
import type { ProjectionComponents, ProjectionPageViewModel } from "@/data/queries";
import type { TileViewModel } from "@/domain/viewmodel";
import { usd } from "./figures";

/** The share R-N23 asks for, as a share. Whole percent: the input is a count of civil days. */
const share = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });

/**
 * R-V8's one label, and the one figure it belongs to. Keyed on the ViewModel's own tile key so
 * that "which figure is the forecast" is not re-decided in copy.
 */
const ESTIMATED_TILE = "projected-cost";

/**
 * **Ticket 42 — each headline broken into the two components it is the sum of.**
 *
 * Spend to date includes the seat fee and only session Cost is extrapolated, so a reader shown
 * two totals cannot check either one. The two lines are the same two lines on both tiles, in the
 * same order, which is what makes the pair comparable at a glance: the seat figure is *identical*
 * on both, because a seat is charged by whole months and is never projected (R-M5, R-D2).
 *
 * Which resolved figure goes on which line is keyed on the tile's own key, exactly as the R-V8
 * marker above is — placement, not arithmetic. **Nothing here sums anything** (R-T6): the total
 * on the headline was assigned as `projectedSession + seat` in `data/queries/projection.ts`.
 */
const breakdownOf = (
  tileKey: string,
  components: ProjectionComponents,
): readonly { readonly key: string; readonly label: string; readonly value: number | null }[] => [
  {
    key: "session",
    label: "Session cost",
    value: tileKey === ESTIMATED_TILE ? components.projectedSession : components.sessionToDate,
  },
  { key: "seat", label: "Seat cost", value: components.seat },
];

function Breakdown(props: {
  readonly tileKey: string;
  readonly components: ProjectionComponents;
}) {
  return (
    <dl className="mt-4 space-y-1 border-t border-border pt-3">
      {breakdownOf(props.tileKey, props.components).map((line) => (
        <div key={line.key} className="flex items-baseline justify-between gap-4 text-xs">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd
            data-testid={`${props.tileKey}-${line.key}`}
            className="tabular-nums text-foreground"
          >
            {usd(line.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const Pill = (props: { readonly tone: "flag" | "estimate"; readonly children: string }) => (
  <span
    className={
      props.tone === "estimate"
        ? "rounded-full border border-chart-4/50 bg-chart-4/10 px-2 py-1 text-[11px] font-medium tracking-wide text-foreground"
        : "rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground"
    }
  >
    {props.children}
  </span>
);

function Figure(props: {
  readonly tile: TileViewModel;
  readonly components: ProjectionComponents;
}) {
  const { tile } = props;
  const estimated = tile.key === ESTIMATED_TILE;
  return (
    <div
      data-testid={`figure-${tile.key}`}
      className="flex-1 rounded-xl border border-border p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {tile.title}
        </h2>
        {estimated ? <Pill tone="estimate">Estimated</Pill> : null}
      </div>
      <p
        data-testid={`figure-value-${tile.key}`}
        className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground"
      >
        {usd(tile.value)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{tile.caption ?? tile.period.label}</p>
      <Breakdown tileKey={tile.key} components={props.components} />
    </div>
  );
}

/**
 * **The arithmetic, with this month's real numbers in it** (ticket 42).
 *
 * It replaces a paragraph of prose about extrapolation with the sum the reader can check against
 * the four figures beside it — and the `(30 ÷ 8)` is the elapsed share the panel already prints
 * as a percentage, written the way the projection actually applies it. Every operand arrived
 * resolved on the ViewModel; this composes them into a sentence and computes nothing (R-T6).
 */
function Arithmetic(props: { readonly view: ProjectionPageViewModel }) {
  const { components, elapsed } = props.view;
  if (components.projectedTotal === null) return null;
  return (
    <div className="mt-3">
      <p className="max-w-xl text-xs text-muted-foreground">
        Session cost to date × (days in the month ÷ days elapsed) + seat cost
      </p>
      <p
        data-testid="projection-arithmetic"
        className="mt-1 max-w-xl text-sm tabular-nums text-foreground"
      >
        {usd(components.sessionToDate)} × ({elapsed.totalDays} ÷ {elapsed.days}) +{" "}
        {usd(components.seat)} = {usd(components.projectedTotal)}
      </p>
    </div>
  );
}

/**
 * R-N23's third and fourth parts: the method in one sentence, and the share, side by side —
 * with ticket 42's arithmetic under the sentence, where the seat-cost prose used to sit.
 */
function Method(props: { readonly view: ProjectionPageViewModel }) {
  const { elapsed, method, incomplete } = props.view;
  return (
    <section
      aria-label="Method and elapsed share"
      className="rounded-xl border border-border bg-muted/30 p-6"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Method
          </h2>
          <p data-testid="projection-method" className="mt-2 max-w-xl text-sm text-foreground">
            {method}
          </p>
          <Arithmetic view={props.view} />
        </div>
        <div className="shrink-0 sm:text-right">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Period elapsed
          </h2>
          <p
            data-testid="elapsed-share"
            className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground"
          >
            {share.format(elapsed.fraction)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {elapsed.days} of {elapsed.totalDays} days
          </p>
          {incomplete ? (
            <p className="mt-3" data-testid="incomplete-flag">
              <Pill tone="flag">Incomplete period</Pill>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProjectionPanel(props: {
  readonly view: ProjectionPageViewModel;
  /** R-T29 / T-C0 — fixed numeric dimensions under test. A page leaves it off. */
  readonly dimension?: { readonly width: number; readonly height: number };
}) {
  const { view } = props;
  return (
    <div data-testid="projection-panel" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {view.tiles.map((tile) => (
          <Figure key={tile.key} tile={tile} components={view.components} />
        ))}
      </div>
      <Method view={view} />
      {view.unavailable ? (
        <p data-testid="projection-unavailable" className="max-w-2xl text-sm text-muted-foreground">
          {view.unavailable}
        </p>
      ) : null}
      {/*
        Named for what it draws. Ticket 64 stacked the month's projected remainder on the bars,
        so a section still called "Actual spend to date" would be a heading that contradicts half
        of the chart under it — and it is the accessible name a screen-reader user lands on.
      */}
      <section aria-label="Daily session cost" className="rounded-xl border border-border p-6">
        {/*
          `ChartContainer` is `aspect-video`, which on a full-width dashboard is a chart taller
          than the fold. The child selector out-specifies it (a class plus a type beats a class)
          rather than fighting it with `!important`, and it stays responsive — which `dimension`,
          the R-T29 escape hatch, would not: that one is for tests.
        */}
        <ChartFrame
          chart={view.chart}
          shape="bar"
          dimension={props.dimension}
          className="[&>div]:aspect-[16/5]"
        />
        {/*
          R-M5 — the seat charge is stated beside the bars and is **never a series in them**.
          Spreading a monthly fee across days is the invented precision R-M5 forbids, so both
          daily series are session Cost — what a day cost and what the method says is still to
          come on it — and the flat monthly figure is said in words. A reference line was the
          alternative and is the worse one here: a $468 line over bars in the single dollars
          flattens the chart it was drawn on.

          The projected bars' own sentence arrives on `view.note` beside the seat one, because
          the query is what knows whether a forecast was drawn at all (`data/queries/projection`).
        */}
        <p
          data-testid="chart-seat-note"
          className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground"
        >
          Seat cost is {usd(view.components.seat)} flat for the month. {view.note}
        </p>
      </section>
    </div>
  );
}
