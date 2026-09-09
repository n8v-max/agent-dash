// **`/demo/projection` — where the current month lands** (R-N23, R-N24, R-N25).
//
// Four things are on this page and they are the whole of R-N23: **actual spend to date**, the
// **month-end figure extrapolated in proportion to the period elapsed**, **the method in one
// sentence**, and **the elapsed fraction as a share** — beside the **incomplete-period flag**.
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
// arrived on the ViewModel; percent and currency here are formatting, not arithmetic.
//
// **Money is `figures.ts`'s `usd`**, not a fourth local copy of it (ticket 41). A page that
// spells its own currency format is a page that can disagree with the tile a reader arrived from.

import { ChartFrame } from "@/components/charts/chart-frame";
import type { ProjectionPageViewModel } from "@/data/queries";
import type { TileViewModel } from "@/domain/viewmodel";
import { usd } from "./figures";

/** The share R-N23 asks for, as a share. Whole percent: the input is a count of civil days. */
const share = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });

/**
 * R-V8's one label, and the one figure it belongs to. Keyed on the ViewModel's own tile key so
 * that "which figure is the forecast" is not re-decided in copy.
 */
const ESTIMATED_TILE = "projected-cost";

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

function Figure(props: { readonly tile: TileViewModel }) {
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
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {usd(tile.value)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{tile.caption ?? tile.period.label}</p>
    </div>
  );
}

/** R-N23's third and fourth parts: the method in one sentence, and the share, side by side. */
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
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
            {props.view.note}
          </p>
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
          <Figure key={tile.key} tile={tile} />
        ))}
      </div>
      <Method view={view} />
      {view.unavailable ? (
        <p data-testid="projection-unavailable" className="max-w-2xl text-sm text-muted-foreground">
          {view.unavailable}
        </p>
      ) : null}
      <section aria-label="Actual spend to date" className="rounded-xl border border-border p-6">
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
      </section>
    </div>
  );
}
