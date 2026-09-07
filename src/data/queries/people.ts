// `/demo/people` — who, and how they compare (R-N15…R-N18, R-A9, R-A10).
//
// **A discriminated result** (ticket 28): `?member=` replaces the list with that Member's
// profile (R-N16), so the surface is a property of the params and the page renders one of three
// arms rather than a table with a profile hidden inside it.
//
// **A row appears only where the viewer resolves that Member by name.** `team`, `peer-team` and
// `org` are *aggregated* scopes (`CONTEXT.md` § Access): a Member reachable only through one
// contributes to totals and is never labelled. Under the restricted account that is every
// teammate, so the table is the viewer's own row plus a note saying how many Members are behind
// the totals without being named — which is the mechanism ADR-0003 kept, made visible.
//
// **The permission matrix renders for both accounts** (R-A10): R-A3.1 grants `self` over every
// class to every Role, so a viewer whose tables have just shrunk can always reach the page that
// explains why.

import {
  DATAPOINT_CLASSES,
  SCOPE_RESOLUTION,
  SUBJECT_SCOPES,
  grantMatrix,
  resolvesName,
  type DatapointClass,
  type Resolution,
  type SubjectScope,
  type Viewer,
} from "@/domain/access";
import { sessionTokensProcessed } from "@/domain/metrics/adoption";
import { completedTaskKeys, sessionCost } from "@/domain/metrics/spend";
import type { AgentSession, Member } from "@/domain/types";
import { tableViewModel, type TableCell, type TableViewModel } from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { pageContext, type PageContext, type RowClass } from "./context";
import { memberProfile, type MemberProfileViewModel } from "./profile";

/** R-A10 — the read-only matrix, every cell resolved so a renderer decides nothing. */
export type PermissionMatrixViewModel = {
  readonly roleKey: string;
  readonly roleName: string;
  readonly datapoints: readonly DatapointClass[];
  readonly rows: readonly {
    readonly scope: SubjectScope;
    /** Aggregated or identified — the second, independent dimension of the model. */
    readonly resolution: Resolution;
    readonly cells: readonly { readonly datapoint: DatapointClass; readonly granted: boolean }[];
  }[];
  /** R-A3.1, in words: the `self` row is an invariant of the model, not a property of a preset. */
  readonly note: string;
};

export type PeoplePageViewModel = {
  readonly orgSlug: string;
  /** R-A10 — present on every arm, for both accounts. */
  readonly matrix: PermissionMatrixViewModel;
} & (
  | { readonly surface: "table"; readonly table: TableViewModel }
  | { readonly surface: "profile"; readonly profile: MemberProfileViewModel }
  /** A Member the viewer cannot resolve by name has no profile to show (R-A6). */
  | { readonly surface: "withheld"; readonly memberId: string; readonly message: string }
);

const SELF_ROW_NOTE =
  "`self` is granted over every class, to every Role, always: a Member can always see their own " +
  "data and their own permissions, and restriction bites on other people (R-A3.1).";

/** R-N15 — Member · Team · kind · Completed Jobs · Sessions · Tokens · Cost. Numeric columns sort. */
const COLUMNS = [
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

/** R-A9 — how many Members are behind the totals without being resolved by name. */
const unnamedNote = (context: PageContext, unnamed: readonly Member[]): string | null => {
  const contributing = unnamed.filter(
    (member) => rowsOf(context.view("jobs").rows, member.id).length > 0,
  ).length;
  if (contributing === 0) return null;
  return (
    `${contributing} ${contributing === 1 ? "Member contributes" : "Members contribute"} to the ` +
    "totals on this page through an aggregated grant, so they are counted and not named. The " +
    "permission matrix below says which grants resolve a name."
  );
};

const peopleTable = (context: PageContext): TableViewModel => {
  const request = context.access("jobs");
  const named = context.population.filter((member) => resolvesName(request, member.id));
  const unnamed = context.population.filter((member) => !resolvesName(request, member.id));

  return tableViewModel({
    columns: [...COLUMNS],
    rows: named.map((member) => ({ key: member.id, cells: cellsFor(context, member) })),
    sort: context.params.sort,
    note: unnamedNote(context, unnamed),
  });
};

/** R-A10 — the matrix, for whichever Role the acting Member's `Member.role` resolved to. */
const permissionMatrix = (viewer: Viewer): PermissionMatrixViewModel => {
  const matrix = grantMatrix(viewer.role);
  return {
    roleKey: viewer.role.key,
    roleName: viewer.role.name,
    datapoints: DATAPOINT_CLASSES,
    rows: SUBJECT_SCOPES.map((scope) => ({
      scope,
      resolution: SCOPE_RESOLUTION[scope],
      cells: DATAPOINT_CLASSES.map((datapoint) => ({
        datapoint,
        granted: matrix[scope][datapoint],
      })),
    })),
    note: SELF_ROW_NOTE,
  };
};

/**
 * **`/demo/people`.** One call; the params decide which of the three surfaces it returns.
 *
 * R-T16: `viewer` first, and there is no callable form without it.
 */
export function peoplePage(viewer: Viewer, params: ControlSet): PeoplePageViewModel {
  const context = pageContext(viewer, params);
  const matrix = permissionMatrix(viewer);
  const slug = params.orgSlug;

  if (params.member === null) {
    return { orgSlug: slug, matrix, surface: "table", table: peopleTable(context) };
  }

  const member = context.data.members.find((candidate) => candidate.id === params.member);
  if (!member || !resolvesName(context.access("jobs"), member.id)) {
    return {
      orgSlug: slug,
      matrix,
      surface: "withheld",
      memberId: params.member,
      message:
        "This Member is not resolved by name under your grants: their work reaches the totals " +
        "on this page and their profile does not exist for you (R-A6). The matrix below says why.",
    };
  }

  return { orgSlug: slug, matrix, surface: "profile", profile: memberProfile(context, member) };
}
