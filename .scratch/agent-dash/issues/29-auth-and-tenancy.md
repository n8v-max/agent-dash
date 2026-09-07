Type: implementation
Status: ready-for-agent
Blocked by: 21
Label: ready-for-agent

# Auth, tenancy, and server-side enforcement

## Goal

Two accounts, two JWTs, and enforcement that acts on the wire rather than in a function.

## Scope

- **`/sign-in`** — two "continue as" buttons (R-A4), each posting to `POST /api/session`, which
  issues that account's JWT as an `httpOnly`, `sameSite=lax`, `secure` cookie and redirects to
  `/demo`. `DELETE` clears it.
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
