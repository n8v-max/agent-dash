// T-U10 — the permission matrix as a pure function (`testing-spec.md` § 3.3, spec.md R-A3,
// R-A3.1, R-A9, R-A10, R-T17).
//
// The access model is the one part of this product whose surface is combinatorial rather than
// visual, which is why it is asserted here and not by clicking through the UI. Every clause of
// T-U10 has a `describe` block below carrying its name.
//
// `src/domain/**` is pure (R-T5), and that applies to its tests: this file reads no fixture and
// touches no filesystem. Every row, Team and Role it needs is built inline.

import { describe, expect, it, vi } from "vitest";
import {
  DATAPOINT_CLASSES,
  OPEN_DEFAULT_ROLE,
  RESTRICTED_ROLE,
  SCOPE_RESOLUTION,
  SELF_ONLY_ROLE,
  SHIPPED_PRESETS,
  SUBJECT_SCOPES,
  filterRows,
  grantMatrix,
  grantedScopes,
  holds,
  membershipFromTeams,
  permissions,
  resolvesName,
  roleFor,
  scopesCovering,
  type AccessRequest,
  type DatapointClass,
  type Role,
  type SubjectScope,
  type Viewer,
} from "./access";
import type { AgentSession, Team } from "./types";

// --- Inline world -------------------------------------------------------------------------
//
// Four Members. `mem_b` sits on both Teams, which is what makes Team non-additive and what
// exercises the multi-Team branch of `membershipFromTeams`. `mem_d` is on no Team at all.

const TEAMS: readonly Team[] = [
  { id: "team_one", github_id: 1, slug: "one", name: "One", member_ids: ["mem_a", "mem_b"] },
  { id: "team_two", github_id: 2, slug: "two", name: "Two", member_ids: ["mem_b", "mem_c"] },
];

const MEMBERSHIP = membershipFromTeams(TEAMS);

const viewerFor = (memberId: string, role: Role): Viewer => ({
  memberId,
  teamIds: MEMBERSHIP.get(memberId) ?? [],
  role,
});

const requestFor = (viewer: Viewer, datapoint: DatapointClass): AccessRequest => ({
  viewer,
  datapoint,
  membership: MEMBERSHIP,
});

/** A real `AgentSession`, so the filter is proved against the shape it actually receives. */
const session = (id: string, memberId: string, cost: number): AgentSession => ({
  id,
  parent_session_id: null,
  started_at: "2026-04-01T09:00:00+02:00",
  ended_at: "2026-04-01T09:30:00+02:00",
  member_id: memberId,
  repository_id: "repo_api_gateway",
  work_type: "implementation",
  task_key: "equilibrio/api-gateway#412",
  execution_mode: "interactive",
  machine_spec: "general",
  accepted: true,
  hidden: false,
  prompt_count: 7,
  cost,
  interactive_duration_s: 1200,
  idle_duration_s: 300,
  afk_duration_s: 300,
  machine_allocation_duration_s: 1800,
  artefacts: { pull_request: 1 },
  token_usage: [
    { model_id: "mdl_frontier", uncached_input: 10, cache_read: 20, cache_write: 5, output: 30 },
  ],
});

const ROWS: readonly AgentSession[] = [
  session("s_a", "mem_a", 10),
  session("s_b", "mem_b", 20),
  session("s_c", "mem_c", 40),
  session("s_d", "mem_d", 80),
];

const idsOf = (rows: readonly AgentSession[]) => rows.map((row) => row.id);
const sum = (rows: readonly AgentSession[]) => rows.reduce((total, row) => total + row.cost, 0);

// --- Clause 1: every one of the 24 cells, table-driven, both presets ------------------------

type CellExpectation = {
  readonly scope: SubjectScope;
  readonly datapoint: DatapointClass;
  readonly open: boolean;
  readonly restricted: boolean;
};

