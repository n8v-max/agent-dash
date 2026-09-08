// `/demo/people` — who, and how they compare (R-N15…R-N18, R-A9, R-A10).
//
// **A discriminated result** (ticket 28): `?member=` replaces the list with that Member's
// profile (R-N16), so the surface is a property of the params and the page renders one of three
// arms rather than a table with a profile hidden inside it.
//
// **A row appears only where the viewer resolves that Member by name.** `team`, `peer-team` and
// `org` are *aggregated* scopes (`CONTEXT.md` § Access): a Member reachable only through one
// contributes to totals and is never labelled. Under the restricted account that is every
// teammate, so the table is **the viewer's own row and nothing else** (C10).
//
// **No aggregate is restated here.** An earlier build added a note counting the Members behind the
// totals. The grant is real and stays legible on `/demo/work` and `/demo/spend`; put beside a
// named row in one column set it invites the subtraction R-M17 exists to prevent, and it made the
// page's row count a claim about two different kinds of thing.
//
// **No permission matrix renders** (R-A10, `spec.md` § 11 C9). What the page carries instead is
// one sentence naming what the acting account can see — `visibility` below, present on every arm,
// derived from the grants rather than written per preset. It holds no figures.

import {
  SCOPE_RESOLUTION,
  SUBJECT_SCOPES,
  grantMatrix,
  resolvesName,
  type Viewer,
} from "@/domain/access";
import { sessionTokensProcessed } from "@/domain/metrics/adoption";
import { completedTaskKeys, sessionCost } from "@/domain/metrics/spend";
import type { AgentSession, Member } from "@/domain/types";
import { tableViewModel, type TableCell, type TableViewModel } from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { pageContext, type PageContext, type RowClass } from "./context";
import { memberProfile, type MemberProfileViewModel } from "./profile";

export type PeoplePageViewModel = {
  readonly orgSlug: string;
  /**
   * R-A10, C9 — what this account can see, in one sentence, on every arm. It replaces the
   * permission matrix, and it is an empty-state affordance before it is an access disclosure:
   * the restricted account's table is a single row, and a single row with no explanation reads
   * as a fault rather than as a restriction.
   */
  readonly visibility: string;
} & (
  | { readonly surface: "table"; readonly table: TableViewModel }
  | { readonly surface: "profile"; readonly profile: MemberProfileViewModel }
  /** A Member the viewer cannot resolve by name has no profile to show. */
  | { readonly surface: "withheld"; readonly memberId: string; readonly message: string }
);

/** R-N15 — Member · Team · kind · Completed Jobs · Sessions · Tokens · Cost. Numeric columns sort. */
/**
 * Exported because the toolbar's sort control offers exactly these columns (R-C3, R-N15). A
 * second list of column keys in the control layer would be a second answer to "what is
 * sortable", and the two would drift the first time a column is added.
 */
export const PEOPLE_COLUMNS = [
  { key: "member", label: "Member", numeric: false, sortable: false },
  { key: "team", label: "Team", numeric: false, sortable: false },
  { key: "kind", label: "Kind", numeric: false, sortable: false },
  { key: "completedTasks", label: "Completed Jobs", numeric: true, sortable: true },
  { key: "sessions", label: "Sessions", numeric: true, sortable: true },
  { key: "tokens", label: "Tokens", numeric: true, sortable: true },
  { key: "cost", label: "Cost", numeric: true, sortable: true },
] as const;

const rowsOf = (rows: readonly AgentSession[], memberId: string): readonly AgentSession[] =>
  rows.filter((row) => row.member_id === memberId);

/**
 * One class's figure for one Member, or `null` where the viewer's grant over that class does not
 * resolve them. **`null` is withheld, not zero** — and `tableViewModel` sorts it last in both
 * directions so the absence of a grant cannot order the table.
 */
const figureFor = (input: {
  readonly context: PageContext;
  readonly datapoint: RowClass;
  readonly member: Member;
  readonly valueOf: (rows: readonly AgentSession[]) => number;
}): number | null => {
  const request = input.context.access(input.datapoint);
  if (!resolvesName(request, input.member.id)) return null;
  return input.valueOf(rowsOf(input.context.view(input.datapoint).rows, input.member.id));
};

const cellsFor = (context: PageContext, member: Member): readonly TableCell[] => [
  context.label.member(member.id),
  (context.membership.get(member.id) ?? []).map((id) => context.label.team(id)).join(", "),
  member.kind,
  figureFor({
    context,
    datapoint: "jobs",
    member,
    valueOf: (rows) => completedTaskKeys(rows).length,
  }),
  figureFor({ context, datapoint: "jobs", member, valueOf: (rows) => rows.length }),
  figureFor({
    context,
    datapoint: "tokens",
    member,
    valueOf: (rows) => rows.reduce((running, row) => running + sessionTokensProcessed(row), 0),
  }),
  figureFor({ context, datapoint: "cost", member, valueOf: (rows) => sessionCost(rows) }),
];

const peopleTable = (context: PageContext): TableViewModel => {
  const request = context.access("jobs");
  const named = context.population.filter((member) => resolvesName(request, member.id));

  return tableViewModel({
    columns: [...PEOPLE_COLUMNS],
    rows: named.map((member) => ({ key: member.id, cells: cellsFor(context, member) })),
    sort: context.params.sort,
    note: null,
  });
};

/**
 * **C9 — what this account can see, said once, in words.**
 *
 * Read off `grantMatrix` rather than keyed on the preset, so a third Role gets a true sentence
 * without anyone remembering to write one. The two dimensions of the model are the two clauses:
 * whether a scope beyond `self` is granted at all, and whether it *identifies* or only
 * *aggregates* (`SCOPE_RESOLUTION`).
 *
 * **It contains no digits, deliberately.** C10 took an aggregate off this page; an explanation
 * that quotes a count puts one back under a different name.
 */
const visibilityOf = (viewer: Viewer): string => {
  const matrix = grantMatrix(viewer.role);
  const beyondSelf = SUBJECT_SCOPES.filter((scope) => scope !== "self" && matrix[scope].jobs);
  const opening = "You can see yourself by name";

  if (beyondSelf.some((scope) => SCOPE_RESOLUTION[scope] === "identified")) {
    return `${opening}, and every other Member of this Organization by name.`;
  }
  if (beyondSelf.length > 0) {
    return `${opening}. Other Members' work reaches the totals on this page without being named.`;
  }
  return `${opening}, and no one else.`;
};

/**
 * **`/demo/people`.** One call; the params decide which of the three surfaces it returns.
 *
 * R-T16: `viewer` first, and there is no callable form without it.
 */
export function peoplePage(viewer: Viewer, params: ControlSet): PeoplePageViewModel {
  const context = pageContext(viewer, params);
  const visibility = visibilityOf(viewer);
  const slug = params.orgSlug;

  if (params.member === null) {
    return { orgSlug: slug, visibility, surface: "table", table: peopleTable(context) };
  }

  const member = context.data.members.find((candidate) => candidate.id === params.member);
  if (!member || !resolvesName(context.access("jobs"), member.id)) {
    return {
      orgSlug: slug,
      visibility,
      surface: "withheld",
      memberId: params.member,
      message:
        "This Member is not resolved by name under your grants: their work reaches the totals " +
        "on this page and their profile does not exist for you.",
    };
  }

  return { orgSlug: slug, visibility, surface: "profile", profile: memberProfile(context, member) };
}
