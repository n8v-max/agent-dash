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
// viewer's own granted rows can legitimately **add up to and divide out to** — a ratio is a
// reading of granted rows exactly as a total is, and `/demo/work` renders acceptance rates on a
// page that carries no money at all. `./support/costs` computes both from the raw committed
// fixture, never from `src/data/queries.ts`, and its header says why.
//
// **Two positive controls, because a negative assertion is only worth what its search is worth.**
//
//   1. *The viewer's own name is in its own payload.* Without it every assertion below could pass
//      because the payload was empty, the encoding defeated the search, or the request never
//      reached the app.
//   2. *The other Members' names are in the **open** account's payload.* This is the permanent
//      one, and it is the stronger of the two: it proves the nineteen names the restricted
//      account must not receive are names this product genuinely serialises when a grant allows
//      it — so their absence from the restricted payload is a fact about the access model rather
//      than a fact about the fixture, the route or the regex. It could not be written until
//      `/[org]/people` rendered rows, and it now can.
//
// The two set-shape tests do the same job for the cost half.
//
// **The one T-E2-shaped assertion this file still does not make** is the restricted payload's
// *row count*. `testing-spec.md` § 5 asks for two rows — the viewer's own plus its Team's
// aggregate — and `src/data/queries/people.ts` renders the own row plus an aggregate *sentence*,
// so the count is one. That is a recorded shortfall and a product decision, not a test defect;
// it is asserted where the rows are, in `e2e/people.spec.ts`, as the range both designs satisfy
// with the difference-in-kind claim asserted sharply beside it. It is not restated here.

import { expect, test } from "@playwright/test";
import { decimalsIn, ungrantedCostLiterals } from "./support/costs";
import {
  OPEN_ACCOUNT,
  RESTRICTED_ACCOUNT,
  orgRoutes,
  payloadFor,
  ungrantedNames,
  useSession,
} from "./support/session";

const BASE = "http://localhost:3000";

const ROUTES = orgRoutes(RESTRICTED_ACCOUNT.orgSlug);
const UNGRANTED_NAMES = ungrantedNames(RESTRICTED_ACCOUNT.memberId);
const UNGRANTED_COSTS = ungrantedCostLiterals(RESTRICTED_ACCOUNT.memberId);

/**
 * The floor the residual cost set must clear. Measured on the committed fixture: **525**
 * candidate ungranted literals, **348** after subtracting every figure the viewer's own granted
 * rows can produce. Where the 177 go:
 *
 *   * **66** are the viewer's own session costs and the totals its rows aggregate to (sums).
 *   * **95** are money quotients — Cost per session and Cost per completed Job, at the same
 *     (period × grouping) key the numerator and the denominator were both summed over. This is
 *     the class that made `/demo/spend` fail on 16 R-X1 mirror cells.
 *   * **13** are the session- and Task-grain rates: acceptance rate, Rework rate, Decomposition
 *     rate. This is the class that made `/demo/work` — a page carrying no money figure at all —
 *     fail on `0.7`, `0.6` and `0.86`.
 *   * **3** are the published token rate card (R-N11), which is nobody's datapoint.
 *
 * **The floor was 400 against a set of 459 and is now 300 against a set of 348.** That is a
 * deliberate, measured change and not a concession: the 111 literals the quotient and rate-card
 * subtractions removed are each a value the viewer's own `self`-granted rows genuinely read out
 * to, so keeping them would keep testing arithmetic coincidence rather than disclosure. 300
 * holds the same ~14% headroom over the measured set that 400 held over 459, and 348 of 525 is
 * still two thirds of the ungranted money range.
 *
 * **300 is the line below which this stops being a search of the money range.** If a fixture or
 * a subtraction change ever drops the set under it, the cost assertion has become theatre and
 * the answer is to investigate, not to lower the number.
 */
const UNGRANTED_COST_FLOOR = 300;

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

/**
 * `0.7` is the viewer's own acceptance rate for `implementation` work in August 2026 — 7 of its
 * own 10 sessions — and it is also some other Member's session cost. It is one of the three
 * literals `/demo/work` failed on, on a page whose ViewModel carries **no cost field at all**.
 * A *sum* subtraction cannot see it; only the quotient subtraction can. It is named here so
 * that a future change reverting the quotient half fails on a value, not just on a set size.
 */
const OWN_QUOTIENT_COLLISION = "0.7";

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

  test("the search set excludes a ratio the viewer's own rows divide out to", () => {
    expect(
      UNGRANTED_COSTS.has(OWN_QUOTIENT_COLLISION),
      `${OWN_QUOTIENT_COLLISION} is the viewer's own acceptance rate for one WorkType in one ` +
        "month — a quotient of its own granted rows, not a cost it holds no scope over",
    ).toBe(false);

    // Named beside it, because the pair is the point: subtracting quotients must not have
    // reached the costs a leak would actually be made of.
    expect(
      UNGRANTED_COSTS.has(KNOWN_UNGRANTED_LITERAL),
      `${KNOWN_UNGRANTED_LITERAL} must survive the quotient subtraction as well as the sum one`,
    ).toBe(true);
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

// The permanent positive control for the name half. It runs as the *open* account, which is the
// only reason it belongs in a second describe: the same nineteen names, the same route, the same
// search, and a grant that allows them — so a green negative above cannot be the search failing.
test.describe("T-E4 — the same names, for an account that holds the grant", () => {
  test("the open account's /demo/people payload carries every name the contractor may not see", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: OPEN_ACCOUNT.orgSlug },
      baseURL ?? BASE,
    );

    const payload = await payloadFor(page, `/${OPEN_ACCOUNT.orgSlug}/people`);

    const absent = UNGRANTED_NAMES.filter((name) => !payload.includes(name));

    expect(
      absent,
      "the search found none of these in a payload that is supposed to carry them, so the " +
        "negative assertions above prove nothing about the access model",
    ).toEqual([]);
  });
});
