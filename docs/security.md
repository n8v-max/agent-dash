# Security

What this application actually does about authentication, tenancy and enforcement — read off the
code, not off the specs. **Every claim below carries a file reference, and where the code and the
specs disagree the code is what is written down.** A security note describing an intended posture
rather than the implemented one is worse than none, because it will be believed.

## The threat model, in one paragraph

Two adversaries are in scope. **A signed-in visitor** trying to reach figures their Role does not
grant — this is the one the product is built around, and § 4 is the answer. **An unauthenticated
visitor** probing for which Organizations exist — § 3. What is *not* in scope: the dataset is not a
secret. The fixture is committed to the repository, both seeded accounts are offered to any
anonymous visitor at `/sign-in` (`src/app/sign-in/page.tsx:77`), and CI says so in as many words
when it declines to make the signing key a repo secret (`.github/workflows/ci.yml:18-21`). The
asset being protected is **the correctness of the access model as a demonstration**, not the rows.
That fact does real work below — most notably in § 2, where it is why the honest answer on CSRF is
"no token".

---

## 1. The session

**A JWT in an HttpOnly cookie, and the token is asked *who* the viewer is and never *what they may
see*.**

| | |
|---|---|
| Cookie name | `agent_dash_session` (`src/data/session-cookie.ts:11`) |
| Attributes | `httpOnly`, `sameSite: "lax"`, `secure`, `path: "/"` (`src/data/session-cookie.ts:26-32`) |
| Lifetime | 8 hours, as `maxAge` and as the JWT's `exp` (`src/data/session-cookie.ts:14`, `src/data/session.ts:55`) |
| Algorithm | HS256, pinned on both sign and verify (`src/data/session.ts:48`, `:52`, `:76`) |
| Payload | `{ member_id, org_slug }`, plus the registered `iat`/`exp` (`src/data/session.ts:20-23`, `:51-56`) |

`secure` is set unconditionally rather than switched on `NODE_ENV`: `http://localhost` is a
potentially-trustworthy origin so browsers accept the attribute there, and an environment switch is
how the production flag ends up off (`src/data/session-cookie.ts:20-24`). Asserted live, on all
three attributes, in `e2e/enforcement.spec.ts:84-87`.

**Grants are not in the token.** `issueSession` writes exactly two claims
(`src/data/session.ts:52`); the Role is resolved server-side from the Member's fixture row on every
request (`src/data/viewer.ts:75` → `roleFor`, `src/domain/access.ts:171`). A token carrying its own
grants is a token that can be edited to widen them. This is asserted adversarially rather than
assumed: `src/data/viewer.test.ts:117` signs a *valid* token carrying `role`, `grants` and `scopes`
fields and checks the resolved viewer is still the restricted preset.

**Role resolution fails closed.** An unrecognised `Member.role` string resolves to `SELF_ONLY_ROLE`
— no grants at all beyond the universal `self` row — rather than to a default
(`src/domain/access.ts:162`, `:165-172`). Widening is never the consequence of a typo.

**Verification returns one `undefined` and never a reason** (`src/data/session.ts:71-81`). Absent,
malformed, expired, signed with another key, or shaped wrongly all collapse to the same value at
the point of verification, so no caller downstream is able to leak which one it was. The same
technique appears again in § 3 and it is the same argument both times.

**The secret is read once, at module load, and a bad key kills the boot.**
`src/data/session.ts:45` evaluates `readSecret()` at import time; `:35-41` throws when
`AUTH_JWT_SECRET` is missing or under 32 bytes — HS256's key floor — and the message names the
generation command. Three tests hold that: `src/data/session.test.ts:40`, `:44`, `:48`. The
alternative, resolving the key lazily at first sign-in, moves the failure from deploy time (where
somebody is watching) to the first visitor (where nobody is).

`AUTH_JWT_SECRET` is never `NEXT_PUBLIC_`-prefixed. `src/data/session-cookie.ts` exists as a
separate module for the same reason: `src/proxy.ts` needs the cookie *name* and must not drag in
the key or `jose` (`src/data/session-cookie.ts:3-8`).

### 1.1 Rotating `AUTH_JWT_SECRET`

