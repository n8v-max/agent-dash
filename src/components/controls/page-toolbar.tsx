// **R-N3 — the page toolbar.** Below the header, sticky, holding *this page's global controls*
// and period first.
//
// **R-C6 — it holds the population, not the panel.** Period, aggregation, per, Repository and
// template narrow the rows every panel on the page is read off, so a bar is where they belong: a
// bar reads as a page-wide claim, and for these five it is one. The four toggles that changed a
// single panel — `accepted`, per-capita, Model roll-up, `execution_mode` — have moved into the
// header of each panel that reads them (`PanelControl`), and `sort` has moved onto the People
// table's own headings, which show the ordering where it acts (R-N15, ticket 63). What the
// toolbar renders is therefore `toolbarControls(page)` and not the whole declared set; all three
// lists come from the same table in `params.ts`, so there is no second list here to disagree with
// it.
//
// **R-N3.1 — the bar also carries the as-of stamp, right-aligned**, and that is what makes it
// present on every `/[org]` surface including `/demo/projection`, which declares no controls at
// all. R-N3 used to make the bar *absent* on that page, on the argument that an empty toolbar is
// a promise of controls that never arrive. The argument holds and no longer applies: the bar is
// not empty there, it holds a fact — how fresh the data under the page is — and a freshness stamp
// that appeared on five surfaces and not the sixth would be read as the sixth being stale.
//
// The stamp is the *dataset's* edge, not this page's selection: it does not move when a filter
// does, which is why it sits apart from the controls rather than among them, past the Reset link.
//
// Nothing here holds state. Every control is an `href` built by `schema.ts` from the current
// `ControlSet`, which was itself parsed from the query string on this request (R-T25).

import Link from "next/link";
import type { DataAsOf } from "@/data/clock";
import { toolbarControls } from "@/data/params";
import { cn } from "@/lib/utils";
import { ControlWidget, type ControlContext } from "./control-renderers";
import { canonicalQuery, pathFor } from "./schema";

/**
 * The stamp's words. *"Data to"* rather than *"Updated"* or *"Last sync"*: this product ingests
 * nothing and refreshes nothing, and a verb implying it would be a claim about a pipeline that
 * does not exist. What the sentence says is where the rows stop.
 */
export const AS_OF_PREFIX = "Data to";

export const asOfText = (asOf: DataAsOf): string => `${AS_OF_PREFIX} ${asOf.label}`;

/**
 * **R-N3.1 — the as-of stamp.** The instant is the Organization's (R-M10) and the string is the
 * one `/demo/history`'s Started column prints, so a reader can check the claim against the top
 * row of the page that exists to be checked against. `data-session` names the row it was read
 * off, which is how T-E15 asserts "matches the History top row" as an identity rather than as an
 * arithmetic coincidence between two formatted strings.
 */
function AsOfStamp(props: { readonly asOf: DataAsOf }) {
  return (
    <p
      data-testid="data-as-of"
      data-session={props.asOf.sessionId}
      className="shrink-0 text-xs tabular-nums text-muted-foreground"
    >
      {asOfText(props.asOf)}
    </p>
  );
}

/**
 * **The toolbar.** Always rendered on a controlled surface, because the as-of stamp is on every
 * one of them (R-N3.1); a page declaring no control renders the bar holding the stamp and
 * nothing else, which is `/demo/projection`.
 */
export function PageToolbar(props: ControlContext & { readonly asOf: DataAsOf | null }) {
  const context: ControlContext = {
    controls: props.controls,
    options: props.options,
    window: props.window,
  };
  const shown = toolbarControls(props.controls.page);
  const bare = pathFor(props.controls.page, props.controls.orgSlug);
  const changed = canonicalQuery(props.controls, props.window).size > 0;

  return (
    <div
      data-testid="page-toolbar"
      role="group"
      aria-label="Page controls"
      className={cn(
        "sticky top-14 z-30 border-b border-border/80",
        "bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
      )}
    >
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        {shown.map((key) => (
          <ControlWidget key={key} control={key} {...context} />
        ))}
        {/*
          Reset and the stamp share one right-aligned group, rather than each claiming `ml-auto`
          for itself: two auto margins in a flex row split the free space between them and put the
          Reset link in the middle of the bar.
        */}
        <div className="ml-auto flex items-center gap-3">
          {changed ? (
            <Link
              href={bare}
              className="rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Reset
            </Link>
          ) : null}
          {props.asOf ? <AsOfStamp asOf={props.asOf} /> : null}
        </div>
      </div>
    </div>
  );
}
