// **R-C7 — the active-filter sentence**, under the page heading.
//
// The toolbar says what a control *could* be; this says what the page in front of you actually
// is, in one line: *"Week aggregation · per Team · mobile-app · all templates"*. It exists
// because the bar answers that question only by reading five widgets and remembering which was at its
// default — and because R-C6 moved four toggles out of the bar, so the bar is no longer even a
// complete account of the URL.
//
// **Every filter has a phrase, including the ones nobody set.** "all templates" is in the
// sentence when no template is chosen, because the reading a viewer needs is *what population is
// this figure over*, and an omitted phrase makes the answer depend on knowing what could have
// been there. It is the same reason `filterMenu` offers "All templates" as an option rather than
// as an absence: a filter is legible only when its off state is written down.
//
// **Period is not in it, and neither is sort.** The period control prints its own current value
// in the bar above — "Period · August 2026" — so a second copy in the sentence would be the only
// phrase here that is already on screen. Sort is an ordering rather than a narrowing: it changes
// which row is first, not which rows there are — and since ticket 63 its control *is* the People
// table's headings, which show the ordering where it acts.
//
// **It computes nothing** (R-T6). Every name it prints arrived on `ControlOptions`, resolved by
// the data layer against the viewer's own grants, so a Member the viewer cannot resolve by name
// cannot be named here either (R-A6).

import { toolbarControls, type ControlKey, type ControlSet } from "@/data/params";
import type { ControlOption, ControlOptions } from "@/data/queries";
import type { ControlContext } from "./control-renderers";

/** The words the Aggregation control reads in, so the sentence and the bar agree (ticket 63). */
const GRAIN_WORDS: Readonly<Record<ControlSet["grain"], string>> = {
  day: "Day aggregation",
  week: "Week aggregation",
  month: "Month aggregation",
};

/** The Per control's own words. Its options are Organisation, Team and Member (ticket 63). */
const SUBJECT_WORDS: Readonly<Record<ControlSet["subject"], string>> = {
  organization: "per Organisation",
  team: "per Team",
  member: "per Member",
};

const KIND_WORDS: Readonly<Record<string, string>> = {
  human: "Humans only",
  service_account: "Service accounts only",
};

/** A nullable filter: the chosen value's own label, or the words for its off state. */
const chosen = (
  values: readonly ControlOption[],
  selected: string | null,
  none: string,
): string => values.find((option) => option.value === selected)?.label ?? none;

/**
 * One phrase per summarised control. A key absent from this table is deliberately not in the
 * sentence, and `undefined` is how it says so — a total record over `ControlKey` would force a
 * phrase for `period` and `sort`, which is exactly what the comment above rules out.
 *
 * It is read through `toolbarControls`, so a control that left the bar leaves the sentence with
 * it: `sort` has no phrase here and would have none rendered even if it grew one.
 */
const PHRASES: Partial<
  Readonly<Record<ControlKey, (controls: ControlSet, options: ControlOptions) => string>>
> = {
  grain: (controls) => GRAIN_WORDS[controls.grain],
  subject: (controls) => SUBJECT_WORDS[controls.subject],
  repository: (controls, options) =>
    chosen(options.repositories, controls.repository, "all repositories"),
  workType: (controls, options) => chosen(options.workTypes, controls.workType, "all templates"),
  // "Platform team", not "Platform": a Team name on its own reads as a Repository or a template
  // beside the other phrases, and the sentence is the one place the reader is told which
  // dimension narrowed the page (ticket 63).
  team: (controls, options) => {
    const name = options.teams.find((option) => option.value === controls.team)?.label;
    return name ? `${name} team` : "all teams";
  },
  memberKind: (controls) =>
    controls.memberKind ? KIND_WORDS[controls.memberKind] ?? controls.memberKind : "all kinds",
  member: (controls, options) => chosen(options.members, controls.member, "all Members"),
};

/** R-C7's phrases, in the page's own declaration order. Empty where the page filters nothing. */
export const activeFilterPhrases = (context: ControlContext): readonly string[] =>
  toolbarControls(context.controls.page).flatMap((key) => {
    const phrase = PHRASES[key];
    return phrase ? [phrase(context.controls, context.options)] : [];
  });

export function ActiveFilters(props: { readonly context: ControlContext }) {
  const phrases = activeFilterPhrases(props.context);
  if (phrases.length === 0) return null;

  return (
    <p
      data-testid="active-filters"
      className="mt-2 text-xs font-medium tracking-wide text-muted-foreground"
    >
      {phrases.join(" · ")}
    </p>
  );
}
