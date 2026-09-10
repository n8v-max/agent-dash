// **One control, rendered.** The lookup from a `WidgetControl` to the widget that spells it, and
// the only place in the program that knows a period is a menu and an aggregation is a segmented
// strip.
//
// It is its own module because a control no longer has one home. R-C6 splits the declared set
// three ways: the population filters stand in the page toolbar, the panel-local toggles stand in
// the header of each panel that reads them, and `sort` is the People table's own headings and has
// no widget here at all (R-N15, ticket 63). The first two call `ControlWidget`, so the *widget* a
// control takes does not depend on where it stands — a per-capita toggle in a panel header is the
// same strip of links, with the same `href`s, that stood in the bar before it moved (T-C14).
//
// **The copy is the reader's, not the schema's.** `grain` is labelled **Aggregation** and
// `subject` **Per**, because "grain" and "subject" are this program's words for them and neither
// is a word an engineering manager reading a spend chart would reach for. The query string is
// unchanged: `?grain=` and `?subject=` are what they always were, and a link shared before the
// relabelling opens on the same page after it (R-C3, T-C14).
//
// **R-C1 — a page renders only the controls its panels use, and none of them is ever greyed.**
// The table below is keyed on `WidgetControl` and driven by `DECLARED_CONTROLS`, so no caller can
// reach a renderer for a control its page does not declare: there is no second list of controls
// here to get wrong. An option a range cannot carry (day grain, R-M11) is missing from its list
// rather than present and disabled.
//
// Nothing here holds state. Every control is an `href` built by `schema.ts` from the current
// `ControlSet`, which was itself parsed from the query string on this request (R-T25).

import type { ReactNode } from "react";
import { CONTROL_VOCABULARIES, type ControlSet, type WidgetControl } from "@/data/params";
import type { ControlOption, ControlOptions } from "@/data/queries";
import type { PeriodRange } from "@/domain/periods";
import { DateRangeControl, MenuControl, SegmentedControl, type LinkOption } from "./control-widgets";
import {
  canonicalQuery,
  controlHref,
  pathFor,
  periodOptions,
  rangeEquals,
  type ControlOverrides,
} from "./schema";

/**
 * Everything a control needs to render itself: the URL's own values, the options the viewer's
 * grants allow, and the window a period is measured against. A `PageRequest` satisfies it, which
 * is how a page hands the same context to the toolbar and to a panel header alike.
 */
export type ControlContext = {
  readonly controls: ControlSet;
  readonly options: ControlOptions;
  readonly window: PeriodRange;
};

const href = (context: ControlContext, overrides: ControlOverrides): string =>
  controlHref({ controls: context.controls, window: context.window, overrides });

/** Copy, and only copy. Every key below is a member of a closed vocabulary in `src/domain`. */
const LABELS: Readonly<Record<string, string>> = {
  day: "Day",
  week: "Week",
  month: "Month",
  organization: "Organisation",
  team: "Team",
  member: "Member",
  any: "Any",
  accepted: "Accepted",
  "not-accepted": "Not accepted",
  exact: "Exact",
  family: "Family",
  tier: "Tier",
  interactive: "Interactive",
  headless: "Headless",
  human: "Human",
  service_account: "Service account",
};

const named = (values: readonly string[]): readonly ControlOption[] =>
  values.map((value) => ({ value, label: LABELS[value] ?? value }));

const segmented = (input: {
  readonly context: ControlContext;
  readonly label: string;
  readonly selected: string;
  readonly values: readonly ControlOption[];
  readonly overrideOf: (value: string) => ControlOverrides;
}): ReactNode => (
  <SegmentedControl
    label={input.label}
    options={input.values.map((option) => ({
      ...option,
      href: href(input.context, input.overrideOf(option.value)),
      selected: option.value === input.selected,
    }))}
  />
);

/**
 * A nullable filter. "All" is an option rather than an absence, so a filter is always undoable.
 *
 * **The off state is spelled out, and in the plural the sentence uses.** It read `All ${label}`
 * lowercased — "All team", "All repository" — which is the label with a word in front of it
 * rather than English, and it disagreed with the phrase R-C7's sentence prints for the same off
 * state. `all` is now given per control, so the menu offers "All teams" where the sentence says
 * "all teams" and the two are one claim (ticket 63).
 */
const filterMenu = (input: {
  readonly context: ControlContext;
  readonly label: string;
  /** The off state, in words — "All teams". Never derived from `label`. */
  readonly all: string;
  readonly values: readonly ControlOption[];
  readonly selected: string | null;
  readonly overrideOf: (value: string | null) => ControlOverrides;
}): ReactNode => {
  const all: ControlOption = { value: "", label: input.all };
  const options: readonly LinkOption[] = [all, ...input.values].map((option) => ({
    value: option.value === "" ? " all" : option.value,
    label: option.label,
    href: href(input.context, input.overrideOf(option.value === "" ? null : option.value)),
    selected: (option.value === "" ? null : option.value) === input.selected,
  }));
  const current = input.values.find((option) => option.value === input.selected);
  return <MenuControl label={input.label} current={current?.label ?? "All"} options={options} />;
};

