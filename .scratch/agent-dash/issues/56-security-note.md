Type: implementation
Status: resolved
Blocked by:
Label: resolved

# `docs/security.md`

## Scope

One page: JWT in an HttpOnly cookie, signed with `AUTH_JWT_SECRET`, rotation procedure; CSRF
posture for the single POST endpoint (SameSite, origin check, whether a token is needed); the
404-not-403 tenancy rule and why; enforcement in the data layer, never the client; what is not
done (rate limiting, audit log) and why it is acceptable for a demo. Verify each claim against the
code and cite the file.

## Done when

File exists and every claim has a code reference.

## Comments

### 2026-09-09 — written (AFK build, wave 2, worktree `agent-dash-t56`)

`docs/security.md`, one page, six sections plus a reading order. Gates: `lint` clean · `typecheck`
clean · `test` **1379** across 63 files · `build` clean, all six `/[org]` routes `ƒ (Dynamic)`.
`test:coverage` and `e2e` skipped under the wave rule — the diff touches no file under `src/` or
`e2e/`. No spec identifier was allocated.

**Every claim carries a `path:line`.** The doc was written the other way round from the usual: each
paragraph started as a file read, and three claims I was about to write did not survive contact with
the code (below). The specs were used as an index into the source, never as the source.

**What is documented.** The session token (HttpOnly/Lax/Secure cookie, HS256 pinned on both sides,
32-byte floor read at module load, two claims and no grants, one `undefined` for every verification
failure, fail-closed `roleFor`); the rotation procedure for all three environments as executable
steps; CSRF, answered; the 404-not-403 tenancy rule and the mechanism that makes it hold; enforcement
in the data layer with the six places it happens; and what is not done — rate limiting, audit log,
security headers, sign-out, real identity — each with the argument for why a demo can accept it
**and the condition under which it stops being acceptable**.

### CSRF: no token, and the reasoning is the deliverable

The question was answered from the endpoint, not from a checklist. `POST /api/session`
(`src/app/api/session/route.ts:58`) is the only route handler in the app and there are no Server
Actions anywhere (`grep "use server" src` is empty), so it is genuinely the whole POST surface. It
mints from a two-element list and 400s on anything else (`:62-65`), takes `org_slug` from the
resolved account rather than the request (`:67`), and writes no data — there is no write path in
this product at all.

**Three things I had to correct while working.**

1. **`SameSite=Lax` does not close this, and the doc says so loudly.** SameSite governs when a
   cookie is *sent*, not when it may be *set*. A cross-site form POST is a top-level navigation, the
   303 + `Set-Cookie` lands, and the victim's later top-level GETs carry it. The forgery works. It
   would have been very easy to write "SameSite handles it" and be wrong.
2. **Next's framework CSRF check does not apply here.** The Origin-vs-Host comparison is a *Server
   Action* protection (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:82`), and
   these are plain `<form method="post">` posts to a route handler — chosen deliberately so sign-in
   needs no JavaScript. That choice is also a choice to opt out of the framework check, which is
   recorded nowhere else in the repo. The same docs name `route.ts` as the file to hand-audit
   (`data-security.md:611`).
3. **The exposure is nonetheless empty**, so no token. Both target identities are public and any
   anonymous visitor can hold either by clicking at `/sign-in`; the forged POST moves the victim into
   a state the attacker already occupies, over data the attacker can already read, visibly (the
   header names the account and Role), reversibly (one click), with nothing writable behind it. A
   synchroniser token would also *break*: it would have to be a hidden field minted at render time,
   and the switcher lives in a layout, which renders once and survives soft navigation — exactly the
   staleness argument `route.ts:44-48` already makes about the return path.

**Four triggers are written into the doc** that flip the verdict (the endpoint accepting a
`member_id` outside `signInAccounts()`; any mutating endpoint; a session becoming worth something;
grants exceeding what an anonymous visitor can self-issue), so a future change is measured against
the reasoning rather than the conclusion.

**Recommended, not applied — an `Origin` check on the POST.** Two lines, stateless, no staleness
problem, and it is what the Server Action path does. Not added because this is a documentation
ticket and that is application code. It is the right control the moment any trigger above fires, and
it is strictly better than a token here.

### Security finding — for the human

**Tenancy is enforced on the URL and the token, but not on the Member→Organization relation.**
`resolveViewer` compares the token's `org_slug` to the `[org]` segment (`src/data/viewer.ts:47`),
then looks the Member up across the **whole dataset** (`:50`) with no check that the Member belongs
to that Organization.

*Not exploitable today*, and the doc says so plainly: there is exactly one Organization. `Dataset`
holds `organization` singular (`src/data/load.ts:70`), `organizations()` returns a one-element list
(`src/data/accounts.ts:28`), and `Member` carries no organization id at all
(`src/domain/types.ts:146-157`) — so the two checks coincide.

*The discrepancy* is that `src/data/accounts.ts:24-27` claims "a second Organization is a fixture
change and no code change", and R-A1 is written the same way. It is not true of this path. A second
Organization needs a Member→Organization relation in the schema **and** an org-scoped member lookup
in `resolveViewer`, or a token naming org A together with a Member of org B resolves to a signed-in
viewer. Left unfixed per the no-application-code rule; it is a schema change plus a one-line lookup
change and should be one ticket, not a patch here.

### Second discrepancy — a stated guarantee that is a convention

`src/data/queries.ts:15-17` says a `Viewer` "is producible only by `resolveViewer`, which verifies
the JWT", as though the type system enforced it. It does not: `Viewer` is a plain exported
structural type (`src/domain/access.ts:178`) and any module could write one. The half that *is*
enforced — every query takes a `Viewer` first, so no unfiltered query is nameable — is the valuable
half and is stated as such. In practice nothing constructs one outside `resolveViewer`, and
`eslint.config.mjs:197` stops `src/app` and `src/components` importing `roleFor` to build a
plausible one. The comment is right about the risk and wrong about the mechanism. Documented, not
edited.

### Smaller absences recorded

- **No sign-out.** `DELETE /api/session` exists (`route.ts:75`) and is e2e-tested, but nothing in
  the UI calls it — no sign-out control anywhere in `src/`. A session ends at 8 hours or by clearing
  cookies. The switcher makes it unimportant for the demo, but it is an absence, not a decision
  recorded anywhere, so the doc records it as the former.
- **`DELETE` is protected by CORS preflight and by nothing in this repo.** Real, but incidental, and
  it would evaporate the day a `headers()` block is added to `next.config.ts` for an unrelated
  reason. Written down for that reason.
- **The proxy matcher skips any path with a file extension** (`src/proxy.ts:29`). Harmless, because
  the proxy is not the gate — and it is the clearest concrete demonstration of why R-T4 insists on
  the distinction, so the doc uses it as one.
- **R-T14 says the token carries `{ member_id, org_slug }` only**; it also carries the registered
  `iat`/`exp` (`src/data/session.ts:54-55`). The repo's own test already says "and nothing else
  beyond the registered claims" (`src/data/session.test.ts:54`). The doc states the payload the way
  the test does. Not a defect, but the spec's wording read literally is wrong.

### Escalated decision (nothing blocked)

**No new ADR, and no spec edit.** The 404-not-403 rule and the CSRF verdict are both real design
decisions with recorded alternatives, and there was a case for an ADR on the CSRF answer. Chose the
cheaper option: both are argued in `docs/security.md` itself, with the alternatives and the flip
conditions in place. Cost — the CSRF reasoning is not in `docs/adr/`, so a reader auditing decisions
by ADR index will not find it. Mitigated by the doc naming its own triggers, which is the thing an
ADR would have been consulted for.