// R-A3, read cell by cell. The `self` row is `true` everywhere for both presets and neither
// preset authors it — that is R-A3.1. Everything else is written out, negatives included,
// because a table that only lists the grants cannot fail when a grant is added by accident.
const CELLS: readonly CellExpectation[] = [
  { scope: "self", datapoint: "jobs", open: true, restricted: true },
  { scope: "self", datapoint: "tokens", open: true, restricted: true },
  { scope: "self", datapoint: "cost", open: true, restricted: true },
  { scope: "self", datapoint: "access", open: true, restricted: true },

  { scope: "peer", datapoint: "jobs", open: false, restricted: false },
  { scope: "peer", datapoint: "tokens", open: false, restricted: false },
  { scope: "peer", datapoint: "cost", open: false, restricted: false },
  { scope: "peer", datapoint: "access", open: false, restricted: false },

  { scope: "team", datapoint: "jobs", open: false, restricted: true },
  { scope: "team", datapoint: "tokens", open: false, restricted: true },
  { scope: "team", datapoint: "cost", open: false, restricted: false },
  { scope: "team", datapoint: "access", open: false, restricted: false },

  { scope: "peer-team", datapoint: "jobs", open: false, restricted: false },
  { scope: "peer-team", datapoint: "tokens", open: false, restricted: false },
  { scope: "peer-team", datapoint: "cost", open: false, restricted: false },
  { scope: "peer-team", datapoint: "access", open: false, restricted: false },

  { scope: "org", datapoint: "jobs", open: false, restricted: false },
  { scope: "org", datapoint: "tokens", open: false, restricted: false },
  { scope: "org", datapoint: "cost", open: false, restricted: false },
  { scope: "org", datapoint: "access", open: false, restricted: false },

  { scope: "org-member", datapoint: "jobs", open: true, restricted: false },
  { scope: "org-member", datapoint: "tokens", open: true, restricted: false },
  { scope: "org-member", datapoint: "cost", open: true, restricted: false },
  { scope: "org-member", datapoint: "access", open: true, restricted: false },
];

describe("the matrix is 6 scopes × 4 classes, and the table covers all 24 cells", () => {
  it("carries the six subject scopes of CONTEXT.md § Access", () => {
    expect([...SUBJECT_SCOPES]).toEqual(["self", "peer", "team", "peer-team", "org", "org-member"]);
    // `cohort` was withdrawn as a seventh scope and demoted to an aggregation dimension
    // (ADR-0003, ADR-0004). It gates nothing.
    expect(SUBJECT_SCOPES).not.toContain("cohort");
  });

  it("carries the four datapoint classes, `access` among them", () => {
    expect([...DATAPOINT_CLASSES]).toEqual(["jobs", "tokens", "cost", "access"]);
  });

  it("asserts every cell exactly once — 6 × 4 = 24, none repeated, none missing", () => {
    const expected = SUBJECT_SCOPES.flatMap((scope) =>
      DATAPOINT_CLASSES.map((datapoint) => `${scope}/${datapoint}`),
    );
    const asserted = CELLS.map((cell) => `${cell.scope}/${cell.datapoint}`);
    expect(asserted).toHaveLength(24);
    expect(new Set(asserted).size).toBe(24);
    expect([...asserted].sort()).toEqual([...expected].sort());
  });
});

describe("the open default preset, cell by cell including the negatives (R-A3, ADR-0003)", () => {
  it.each(CELLS)("`$scope` × `$datapoint` is $open", ({ scope, datapoint, open }) => {
    expect(holds(OPEN_DEFAULT_ROLE, scope, datapoint)).toBe(open);
  });

  it("authors `org-member` over all four classes and nothing else", () => {
    expect(OPEN_DEFAULT_ROLE.grants).toEqual(
      permissions(["org-member"], ["jobs", "tokens", "cost", "access"]),
    );
  });
});

describe("the restricted preset, cell by cell including the negatives (R-A3, § 11 C5/C6)", () => {
  it.each(CELLS)("`$scope` × `$datapoint` is $restricted", ({ scope, datapoint, restricted }) => {
    expect(holds(RESTRICTED_ROLE, scope, datapoint)).toBe(restricted);
  });

  it("authors `team` over `jobs` and `tokens` and nothing else", () => {
    expect(RESTRICTED_ROLE.grants).toEqual(permissions(["team"], ["jobs", "tokens"]));
  });

  it("holds no `org-member` and no `peer` cell, so it resolves no other Member by name", () => {
    for (const datapoint of DATAPOINT_CLASSES) {
      expect(holds(RESTRICTED_ROLE, "org-member", datapoint)).toBe(false);
      expect(holds(RESTRICTED_ROLE, "peer", datapoint)).toBe(false);
    }
  });
});

// --- A permission is a cell, not a rung ----------------------------------------------------

