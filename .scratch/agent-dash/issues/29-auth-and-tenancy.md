Type: implementation
Status: resolved
Blocked by: 21
Label: resolved

# Auth, tenancy, and server-side enforcement

## Goal

Two accounts, two JWTs, and enforcement that acts on the wire rather than in a function.

## Scope

- **`/sign-in`** — two "continue as" buttons (R-A4), each posting to `POST /api/session`, which
  issues that account's JWT as an `httpOnly`, `sameSite=lax`, `secure` cookie and redirects to
  `/demo`. `DELETE` clears it.
- **The signing key is the env var `AUTH_JWT_SECRET`** (R-T14), read server-side only and never
  `NEXT_PUBLIC_`-prefixed. Read it once at module load and **throw if it is missing or under 32
  bytes** (HS256's minimum), so a keyless deploy fails at boot rather than at first sign-in. It is
  already provisioned in all three environments: `.env.local` for dev, a fixed non-production
  literal in `.github/workflows/ci.yml`, and the Vercel dashboard for production via
  `scripts/setup-vercel.sh` stage 5. **Do not invent a second name for it.**
- **The JWT carries `{ member_id, org_slug }` only** (R-T14). Grants are resolved server-side from
  the Member's Role. **A token carrying its own grants is a token that can be edited to widen
  them.**
- **`proxy.ts` — optimistic only** (R-T4, R-T15). No cookie on `/[org]/**` → redirect to
  `/sign-in`. **Note: Next 16 deprecated `middleware.ts` and renamed it `proxy.ts`.** The Next docs
  are explicit that Proxy "should not be used as a full session management or authorization
  solution", which is why it is not the boundary here.
- **`src/app/[org]/layout.tsx` — authoritative.** Verify the JWT, compare `org_slug` against the
  `[org]` path segment, `notFound()` on mismatch or unknown slug. **404, not 403** (R-A7) — a 403
  confirms an Organization exists, which is a tenancy leak.
- **The Organization slug lives in the path** (R-A2). Tenancy that exists only in a token is
  invisible in exactly the artefact a reviewer inspects, and breaks the moment one account belongs
  to two Organizations.
- **Nothing below grant is serialised to the client** (R-T18). Client-side filtering over the full
  fixture is rejected outright: it ships every Member's data to a contractor's browser and makes the
  access model theatre.
- **Navigation is identical for both accounts** (R-A8). Nothing hidden, nothing disabled — the
  restricted account simply receives fewer rows.

## Done when

**T-E3** and **T-E4** pass.

## Notes

**T-E4 is load-bearing and singular.** It is the only assertion that the access model acts on the
wire. If it is weakened to a DOM query instead of a payload inspection, the product's central
privacy claim becomes untested while appearing tested. A reviewer opening devtools on the restricted
account must find no ungranted figure in the RSC payload.

`demo` is an Organization **slug**, not a demo-mode prefix. The code supports as many Organizations
as needed; only `demo` is seeded.

## Comments

### 2026-09-08 — implemented (AFK build, wave 4)

All six gates green: `lint` (0 errors, 1 deliberate warning — see below) · `typecheck` · `test`
(375 tests) · `test:coverage` (93.1% statements / 89.5% branches, over the 80/75 global bar) ·
`build` · `e2e` (**22 passed**, and again under `CI=1` against `next start` on the production
build). Added one dependency: `jose` 6.2.12.

Routes now built: `/sign-in`, `POST|DELETE /api/session`, `src/proxy.ts`, `src/app/[org]/layout.tsx`
and six stub pages under `/[org]`. Data layer: `session.ts`, `session-cookie.ts`, `accounts.ts`,
`viewer.ts` — the runtime path from a route into the domain, and the shape ticket 28 extends.

`session-cookie.ts` is split from `session.ts` deliberately, so **`proxy.ts` can know the cookie's
name without importing the signing key** — importing `session.ts` would drag its module-load
side effect and `jose` into a per-request module that is explicitly not the boundary.

**The JWT carries only `{member_id, org_slug}`, asserted rather than inspected.** A test decodes
the payload segment and asserts `Object.keys().sort()` is exactly
`["exp","iat","member_id","org_slug"]`. Two further tests sign — **with the real key** — payloads
carrying `role`, `grants`, `scopes` and `teams`, and assert the resolved `Viewer` still holds
`RESTRICTED_ROLE` and the fixture's Team list. The extra claims are ignored because the Role comes
from `members.json`, which a token holder cannot sign. That is R-T14's "a token carrying its own
grants is a token that can be edited to widen them", proved.

Accounts are derived from `SHIPPED_PRESETS` × `roleFor` over `members.json`, and
`organizationBySlug` runs over an `organizations()` list — so a second Organization is a fixture
change, not a code change (R-A1).

**T-E3's three cases, all asserting `response.status()` off the navigation rather than the rendered
body**, so a soft 404 fails: org mismatch → 404 (a token signed with the *real* key claiming
`org_slug: "other-org"`, pointed at the existing `/demo` — this is what keeps mismatch and unknown
slug two distinct observables under a single-org fixture); unknown slug → 404; no cookie →
redirect to `/sign-in`. Plus the real flow round-trip: the cookie is asserted `httpOnly: true`,
`sameSite: "Lax"`, `secure: true`, and `DELETE` → 204 with the next request redirecting.

### T-E4 — what it asserts today, and what it cannot

Over **both** the HTML document and the `text/x-component` RSC flight payload (verified to be real
flight), with `\uXXXX` and HTML entities decoded first, for the restricted contractor account:

1. **A positive control** — the payload *does* contain the viewer's own full name (`self` is
   granted, R-A3.1). This is what stops the negatives being vacuous: it proves the search finds a
   Member name when one is genuinely present.
