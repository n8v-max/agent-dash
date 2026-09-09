// The shape every controlled page takes: the sticky toolbar, then the page.
//
// It exists so that the toolbar's placement is decided once. R-N3 puts it **below the header and
// above the page**, and it is rendered here — outside `<main>` — because it is chrome for the
// page rather than content in it, and because a page that had to remember to render its own
// toolbar is a page that can forget.
//
// **R-N3.1 — the bar is on every controlled surface, because the as-of stamp is.** It used to be
// absent where a page declared no controls; `/demo/projection` now renders it holding the stamp
// alone. A freshness claim on five of six surfaces reads as the sixth being stale.
//
// **R-C7's active-filter sentence is here too, and under the heading rather than in the bar.**
// It is a reading of the page — *"Week grain · by Team · mobile-app · all templates"* — not a
// control, and it belongs with the title it qualifies. Deciding that once, here, is the same
// argument the toolbar's placement was decided by.

import type { ReactNode } from "react";
import { ActiveFilters } from "@/components/controls/active-filters";
import { PageToolbar } from "@/components/controls/page-toolbar";
import type { PageRequest } from "@/components/controls/request";

export function PageFrame(props: {
  readonly request: PageRequest;
  readonly title: string;
  /** One line saying what question this page answers (R-N1: the route axis is the question). */
  readonly lede: string;
  readonly children: ReactNode;
}) {
  return (
    <>
      <PageToolbar
        controls={props.request.controls}
        options={props.request.options}
        window={props.request.window}
        asOf={props.request.asOf}
      />
      <main className="mx-auto w-full max-w-[110rem] px-4 py-8 sm:px-6">
        <div className="mb-6 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{props.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{props.lede}</p>
          <ActiveFilters context={props.request} />
        </div>
        {props.children}
      </main>
    </>
  );
}