describe("scopes are a set, not a ladder", () => {
  it("does not let `org-member` imply `org`, `team`, `peer` or `peer-team`", () => {
    expect(holds(OPEN_DEFAULT_ROLE, "org-member", "cost")).toBe(true);
    expect(holds(OPEN_DEFAULT_ROLE, "org", "cost")).toBe(false);
    expect(holds(OPEN_DEFAULT_ROLE, "team", "cost")).toBe(false);
    expect(holds(OPEN_DEFAULT_ROLE, "peer", "cost")).toBe(false);
    expect(holds(OPEN_DEFAULT_ROLE, "peer-team", "cost")).toBe(false);
  });

  it("does not let `team` imply `peer` — aggregated reach is not identified reach", () => {
    expect(holds(RESTRICTED_ROLE, "team", "jobs")).toBe(true);
    expect(holds(RESTRICTED_ROLE, "peer", "jobs")).toBe(false);
  });

  it("does not let a grant on one class leak onto another", () => {
    expect(holds(RESTRICTED_ROLE, "team", "tokens")).toBe(true);
    expect(holds(RESTRICTED_ROLE, "team", "cost")).toBe(false);
  });
});

// --- Clause 2: the R-A3.1 invariant --------------------------------------------------------

describe("`self` is granted over every class, to every Role, always (R-A3.1)", () => {
  // The Role testing-spec § 3.3 names explicitly: "a test constructs a Role granting only
  // `team` over `jobs` and asserts `self` is still resolved".
  const teamJobsOnly: Role = {
    key: "team-jobs-only",
    name: "Team jobs only",
    grants: permissions(["team"], ["jobs"]),
  };

  it.each([...DATAPOINT_CLASSES])(
    "resolves `self` × `%s` for a Role granting only `team` × `jobs`",
    (datapoint) => {
      expect(holds(teamJobsOnly, "self", datapoint)).toBe(true);
    },
  );

  it("resolves `self` for a Role granting nothing at all", () => {
    for (const datapoint of DATAPOINT_CLASSES) {
      expect(holds(SELF_ONLY_ROLE, "self", datapoint)).toBe(true);
    }
    expect(SELF_ONLY_ROLE.grants).toEqual([]);
  });

  it("holds for both shipped presets over all four classes", () => {
    for (const preset of SHIPPED_PRESETS) {
      for (const datapoint of DATAPOINT_CLASSES) {
        expect(holds(preset, "self", datapoint)).toBe(true);
      }
    }
  });

  it("keeps a `team`-only viewer from meeting /demo/people with no people on it", () => {
    const viewer = viewerFor("mem_a", teamJobsOnly);
    const view = filterRows(requestFor(viewer, "jobs"), ROWS);
    // Scopes are not a ladder, so `team` alone resolves nobody by name. `self` is what puts
    // the acting Member on the page.
    expect([...view.identifiedSubjects]).toEqual(["mem_a"]);
  });

  it("lets a narrowed viewer always reach the matrix explaining why (§ 11 C6)", () => {
    // Under the literal reading of ticket 10's grants the matrix rendered for nobody.
    expect(holds(RESTRICTED_ROLE, "self", "access")).toBe(true);
    expect(grantMatrix(RESTRICTED_ROLE).self.access).toBe(true);
    expect(resolvesName(requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "access"), "mem_a")).toBe(
      true,
    );
  });

  it("is an invariant of the model, so no preset authors a `self` cell", () => {
    for (const preset of [...SHIPPED_PRESETS, SELF_ONLY_ROLE]) {
      expect(preset.grants.some((cell) => cell.scope === "self")).toBe(false);
    }
  });
});

// --- Clause 3: aggregated vs identified is a separate grant ---------------------------------