The key lives in three places and each has a different procedure.

**Development.** Generate, write, restart:

```
openssl rand -base64 32                       # 32 bytes, base64 — the floor at session.ts:35
```

Put it in `.env.local` as `AUTH_JWT_SECRET=…` (the shape is documented at `.env.example:8-14`, where
the key is deliberately empty). **Restart `next dev`** — the secret is captured in a module-level
constant at import (`src/data/session.ts:45`), so a running server keeps the old one.
`scripts/setup-vercel.sh:292-295` writes this key on first setup and pointedly *only* if none
exists, so re-running the wizard never invalidates a working dev session.

**CI.** Edit the literal at `.github/workflows/ci.yml:23`. Nothing coordinates with it: the key
exists for the life of one job and no token outlives a run. It is a literal and not a GitHub secret
on purpose, and the reasoning is recorded beside it (`ci.yml:18-21`).

**Production (Vercel) — a human step, and the only one.** `scripts/setup-vercel.sh:266-288` is the
first-time procedure; rotation is the same steps without the project import:

1. `openssl rand -base64 32` locally. The wizard generates it exactly this way
   (`scripts/setup-vercel.sh:270`).
2. Vercel dashboard → the `agent-dash` project → **Settings → Environment Variables** → edit
   `AUTH_JWT_SECRET`. Tick **Production**; tick **Preview** too if preview URLs should sign in
   (`scripts/setup-vercel.sh:276-278`).
3. Save, then **Deployments → latest → ⋯ → Redeploy**. Environment variables are read at build *and*
   at runtime, so the deployment already live does not pick the new value up until it is redeployed
   (`scripts/setup-vercel.sh:279-281`).
4. Do not write it to a file. Production's key exists only in the dashboard and appears nowhere in
   this repository (`scripts/setup-vercel.sh:274`, `ci.yml:20-21`).
5. Verify: open the production URL, expect a redirect to `/sign-in`, sign in, expect the dashboard.
   A missing or short key fails at boot with the message from `src/data/session.ts:36-40`, so a
   broken rotation shows up as a dead deployment and not as a silent one.

**Rotation invalidates every live session. That is the design, and it is the accepted answer.**
There is one secret, held in one constant (`src/data/session.ts:45`), and verification is against
exactly that one (`:76`). There is no key ring, no `kid` header and no overlap window, so every
cookie issued under the old key stops verifying the moment the new one is live. What a visitor
actually experiences: `readSession` returns `undefined` (`src/data/session.ts:78`) →
`resolveViewer` reports `no-session` (`src/data/viewer.ts:57`) → the layout redirects to `/sign-in`
(`src/app/[org]/layout.tsx:34`). No error, no broken page, one click to recover.

Accepting that is cheap here and would not be everywhere. A session in this product is worth 8
hours (`src/data/session-cookie.ts:14`) and holds nothing: there is no write path anywhere in the
application (§ 2), so no work is lost and no state is orphaned. A two-key rotation would need a
`kid` header, a key list, and a window during which two keys are valid — machinery whose entire
benefit is that open tabs do not bounce.

**Rotation is also the only revocation mechanism.** There is no server-side session store and no
deny list — `readSession` verifies a signature and reads claims, and consults nothing
(`src/data/session.ts:71-81`). Changing the secret is therefore the only way to invalidate an
issued token before its 8 hours elapse, and it invalidates all of them.

---

## 2. CSRF, on the single POST endpoint

### The facts, before the verdict

- **There is exactly one POST endpoint in the product**: `POST /api/session`
  (`src/app/api/session/route.ts:58`). It is the only route handler in `src/app`, and there are no
  Server Actions at all — no `"use server"` directive appears anywhere under `src/`. Every other
  surface is a GET.
- **It writes a cookie, not data.** It mints a JWT and sets it
  (`src/app/api/session/route.ts:79-87`). Nothing in this application mutates any stored data,
  because the only data is the committed fixture and `src/data/load.ts` opens it read-only.
- **Its input is one field, matched against a two-element list.** `member_id` is looked up in
  `signInAccounts()`; anything else is a 400 (`src/app/api/session/route.ts:62-65`). The endpoint
  *issues* tokens; it does not accept an identity claim.
