// @vitest-environment node
// R-T14 — the secret, and the payload's contents.
//
// Every case imports the module dynamically after stubbing the environment, because the
// secret is read at module *load*: that is the behaviour under test in the first two cases,
// and a static import would run it once, before any stub, in all of them.

import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "a-thirty-two-byte-or-longer-testing-key";
const OTHER_SECRET = "a-different-thirty-two-byte-testing-key";

type SessionModule = typeof import("./session");

const loadModule = async (secret: string | undefined): Promise<SessionModule> => {
  if (secret === undefined) vi.stubEnv("AUTH_JWT_SECRET", undefined);
  else vi.stubEnv("AUTH_JWT_SECRET", secret);
  vi.resetModules();
  return import("./session");
};

const payloadOf = (token: string): Record<string, unknown> => {
  const [, encoded] = token.split(".");
  if (!encoded) throw new Error("not a JWT");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
};

beforeEach(() => {
  vi.stubEnv("AUTH_JWT_SECRET", VALID_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetModules();
});

describe("the signing key", () => {
  it("throws at module load when AUTH_JWT_SECRET is absent", async () => {
    await expect(loadModule(undefined)).rejects.toThrow(/AUTH_JWT_SECRET/);
  });

  it("throws at module load when AUTH_JWT_SECRET is under HS256's 32 bytes", async () => {
    await expect(loadModule("31-bytes-long-and-one-too-few!!")).rejects.toThrow(/32 bytes/);
  });

  it("names the generation command, so a failing boot says what to do", async () => {
    await expect(loadModule("")).rejects.toThrow(/openssl rand -base64 32/);
  });
});

describe("the session token", () => {
  it("carries member_id and org_slug and nothing else beyond the registered claims", async () => {
    const { issueSession } = await loadModule(VALID_SECRET);

    const token = await issueSession({ member_id: "mem_hcamps", org_slug: "demo" });

    // The assertion R-T14 exists for: no grants, no scopes, no role name, nothing a holder
    // could edit to widen their own view. `iat`/`exp` are the JWT's own registered claims.
    expect(Object.keys(payloadOf(token)).sort()).toEqual(["exp", "iat", "member_id", "org_slug"]);
  });

  it("round-trips the claims through verification", async () => {
    const { issueSession, readSession } = await loadModule(VALID_SECRET);

    const token = await issueSession({ member_id: "mem_hcamps", org_slug: "demo" });

    await expect(readSession(token)).resolves.toEqual({
      member_id: "mem_hcamps",
      org_slug: "demo",
    });
  });

  it("signs with HS256", async () => {
    const { issueSession } = await loadModule(VALID_SECRET);

    const [header] = (await issueSession({ member_id: "m", org_slug: "demo" })).split(".");

    expect(JSON.parse(Buffer.from(header ?? "", "base64url").toString("utf8"))).toMatchObject({
      alg: "HS256",
    });
  });
});

describe("verification", () => {
  it("refuses a missing token", async () => {
    const { readSession } = await loadModule(VALID_SECRET);

    await expect(readSession(undefined)).resolves.toBeUndefined();
  });

  it("refuses a malformed token", async () => {
    const { readSession } = await loadModule(VALID_SECRET);

    await expect(readSession("not.a.jwt")).resolves.toBeUndefined();
  });

  it("refuses a token signed with a different key", async () => {
    const forged = await new SignJWT({ member_id: "mem_ncastells", org_slug: "demo" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(OTHER_SECRET));
    const { readSession } = await loadModule(VALID_SECRET);

    await expect(readSession(forged)).resolves.toBeUndefined();
  });

  it("refuses an unsigned token, whatever algorithm it claims", async () => {
    const { readSession } = await loadModule(VALID_SECRET);
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ member_id: "m", org_slug: "demo" })).toString(
      "base64url",
    );

    await expect(readSession(`${header}.${body}.`)).resolves.toBeUndefined();
  });

  it("refuses a token whose payload is the wrong shape", async () => {
    const stray = await new SignJWT({ member_id: 7, org_slug: "demo" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(VALID_SECRET));
    const { readSession } = await loadModule(VALID_SECRET);

    await expect(readSession(stray)).resolves.toBeUndefined();
  });

  it("refuses an expired token", async () => {
    const { issueSession, readSession } = await loadModule(VALID_SECRET);
    const token = await issueSession({ member_id: "mem_hcamps", org_slug: "demo" });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);

    await expect(readSession(token)).resolves.toBeUndefined();
  });
});
