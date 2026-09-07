// The session cookie's name and attributes — and nothing else.
//
// This module exists apart from `session.ts` because `src/proxy.ts` needs the cookie *name*
// and must not need the signing key. `session.ts` reads `AUTH_JWT_SECRET` at module load and
// throws without it (R-T14); importing it from the proxy would drag that side effect, and
// `jose`, into a module that runs on every request and is explicitly not the authorization
// boundary (R-T4, R-T15). A shared constant is also the only way the proxy and the
// authoritative layout cannot disagree about which cookie they are talking about.

/** The one session cookie. Named, not guessed, in both the proxy and the layout. */
export const SESSION_COOKIE = "agent_dash_session";

/** Eight hours: long enough for a demo session, short enough that a leaked token expires. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * R-T13 — `httpOnly`, `sameSite=lax`, `secure`.
 *
 * `httpOnly` keeps the token out of `document.cookie`, so an injected script cannot read it.
 * `lax` still sends it on the top-level GET that follows the sign-in redirect, while
 * withholding it from cross-site sub-requests. `secure` holds in development too:
 * `http://localhost` is a potentially-trustworthy origin, so browsers accept it there — the
 * attribute does not need an environment switch, and an environment switch is how the
 * production flag ends up off.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
} as const;
