// **The Adoption section of `/demo/spend`** — R-N9 panels 6 and 7, under their own heading.
//
// **The heading and the one line under it are the section's whole job** (R-M9): these measure
// **use, not money**. Tokens processed is an adoption measure and never a cost proxy, and the
// section break is what stops it being read as one. So **no money figure appears anywhere in
// this section** — the rate card is a separate element at the foot of the page, and the ~200×
// input-price spread across Model tiers is exactly why token volume predicts spend badly.
//
// **Model is a breakdown, not an axis** (R-M7). Nothing here groups a per-session metric by
// Model: the mix is a distribution over token readings at the roll-up level the viewer chose,
// and the level control is scoped to this section (R-C1) — which is now where it physically
// stands, in the header of the one panel it redraws (R-C6).
//
// **The four token classes are not here.** They are volumes, and R-N20.1 puts per-session
// volumes on `/demo/history` alone; on this page the four classes appear only as the rate card's
// columns, never as figures.
//
// **Both charts draw their measure axis in token units** (ticket 69): `75K`, `1.3M`, `2.1B`, not
// eight digits along the left edge of a card. That is `TokenChart` rather than `ChartFrame`
// directly — a `tickFormat` is a function and this is a Server Component, so the function has to
// be created on the client side of the boundary. See `token-chart.tsx`.
//
// **It computes nothing** (R-T6): the shares arrived resolved, and `levels[level]` is a lookup.

import type { ReactNode } from "react";
import type { AdoptionSection as AdoptionViewModel, DistributionViewModel } from "@/data/queries";
import { Figure, FigureList, count, share } from "./money-figure";
import { PanelCard } from "./panel-card";
import { TokenChart } from "./token-chart";
import type { PanelDimension } from "./spend-panels";

/** How the three roll-up levels read in a sentence (R-M7). Copy, and only copy. */
const LEVEL_WORDS: Readonly<Record<string, string>> = {
  exact: "exact Model",
  family: "Model family",
  tier: "Model tier",
};

/**
 * The current level's distribution, as text.
 *
 * **No swatches.** The chart's legend owns series identity, and a second set of colours over a
 * list the chart caps differently would pair the wrong colour with the right name.
 *
 * **It renders every slice, including the ones the chart folded into "Other", and that is not a
 * lifted cap.** R-V4's cap is a rule about *series* — it exists because the palette is five
 * colours (R-V7) — and R-V6 already discloses the tail by name in "Other"'s tooltip. What is
 * forbidden is expanding "Other" into series or making it clickable; nothing here does either,
 * and no slice is reordered, summed or capped by this component (R-T6).
 */
function ModelMixList(props: { readonly distribution: DistributionViewModel }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {props.distribution.slices.map((slice) => (
        <li
          key={slice.key}
          className="flex items-baseline justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2 text-sm"
        >
          <span className="truncate text-foreground">{slice.label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {count(slice.value)} tokens · {share(slice.share)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AdoptionSection(props: {
  readonly adoption: AdoptionViewModel;
  /**
   * R-C6 — the Model roll-up control, already rendered, for the Model mix panel's header. R-C1
   * always scoped this control to this section; standing it on the panel it redraws is that scope
   * made visible, and it is why the control no longer has to spell "(Adoption)" in its own label.
   */
  readonly modelLevelControl?: ReactNode;
  /** R-T29 / T-C0 — set by tests only, exactly as `ChartFrame` and the money panels carry it. */
  readonly dimension?: PanelDimension;
}) {
  const { adoption } = props;
  const mix = adoption.modelMix;
  const level = LEVEL_WORDS[mix.level] ?? mix.level;

  return (
    <section aria-label={adoption.heading} className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {adoption.heading}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{adoption.statement}</p>
      </div>

      <PanelCard
        level="h3"
        title={adoption.tokensOverTime.title}
        question="How much the agents were used, over time. This is a volume, not a bill: a token on a frontier Model and a token on a small one cost about two hundred times differently, so this line does not predict the spend above it."
        figures={
          <FigureList>
            <Figure label="Tokens processed" value={count(adoption.volume.processed)} lead />
            <Figure
              label="Readings"
              value={count(adoption.volume.entries)}
              hint="Token readings, not sessions: one session may span several Models."
            />
          </FigureList>
        }
      >
        <TokenChart chart={adoption.tokensOverTime} shape="area" dimension={props.dimension} />
      </PanelCard>

      <PanelCard
        level="h3"
        controls={props.modelLevelControl}
        title={mix.chart.title}
        question={`Which Models the tokens went to, rolled up by ${level}. A breakdown and not a comparison axis: a session may span several Models, so no per-session metric is grouped by one.`}
      >
        <TokenChart chart={mix.chart} shape="bar" dimension={props.dimension} />
        <ModelMixList distribution={mix.levels[mix.level]} />
      </PanelCard>
    </section>
  );
}
