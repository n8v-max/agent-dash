// **R-N3 — the page toolbar.** Below the header, sticky, holding *this page's global controls*
// and period first.
//
// **R-C6 — it holds the population, not the panel.** Period, grain, subject, Repository and
// template narrow the rows every panel on the page is read off, so a bar is where they belong: a
// bar reads as a page-wide claim, and for these five it is one. The four toggles that changed a
// single panel — `accepted`, per-capita, Model roll-up, `execution_mode` — have moved into the
// header of each panel that reads them (`PanelControl`). What the toolbar renders is therefore
// `toolbarControls(page)` and not the whole declared set; both come from the same table in
// `params.ts`, so there is no second list here to disagree with it.
//
// It is **absent, not empty, on a page declaring none**: `toolbarControls` is `[]` for
// `/demo/projection` and this component returns `null`, so no bar, no border and no reserved
// height reach the document. An empty toolbar would be a promise of controls that never arrive.
//
// Nothing here holds state. Every control is an `href` built by `schema.ts` from the current
// `ControlSet`, which was itself parsed from the query string on this request (R-T25).

import Link from "next/link";
import { toolbarControls } from "@/data/params";
import { cn } from "@/lib/utils";
import { ControlWidget, type ControlContext } from "./control-renderers";
import { canonicalQuery, pathFor } from "./schema";

/**
 * **The toolbar.** `null` where the page holds nothing in the bar, which is R-N3's "absent" read
 * literally: `/demo/projection` renders a header and a page, and no bar between them.
 */
export function PageToolbar(props: ControlContext) {
  const shown = toolbarControls(props.controls.page);
  if (shown.length === 0) return null;

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
          <ControlWidget key={key} control={key} {...props} />
        ))}
        {changed ? (
          <Link
            href={bare}
            className="ml-auto rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Reset
          </Link>
        ) : null}
      </div>
    </div>
  );
}
