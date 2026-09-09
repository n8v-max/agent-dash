// **`/demo/spend`'s five money panels, in R-N9's order** — and the order is the point.
//
// **R-N10 — the page opens with the ratio, not with Total spend.** Total spend has already been
// read on the summary; repeating it in the first position spends the fold twice. So panel 1 is
// Cost per completed Job, and it is the only panel given the page's full width on its own.
//
// **R-N9 item 5 is "Cost by Repository", flat** — no work-domain roll-up. Ticket 07 named it
// "Cost by Repository work domain"; ADR-0004, later, removed the label entirely (`spec.md` § 11
// C2), so there is no roll-up here to render and no control that offers one.
//
// **R-V8 — no attributed money figure carries an "estimated" marker.** Every figure below is
// attributed (R-M4): it is the bill, not an estimate of it. `Figure` defaults to `attributed`
// and the marker is unreachable from this module, which is what makes T-C9's first claim a
// property of the page rather than a promise from five panels.
//
// **It computes nothing** (R-T6). Every number, series, colour, cap and stack decision arrived
// resolved on the ViewModel; the only judgements here are shape and copy.
//
// **A chart stacks iff its ViewModel says so** (R-V1). Panel 2 partitions — session Cost and
// Seat cost sit outside each other and sum to Total spend exactly — and its ViewModel carries
// `stackable: true`, so the bars stack. Repository does not partition (a Job's sessions may span
// repositories) and its ViewModel says so, so the same shape renders side by side. Neither
// decision is taken here.

import type { ReactElement, ReactNode } from "react";
import type {
  CostByRepositoryPanel as CostByRepositoryViewModel,
  CostPerSessionPanel as CostPerSessionViewModel,
  SpendPageViewModel,
  TotalSpendPanel as TotalSpendViewModel,
} from "@/data/queries";
import type { ChartViewModel } from "@/domain/viewmodel";
import { usd } from "./figures";
import { Figure, FigureList, count, share } from "./money-figure";
import { MoneyChart } from "./money-chart";
import { PanelCard } from "./panel-card";

/**
 * **What the seat charge is a charge for**, in the arithmetic a reader can check against the
 * figure above it (ticket 41).
 *
 * A **seat-month is one month held by one seat**, so the quantity billed is `seats × months`:
 * 18 human Members over 6 months is 108 seat-months, not 6. The hint used to read
 * "18 human Members · 6 seat-months", which put a bare month count under a seat-month label and
 * understated the quantity by the size of the Organization. Every number here arrives on the
 * ViewModel — `seats`, `months` and their product are all `TotalSpend`'s (R-T6); the "×" and the
 * "=" are punctuation, not a multiplication this component performs.
 */
const seatHint = (panel: TotalSpendViewModel): string =>
  `${count(panel.seats)} human Members × ${count(panel.months)} months = ` +
  `${count(panel.seatMonths)} seat-months`;

/**
 * Copy for R-M1's `accepted` filter, in the words a reader of panel 3 needs.
 *
 * It is the panel's **footnote** rather than part of its question (R-V14): the question is what
 * the panel answers and stands whatever the URL says, while this is a reading of the current
 * selection and changes with the toggle in the header. A sentence that moves with a control does
 * not belong behind a disclosure, which is the same line `PanelCard` draws for the per-capita
 * denominator.
 */
const OUTCOME_SENTENCE: Readonly<Record<string, string>> = {
  any: "Every session in the period is counted.",
  accepted: "Counting accepted sessions only.",
  "not-accepted": "Counting sessions that were not accepted only.",
};

/**
 * **R-T29 / T-C0 — the fixed-dimension escape hatch, threaded through.** A page leaves it off
 * and gets `ChartFrame`'s responsive path; a test sets it, because shadcn's `initialDimension`
 * is exactly the construct T-C0 rules out. It is the one prop here that exists for the suite,
 * and it is the same prop, with the same reason, that `ChartFrame` already carries.
 */
export type PanelDimension = { readonly width: number; readonly height: number };

type PanelChart = {
  readonly chart: ChartViewModel;
  readonly dimension?: PanelDimension;
};

const moneyChart = (
  chart: ChartViewModel,
  shape: "line" | "bar",
  dimension?: PanelDimension,
): ReactElement => <MoneyChart chart={chart} shape={shape} dimension={dimension} />;

/** R-N9 panel 1, and R-N10's opener: the join, one bucket at a time. */
export function CostPerCompletedTaskPanel(props: PanelChart) {
  return (
    <PanelCard
      title={props.chart.title}
      question="What one finished Job costs. Every session's cost is in the numerator and only Completed Jobs are in the denominator, so work that had to be redone raises it. A bucket that spent money and finished nothing has no reading at all, and draws nothing rather than a zero."
    >
      {moneyChart(props.chart, "line", props.dimension)}
    </PanelCard>
  );
}

/**
 * C14's denominator, in words, where the toggle is on. Copy — the number is the ViewModel's, and
 * `work-panels.tsx` says the same thing about the same denominator for the same reason.
 */
export const perCapitaNote = (perCapita: SpendPageViewModel["perCapita"]): string | null =>
  perCapita.on
    ? `Per Member: divided by ${count(perCapita.denominator)} active human Members. Service accounts hold no seat and are excluded from the denominator.`
    : null;

