// @vitest-environment node
// The two seeded accounts, and the tenancy gate the `[org]` layout delegates to.
//
// Dynamic imports again: `viewer.ts` pulls in `session.ts`, which reads AUTH_JWT_SECRET at
// module load, and the test environment carries no `.env.local`.

import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_DEFAULT_ROLE, RESTRICTED_ROLE } from "@/domain/access";

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
