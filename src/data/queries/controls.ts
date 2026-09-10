// The options a page toolbar renders — the seventh entry point on the façade, and a ViewModel
// like every other (R-T6).
//
// **Why the options are a query and not a component's own lookup.** Three of them are not
// constants: the grains a period offers are R-M11's answer for *this* range, and the Members a
// filter lists are the Members this viewer's grants resolve by name (R-A6, R-A9). A toolbar that
// looked either up itself would be computing, and the Member list in particular would be an
// access decision taken in a component — the exact thing ADR-0003 and R-A6 put in the data layer.
//
// **The lists do not narrow with the current selection.** Filtering the options by the active
// filter is the change that makes a filter impossible to undo, and it also makes a shared URL
// unreadable: an option that is not offered cannot be cleared. Every list here is the page's
// whole vocabulary, and the selected value is marked by the toolbar, never removed from the list.
//
// Nothing here reads a clock or a cookie: `viewer` and `params` arrive as arguments (P5, R-T16).

import { filterRows, membershipFromTeams, type Viewer } from "@/domain/access";
import { availableGrains, type PeriodGrain } from "@/domain/periods";
import type { TableColumn } from "@/domain/viewmodel";
import { loadDataset } from "../load";
import type { ControlSet } from "../params";
import { PEOPLE_COLUMNS } from "./people";

/** One selectable value. `value` is what the query string carries; `label` is what a viewer reads. */
export type ControlOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * Every open-vocabulary list a toolbar needs, resolved once for the page.
 *
 * The closed vocabularies (grain aside) are not here: they are `CONTROL_VOCABULARIES` in
 * `params.ts`, they never vary by request, and duplicating them into a per-request ViewModel
 * would give a control two sources for the same list.
 */
export type ControlOptions = {
  readonly repositories: readonly ControlOption[];
  readonly workTypes: readonly ControlOption[];
  readonly teams: readonly ControlOption[];
  /** R-A6 — only Members this viewer holds an identifying grant over. Never the whole roster. */
  readonly members: readonly ControlOption[];
  /** R-M11 — the grains this range can carry. Day is simply absent over a long range (R-C1). */
  readonly grains: readonly PeriodGrain[];
};

const sortable = (columns: readonly TableColumn[]): readonly ControlOption[] =>
  columns.filter((column) => column.sortable).map(({ key, label }) => ({ value: key, label }));

/**
 * R-N15's sortable columns, derived from the People table's own definition and exported because
 * the URL parser rejects a sort naming a column that is not one of them (A24). Deriving that list
 * twice is how the parser and the table disagree about what `?sort=` may say.
 *
 * They are **not** on `ControlOptions` any more (ticket 63). The toolbar's Sort menu was the only
 * thing that read them there, and the ordering's control is now the table's own headings, which
 * are built from `PEOPLE_COLUMNS` directly — so a per-request copy of the list would be a third
 * answer to a question the table already answers.
 */
export const PEOPLE_SORT_COLUMNS: readonly ControlOption[] = sortable(PEOPLE_COLUMNS);

/**
 * **The toolbar's options.** One call per page render, beside the page's own query.
 *
 * R-T16: `viewer` is the first parameter here as everywhere on the façade, because the Member
 * list is a grant-dependent figure and there is no callable form of this without one.
 */
export function controlOptions(viewer: Viewer, params: ControlSet): ControlOptions {
  const data = loadDataset();
  // `jobs` is the class every surface that names a Member reads, and R-A3.1 puts the viewer's
  // own row in it for every Role — so this list is never empty, whatever the Role grants.
  const named = filterRows(
    { viewer, datapoint: "jobs", membership: membershipFromTeams(data.teams) },
    data.sessions,
  ).identifiedSubjects;

  return {
    repositories: data.repositories.map((row) => ({ value: row.id, label: row.name })),
    workTypes: data.workTypes.map((row) => ({ value: row.key, label: row.name })),
    teams: data.teams.map((row) => ({ value: row.id, label: row.name })),
    members: data.members
      .filter((member) => named.has(member.id))
      .map((member) => ({ value: member.id, label: member.full_name })),
    grains: availableGrains(params.range),
  };
}
