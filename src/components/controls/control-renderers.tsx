// **One control, rendered.** The lookup from a `ControlKey` to the widget that spells it, and the
// only place in the program that knows a period is a menu and a grain is a segmented strip.
//
// It is its own module because a control no longer has one home. R-C6 splits the declared set in
// two: the population filters stand in the page toolbar, and the panel-local toggles stand in the
// header of each panel that reads them. Both call `ControlWidget`, so the *widget* a control takes
// does not depend on where it stands — a per-capita toggle in a panel header is the same strip of
// links, with the same `href`s, that stood in the bar before it moved (T-C14).
//
// **R-C1 — a page renders only the controls its panels use, and none of them is ever greyed.**
// The table below is keyed on `ControlKey` and driven by `DECLARED_CONTROLS`, so no caller can
// reach a renderer for a control its page does not declare: there is no second list of controls
// here to get wrong. An option a range cannot carry (day grain, R-M11) is missing from its list
// rather than present and disabled.
//
// Nothing here holds state. Every control is an `href` built by `schema.ts` from the current
// `ControlSet`, which was itself parsed from the query string on this request (R-T25).

import type { ReactNode } from "react";
import { CONTROL_VOCABULARIES, type ControlKey, type ControlSet } from "@/data/params";
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
  organization: "Organization",
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

/** A nullable filter. "All" is an option rather than an absence, so a filter is always undoable. */
const filterMenu = (input: {
  readonly context: ControlContext;
  readonly label: string;
  readonly values: readonly ControlOption[];
  readonly selected: string | null;
  readonly overrideOf: (value: string | null) => ControlOverrides;
}): ReactNode => {
  const all: ControlOption = { value: "", label: `All ${input.label.toLowerCase()}` };
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

/** R-N15 — one control and not two: a column and a direction are one ordering (A24). */
const sortControl = (context: ControlContext): ReactNode => {
  const options: readonly LinkOption[] = context.options.sortColumns.flatMap((column) =>
    CONTROL_VOCABULARIES.sortDirection.map((direction) => ({
      value: `${column.value}:${direction}`,
      label: `${column.label} ${direction === "desc" ? "high to low" : "low to high"}`,
      href: href(context, { sort: { column: column.value, direction } }),
      selected:
        context.controls.sort.column === column.value &&
        context.controls.sort.direction === direction,
    })),
  );
  const current = options.find((option) => option.selected);
  return <MenuControl label="Sort" current={current?.label ?? "Default"} options={options} />;
};

/** R-C1's table, as renderers. A key absent from `DECLARED_CONTROLS[page]` is never reached. */
const RENDERERS: Readonly<Record<ControlKey, (context: ControlContext) => ReactNode>> = {
  period: periodControl,
  dateRange: dateRangeControl,
  grain: (context) =>
    segmented({
      context,
      label: "Grain",
      selected: context.controls.grain,
      values: named([...context.options.grains]),
      overrideOf: (grain) => ({ grain: grain as ControlSet["grain"] }),
    }),
  subject: (context) =>
    segmented({
      context,
      label: "Subject",
      selected: context.controls.subject,
      values: named([...CONTROL_VOCABULARIES.subject]),
      overrideOf: (subject) => ({ subject: subject as ControlSet["subject"] }),
    }),
  repository: (context) =>
    filterMenu({
      context,
      label: "Repository",
      values: context.options.repositories,
      selected: context.controls.repository,
      overrideOf: (repository) => ({ repository }),
    }),
  workType: (context) =>
    filterMenu({
      context,
      label: "Template",
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
      values: named([...CONTROL_VOCABULARIES.executionMode]),
      selected: context.controls.executionMode,
      overrideOf: (mode) => ({ executionMode: mode as ControlSet["executionMode"] }),
    }),
  team: (context) =>
    filterMenu({
      context,
      label: "Team",
      values: context.options.teams,
      selected: context.controls.team,
      overrideOf: (team) => ({ team }),
    }),
  memberKind: (context) =>
    filterMenu({
      context,
      label: "Kind",
      values: named([...CONTROL_VOCABULARIES.memberKind]),
      selected: context.controls.memberKind,
      overrideOf: (kind) => ({ memberKind: kind as ControlSet["memberKind"] }),
    }),
  sort: sortControl,
  member: (context) =>
    filterMenu({
      context,
      label: "Member",
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
export function ControlWidget(props: ControlContext & { readonly control: ControlKey }) {
  return (
    <div data-testid={`control-${props.control}`} className="flex items-center">
      {RENDERERS[props.control](props)}
    </div>
  );
}
