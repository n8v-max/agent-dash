// The access matrix — `CONTEXT.md` § Access, `spec.md` § 2 (R-A1…R-A10) and § 11 C5/C6,
// `technical-spec.md` § 3.2 / R-T16–R-T18, ADR-0003. Tested by T-U10.
//
// **Access is two-dimensional.** A permission is one cell of (subject scope × datapoint class).
// It is emphatically NOT a level on a ladder: nothing here compares scopes with `>=`, there is
// no ordering over `SUBJECT_SCOPES`, and holding a wider-looking cell implies no narrower one.
// `org-member` does not imply `org`; `team` does not imply `peer`. Each cell is granted or it
// is not, and the six scopes are two independent facts wearing one name — *which population*
// a subject falls in, and *how sharply* that population resolves.
//
// **Aggregated vs identified is a separate grant** (`SCOPE_RESOLUTION`). `team` reaches a
// teammate's rows so their figures land in a total; it never resolves that teammate to a name.
// `org-member` and `peer` do. The distinction does no work in the default configuration — which
// is exactly why it is implemented deliberately here rather than left to fall out of something
// else, and why T-U10 tests it directly.
//
// **The filter runs on rows, before aggregation** (R-T17). `filterRows` returns the *input* to
// aggregation with below-grant rows already gone. Filtering a computed aggregate leaks by
// arithmetic; filtering rows does not, and a figure that never reaches a sum cannot reach a
// payload (R-A6, R-T18).
//
// **Roles are data, not an enum** (`CONTEXT.md` § Access). A `Role` is a name plus a list of
// cells. Nothing in this module switches on a role identity, so an Organization defining its
// own costs a data change and no code change (ADR-0003, "the grants are data").
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import type { Team } from "./types";

/**
 * *Whose* data is reachable, and how sharply. Declaration order is `CONTEXT.md`'s table order
 * and carries **no** meaning: it is a set, not a ladder, and no comparison is defined over it.
 */
export const SUBJECT_SCOPES = ["self", "peer", "team", "peer-team", "org", "org-member"] as const;
export type SubjectScope = (typeof SUBJECT_SCOPES)[number];

/** *What* is reachable about them. `access` is a class like any other — the model sees itself. */
export const DATAPOINT_CLASSES = ["jobs", "tokens", "cost", "access"] as const;
export type DatapointClass = (typeof DATAPOINT_CLASSES)[number];

