// @vitest-environment node
// The two seeded accounts, and the tenancy gate the `[org]` layout delegates to.
//
// Dynamic imports again: `viewer.ts` pulls in `session.ts`, which reads AUTH_JWT_SECRET at
// module load, and the test environment carries no `.env.local`.

import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_DEFAULT_ROLE, RESTRICTED_ROLE } from "@/domain/access";
import type { Member, Organization } from "@/domain/types";
import type { Dataset } from "./load";

const SECRET = "a-thirty-two-byte-or-longer-testing-key";

type ViewerModule = typeof import("./viewer");
type AccountsModule = typeof import("./accounts");

const loadModule = async (): Promise<ViewerModule & AccountsModule> => {
  vi.resetModules();
  const [viewer, accounts] = await Promise.all([import("./viewer"), import("./accounts")]);
  return { ...viewer, ...accounts };
};

/** Signs an arbitrary payload with the real key — including payloads the app would never mint. */
const forge = async (claims: Record<string, unknown>): Promise<string> =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));

beforeEach(() => {
  vi.stubEnv("AUTH_JWT_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the seeded accounts", () => {
  it("offers exactly the two presets of R-A3, in the order /sign-in shows them", async () => {
    const { signInAccounts } = await loadModule();

    expect(signInAccounts().map((account) => account.roleName)).toEqual([
      OPEN_DEFAULT_ROLE.name,
      RESTRICTED_ROLE.name,
    ]);
  });

  it("resolves each account to a distinct Member of the seeded Organization", async () => {
    const { signInAccounts } = await loadModule();

    const accounts = signInAccounts();

    expect(new Set(accounts.map((account) => account.memberId)).size).toBe(2);
    expect(accounts.every((account) => account.orgSlug === "demo")).toBe(true);
    expect(accounts.every((account) => account.fullName.length > 0)).toBe(true);
  });
});

describe("resolving a viewer", () => {
  it("reports no session when there is no cookie", async () => {
    const { resolveViewer } = await loadModule();

    await expect(resolveViewer(undefined, "demo")).resolves.toEqual({ outcome: "no-session" });
  });

  it("reports no session for a token it cannot verify", async () => {
    const { resolveViewer } = await loadModule();

    await expect(resolveViewer("not.a.jwt", "demo")).resolves.toEqual({ outcome: "no-session" });
  });

  it("resolves a valid token against its own Organization", async () => {
    const { resolveViewer, signInAccounts } = await loadModule();
    const [open] = signInAccounts();
    const token = await forge({ member_id: open?.memberId, org_slug: "demo" });

    const resolution = await resolveViewer(token, "demo");

    expect(resolution.outcome).toBe("signed-in");
  });

  // R-A7 / A11. Three different faults, one indistinguishable outcome: anything else confirms
  // that an Organization exists, which is the tenancy leak 404-not-403 exists to prevent.
  it.each([
    ["the token names another Organization", { org_slug: "other-org" }, "demo"],
    ["the path names an Organization that does not exist", { org_slug: "nope" }, "nope"],
  ])("is not-found when %s", async (_case, overrides, path) => {
    const { resolveViewer, signInAccounts } = await loadModule();
    const [open] = signInAccounts();
    const token = await forge({ member_id: open?.memberId, ...overrides });

    await expect(resolveViewer(token, path)).resolves.toEqual({ outcome: "not-found" });
  });

  it("is not-found when the token names a Member the Organization does not have", async () => {
    const { resolveViewer } = await loadModule();
    const token = await forge({ member_id: "mem_nobody", org_slug: "demo" });

    await expect(resolveViewer(token, "demo")).resolves.toEqual({ outcome: "not-found" });
  });
});

describe("grants are resolved from the fixture, never from the token", () => {
  it("gives the restricted account the restricted Role", async () => {
    const { resolveViewer, signInAccounts } = await loadModule();
    const restricted = signInAccounts()[1];
    const token = await forge({ member_id: restricted?.memberId, org_slug: "demo" });

    const resolution = await resolveViewer(token, "demo");

    expect(resolution.outcome === "signed-in" && resolution.viewer.role).toEqual(RESTRICTED_ROLE);
  });

  // The attack R-T14 is written against: a token holder edits their own payload to widen it.
  // The extra claims are signed with the real key, so verification passes and they are still
  // ignored — the Role comes from `members.json`, which the holder cannot sign.
  it("ignores grants, scopes and a role name smuggled into a validly signed token", async () => {
    const { resolveViewer, signInAccounts } = await loadModule();
    const restricted = signInAccounts()[1];
    const token = await forge({
      member_id: restricted?.memberId,
      org_slug: "demo",
      role: "member",
      grants: [{ scope: "org-member", datapoint: "cost" }],
      scopes: ["org-member"],
    });

    const resolution = await resolveViewer(token, "demo");

    expect(resolution.outcome === "signed-in" && resolution.viewer.role).toEqual(RESTRICTED_ROLE);
  });

  it("resolves the viewer's Teams from the fixture, not from the token", async () => {
    const { resolveViewer, signInAccounts } = await loadModule();
    const restricted = signInAccounts()[1];
    const token = await forge({ member_id: restricted?.memberId, org_slug: "demo", teams: ["x"] });

    const resolution = await resolveViewer(token, "demo");

    expect(resolution.outcome === "signed-in" && resolution.viewer.teamIds).not.toContain("x");
  });
});

/**
 * **Ticket 58 — the two-Organization world, hand-built.**
 *
 * The committed fixture seeds one Organization, so the bad state this describes cannot be
 * expressed in it. That is not a reason to assert nothing; it is the reason the assertion has to
 * be built here. `resolveViewer` takes its `Dataset` as a parameter precisely so this test can
 * hand it a world with two Organizations in it and watch the resolution fail.
 *
 * Everything that is not tenancy is stubbed to empty: this exercises the Membership predicate and
 * nothing else, and a row that is not read is a row that cannot make the test pass by accident.
 */
const ORG_A: Organization = {
  id: "org_a",
  slug: "alpha",
  name: "Alpha S.L.",
  timezone: "Europe/Madrid",
  github_org: "alpha",
  window_start: "2026-04-12",
  window_end: "2026-09-08",
  window_days: 150,
};

const memberIn = (id: string): Member => ({
  id,
  github_id: 1,
  github_login: id,
  full_name: `Person ${id}`,
  email: `${id}@example.test`,
  kind: "human",
  team_ids: [],
  seat_active: true,
});

/**
 * A `Dataset` serving Organization A, in which `mem_here` holds a Membership and `mem_elsewhere`
 * holds one in Organization B — an Organization this dataset does not serve. That asymmetry is
 * the whole point: B exists only as the target of a Membership, which is exactly the shape a
 * cross-tenant token has.
 */
const TWO_ORG_DATASET = {
  organization: ORG_A,
  repositories: [],
  teams: [],
  members: [memberIn("mem_here"), memberIn("mem_elsewhere")],
  memberships: [
    { organization_id: "org_a", member_id: "mem_here", role: "member" },
    { organization_id: "org_b", member_id: "mem_elsewhere", role: "member" },
  ],
  githubUsers: [],
  tasks: [],
  workTypes: [],
  models: [],
  rateCards: { token: [], compute: [], seat: [] },
  sessions: [],
  childSessions: new Map(),
} as unknown as Dataset;

describe("ticket 58 — the acting Member is checked against the Organization, not just the token", () => {
  it("signs in a Member who holds a Membership in the Organization on the path", async () => {
    const { resolveViewer } = await loadModule();
    const token = await forge({ member_id: "mem_here", org_slug: "alpha" });

    const resolution = await resolveViewer(token, "alpha", TWO_ORG_DATASET);

    expect(resolution.outcome).toBe("signed-in");
  });

  /**
   * **The regression.** Before ticket 58 this resolved `signed-in`: the token's `org_slug` matched
   * the path, and the Member lookup ran across the whole dataset with no Organization predicate.
   * Both surviving checks passed and the third did not exist.
   */
  it("refuses a token for one Organization naming a Member of another", async () => {
    const { resolveViewer } = await loadModule();
    const token = await forge({ member_id: "mem_elsewhere", org_slug: "alpha" });

    const resolution = await resolveViewer(token, "alpha", TWO_ORG_DATASET);

    expect(resolution.outcome).toBe("not-found");
  });

  /**
   * **R-A7 — indistinguishable, not merely both errors.** A resolution that told the two apart
   * would confirm that `mem_elsewhere` is a real Member somewhere, which is the membership oracle
   * the 404-not-403 collapse exists to deny. Asserted by deep equality on the whole resolution,
   * so a later field that differed between the two would fail this rather than slip through.
   */
  it("makes a Member of another Organization indistinguishable from one that does not exist", async () => {
    const { resolveViewer } = await loadModule();
    const [foreign, absent] = await Promise.all([
      forge({ member_id: "mem_elsewhere", org_slug: "alpha" }),
      forge({ member_id: "mem_nobody", org_slug: "alpha" }),
    ]);

    const [foreignResolution, absentResolution] = await Promise.all([
      resolveViewer(foreign, "alpha", TWO_ORG_DATASET),
      resolveViewer(absent, "alpha", TWO_ORG_DATASET),
    ]);

    expect(foreignResolution).toEqual(absentResolution);
    expect(foreignResolution).toEqual({ outcome: "not-found" });
  });

  it("resolves the Role from the Membership, so it is held per Organization", async () => {
    const { resolveViewer } = await loadModule();
    const dataset = {
      ...TWO_ORG_DATASET,
      memberships: [
        { organization_id: "org_a", member_id: "mem_here", role: "contractor" },
        { organization_id: "org_b", member_id: "mem_here", role: "member" },
      ],
    } as unknown as Dataset;
    const token = await forge({ member_id: "mem_here", org_slug: "alpha" });

    const resolution = await resolveViewer(token, "alpha", dataset);

    expect(resolution.outcome === "signed-in" && resolution.viewer.role).toEqual(RESTRICTED_ROLE);
  });

  it("reports only the Organizations a Member holds a Membership in", async () => {
    const { organizationsFor } = await loadModule();

    expect(organizationsFor("mem_here", TWO_ORG_DATASET).map((org) => org.slug)).toEqual(["alpha"]);
    expect(organizationsFor("mem_elsewhere", TWO_ORG_DATASET)).toEqual([]);
  });
});