describe("aggregated vs identified is a separate grant", () => {
  it("splits the six scopes into aggregated and identified, per CONTEXT.md", () => {
    expect(SCOPE_RESOLUTION).toEqual({
      self: "identified",
      peer: "identified",
      team: "aggregated",
      "peer-team": "aggregated",
      org: "aggregated",
      "org-member": "identified",
    });
  });

  it("lets `team` reach a teammate's rows for a total but never resolve their name", () => {
    const request = requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "jobs");
    const view = filterRows(request, ROWS);

    // mem_b shares team_one, so their row is in the input to aggregation...
    expect(idsOf([...view.rows])).toContain("s_b");
    // ...and yet mem_b is not nameable: `team` is aggregated, and no identified scope covers them.
    expect(view.identifiedSubjects.has("mem_b")).toBe(false);
    expect(resolvesName(request, "mem_b")).toBe(false);
    expect(grantedScopes(request, "mem_b")).toEqual(["team"]);
  });

  it("lets `org-member` resolve the same teammate by name", () => {
    const request = requestFor(viewerFor("mem_a", OPEN_DEFAULT_ROLE), "jobs");
    expect(grantedScopes(request, "mem_b")).toEqual(["org-member"]);
    expect(resolvesName(request, "mem_b")).toBe(true);
  });

  it("lets `peer` resolve a teammate by name where `team` does not, on the same population", () => {
    const peerJobs: Role = { key: "peer-jobs", name: "Peer jobs", grants: permissions(["peer"], ["jobs"]) };
    const teamJobs: Role = { key: "team-jobs", name: "Team jobs", grants: permissions(["team"], ["jobs"]) };
    const peerRequest = requestFor(viewerFor("mem_a", peerJobs), "jobs");
    const teamRequest = requestFor(viewerFor("mem_a", teamJobs), "jobs");

    // Identical rows either way — `peer` plus the R-A3.1 `self` row reaches exactly what
    // `team` reaches. The two grants differ in resolution alone, which is the point.
    expect(idsOf([...filterRows(peerRequest, ROWS).rows])).toEqual(["s_a", "s_b"]);
    expect(idsOf([...filterRows(teamRequest, ROWS).rows])).toEqual(["s_a", "s_b"]);
    expect(resolvesName(peerRequest, "mem_b")).toBe(true);
    expect(resolvesName(teamRequest, "mem_b")).toBe(false);
  });

  it("names the acting Member even when their teammates are aggregate-only", () => {
    const request = requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "jobs");
    const view = filterRows(request, ROWS);
    expect(view.identifiedSubjects.has("mem_a")).toBe(true);
    expect(view.identifiedSubjects.has("mem_b")).toBe(false);
  });

  it("resolves nobody by name under an `org`-only grant, though every row is reachable", () => {
    const orgOnly: Role = { key: "org-only", name: "Org only", grants: permissions(["org"], ["cost"]) };
    const request = requestFor(viewerFor("mem_c", orgOnly), "cost");
    const view = filterRows(request, ROWS);
    expect(idsOf([...view.rows])).toEqual(["s_a", "s_b", "s_c", "s_d"]);
    expect([...view.identifiedSubjects]).toEqual(["mem_c"]);
  });

  it("reaches other Teams in aggregate only under `peer-team`", () => {
    const peerTeam: Role = {
      key: "peer-team-jobs",
      name: "Peer team jobs",
      grants: permissions(["peer-team"], ["jobs"]),
    };
    const request = requestFor(viewerFor("mem_a", peerTeam), "jobs");
    const view = filterRows(request, ROWS);
    // mem_c and mem_d share no Team with mem_a; mem_b does, so `peer-team` does not cover them.
    expect(idsOf([...view.rows])).toEqual(["s_a", "s_c", "s_d"]);
    expect([...view.identifiedSubjects]).toEqual(["mem_a"]);
  });
});

// --- The relation itself --------------------------------------------------------------------

describe("the subject relation is population-only and knows nothing about a Role", () => {
  const viewer = viewerFor("mem_a", SELF_ONLY_ROLE);

  it("covers the acting Member with self, team, org and org-member", () => {
    expect(scopesCovering(viewer, "mem_a", MEMBERSHIP)).toEqual([
      "self",
      "team",
      "org",
      "org-member",
    ]);
  });

  it("covers a teammate with peer, team, org and org-member — never self or peer-team", () => {
    expect(scopesCovering(viewer, "mem_b", MEMBERSHIP)).toEqual([
      "peer",
      "team",
      "org",
      "org-member",
    ]);
  });

  it("covers a non-teammate with peer-team, org and org-member", () => {
    expect(scopesCovering(viewer, "mem_c", MEMBERSHIP)).toEqual(["peer-team", "org", "org-member"]);
  });

  it("covers a Member on no Team at all with peer-team, org and org-member", () => {
    expect(scopesCovering(viewer, "mem_d", MEMBERSHIP)).toEqual(["peer-team", "org", "org-member"]);
  });

  it("never puts a teamless acting Member in their own `peer-team`", () => {
    const teamless = viewerFor("mem_d", SELF_ONLY_ROLE);
    expect(teamless.teamIds).toEqual([]);
    expect(scopesCovering(teamless, "mem_d", MEMBERSHIP)).toEqual(["self", "org", "org-member"]);
  });

  it("has a coverage rule for every one of the six scopes — none silently dropped", () => {
    // The relation is written as ordered pairs inside the module; this is what stops that list
    // from drifting out of step with SUBJECT_SCOPES.
    const reached = new Set<SubjectScope>();
    for (const subject of ["mem_a", "mem_b", "mem_c"]) {
      for (const scope of scopesCovering(viewer, subject, MEMBERSHIP)) reached.add(scope);
    }
    expect([...reached].sort()).toEqual([...SUBJECT_SCOPES].sort());
  });

  it("inverts Team.member_ids, keeping a Member who sits on two Teams on both", () => {
    expect(MEMBERSHIP.get("mem_a")).toEqual(["team_one"]);
    expect(MEMBERSHIP.get("mem_b")).toEqual(["team_one", "team_two"]);
    expect(MEMBERSHIP.get("mem_d")).toBeUndefined();
  });
});