/** R-N9 panel 2 — Total spend, split into session Cost and Seat cost (R-M5, A25). */
export function TotalSpendPanel(props: {
  readonly panel: TotalSpendViewModel;
  readonly perCapitaNote?: string | null;
  /** R-C6 — the per-capita toggle, in this panel's header because this panel is one it divides. */
  readonly controls?: ReactNode;
  readonly dimension?: PanelDimension;
}) {
  const { panel } = props;

  return (
    <PanelCard
      controls={props.controls}
      title={panel.chart.title}
      question="What the period cost in total, and how much of it was seats rather than sessions. A seat is charged by whole months, so this panel reads months whatever grain the page is set to. The seat charge is one fee per seat per month — a seat-month — so it grows with the Organization as well as with the calendar."
      footnote={[props.perCapitaNote, panel.note].filter(Boolean).join(" ")}
      figures={
        <FigureList>
          <Figure
            label="Total spend"
            value={usd(panel.total)}
            lead
            hint={panel.partial ? "The period is incomplete; the figure is not final." : null}
          />
          <Figure label="Session cost" value={usd(panel.sessionCost)} />
          <Figure
            label="Seat cost"
            value={usd(panel.seatCost)}
            hint={seatHint(panel)}
          />
          <Figure label="Seats as a share" value={share(panel.seatShare)} />
        </FigureList>
      }
    >
      {moneyChart(panel.chart, "bar", props.dimension)}
    </PanelCard>
  );
}

/** R-N9 panel 3 — Cost per session, under the `accepted` filter (R-M1). */
export function CostPerSessionPanel(props: {
  readonly panel: CostPerSessionViewModel;
  /** R-C6 — the `accepted` filter, which narrows this panel and no other on the page. */
  readonly controls?: ReactNode;
  readonly dimension?: PanelDimension;
}) {
  const { panel } = props;

  return (
    <PanelCard
      controls={props.controls}
      title={panel.chart.title}
      question="What one session costs on average. Seat cost is not in it — a monthly fee shared across sessions would be the apportioning R-M5 refuses."
      footnote={OUTCOME_SENTENCE[panel.outcome] ?? null}
      figures={
        <FigureList>
          {/*
            R-M18 — where the period holds no session the figure is `usd(null)`, an em dash, and
            the hint is the domain layer's own reason for it. A headline dash with nothing beside
            it reads as a rendering fault; the sentence is what makes it read as an absence.
          */}
          <Figure
            label="Cost per session"
            value={usd(panel.range.value)}
            hint={panel.range.message}
            lead
          />
          <Figure label="Sessions" value={count(panel.range.sessions)} />
          <Figure label="Session cost" value={usd(panel.range.cost)} />
        </FigureList>
      }
    >
      {moneyChart(panel.chart, "line", props.dimension)}
    </PanelCard>
  );
}

/** R-N9 panel 4 — Cost per completed Job by template. A ratio, so it never stacks (R-V1). */
export function CostByWorkTypePanel(props: PanelChart) {
  return (
    <PanelCard
      title={props.chart.title}
      question="Which templates finish work cheaply and which do not. Five ratios do not add up to the Organization's ratio, so these are read against each other and never as parts of a whole."
    >
      {moneyChart(props.chart, "line", props.dimension)}
    </PanelCard>
  );
}

/**
 * R-N9 panel 5 — Cost by Repository. Flat: no work-domain roll-up (ADR-0004, § 11 C2).
 *
 * **It reads months whatever the page grain is** (R-N9.1), and says so in the ViewModel's own
 * words — the same sentence Total spend carries above, because it is the same claim about the
 * same buckets. The grain is the query's decision; this component renders the note it was given.
 */
export function CostByRepositoryPanel(props: {
  readonly panel: CostByRepositoryViewModel;
  readonly perCapitaNote?: string | null;
  /** R-C6 — the per-capita toggle, in this panel's header because this panel is one it divides. */
  readonly controls?: ReactNode;
  readonly dimension?: PanelDimension;
}) {
  const { panel } = props;

  return (
    <PanelCard
      controls={props.controls}
      title={panel.chart.title}
      question="Where the money went, by Repository. A Job's sessions may span repositories, so these totals sit beside each other rather than summing into one bar. Five repositories across a page of weeks is more bars than a comparison can carry, so this panel reads months."
      footnote={[props.perCapitaNote, panel.note].filter(Boolean).join(" ")}
    >
      {moneyChart(panel.chart, "bar", props.dimension)}
    </PanelCard>
  );
}

/**
 * R-C6 — the panel-local controls this page's panels read, already rendered by the page.
 *
 * Two fields and five panels, because a control belongs to the *reading* rather than to the card:
 * per-capita is one node handed to the two money panels it divides, and the three ratios beside
 * them are handed nothing, which is the same fact `perCapitaNote` states in words.
 */
export type SpendPanelControls = {
  readonly accepted?: ReactNode;
  readonly perCapita?: ReactNode;
};

/** R-N9 panels 1–5, in order. The Adoption section follows, under its own heading. */
export function SpendPanels(props: {
  readonly page: SpendPageViewModel;
  readonly controls?: SpendPanelControls;
  readonly dimension?: PanelDimension;
}) {
  const { page, dimension } = props;
  const controls = props.controls ?? {};
  // C14 — the note goes on the two panels the toggle actually divides, and on no others. The
  // three ratios below are already normalised, so per-capita neither changes them nor claims to.
  const note = perCapitaNote(page.perCapita);

  return (
    <div className="space-y-6">
      <CostPerCompletedTaskPanel chart={page.costPerCompletedTask} dimension={dimension} />
      <TotalSpendPanel
        panel={page.totalSpend}
        perCapitaNote={note}
        controls={controls.perCapita}
        dimension={dimension}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CostPerSessionPanel
          panel={page.costPerSession}
          controls={controls.accepted}
          dimension={dimension}
        />
        <CostByWorkTypePanel chart={page.costPerCompletedTaskByWorkType} dimension={dimension} />
      </div>
      <CostByRepositoryPanel
        panel={page.costByRepository}
        perCapitaNote={note}
        controls={controls.perCapita}
        dimension={dimension}
      />
    </div>
  );
}