2. Non-emptiness guards on the search sets (>10 ungranted names, >100 ungranted cost literals).
3. On each of the six `/demo/**` routes: **none of the other 19 Members' full names** appears in
   either serialisation.
4. On each route: **no ungranted cost literal**. Values that also occur on one of the viewer's own
   sessions are removed first, so the assertion cannot fire on granted data.

**The harness was proved able to fail.** A temporary probe rendered `Nuria Castells Vidal` and
`24.39` inside a `hidden` `<section>`; both assertions failed and named the leaked values.
**A `not.toBeVisible()` DOM query would have passed on that same page** — which is the concrete
demonstration of why testing-spec § 10 forbids weakening T-E4 to a DOM query. Probe reverted.

**Named and pending, because the panels do not exist yet:** that `/demo/people` carries exactly two
rows for the restricted account (T-E2's claim); that the **open** account's payload *does* carry
the other 19 names — the strongest possible positive control for (3) and (4), unavailable because
no route renders Member rows for either account yet; and that `team`-scoped aggregate totals are
present while the names behind them are not. These are a `TODO(ticket 28 / wave 9)` at
`e2e/payload.spec.ts:21`, which is the single lint warning in the repo — `sonarjs/todo-tag` is
`warn` for exactly this purpose. **No test is skipped and none passes vacuously.**

### A11 has a silent failure mode nobody has recorded — read before enabling Cache Components

`node_modules/next/dist/docs/03-api-reference/04-functions/not-found.md` carries a warning worth
carrying forward: with **Cache Components** enabled, every dynamic route streams a static shell
first, so `notFound()` lands *after* streaming has begun and the response becomes a **soft 404 with
status 200**. `cacheComponents` is off in `next.config.ts`, so the layout returns a hard 404 today
— verified against `next start`. **If Cache Components is ever turned on, A11 breaks silently**,
and the only reason the suite would catch it is that T-E3 asserts `response.status()` rather than
the body. That choice is now load-bearing; do not "simplify" it to a body assertion.

Other Next 16 findings: Proxy **runs on prefetches**, which is the concrete reason it reads cookie
presence only. `cookies()` is async and cannot `.set`/`.delete` during Server Component render, so
the cookie is written on the `NextResponse` in the Route Handler. `redirect()` serves 307 by
default and a form POST must be answered **303**, or the browser re-POSTs to `/demo`.

### Four arguments recorded, none re-decided

1. **`/sign-in` publishes both seeded Members' full names to an unauthenticated visitor.** R-A4
   mandates "continue as" buttons and a button has to say who. It is not a `/[org]` route so T-E4
   does not cover it, and the fixture is public — but it is the one surface in the product where a
   Member name outside the viewer's grants is served by design.
2. **T-E3's three cases only separate under a multi-org fixture.** Resolved by forging the token's
   org claim rather than by seeding a second Organization. If a second org is ever added, the test
   should use two real slugs.
3. **T-E4's cost assertion is near-vacuous by circumstance, not by construction** — the routes
   render no figures yet. **Wave 9 should add a permanent positive control** (the open account's
   payload carrying the other names) rather than rely on a one-off probe.
4. **R-N3's ellipsis menu is not built here.** The minimal layout lists all six nav items flat;
   ticket 30 owns the real shell. What is asserted here is R-A8's equality claim, not the menu's
   shape.
