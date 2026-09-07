// @vitest-environment node
// R-A5 — the account switch happens **in place**, so this endpoint has to know where "in place"
// was. The rule it applies is the whole security surface of the feature, so each arm of it is a
// case: honoured when the path belongs to the account's Organization, ignored otherwise.
//
// The module is imported dynamically after the environment is stubbed, exactly as
// `src/data/session.test.ts` does: `session.ts` reads `AUTH_JWT_SECRET` at module *load* (R-T14),
// so a static import would run before any stub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAccounts } from "@/data/accounts";
import { SESSION_COOKIE } from "@/data/session-cookie";

const SECRET = "a-thirty-two-byte-or-longer-testing-key";
const ENDPOINT = "http://localhost:3000/api/session";

const [openAccount, restrictedAccount] = signInAccounts();
if (!openAccount || !restrictedAccount) throw new Error("R-A3: two seeded accounts expected");

const post = async (input: {
  readonly memberId?: string;
  readonly referer?: string;
  readonly returnTo?: string;
}): Promise<Response> => {
  vi.resetModules();
  const { POST } = await import("./route");
  const body = new FormData();
  if (input.memberId !== undefined) body.set("member_id", input.memberId);
  if (input.returnTo !== undefined) body.set("return_to", input.returnTo);
  return POST(
    new Request(ENDPOINT, {
      method: "POST",
      body,
      headers: input.referer ? { referer: input.referer } : {},
    }),
  );
};

const locationOf = (response: Response): string =>
  new URL(response.headers.get("location") ?? "").pathname +
  new URL(response.headers.get("location") ?? "").search;

beforeEach(() => {
  vi.stubEnv("AUTH_JWT_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/session — issuing the token (R-T13)", () => {
  it("sets the session cookie and answers 303 so the POST becomes a GET", async () => {
    const response = await post({ memberId: restrictedAccount.memberId });

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("mints no token for a Member id /sign-in does not offer", async () => {
    const response = await post({ memberId: "mem_not_offered" });

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("mints no token for a request carrying no account at all", async () => {
    expect((await post({})).status).toBe(400);
  });
});

describe("R-A5 — the switch keeps the viewer on the current URL", () => {
  it("returns to the page the switch was made from, query string and all", async () => {
    const response = await post({
      memberId: restrictedAccount.memberId,
      referer: "http://localhost:3000/demo/spend?period=2026-08&grain=day",
    });

    expect(locationOf(response)).toBe("/demo/spend?period=2026-08&grain=day");
  });

  it("prefers an explicit return path over the referring page", async () => {
    const response = await post({
      memberId: openAccount.memberId,
      referer: "http://localhost:3000/demo/spend",
      returnTo: "/demo/people?sort=cost",
    });

    expect(locationOf(response)).toBe("/demo/people?sort=cost");
  });

  it("falls back to the Organization root when there is nothing to return to", async () => {
    expect(locationOf(await post({ memberId: openAccount.memberId }))).toBe(
      `/${openAccount.orgSlug}`,
    );
  });
});

describe("R-A2/R-A7 — the return path is validated, never trusted", () => {
  it.each([
    ["another origin", "https://elsewhere.example/demo/spend"],
    ["a protocol-relative escape", "//elsewhere.example/demo/spend"],
    ["another Organization's path", "http://localhost:3000/acme/spend"],
    ["a path outside any Organization", "http://localhost:3000/sign-in"],
    ["a path that merely starts with the slug", "http://localhost:3000/demonstration/spend"],
  ])("ignores %s", async (_case, referer) => {
    const response = await post({ memberId: openAccount.memberId, referer });

    expect(locationOf(response)).toBe(`/${openAccount.orgSlug}`);
  });
});
