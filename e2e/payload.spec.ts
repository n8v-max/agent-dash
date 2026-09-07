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
// **What this file cannot yet assert, and does not pretend to.** The panels that carry Member
// rows and cost figures do not exist — ticket 28 supplies `src/data/queries.ts` and wave 9 the
// panels. Until they do, the negative assertions below run against routes that render a shell.
// The positive control exists so that this is not a vacuous pass: it proves the search finds a
// Member name in the payload when one is genuinely there, so a failure to find the other
// nineteen is a fact about the payload and not about the search.
//
// TODO(ticket 28 / wave 9): once `/[org]/people` and `/[org]/spend` render rows, add the
// assertions that cannot be made today — that the restricted payload carries exactly two rows
// (own + Team aggregate, T-E2) and that the open account's payload carries the other Members'
// names, which is the positive control for the negative assertions on the restricted one.

import { expect, test } from "@playwright/test";
import {
  RESTRICTED_ACCOUNT,
  decimalsIn,
  orgRoutes,
  payloadFor,
  ungrantedCostLiterals,
  ungrantedNames,
  useSession,
} from "./support/session";

const BASE = "http://localhost:3000";

const ROUTES = orgRoutes(RESTRICTED_ACCOUNT.orgSlug);
const UNGRANTED_NAMES = ungrantedNames(RESTRICTED_ACCOUNT.memberId);
const UNGRANTED_COSTS = ungrantedCostLiterals(RESTRICTED_ACCOUNT.memberId);

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
    expect(UNGRANTED_COSTS.size).toBeGreaterThan(100);
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
