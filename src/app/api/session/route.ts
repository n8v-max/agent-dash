// R-T13 — `POST` issues one of the two seeded accounts' JWTs as the session cookie and redirects
// the browser back where it came from; `DELETE` clears it.
//
// **R-A5 — the switch happens in place.** The header account switcher posts from whatever page
// the viewer is reading, and this endpoint sends them back to it, so the difference reads as *the
// same page with fewer rows* rather than as a trip through the summary. `/sign-in` has nowhere to
// return to and lands on the Organization root, which is the same rule with an empty input.
//
// **The return path is validated, not trusted.** It is honoured only if it is same-origin and
// under the Organization the freshly-issued token names — so it cannot be used as an open
// redirect, and it cannot be used to land a viewer on another tenant's path (R-A2, R-A7).
//
// The fallback is `/${orgSlug}`, read from the resolved Organization rather than written as
// `/demo`: `demo` is a slug, not a prefix (R-A1), and a literal here is the first place a second
// Organization would break.

import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/data/session-cookie";
import { issueSession } from "@/data/session";
import { organizationsFor, signInAccounts } from "@/data/accounts";

/** The name the return path travels under, when a caller states it rather than implying it. */
const RETURN_FIELD = "return_to";

/**
 * `/sign-in` and the account switcher both post plain HTML forms; a JSON caller is supported
 * because the endpoint's contract should not be "whatever a `<form>` sends". Neither encoding is
 * trusted further than "which of the two offered accounts", and every value is a string or absent.
 */
const fieldsOf = async (request: Request): Promise<Readonly<Record<string, string>>> => {
  const entries: readonly (readonly [string, unknown])[] = request.headers
    .get("content-type")
    ?.includes("json")
    ? Object.entries((await request.json()) as Record<string, unknown>)
    : [...(await request.formData()).entries()];
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
};

/**
 * Where to send the browser after the cookie is set.
 *
 * The candidate is the caller's explicit `return_to` if it sent one, and otherwise the request's
 * own `Referer` — which is what the account switcher relies on, and which the browser recomputes
 * for **every** submission. A hidden field written at render time could not: a layout renders once
 * and is preserved across client-side navigations, so the field would be stale the moment the
 * viewer moved off the page the document was served for.
 */
const returnPath = (request: Request, orgSlug: string, stated: string | undefined): string => {
  const home = `/${orgSlug}`;
  const target = URL.parse(stated ?? request.headers.get("referer") ?? "", request.url);
  if (!target || target.origin !== new URL(request.url).origin) return home;
  const inOrg = target.pathname === home || target.pathname.startsWith(`${home}/`);
  return inOrg ? `${target.pathname}${target.search}` : home;
};

export async function POST(request: Request): Promise<Response> {
  const fields = await fieldsOf(request).catch(() => ({}) as Record<string, string>);
  // Only the accounts `/sign-in` offers. Any other Member id is not a sign-in, so no token
  // is minted for it — the endpoint issues tokens, it does not accept an identity claim.
  const account = signInAccounts().find((candidate) => candidate.memberId === fields.member_id);
  if (!account) {
    return NextResponse.json({ error: "unknown account" }, { status: 400 });
  }

  // **The Organization is resolved through the Member's Memberships, never taken from the form.**
  // The switcher states `org_slug` when it offers an Organization switch, and a caller can state
  // anything; a token pairing a Member with an Organization they hold no Membership in is exactly
  // the artefact ticket 58 was about, and minting one here would reopen on the issuing side the
  // hole `resolveViewer` closes on the reading side. Absent or unrecognised falls back to the
  // account's own Organization rather than failing, because an unknown slug is not a sign-in
  // failure — it is a switch to somewhere this Member does not have standing.
  const orgSlug =
    organizationsFor(account.memberId).find(
      (organization) => organization.slug === fields.org_slug,
    )?.slug ?? account.orgSlug;

  const token = await issueSession({ member_id: account.memberId, org_slug: orgSlug });
  // The return path is validated against the Organization the *token* names, not the one the
  // account started in — an Organization switch must not bounce the viewer back into the tenant
  // they just left.
  const destination = returnPath(request, orgSlug, fields[RETURN_FIELD]);
  // 303: a form POST must become a GET, or the browser re-posts to the dashboard route.
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
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
