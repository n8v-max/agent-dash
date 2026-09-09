// **R-V8's labels and the one place a money figure is formatted.**
//
// `technical-spec.md` § 7 puts the "estimated" / "illustrative rates" labels in `components/`:
// they are copy, the domain layer carries no copy, and R-V8 is a claim about what a *rendered*
// figure says. So both live here, as constants, and the rule that decides between them is one
// expression — `basis`:
//
//   * **`attributed`** — the bill, as billed (R-M4, ADR-0005). It carries **no** marker. Every
//     money figure on `/demo/spend` is one of these, so the whole page is unmarked by
//     construction rather than by each panel remembering not to add a word.
//   * **`forecast`** — Projected cost, and nothing else in the product (R-M1 scopes it to
//     `/demo/projection`). It carries **"Estimated"**, because a forecast is the one money
//     figure here that really is an estimate.
//
// The forecast arm is not reachable from this page and is not meant to be: `/demo/projection` is
// ticket 36's surface. What is asserted here is the *rule* — the same component marks a forecast
// and refuses to mark an attributed figure — which is T-C9's second claim in the layer R-V8
// puts it in.
//
// **It computes nothing** (R-T6). Formatting a number that arrived resolved is not computing
// one: nothing here filters, sums, sorts, ranks or compares.
//
// **The money formatter is not here.** It was, and it was also in `figures.ts`, in
// `projection-panel.tsx` and — as a bare two-decimal number — in `data-table.tsx`, which is how
// `/demo/people` came to print `310.5` in a Cost column beside a tile reading `$310.50`. Ticket
// 41 collapsed the four into `figures.ts`'s `usd` / `usdTick`; this module keeps only the two
// formatters nothing else spells, and R-V8's two labels, which are its actual subject.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WITHHELD } from "./figures";

/** R-V8 — attaches to Projected cost and to nothing attributed. */
export const ESTIMATED_MARKER = "Estimated";

/** R-N11 / R-V8 — the token rate card's label, because the rates are invented. */
export const ILLUSTRATIVE_RATES = "Illustrative rates";

const COUNT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const SHARE = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });

/** `null` is a figure that does not exist — no Completed Job to divide by — never a zero. */
const DASH = WITHHELD;

export const count = (value: number | null): string =>
  value === null ? DASH : COUNT.format(value);

export const share = (value: number | null): string =>
  value === null ? DASH : SHARE.format(value);

/**
 * Where a figure came from, and therefore what it is allowed to say about itself (R-V8).
 * `attributed` is the default because every figure in the product except one is attributed.
 */
export type FigureBasis = "attributed" | "forecast";

/** The figures a panel puts beside its chart. A `<dl>`, so each label owns its value. */
export function FigureList(props: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <dl className={cn("flex flex-wrap gap-x-8 gap-y-4", props.className)}>{props.children}</dl>
  );
}

export function Figure(props: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string | null;
  readonly basis?: FigureBasis;
  readonly lead?: boolean;
}) {
  return (
    <div className="min-w-32">
      <dt className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {props.label}
        {props.basis === "forecast" ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
            {ESTIMATED_MARKER}
          </span>
        ) : null}
      </dt>
      <dd
        className={cn(
          "mt-1 font-semibold tabular-nums text-foreground",
          props.lead ? "text-3xl tracking-tight" : "text-xl",
        )}
      >
        {props.value}
      </dd>
      {props.hint ? <dd className="mt-1 text-xs text-muted-foreground">{props.hint}</dd> : null}
    </div>
  );
}