// --- Clause 4: the filter runs on rows, before aggregation (R-T17) ---------------------------

describe("the filter runs on rows, before aggregation (R-T17)", () => {
  it("keeps a below-grant row out of the *input* the aggregation receives", () => {
    // The restricted preset holds no `cost` cell above `self`, so every other Member's cost
    // row is below grant.
    const request = requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "cost");
    const view = filterRows(request, ROWS);

    const aggregate = vi.fn((rows: readonly AgentSession[]) => sum(rows));
    aggregate(view.rows);

    const input = aggregate.mock.calls[0]?.[0] ?? [];
    expect(idsOf([...input])).toEqual(["s_a"]);
    expect(idsOf([...input])).not.toContain("s_b");
    // Row identity, not just row content: the object never reached the aggregation.
    expect([...input]).not.toContain(ROWS[1]);
  });

  it("returns rows, never a total — a post-hoc filter would have summed 150 first", () => {
    const request = requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "cost");
    const view = filterRows(request, ROWS);
    expect(Array.isArray(view.rows)).toBe(true);
    expect(sum(ROWS)).toBe(150);
    expect(sum(view.rows)).toBe(10);
  });

  it("hands aggregation nothing at all when no cell is granted for the class", () => {
    const noAccess: Role = { key: "jobs-only", name: "Jobs only", grants: permissions(["org-member"], ["jobs"]) };
    const request = requestFor(viewerFor("mem_a", noAccess), "cost");
    const view = filterRows(request, ROWS);
    // Only the acting Member's own row survives, via the R-A3.1 invariant.
    expect(idsOf([...view.rows])).toEqual(["s_a"]);
    expect(grantedScopes(request, "mem_c")).toEqual([]);
  });

  it("preserves row order and identity for the rows it does pass through", () => {
    const request = requestFor(viewerFor("mem_a", OPEN_DEFAULT_ROLE), "tokens");
    const view = filterRows(request, ROWS);
    expect(view.rows).toEqual(ROWS);
    expect(view.rows[0]).toBe(ROWS[0]);
  });

  it("identifies only subjects that survived the filter", () => {
    const request = requestFor(viewerFor("mem_a", RESTRICTED_ROLE), "cost");
    const view = filterRows(request, ROWS);
    const survivors = new Set(view.rows.map((row) => row.member_id));
    for (const subject of view.identifiedSubjects) {
      expect(survivors.has(subject)).toBe(true);
    }
  });
});

// --- Clause 5: symmetry under the open default (R-A9) ----------------------------------------