const periodControl = (context: ControlContext): ReactNode => {
  // The offer is the page's, not the product's: `/demo` is month-locked and offers no whole
  // window (R-N6, ticket 39). The list is never narrowed by the current selection.
  const offered = periodOptions(context.controls.page, context.window);
  const options: readonly LinkOption[] = offered.map((option) => ({
    value: option.value,
    label: option.label,
    href: href(context, { range: option.range }),
    selected: rangeEquals(option.range, context.controls.range),
  }));
  const current = offered.find((option) => rangeEquals(option.range, context.controls.range));
  return <MenuControl label="Period" current={current?.label ?? "Custom"} options={options} />;
};

const dateRangeControl = (context: ControlContext): ReactNode => {
  const carried = canonicalQuery(context.controls, context.window);
  carried.delete("from");
  carried.delete("to");
  return (
    <DateRangeControl
      action={pathFor(context.controls.page, context.controls.orgSlug)}
      range={context.controls.range}
      bounds={context.window}
      carried={[...carried.entries()]}
    />
  );
};

/**
 * R-C1's table, as renderers. A key absent from `DECLARED_CONTROLS[page]` is never reached.
 *
 * It is keyed on `WidgetControl` rather than on `ControlKey`, so `sort` — whose control is the
 * People table's own headings (R-N15, ticket 63) — has no renderer here to reach for. The bar
 * cannot grow a second widget for that parameter by accident: it would have to be given one.
 */
const RENDERERS: Readonly<Record<WidgetControl, (context: ControlContext) => ReactNode>> = {
  period: periodControl,
  dateRange: dateRangeControl,
  grain: (context) =>
    segmented({
      context,
      label: "Aggregation",
      selected: context.controls.grain,
      values: named([...context.options.grains]),
      overrideOf: (grain) => ({ grain: grain as ControlSet["grain"] }),
    }),
  subject: (context) =>
    segmented({
      context,
      label: "Per",
      selected: context.controls.subject,
      values: named([...CONTROL_VOCABULARIES.subject]),
      overrideOf: (subject) => ({ subject: subject as ControlSet["subject"] }),
    }),
  repository: (context) =>
    filterMenu({
      context,
      label: "Repository",
      all: "All repositories",
      values: context.options.repositories,
      selected: context.controls.repository,
      overrideOf: (repository) => ({ repository }),
    }),
  workType: (context) =>
    filterMenu({
      context,
      label: "Template",
      all: "All templates",
      values: context.options.workTypes,
      selected: context.controls.workType,
      overrideOf: (workType) => ({ workType: workType as ControlSet["workType"] }),
    }),
  accepted: (context) =>
    segmented({
      context,
      label: "Accepted",
      selected: context.controls.accepted,
      values: named([...CONTROL_VOCABULARIES.accepted]),
      overrideOf: (accepted) => ({ accepted: accepted as ControlSet["accepted"] }),
    }),
  perCapita: (context) =>
    segmented({
      context,
      label: "Measure",
      selected: context.controls.perCapita ? "per-capita" : "raw",
      values: [
        { value: "raw", label: "Raw" },
        { value: "per-capita", label: "Per capita" },
      ],
      overrideOf: (value) => ({ perCapita: value === "per-capita" }),
    }),
  modelLevel: (context) =>
    segmented({
      context,
      label: "Model",
      selected: context.controls.modelLevel,
      values: named([...CONTROL_VOCABULARIES.modelLevel]),
      overrideOf: (modelLevel) => ({ modelLevel: modelLevel as ControlSet["modelLevel"] }),
    }),
  executionMode: (context) =>
    filterMenu({
      context,
      label: "Mode",
      all: "All modes",
      values: named([...CONTROL_VOCABULARIES.executionMode]),
      selected: context.controls.executionMode,
      overrideOf: (mode) => ({ executionMode: mode as ControlSet["executionMode"] }),
    }),
  team: (context) =>
    filterMenu({
      context,
      label: "Team",
      all: "All teams",
      values: context.options.teams,
      selected: context.controls.team,
      overrideOf: (team) => ({ team }),
    }),
  memberKind: (context) =>
    filterMenu({
      context,
      label: "Kind",
      all: "All kinds",
      values: named([...CONTROL_VOCABULARIES.memberKind]),
      selected: context.controls.memberKind,
      overrideOf: (kind) => ({ memberKind: kind as ControlSet["memberKind"] }),
    }),
  member: (context) =>
    filterMenu({
      context,
      label: "Member",
      all: "All Members",
      values: context.options.members,
      selected: context.controls.member,
      overrideOf: (member) => ({ member }),
    }),
};

/**
 * **One control, wherever it stands.** The `data-testid` travels with the control rather than
 * with the bar, so `control-perCapita` names the same thing before and after R-C6 moved it — and
 * a test asserting a control's *placement* has to say which container it looked inside.
 */
export function ControlWidget(props: ControlContext & { readonly control: WidgetControl }) {
  return (
    <div data-testid={`control-${props.control}`} className="flex items-center">
      {RENDERERS[props.control](props)}
    </div>
  );
}
