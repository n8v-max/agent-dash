// The three shapes a control takes on screen. **Every one of them is a link or a plain form** —
// there is no handler, no `useState`, no context (R-T25). A viewer changes a control by following
// an `href` this module was handed; the browser writes the query string, the server reads it back
// on the next render, and there is nothing in between that could hold a stale copy.
//
// None of these files carries `"use client"`, which is what makes that structural rather than
// careful: a Server Component has no hooks in scope, so the failure R-T25 names — a `useState`
// shadowing a control value — is not expressible here. `page-toolbar.test.tsx` asserts the
// absence over the whole directory.
//
// **No control is ever greyed** (R-C1). An unavailable option is absent from its list: day grain
// over a long range (R-M11) is not offered rather than offered-and-disabled, which is why nothing
// below accepts a `disabled` prop.
//
// The date range is the one control that is a form rather than a link, and the one that needs a
// change event to apply itself. That event lives in `components/forms/auto-submit-form.tsx`,
// outside this directory, precisely so the paragraph above stays true of every module in it.

import Link from "next/link";
import { AutoSubmitForm } from "@/components/forms/auto-submit-form";
import { cn } from "@/lib/utils";

/** One offered value: what it reads as, where it goes, and whether it is the current one. */
export type LinkOption = {
  readonly value: string;
  readonly label: string;
  readonly href: string;
  readonly selected: boolean;
};

const LABEL = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

/**
 * A closed vocabulary, all of it visible at once — grain, subject, `accepted`, per-capita, Model
 * roll-up. Three or four values fit in the width a menu's trigger would have taken, and a viewer
 * can see the alternatives without opening anything.
 */
export function SegmentedControl(props: {
  readonly label: string;
  readonly options: readonly LinkOption[];
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={props.label}>
      <span className={LABEL}>{props.label}</span>
      <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {props.options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            aria-current={option.selected ? "true" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              option.selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * An open vocabulary — a period, a Repository, a Member. `<details>` rather than a popover
 * library because a disclosure is exactly what this is, and it costs no client JavaScript.
 *
 * The `key` carries the current selection, so choosing an option remounts the element and the
 * menu closes on its own. Uncontrolled DOM state that a re-render cannot reach is the one way a
 * menu built this way could feel broken — and `suppressHydrationWarning` says that `open`
 * differing between the server's markup and the hydrated DOM is that same deliberate uncontrolled
 * state, not a drift React should report.
 */
export function MenuControl(props: {
  readonly label: string;
  readonly current: string;
  readonly options: readonly LinkOption[];
}) {
  return (
    <details
      key={`${props.label}:${props.current}`}
      className="relative"
      suppressHydrationWarning
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border",
          "bg-background px-3 py-1 text-xs transition-colors hover:bg-accent",
          "marker:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className={LABEL}>{props.label}</span>
        <span className="font-medium text-foreground">{props.current}</span>
        <span aria-hidden className="text-muted-foreground">
          ▾
        </span>
      </summary>
      <div
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-50 max-h-80 min-w-52 overflow-auto",
          "rounded-xl border border-border bg-popover p-1 shadow-lg",
        )}
      >
        {props.options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            aria-current={option.selected ? "true" : undefined}
            className={cn(
              "block truncate rounded-lg px-3 py-1 text-xs transition-colors hover:bg-accent",
              option.selected ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

/**
 * `/demo/history`'s free date range (R-N20). A `GET` form: the browser assembles the query string
 * from the two inputs, which is the same write path every other control uses.
 *
 * **Native date inputs, in the browser's own locale.** `type="date"` is the control, so the
 * calendar, the keyboard behaviour and the field order are the ones the viewer's own platform
 * gives them — a hand-rolled picker would have to reimplement all three and would spell 1 August
 * in this project's opinion rather than in theirs. The *value* crossing the wire stays ISO
 * `YYYY-MM-DD` whatever the display order is, which is what `schema.ts` parses (R-T26).
 *
 * **It applies on change; there is no Apply button.** Every other control in the product is a
 * link, and following it is the whole gesture; a range that also needed a button was the one
 * control asking for a second one. `AutoSubmitForm` carries the change event and the validity
 * guard, and it sits outside `components/controls/` so that this directory stays free of
 * `"use client"` (R-T25).
 *
 * `min`/`max` are the Organization's observation window and `required` refuses an emptied field,
 * so an incomplete or out-of-window edit simply does not submit — see `AutoSubmitForm`.
 *
 * `carried` holds the page's *other* parameters as `type="hidden"` inputs, because a `GET` form
 * replaces the query string wholesale — without them, narrowing the dates would silently clear
 * the Member filter. (The prop is not called `hidden`: `src/data/load.ts` owns that word, and one
 * test in this repo asserts that no other module in `src` reads a field by that name.)
 */
export function DateRangeControl(props: {
  readonly action: string;
  readonly range: { readonly start: string; readonly end: string };
  readonly bounds: { readonly start: string; readonly end: string };
  readonly carried: readonly (readonly [string, string])[];
}) {
  const field = cn(
    "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
    "[color-scheme:light] dark:[color-scheme:dark]",
  );
  return (
    <AutoSubmitForm
      label="Date range"
      action={props.action}
      className="flex items-center gap-2"
    >
      {props.carried.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className={LABEL}>Dates</span>
      <input
        type="date"
        name="from"
        aria-label="From"
        required
        defaultValue={props.range.start}
        min={props.bounds.start}
        max={props.bounds.end}
        className={field}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <input
        type="date"
        name="to"
        aria-label="To"
        required
        defaultValue={props.range.end}
        min={props.bounds.start}
        max={props.bounds.end}
        className={field}
      />
    </AutoSubmitForm>
  );
}