describe("visibility under the open default is symmetric (R-A9, ADR-0003)", () => {
  const pairs: readonly (readonly [string, string])[] = [
    ["mem_a", "mem_b"], // same Team
    ["mem_a", "mem_c"], // different Teams
    ["mem_a", "mem_d"], // one of them on no Team
  ];

  it.each(pairs)("viewer %s's view of %s equals %s's view of that viewer", (first, second) => {
    for (const datapoint of DATAPOINT_CLASSES) {
      const forward = requestFor(viewerFor(first, OPEN_DEFAULT_ROLE), datapoint);
      const backward = requestFor(viewerFor(second, OPEN_DEFAULT_ROLE), datapoint);

      expect(grantedScopes(forward, second)).toEqual(grantedScopes(backward, first));
      expect(resolvesName(forward, second)).toBe(true);
      expect(resolvesName(backward, first)).toBe(true);
    }
  });

  it("shows each of them the whole Organization, by name, on the same terms", () => {
    for (const memberId of ["mem_a", "mem_b", "mem_c", "mem_d"]) {
      const view = filterRows(requestFor(viewerFor(memberId, OPEN_DEFAULT_ROLE), "cost"), ROWS);
      expect(idsOf([...view.rows])).toEqual(["s_a", "s_b", "s_c", "s_d"]);
      expect([...view.identifiedSubjects].sort()).toEqual(["mem_a", "mem_b", "mem_c", "mem_d"]);
    }
  });

  it("gives no Member a wider matrix than any other — there is no administrative tier", () => {
    const matrices = ["mem_a", "mem_b", "mem_c", "mem_d"].map((memberId) =>
      grantMatrix(viewerFor(memberId, OPEN_DEFAULT_ROLE).role),
    );
    for (const matrix of matrices) {
      expect(matrix).toEqual(matrices[0]);
    }
  });

  it("applies no minimum-population floor: a Team of one is shown, not suppressed", () => {
    const soloTeams: readonly Team[] = [
      { id: "team_solo", github_id: 3, slug: "solo", name: "Solo", member_ids: ["mem_c"] },
    ];
    const membership = membershipFromTeams(soloTeams);
    const viewer: Viewer = { memberId: "mem_a", teamIds: [], role: OPEN_DEFAULT_ROLE };
    const view = filterRows({ viewer, datapoint: "cost", membership }, [ROWS[2]]);
    expect(idsOf([...view.rows])).toEqual(["s_c"]);
    expect([...view.identifiedSubjects]).toEqual(["mem_c"]);
  });
});

// --- The read-only matrix and the Role lookup -------------------------------------------------

describe("the matrix renders as data (R-A10) and Roles are data, not an enum", () => {
  it("resolves all 24 cells for a Role, `self` row included, so a renderer decides nothing", () => {
    const matrix = grantMatrix(RESTRICTED_ROLE);
    expect(Object.keys(matrix)).toEqual([...SUBJECT_SCOPES]);
    expect(Object.keys(matrix.self)).toEqual([...DATAPOINT_CLASSES]);
    expect(matrix.self).toEqual({ jobs: true, tokens: true, cost: true, access: true });
    expect(matrix.team).toEqual({ jobs: true, tokens: true, cost: false, access: false });
    expect(matrix["org-member"]).toEqual({
      jobs: false,
      tokens: false,
      cost: false,
      access: false,
    });
  });

  it("shows the open account the full matrix", () => {
    const matrix = grantMatrix(OPEN_DEFAULT_ROLE);
    expect(matrix["org-member"]).toEqual({ jobs: true, tokens: true, cost: true, access: true });
    expect(matrix.org).toEqual({ jobs: false, tokens: false, cost: false, access: false });
  });

  it("ships exactly two presets, in the order /sign-in offers them", () => {
    expect(SHIPPED_PRESETS.map((preset) => preset.key)).toEqual(["open-default", "restricted"]);
    expect(SHIPPED_PRESETS).not.toContain(SELF_ONLY_ROLE);
  });

  it("maps the fixture's Member.role strings onto the shipped presets", () => {
    expect(roleFor("member")).toBe(OPEN_DEFAULT_ROLE);
    expect(roleFor("contractor")).toBe(RESTRICTED_ROLE);
  });

  it("falls closed on an unrecognised role rather than widening", () => {
    expect(roleFor("automation")).toBe(SELF_ONLY_ROLE);
    expect(roleFor("")).toBe(SELF_ONLY_ROLE);
    expect(roleFor("superadmin")).toBe(SELF_ONLY_ROLE);
  });

  it("builds a Role from cells alone, with no code change", () => {
    const financeCells = permissions(["org"], ["cost"]);
    const finance: Role = { key: "finance", name: "Finance", grants: financeCells };
    expect(financeCells).toEqual([{ scope: "org", datapoint: "cost" }]);
    expect(holds(finance, "org", "cost")).toBe(true);
    expect(holds(finance, "org", "jobs")).toBe(false);
    expect(holds(finance, "org-member", "cost")).toBe(false);
  });

  it("builds an empty cell list from empty inputs", () => {
    expect(permissions([], ["cost"])).toEqual([]);
    expect(permissions(["org"], [])).toEqual([]);
  });
});
