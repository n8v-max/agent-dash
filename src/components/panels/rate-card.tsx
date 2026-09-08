// **R-N11 — the illustrative token rate card, as a collapsed table at the foot of the page.**
//
// It is the evidence for every money figure in the product and it costs one collapsed table.
// Asking a viewer to trust invented prices whose basis is withheld is worse here than it would
// be in a real product, because here the prices really are invented.
//
// **"Illustrative rates" is the label, and it is copy** (R-V8, `technical-spec.md` § 7). It is
// the constant `ILLUSTRATIVE_RATES` rather than a string off the fixture, so the label is a
// property of the surface and cannot be edited out of the data. The fixture's own line — what
// is real and what is derived — sits under it as the description.
//
// **Collapsed, not hidden.** `<details>` without `open`: the summary is always in the accessible
// tree and the table is one activation away, which is what "collapsed table at the foot" asks
// for. Nothing here is behind a control that can lose it.
//
// **The compute rate card is displayed nowhere** (R-N11, A18). Rates vary by machine
// specification and the breakdown is not something a viewer should reason about, so the
// ViewModel does not carry it — there is no expression in this module that could name it, and
// T-E9 crawls all six routes for its values.

import type { RateCardViewModel } from "@/data/queries";
import { DataTable } from "./data-table";
import { ILLUSTRATIVE_RATES } from "./money-figure";

/** The fixture's unit key, in words. A lookup on a closed vocabulary — copy, not computation. */
const UNIT_WORDS: Readonly<Record<string, string>> = {
  usd_per_million_tokens: "US dollars per million tokens",
};

/** The four token classes, as the derivation names them (ADR-0007). */
const CLASS_WORDS: Readonly<Record<string, string>> = {
  uncached_input: "Uncached input",
  cache_read: "Cache read",
  cache_write: "Cache write",
  output: "Output",
};

export function RateCard(props: { readonly card: RateCardViewModel }) {
  const { card } = props;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/40 sm:px-6">
          <span>
            <span>{ILLUSTRATIVE_RATES}</span>{" "}
            <span className="font-normal text-muted-foreground">
              — the prices every money figure in this product was attributed with
            </span>
          </span>
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>

        <div className="space-y-4 border-t border-border px-5 py-5 sm:px-6">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {card.label}. Figures are {UNIT_WORDS[card.unit] ?? card.unit}, in {card.currency}.
          </p>

          <DataTable table={card.table} caption={`${ILLUSTRATIVE_RATES} by Model`} />

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Each class, as a multiple of the model&apos;s uncached input rate (ADR-0007)
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {card.derivation.map((entry) => (
                <li key={entry.key}>
                  {CLASS_WORDS[entry.key] ?? entry.key}
                  <span className="ml-2 tabular-nums text-foreground">{entry.factor}×</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