- **The cookie is `SameSite=Lax`** (`src/data/session-cookie.ts:28`).
- **There is no Origin or Host check.** Read `src/app/api/session/route.ts:58-88`: the only header
  consulted anywhere in the file is `referer` (`:52`), and it is used solely to pick a redirect
  target.
- **Next.js's built-in Origin-vs-Host CSRF check does not cover this endpoint.** It is a Server
  Action protection (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:82`,
  `.../data-security.md:546-552`), and the same docs single out `route.ts` as a file to audit by
  hand (`data-security.md:611`). Both forms here post to a route handler, deliberately, so that
  sign-in and account switching need no JavaScript (`src/app/sign-in/page.tsx:3-5`,
  `src/components/shell/account-switcher.tsx:4-6`). That choice is also a choice to opt out of the
  framework's check, and it is written down here because nothing else in the repo says so.

### `SameSite=Lax` does not close this, and must not be read as if it did

SameSite governs when a cookie is **sent**, not when it may be **set**. A cross-site
`<form method="post" action="https://…/api/session">` is a top-level navigation; the endpoint
answers 303 with `Set-Cookie` (`src/app/api/session/route.ts:85-86`); the browser stores the Lax
cookie, and the victim's subsequent top-level GETs carry it. The forgery works. This is login CSRF,
and `sameSite: "lax"` is not the answer to it — it is the answer to a *different* attack, in which
an attacker's page causes the victim's browser to send an existing session cookie on a cross-site
sub-request, and against that it holds.

### What an attacker gains, worked through rather than assumed

A forged POST switches the victim between the two seeded accounts. It cannot:

- **mint a token for any other Member** — 400 (`src/app/api/session/route.ts:63-65`);
- **widen grants** — the token carries two claims (`src/data/session.ts:52`) and the Role is
  resolved from the fixture per request (`src/data/viewer.ts:75`), proven adversarially at
  `src/data/viewer.test.ts:117`;
- **cross a tenancy boundary** — `org_slug` is resolved through the Member's own Memberships and
  never taken from the request (`src/app/api/session/route.ts:74-77`), and the reading side checks
  the Member against the Organization independently (`src/data/viewer.ts:62-73`);
- **redirect anywhere useful** — the return path is honoured only if it is same-origin *and* under
  the account's own Organization (`src/app/api/session/route.ts:50-56`), with five escape shapes
  asserted rejected at `src/app/api/session/route.test.ts:99-110`;
- **read anything back** — no CORS headers are configured; `next.config.ts` is fourteen lines and
  declares only `outputFileTracingIncludes`;
- **destroy anything** — there is nothing to destroy, and the switch is reversed by one click in the
  header (`src/components/shell/account-switcher.tsx:51-79`).

Both target identities are **public and freely obtainable**: `/sign-in` hands either one to any
anonymous visitor (`src/app/sign-in/page.tsx:77-113`). So the attacker forces the victim into a
state the attacker can already occupy, over data the attacker can already read. The residual harm
is that a victim reads the dashboard as the *other* demo account — visibly, since the header shows
whose account it is and which Role (`src/components/shell/account-switcher.tsx:133-146`), and the two
accounts differ only in how many rows they receive, never in navigation
(`src/components/shell/app-header.tsx:19-22`).

### Verdict: no CSRF token

**And the reason is not "SameSite covers it".** The reason is that the exposure is empty: the
endpoint's entire authority is to choose between two public read-only identities, and it refuses
every other input.

The cost of adding one is not zero, and it is a specific cost. A synchroniser token has to be
minted at render time and carried in a hidden field — and the account switcher lives in a *layout*,
which renders once and is preserved across client-side navigations. That is precisely why the
return path is taken from `Referer` rather than from a hidden field
(`src/app/api/session/route.ts:44-48`, `src/components/shell/account-switcher.tsx:8-14`): a field
written at render time is stale after the first soft navigation. A CSRF token in the same position
would go stale the same way, and its failure mode is worse — the switch would start rejecting
rather than merely returning to the wrong page.

**The cheaper control, also not taken here: an Origin check.** Comparing `Origin` against the
request's own origin and rejecting a mismatch is two lines, stateless, immune to the staleness
problem above, and exactly what Next's Server Action path does
(`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:82`). It is not added in this
document because this is a documentation ticket and that is application code; it is recorded as a
finding on ticket 56. It is the right control the moment any trigger below fires, and it is
strictly better than a token for this endpoint.

**The triggers that flip this verdict.** Listed so a future change is measured against the
reasoning rather than against the conclusion:

1. `POST /api/session` accepts a `member_id` outside `signInAccounts()` — that is, real sign-in;
2. any endpoint in this product mutates stored data;
3. a session becomes worth something to its holder — saved views, an API key, anything bound to
   identity;
4. an account's grants ever exceed what an anonymous visitor can obtain by choosing that account at
   `/sign-in`.

### `DELETE` is protected, but by CORS and by accident

`DELETE /api/session` clears the cookie (`src/app/api/session/route.ts:90-96`). An HTML form cannot
issue `DELETE`, and a cross-origin `fetch` with that method is not a simple request, so the browser
preflights it — and with no CORS headers configured anywhere (`next.config.ts`), the preflight
fails. That is a real protection and it is incidental: nothing in this repo asserts it, and it would
evaporate the day a `headers()` block is added for an unrelated reason. The harm ceiling is low in
any case — a forced sign-out bounces the victim to `/sign-in`
(`src/app/[org]/layout.tsx:34`).

---

## 3. 404, never 403

**Three different failures produce one indistinguishable outcome.**
`src/data/viewer.ts:51-82` resolves a request, and returns the single `NOT_FOUND` value
(`src/data/viewer.ts:30`) for all of:

- an Organization slug that names no Organization (`src/data/viewer.ts:60`);
- a validly signed token whose `org_slug` is not the `[org]` path segment (`:60`);
- a validly signed token naming a Member the Organization does not hold, whether because no such
  Member exists or because they belong to another Organization (`:73`).

Callers turn that into `notFound()` — `src/app/[org]/layout.tsx:35` and
`src/components/controls/request.ts:62`.

**Why 404 and not 403.** A 403 says *"this Organization exists and is not yours"*, which is exactly
the fact a tenancy boundary exists to withhold. An attacker with a valid token for their own
Organization could otherwise enumerate customers by walking slugs and reading the status code. The
reasoning is recorded in the code at `src/data/viewer.ts:20-23` and in the spec as R-A7 (`.scratch/agent-dash/spec.md:91-93`).

**The distinction is destroyed at the point of resolution, not at the point of rendering.**
`ViewerResolution` has three arms and none of them carries a reason
(`src/data/viewer.ts:25-28`), so no caller is *able* to report which failure occurred. This is the
same technique as `readSession` returning one `undefined` (`src/data/session.ts:65-69`), applied one
layer up, and it is what makes the boundary hold rather than merely be checked: an outcome a caller
cannot see is an outcome a caller cannot leak.

**The redirect is the deliberate exception.** No verifiable session at all → redirect to `/sign-in`
(`src/app/[org]/layout.tsx:34`, `src/components/controls/request.ts:60`), not 404. It discloses
nothing: the visitor has claimed no tenancy yet, and `/sign-in` is public to everyone
(`src/proxy.ts:16`).

**Asserted end to end.** `e2e/enforcement.spec.ts:17-60` covers all three 404 cases and
`:62-68` the redirect. The status is read off the *response*, never inferred from the page, because
Next can render a not-found body while answering 200 if the check lands after streaming begins, and
a soft 404 is not what the rule asks for (`e2e/enforcement.spec.ts:6-9`).

**Checked twice, in parallel.** A layout and its page render concurrently in the App Router, so a
page cannot rely on the layout having already refused. `pageRequest` re-takes the same three
outcomes for every controlled surface (`src/components/controls/request.ts:58-62`, reasoning at
`:4-10`). The duplication is deliberate; removing it would leave every page reachable on its own
terms by a request the layout was about to refuse.

### The proxy is not the boundary

`src/proxy.ts` reads the cookie's **presence** and nothing else (`:21`). It does not verify the
signature, does not read the fixture, and cannot decide what a viewer may see — the Next docs are
explicit that Proxy *"should not be used as a full session management or authorization
solution"*, and it runs on prefetches too (`src/proxy.ts:1-8`). Deleting the file would cost a
courtesy redirect and would not open a single row.

Its matcher subtracts `api` and, among other things, **any path ending in a file extension**
(`src/proxy.ts:29`). So `/demo/spend.json` skips the proxy entirely. That is harmless precisely
because the proxy is not the gate: anything that resolves to an `/[org]/**` route renders inside the
layout, which verifies the token regardless, and anything that does not resolve to a route renders
nothing. It is the clearest available demonstration of why the optimistic check and the
authoritative one are kept separate.

---

## 4. Enforcement is in the data layer, never in the client

**The rule.** A figure the acting Member is not granted must never reach the client payload.
Client-side filtering over a full fixture is explicitly rejected: it ships every Member's data to a
contractor's browser and makes the access model theatre.

**Where it happens.**

1. **The viewer is resolved once per request**, from the cookie, by `resolveViewer`
   (`src/data/viewer.ts:51`). Grants come from the fixture Role (`:75`), never from the token.
2. **The filter runs on rows, before any aggregation.** `filterRows`
   (`src/domain/access.ts:317-332`) takes rows and returns rows — never a total — and it is called
   at `src/data/queries/context.ts:258`, ahead of every bucket and every sum. Filtering a computed
   aggregate leaks by arithmetic; filtering rows does not.
3. **It runs once per datapoint class, because grants are per class**
   (`src/data/queries/context.ts:256-279`). The restricted account holds `team` over `jobs` and
   `tokens` and nothing over `cost`, so on `/demo/spend` its token panels see its Team's rows and
   its money panels see only its own. Filtering once "for the page" would have to pick one class,
   and would either leak cost or hide tokens.
4. **A name is a separate grant from a number.** `resolvesName`
   (`src/domain/access.ts:293`) is true only when a *granted covering* scope is an identifying one;
   a subject reachable solely through `team`, `peer-team` or `org` contributes to totals and is
   never labelled. The label map itself withholds it — `src/data/queries/context.ts:227` returns
   `"Unnamed Member"` — so no panel can print a name it was not handed.
5. **Components have nothing to filter with.** ESLint forbids `src/app/**` and `src/components/**`
   from importing `src/domain` at runtime, types only
   (`eslint.config.mjs:197-213`). A panel cannot import `filterRows`, cannot import `roleFor`, and
   receives a fully resolved ViewModel.
6. **Nothing is prerendered or cached across viewers.** Every `/[org]` surface reads `cookies()`
   (`src/app/[org]/layout.tsx:31`, `src/components/controls/request.ts:58`), which makes the route
   dynamic; there is no `revalidate`, no `unstable_cache` and no `force-static` anywhere in `src/`.
   `pnpm build` confirms it: all six `/[org]` routes print `ƒ (Dynamic)`, and only `/`, `/sign-in`
   and `/_not-found` are prerendered.
   The one process-lifetime cache holds the **unfiltered** fixture (`src/data/load.ts:369-376`) and
   the permission filter runs per request over it (`src/data/queries/context.ts:258`), so the cache
   cannot serve one viewer's filtered rows to another.

**The claim is asserted on the wire, not in the DOM.** `e2e/payload.spec.ts` fetches the restricted
account's pages and searches the **response body**, including the RSC flight payload, for Member
names and cost figures outside its grants. `not.toBeVisible()` would prove something was not
rendered and nothing about whether it was *sent*; a figure serialised and never displayed has still
left the server and is still in devtools (`e2e/payload.spec.ts:3-7`). The suite carries two positive
controls, the stronger being that the *open* account's payload does contain all nineteen names
(`e2e/payload.spec.ts:192-213`) — so the restricted account's clean payload is a fact about the
access model rather than about the fixture, the route or the regex. The testing spec names this test
**load-bearing and singular** (`.scratch/agent-dash/testing-spec.md:944-947`): it is the only assertion that the access model acts on the wire
rather than in a function.

**What the type system does and does not guarantee.** Every query function in
`src/data/queries.ts` takes a `Viewer` first, so there is no expression that names an unfiltered
query — that half is real and it is the half that matters. The second half is now also carried by
the type: `Viewer` is **nominal**, holding a brand whose `unique symbol` `src/domain/access.ts` does
not export, so `sealViewer` is the only expression in the application that produces one and no other
module can write the shape it wants. Ticket 58 fixed this; before it, `Viewer` was a plain
structural type and this file's header claimed otherwise as a *type* guarantee.

What remains convention is narrower and is stated as convention: that `resolveViewer` is
`sealViewer`'s only production caller. `src/app` and `src/components` construct no `Viewer`, and the
ESLint rule above stops them importing `roleFor` to build a plausible one — but that mechanism is
lint and call-site discipline, not the type.

---

## 5. What is deliberately not done

**Rate limiting — none, anywhere.** No limiter, no counter, no store; the only occurrences of the
phrase in this repository are Task titles in the fixture. Acceptable here for three reasons that
are properties of *this* endpoint set rather than general excuses:

- there is no credential to guess. The one POST endpoint mints from a two-element list
  (`src/app/api/session/route.ts:62`) with no password and no enumeration oracle, so brute force has
  nothing to find;
- forging a token needs the key, not attempts. An unauthenticated request can force one HS256
  verification (`src/data/session.ts:76`) and nothing else;
- what remains is plain resource exhaustion, which is a platform concern and not an application
  one.

*What it costs:* a signed-in visitor can drive fixture aggregation at whatever rate they like. The
dataset is memoised for the process (`src/data/load.ts:376`) so the cost is CPU in
`src/data/queries/**`, and there is no per-viewer budget. On a demo behind a public URL, accepted.

**Audit log — none.** Nothing records who read what. Acceptable for a demo on two grounds. First,
under the shipped default every read is symmetric and open — every Member holds `org-member` scope
over `jobs`, `tokens` and `cost` (`src/domain/access.ts:129-133`, `docs/adr/0003-individual-visibility-is-open-by-default.md`), so "who saw your data"
has the constant answer *"anyone may"* and a log would record only that the default is the default.
Second, the audience for such a log is an administrator asking who looked at whose spend, and
ADR-0003 is a decision not to build the asymmetric-watcher machinery that question implies.

*Where it stops being acceptable:* the moment a restricted preset is the deployed default rather
than the demonstration. An access model with real restrictions and no log cannot answer whether it
held.

**Security headers — none set by this application.** `next.config.ts` declares no `headers()`, so
there is no CSP, no `X-Frame-Options` and no `Referrer-Policy` from the app; TLS and HSTS on
`*.vercel.app` are the platform's. The exposure a CSP would reduce is script injection, and this
product renders no user-authored strings: every string on every surface comes from the committed
fixture through the one reader (`src/data/load.ts`) or from copy in the source. `Referrer-Policy` is
the one with a real, small consequence, because `Referer` is read for the return path
(`src/app/api/session/route.ts:52`); browsers' default `strict-origin-when-cross-origin` already
limits what leaves the origin, and the return path is validated same-origin regardless (`:53`).

**No sign-out.** `DELETE /api/session` exists (`src/app/api/session/route.ts:90`) and is exercised
by `e2e/enforcement.spec.ts:90-104`, but **nothing in the UI calls it** — there is no sign-out
control in the header (`src/components/shell/app-header.tsx`) or anywhere else in `src/`. A session
ends when its 8 hours elapse (`src/data/session-cookie.ts:14`) or when the visitor clears cookies.
The account switcher makes this unimportant for the demo, since switching re-issues rather than
requiring a sign-out — but it is an absence, not a decision recorded anywhere, and it is written
down here as the former.

**No real identity.** No password, no OAuth, no verification: `/sign-in` mints a token for whichever
of the two seeded accounts is asked for, for any visitor
(`src/app/api/session/route.ts:62`, `src/app/sign-in/page.tsx:77-113`). This is a stated non-goal
(`.scratch/agent-dash/spec.md` § 1.1 — *"Real OAuth, live API integration, a real GitHub App. Fixture data
throughout."*), and it is the premise most of § 2 rests on: every identity here is public and freely
obtainable, so a control protecting *access to an identity* buys nothing. Any of the § 2 triggers
firing means this premise has changed, and the reasoning has to be re-run rather than the conclusion
reused.

---

## 6. Two things found while checking — both since fixed (ticket 58)

Neither was a live vulnerability. Both were places where a document or a comment claimed more than
the code delivered, which is the class of defect this note exists to prevent. They are recorded here
with what they were, because the fix is only legible against the thing it fixed.

**1. Multi-tenancy was a property of the URL and the token, not of the data model. Now it is all
three.**

*What was found.* `resolveViewer` compared the token's `org_slug` against the `[org]` path segment
and then looked the Member up **across the whole dataset**, with no Organization predicate. A token
minted for Organization A naming a Member of Organization B satisfied both surviving checks and
resolved signed-in. It was vacuous in practice — one Organization was seeded and `Member` carried no
organization identifier at all, so the bad state could not be expressed — and that vacuity is
exactly why no test caught it. `src/data/accounts.ts` stated that *"a second Organization is a
fixture change and no code change"*, which was false for this path.

*What the code does now.* Tenancy is stated in `src/fixtures/data/memberships.json` — a
Member↔Organization join carrying the Role, because the Role is held **per Organization** and a
Member may in principle hold several. `resolveViewer` resolves the acting Member *through* a
Membership in the Organization the path and the token already agree on
(`src/data/viewer.ts:62-73`), so a Member of another Organization is **unfindable** rather than
found-and-then-refused. The 404-not-403 collapse is preserved and asserted as *indistinguishability*
by deep equality on the whole resolution, not merely as "both are errors"
(`src/data/viewer.test.ts`). The mint path is closed on the same terms: `POST /api/session` resolves
the Organization through the Member's own Memberships and never from the submitted form, so a token
pairing a Member with a tenant they have no standing in is not issuable either
(`src/app/api/session/route.ts:67-77`).

*What is validated at load.* A Membership naming an Organization nothing declares, one naming a
Member the directory does not hold, and two Memberships for one Member in one Organization are each
a `FixtureFault` naming the file, the row index and the field (`src/data/load.ts`, ticket 53's
format).

*Non-vacuity, stated plainly.* The committed fixture still seeds **one** Organization, so the bad
state is still not expressible in it — this was a deliberate decision, not an oversight. The
regression test therefore builds a two-Organization `Dataset` in the test file and passes it to
`resolveViewer`, which takes its dataset as a parameter for exactly this reason. The test was
verified to fail when the Organization predicate is removed. The consequence worth knowing: this
path has **unit** coverage and no e2e coverage, because with one Organization seeded there is no
browser journey that crosses a tenant boundary.

*What the R-A1 claim says now.* Narrowed rather than repeated. The code path is genuinely
indifferent to how many Organizations exist; what a second one still costs is *data* —
`organization.json` holds one row and every Membership is validated against it, so a second means
pluralising that file and its check plus a Repository set, a Task set, and the full
(repository × work_type) session matrix R-D19 requires.

**2. `src/data/queries.ts:15-17` overstated its own guarantee. Now the type carries it.** `Viewer`
is nominal: it holds a brand whose `unique symbol` `src/domain/access.ts` does not export, so
`sealViewer` is the only expression in the application that produces one and no module can assemble
the shape it wants. What the compiler still does *not* enforce is that `resolveViewer` is
`sealViewer`'s only caller — that remains convention plus the layering lint rule, and the comment
now says so in those terms. See § 4.

---

## Reading order for someone auditing this

`src/data/session.ts` → `src/data/session-cookie.ts` → `src/data/viewer.ts` →
`src/app/[org]/layout.tsx` → `src/components/controls/request.ts` → `src/domain/access.ts` →
`src/data/queries/context.ts`. Then `src/app/api/session/route.ts` on its own, because it is the one
place the application accepts input that is not a URL. The Next docs agree about where to spend the
time (`node_modules/next/dist/docs/01-app/02-guides/data-security.md:611`).
