// @vitest-environment node
// R-A5 — a sign-in returns the browser to where it came from, so this endpoint has to know
// where that was. The rule it applies is the whole security surface of the feature, so each arm
// of it is a case: honoured when the path belongs to the account's Organization, ignored
// otherwise.
//
// It also decides *who* may be minted, which ticket 61 narrowed to `OFFERED_PRESETS`. The
// contractor's own id is tested as a refusal below.
//
// The module is imported dynamically after the environment is stubbed, exactly as
// `src/data/session.test.ts` does: `session.ts` reads `AUTH_JWT_SECRET` at module *load* (R-T14),
// so a static import would run before any stub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restrictedAccount, signInAccounts } from "@/data/accounts";
import { SESSION_COOKIE } from "@/data/session-cookie";

const SECRET = "a-thirty-two-byte-or-longer-testing-key";
const ENDPOINT = "http://localhost:3000/api/session";

const [openAccount] = signInAccounts();
if (!openAccount) throw new Error("R-A4: the open default is expected to be offered");

// Seated in the fixture, offered nowhere (ticket 61). It is here to be *refused*: the endpoint
// mints for the offered list, so this account's own id is the sharpest input to test that with.
const contractor = restrictedAccount();

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
    const response = await post({ memberId: openAccount.memberId });

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("mints no token for a Member id /sign-in does not offer", async () => {
    const response = await post({ memberId: "mem_not_offered" });

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  // Ticket 61. The contractor is a real, seated Member holding a real Role, and it is exactly
  // the id an attacker would try: the account the product used to offer. Refusing an unknown id
  // proves nothing about it — a seated-but-unoffered id is the case that does.
  it("mints no token for the restricted contractor, who is seated but not offered", async () => {
    const response = await post({ memberId: contractor.memberId });

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("mints no token for a request carrying no account at all", async () => {
    expect((await post({})).status).toBe(400);
  });
});

// The switcher stopped posting here (ticket 61), so the only caller that carries a `Referer`
// worth honouring today is a re-sign-in from a page under the Organization. The rule is
// unchanged and still the endpoint's whole security surface, so every arm of it stays tested.
describe("R-A5 — a sign-in returns to the page it was made from", () => {
  it("returns to the referring page, query string and all", async () => {
    const response = await post({
      memberId: openAccount.memberId,
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