/** How sharply a scope resolves the population it reaches. The second, independent dimension. */
export const RESOLUTIONS = ["aggregated", "identified"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * The aggregated/identified split, per scope. `CONTEXT.md` § Access states it scope by scope:
 * `peer` is "**named** individual Members of the acting Member's own Team", `team` is "the
 * acting Member's own Team, **aggregated**", `peer-team` is "aggregated only", `org` is
 * "aggregated", `org-member` is "**named** individual Members across the whole Organization".
 */
export const SCOPE_RESOLUTION: Readonly<Record<SubjectScope, Resolution>> = {
  self: "identified",
  peer: "identified",
  team: "aggregated",
  "peer-team": "aggregated",
  org: "aggregated",
  "org-member": "identified",
};

/** One granted (subject scope × datapoint class) cell. */
export type Permission = {
  readonly scope: SubjectScope;
  readonly datapoint: DatapointClass;
};

/**
 * A named preset over the permission matrix. Data, never an enum.
 *
 * `grants` lists the cells the preset *authors*. It does not list the `self` row: R-A3.1 makes
 * that an invariant of the model rather than a property of any preset, so it is applied in
 * `holds` where no Role can forget it.
 */
export type Role = {
  readonly key: string;
  readonly name: string;
  readonly grants: readonly Permission[];
};

/** Builds the cross-product of scopes × classes as cells. Presets are written with it. */
export function permissions(
  scopes: readonly SubjectScope[],
  datapoints: readonly DatapointClass[],
): readonly Permission[] {
  return scopes.flatMap((scope) => datapoints.map((datapoint) => ({ scope, datapoint })));
}

/**
 * Does `role` hold this one cell?
 *
 * **R-A3.1 — `self` is granted over every class, to every Role, always.** Restriction bites on
 * *other people*, never on the acting Member's view of themselves. It lives here, ahead of the
 * grant lookup, because it is an invariant of the model: a Role that fails it is not expressible.
 *
 * It is load-bearing twice (`spec.md` § 11 C6). Scopes are not a ladder, so a Role holding only
 * `team` over `jobs` would otherwise resolve nobody by name and `/demo/people` would render with
 * no people on it. And because `access` is a class like any other, a Member whose view has just
 * narrowed can always reach the matrix explaining why — under the literal reading, the one
 * account that needed the matrix was the one account that could not see it.
 */
export function holds(role: Role, scope: SubjectScope, datapoint: DatapointClass): boolean {
  if (scope === "self") return true;
  return role.grants.some((cell) => cell.scope === scope && cell.datapoint === datapoint);
}

/** Every cell of the matrix, resolved. This is what the read-only matrix of R-A10 renders. */
export type GrantMatrix = Readonly<Record<SubjectScope, Readonly<Record<DatapointClass, boolean>>>>;

/** All 6 × 4 cells for one Role, `self` row included, so a renderer decides nothing. */
export function grantMatrix(role: Role): GrantMatrix {
  const rows = SUBJECT_SCOPES.map((scope) => {
    const cells = DATAPOINT_CLASSES.map((datapoint) => [datapoint, holds(role, scope, datapoint)]);
    return [scope, Object.fromEntries(cells) as Record<DatapointClass, boolean>];
  });
  return Object.fromEntries(rows) as GrantMatrix;
}

// --- The two shipped presets (R-A3) ------------------------------------------------------

/**
 * **Open default.** `org-member` over all four classes, plus the universal `self` row.
 * ADR-0003: named individual usage and spend, for anyone in the Organization, visible to
 * everyone on the same terms — symmetric, with no minimum-population floor at any scope or
 * class and no administrative tier that sees more than an ordinary Member.
 *
 * Note what it does *not* hold: `org`, `team`, `peer` and `peer-team` are all ungranted. That is
 * the non-ladder property in the shipped data. `org-member` reaches the same population as `org`
 * and resolves it more sharply, so nothing is lost — but it is a distinct cell, not a rung above.
 */
export const OPEN_DEFAULT_ROLE: Role = {
  key: "open-default",
  name: "Open default",
  grants: permissions(["org-member"], ["jobs", "tokens", "cost", "access"]),
};

/**
 * **Restricted (contractor).** `team` over `jobs` and `tokens`, plus the universal `self` row.
 *
 * `spec.md` § 11 C5 resolved the grants in favour of ticket 10 — the richer grant is also the
 * better demonstration, exercising three cells at two different scopes where a purely
 * `self`-scoped account exercises one. § 11 C6 then resolved the `access` question: ticket 10's
 * three-class list was shorthand for the *data* classes, and R-A3.1 gives every Role `self` over
 * `access`, so this account reaches the matrix and sees its own grants.
 *
 * It holds no `org-member` and no `peer` cell, so it resolves **no other Member by name**: its
 * teammates' rows reach a total and never a label. That is the mechanism ADR-0003 kept, made
 * demonstrable — a grid where every cell is granted is indistinguishable from having no grid.
 */
export const RESTRICTED_ROLE: Role = {
  key: "restricted",
  name: "Restricted (contractor)",
  grants: permissions(["team"], ["jobs", "tokens"]),
};

/** The two presets R-A3 ships, in the order `/sign-in` offers them (R-A4). */
export const SHIPPED_PRESETS: readonly Role[] = [OPEN_DEFAULT_ROLE, RESTRICTED_ROLE];

/**
 * The fail-closed floor. **Not a shipped preset** and not offered at `/sign-in`: it is what an
 * unrecognised `Member.role` resolves to, so widening is never the consequence of a typo. Under
 * R-A3.1 it is still coherent — the acting Member sees themselves and their own permissions.
 */
export const SELF_ONLY_ROLE: Role = { key: "self-only", name: "Self only", grants: [] };

/** `Member.role` (fixture data) → Role. Service accounts never sign in; they fail closed. */
const ROLE_BY_MEMBER_ROLE = new Map<string, Role>([
  ["member", OPEN_DEFAULT_ROLE],
  ["contractor", RESTRICTED_ROLE],
]);

/** Resolves a `Member.role` string to its Role, falling closed on anything unrecognised. */
export function roleFor(memberRole: string): Role {
  return ROLE_BY_MEMBER_ROLE.get(memberRole) ?? SELF_ONLY_ROLE;
}

// --- The relation, and the row filter ----------------------------------------------------

/**
 * Not exported, so no module other than this one can name it — which is what makes `sealViewer`
 * the only expression in the application that produces a `Viewer`. A structural type would let
 * any object literal of the right shape be one, and ticket 58 found `queries.ts` claiming
 * otherwise as a *type* guarantee when only convention and a lint rule held it up.
 */
declare const VIEWER_BRAND: unique symbol;

/**
 * The acting Member, resolved once per request and threaded into every query (R-T16).
 *
 * **Nominal, not structural.** The brand is unforgeable outside this module, so a `Viewer` cannot
 * be written as a literal anywhere else — grants arrive from `roleFor` over fixture data, never
 * from a caller assembling the shape it wants. What the type does *not* enforce is which module
 * calls `sealViewer`; that `resolveViewer` is the only one is convention, and `queries.ts` now
 * says so in those terms.
 */
export type Viewer = {
  readonly memberId: string;
  /** The Teams the acting Member belongs to. Many-to-many, so this is a list. */
  readonly teamIds: readonly string[];
  readonly role: Role;
  readonly [VIEWER_BRAND]: true;
};

/** The unbranded shape `sealViewer` takes — everything a `Viewer` is, minus the brand. */
export type ViewerFacts = Omit<Viewer, typeof VIEWER_BRAND>;

/**
 * The only constructor of a `Viewer`. Applies no policy of its own: it exists so that the
 * brand has exactly one source, and so that a reader grepping for who can mint one finds a
 * single answer.
 */
export const sealViewer = (facts: ViewerFacts): Viewer => facts as Viewer;

/** Member id → the Teams that Member belongs to. Built from fixture Teams, never guessed. */
export type TeamMembership = ReadonlyMap<string, readonly string[]>;

/**
 * Inverts `Team.member_ids` into the lookup the relation needs.
 *
 * The parameter is the structural minimum rather than `Team` so that `domain/aggregate.ts` can
 * invert membership through *this* function instead of writing a second one. Teams and Members
 * are many-to-many in one place, and the permission filter and the non-additive Team roll-up
 * (R-V3) must not be able to reach different conclusions about who is on a Team.
 */
export function membershipFromTeams(
  teams: readonly Readonly<Pick<Team, "id" | "member_ids">>[],
): TeamMembership {
  const byMember = new Map<string, string[]>();
  for (const team of teams) {
    for (const memberId of team.member_ids) {
      const existing = byMember.get(memberId);
      if (existing) existing.push(team.id);
      else byMember.set(memberId, [team.id]);
    }
  }
  return byMember;
}

/** Whether a scope's population contains a subject, given how that subject stands to the viewer. */
type Coverage = (isSelf: boolean, sharesTeam: boolean) => boolean;

/**
 * Which scopes place a subject in the acting Member's reach. Population only — this is the
 * relation between two Members and knows nothing about any Role, which is what keeps the two
 * dimensions of the matrix genuinely independent.
 *
 * Written as ordered pairs rather than a keyed object so the lookup is total: there is no
 * `get` that can miss, and therefore no fallback branch pretending a scope has no predicate.
 * The order is `SUBJECT_SCOPES`' order and, as there, carries no meaning.
 */
const COVERAGE: readonly (readonly [SubjectScope, Coverage])[] = [
  ["self", (isSelf) => isSelf],
  ["peer", (isSelf, sharesTeam) => sharesTeam && !isSelf],
  ["team", (_isSelf, sharesTeam) => sharesTeam],
  // "Other Teams" — so never the acting Member, even when they sit on no Team at all.
  ["peer-team", (isSelf, sharesTeam) => !sharesTeam && !isSelf],
  ["org", () => true],
  ["org-member", () => true],
];

/** The scopes covering `subjectMemberId` from `viewer`'s vantage, in `SUBJECT_SCOPES` order. */
export function scopesCovering(
  viewer: Viewer,
  subjectMemberId: string,
  membership: TeamMembership,
): readonly SubjectScope[] {
  const isSelf = subjectMemberId === viewer.memberId;
  const subjectTeams = membership.get(subjectMemberId) ?? [];
  const sharesTeam = viewer.teamIds.some((teamId) => subjectTeams.includes(teamId));
  return COVERAGE.filter(([, covers]) => covers(isSelf, sharesTeam)).map(([scope]) => scope);
}

/** One class of one viewer's reach. Bundled so no call site can drop the membership lookup. */
export type AccessRequest = {
  readonly viewer: Viewer;
  readonly datapoint: DatapointClass;
  readonly membership: TeamMembership;
};

/** The scopes that both cover the subject *and* are granted for this class. */
export function grantedScopes(
  request: AccessRequest,
  subjectMemberId: string,
): readonly SubjectScope[] {
  return scopesCovering(request.viewer, subjectMemberId, request.membership).filter((scope) =>
    holds(request.viewer.role, scope, request.datapoint),
  );
}

/**
 * May the subject be shown by name for this class? True only if a granted covering scope is
 * `identified`. A subject reachable solely through `team`, `peer-team` or `org` contributes to
 * totals and is never labelled.
 */
export function resolvesName(request: AccessRequest, subjectMemberId: string): boolean {
  return grantedScopes(request, subjectMemberId).some(
    (scope) => SCOPE_RESOLUTION[scope] === "identified",
  );
}

/** The minimum a row needs for the filter to place its subject. AgentSession satisfies it. */
export type RowSubject = { readonly member_id: string };

/** The result of the filter: rows to aggregate, plus which subjects may carry a name. */
export type FilteredRows<Row extends RowSubject> = {
  /** The **input** to aggregation. Below-grant rows are already gone (R-T17). */
  readonly rows: readonly Row[];
  /** Subjects among `rows` that a granted `identified` scope resolves. A subset. */
  readonly identifiedSubjects: ReadonlySet<string>;
};

/**
 * The permission filter. Rows in, rows out — never a total (R-T17).
 *
 * A row survives if any granted scope covers its subject for this class. It is *identified* only
 * if one of those scopes is an identifying one, which is how a restricted viewer's own row
 * carries their name while their teammates' rows only carry their numbers.
 */
export function filterRows<Row extends RowSubject>(
  request: AccessRequest,
  rows: readonly Row[],
): FilteredRows<Row> {
  const granted: Row[] = [];
  const identifiedSubjects = new Set<string>();
  for (const row of rows) {
    const scopes = grantedScopes(request, row.member_id);
    if (scopes.length === 0) continue;
    granted.push(row);
    if (scopes.some((scope) => SCOPE_RESOLUTION[scope] === "identified")) {
      identifiedSubjects.add(row.member_id);
    }
  }
  return { rows: granted, identifiedSubjects };
}
