// R-T13 — `POST` issues one of the two seeded accounts' JWTs as the session cookie and
// redirects to that account's Organization; `DELETE` clears it.
//
// The redirect target is `/${account.orgSlug}`, read from the account rather than written as
// `/demo`: `demo` is a slug, not a prefix (R-A1), and a literal here is the first place a
// second Organization would break.

import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/data/session-cookie";
import { issueSession } from "@/data/session";
import { signInAccounts } from "@/data/accounts";

/**
 * `/sign-in` posts a plain HTML form, so this must read form encoding; the header account
 * switcher (R-A5, ticket 30) will post JSON from a client component. Both name the same
 * field, and neither is trusted further than "which of the two offered accounts".
 */
const requestedMemberId = async (request: Request): Promise<string | undefined> => {
  if (request.headers.get("content-type")?.includes("json")) {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("member_id" in body)) return undefined;
    const value: unknown = body.member_id;
    return typeof value === "string" ? value : undefined;
  }
  const value = (await request.formData()).get("member_id");
  return typeof value === "string" ? value : undefined;
};

export async function POST(request: Request): Promise<Response> {
  const memberId = await requestedMemberId(request).catch(() => undefined);
  // Only the accounts `/sign-in` offers. Any other Member id is not a sign-in, so no token
  // is minted for it — the endpoint issues tokens, it does not accept an identity claim.
  const account = signInAccounts().find((candidate) => candidate.memberId === memberId);
  if (!account) {
    return NextResponse.json({ error: "unknown account" }, { status: 400 });
  }

  const token = await issueSession({ member_id: account.memberId, org_slug: account.orgSlug });
  // 303: a form POST must become a GET, or the browser re-posts to the dashboard route.
  const response = NextResponse.redirect(new URL(`/${account.orgSlug}`, request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}

export function DELETE(): Response {
  const response = new NextResponse(null, { status: 204 });
  // Expiring the cookie needs the same attributes it was written with, or the browser keeps
  // the original alongside the replacement and the session survives its own deletion.
  response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
