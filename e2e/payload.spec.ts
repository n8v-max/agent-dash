// T-E4 — no ungranted figure reaches the client payload (A10, R-T18, R-A6).
//
// **This inspects the response body. It is never a DOM query.** `not.toBeVisible()` proves
// that something was not rendered; it proves nothing about whether it was *sent*. A figure
// serialised into the RSC flight payload and never displayed has still left the server, is
// still in devtools, and is still a disclosure — that is exactly the difference between the
// access model working and the access model being theatre (`testing-spec.md` § 10).
//
// The acting account is the restricted contractor. Its grants are `self` over every class
// (R-A3.1) plus `team` over `jobs` and `tokens`. `team` is an *aggregating* scope, so it
// resolves no other Member by name, and it carries no `cost` at all: the only name that may
// appear in its payload is its own, and the only cost figures are its own.
//
// **The two halves are not symmetric, and only one of them had a collision problem.** A Member's
// full name is an identifier: it appears in the payload because the payload named that Member.
// A cost is a *number*, and `self` over `cost` grants the viewer every aggregate of its own
// rows — so a legitimate own-aggregate can equal some other Member's session cost by arithmetic
// coincidence. The name half is untouched and sharp. The cost half now subtracts what the
// viewer's own granted rows can legitimately add up to; `./support/costs` computes that from the
// raw committed fixture, never from `src/data/queries.ts`, and its header says why.
//
// **What this file cannot yet assert, and does not pretend to.** The panels that carry Member
// rows and cost figures do not exist — wave 9 supplies them. Until they do, the negative
// assertions below run against routes that render a shell. The positive control exists so that
// this is not a vacuous pass: it proves the search finds a Member name in the payload when one
// is genuinely there, so a failure to find the other nineteen is a fact about the payload and
// not about the search. The two set-shape tests below do the same job for the cost half.
//
// TODO(wave 9): once `/[org]/people` and `/[org]/spend` render rows, add the assertions that
// cannot be made today — that the restricted payload carries exactly two rows (own + Team
// aggregate, T-E2) and that the open account's payload carries the other Members' names, which
// is the permanent positive control for the negative assertions on the restricted one.

import { expect, test } from "@playwright/test";
import { decimalsIn, ungrantedCostLiterals } from "./support/costs";
import { RESTRICTED_ACCOUNT, orgRoutes, payloadFor, ungrantedNames, useSession } from "./support/session";

const BASE = "http://localhost:3000";

const ROUTES = orgRoutes(RESTRICTED_ACCOUNT.orgSlug);
const UNGRANTED_NAMES = ungrantedNames(RESTRICTED_ACCOUNT.memberId);
const UNGRANTED_COSTS = ungrantedCostLiterals(RESTRICTED_ACCOUNT.memberId);

/**
 * The floor the residual cost set must clear. Measured on the committed fixture: **484**
 * candidate ungranted literals, **459** after subtracting every figure the viewer's own granted
 * rows can produce — 25 removed, each one a value those rows genuinely aggregate to. (The set
 * the earlier construction searched held 439; subtracting aggregates alone takes it to 417, and
 * it is larger here only because an ungranted cost is now also searched for in the two-decimal
 * shape a money formatter would print it in.)
 *
 * **400 is the line below which this stops being a search of the money range.** If a fixture or
 * a subtraction change ever drops the set under it, the cost assertion has become theatre and
 * the answer is to investigate, not to lower the number.
 */
const UNGRANTED_COST_FLOOR = 400;

/**
 * `24.39` is `ses_0032`'s cost — `mem_nightlybot`'s, a Member the contractor holds no scope
 * over — and it is the literal ticket 29's falsification probe leaked to prove T-E4 can fail.
 * It must survive the subtraction, or the probe would no longer fire and neither would a leak.
 */
const KNOWN_UNGRANTED_LITERAL = "24.39";

/**
 * `13.04` is another Member's session cost **and** the viewer's own 2026-08-03 implementation
 * total. It is one of the 15 false positives ticket 31 measured on `/demo/spend`, and it is the
 * defect this file exists to fix: value identity is not fact identity.
 */
const OWN_AGGREGATE_COLLISION = "13.04";

test.describe("T-E4 — the restricted account's payload", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: RESTRICTED_ACCOUNT.orgSlug },
      baseURL ?? BASE,
    );
  });

  // The positive control. Without it every assertion below could pass because the payload was
  // empty, the encoding defeated the search, or the request never reached the app.
  test("contains the viewer's own name, which self scope grants (R-A3.1)", async ({ page }) => {
    const payload = await payloadFor(page, `/${RESTRICTED_ACCOUNT.orgSlug}`);

    expect(payload).toContain(RESTRICTED_ACCOUNT.fullName);
  });

  test("the fixture holds names and costs to look for", () => {
    // Guards the two suites below against becoming assertions over empty sets.
    expect(UNGRANTED_NAMES.length).toBeGreaterThan(10);
    expect(UNGRANTED_COSTS.size).toBeGreaterThanOrEqual(UNGRANTED_COST_FLOOR);
  });

  // The permanent regression guard on the subtraction itself. The set-size floor above catches
  // a subtraction that swallows the range wholesale; these two catch the subtraction drifting
  // in either direction on a specific, named value, which a size check cannot see.
  test("the search set still holds a real ungranted cost literal", () => {
    expect(
      UNGRANTED_COSTS.has(KNOWN_UNGRANTED_LITERAL),
      `${KNOWN_UNGRANTED_LITERAL} is another Member's session cost and must remain searched for`,
    ).toBe(true);
  });

  test("the search set excludes a figure the viewer's own rows aggregate to", () => {
    expect(
      UNGRANTED_COSTS.has(OWN_AGGREGATE_COLLISION),
      `${OWN_AGGREGATE_COLLISION} is a total of the viewer's own sessions; self scope grants it`,
    ).toBe(false);
  });

  for (const route of ROUTES) {
    test(`carries no ungranted Member name on ${route}`, async ({ page }) => {
      const payload = await payloadFor(page, route);

      const leaked = UNGRANTED_NAMES.filter((name) => payload.includes(name));

      expect(leaked, `${route} serialised names the contractor holds no scope over`).toEqual([]);
    });

    test(`carries no ungranted cost figure on ${route}`, async ({ page }) => {
      const payload = await payloadFor(page, route);

      const leaked = [...decimalsIn(payload)].filter((value) => UNGRANTED_COSTS.has(value));

      expect(leaked, `${route} serialised costs outside the contractor's grants`).toEqual([]);
    });
  }
});
