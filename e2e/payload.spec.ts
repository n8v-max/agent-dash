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
// The two set-shape tests do the same job for the cost half, and the scanner's own four tests do
// it for the instrument: a search that cannot find `24.39` where a leak would put it proves
// nothing by not finding it, and a search that reads `1.3M` as a cost fails on the Tokens column
// of a page that leaked nothing (ticket 69).
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
 * The floor the residual cost set must clear. Measured on the committed fixture: **612**
 * candidate ungranted literals, **384** after subtracting every figure the viewer's granted rows
 * can produce. The classes subtracted, each measured against a real failure:
 *
 *   * the viewer's own session costs and the totals its rows aggregate to (sums);
 *   * money quotients — Cost per session and Cost per completed Job, at the same
 *     (period × grouping) key the numerator and the denominator were both summed over. This is
 *     the class that made `/demo/spend` fail on 16 R-X1 mirror cells;
 *   * the session- and Task-grain **rates**: acceptance rate, Rework rate, Decomposition rate.
 *     This is the class that made `/demo/work` — a page carrying no money figure at all — fail
 *     on `0.7`, `0.6` and `0.86`, and again on `0.43` and `0.07` after ticket 48 regenerated the
 *     fixture. Counts over counts, so they are subtracted over the **Team** as well as over the
 *     viewer's own rows: R-A3 grants `team` over `jobs`, so that is the population `/demo/work`
 *     genuinely computes them across, and a count can never be a cost;
 *   * the published token rate card (R-N11), which is nobody's datapoint.
 *
 * **Both sides grew with ticket 48's multi-agent fixture**, and grew together: a root's cost is
 * now its whole tree's (R-M19) and `/demo/history` additionally prints each child's own cost, so
 * there are more candidate literals *and* more legitimate ones. 384 of 612 is still nearly two
 * thirds of the ungranted money range.
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
 * `7.31` is another Member's session cost — `ses_0079`'s, once its two sub-agents roll into it
 * (R-M19) — **and** the viewer's own 2026-07-20 total. It is the same kind of false positive
 * ticket 31 measured on `/demo/spend`, and it is the defect this file exists to fix: value
 * identity is not fact identity. (It reads `7.31` rather than ticket 31's `13.04` because
 * ticket 48 regenerated the fixture; the property it is named for is the same one.)
 */
const OWN_AGGREGATE_COLLISION = "7.31";

/**
 * `0.7` is the viewer's own acceptance rate for `implementation` work in August 2026 — 7 of its
 * own 10 sessions — and it is also some other Member's session cost. It is one of the three
 * literals `/demo/work` failed on, on a page whose ViewModel carries **no cost field at all**.
 * A *sum* subtraction cannot see it; only the quotient subtraction can. It is named here so
 * that a future change reverting the quotient half fails on a value, not just on a set size.
 */
const OWN_QUOTIENT_COLLISION = "0.7";

/**
 * **The scanner itself, before anything is asserted with it** (ticket 69).
 *
 * `decimalsIn` is the search T-E4's negative claims are made of: everything below is only worth
 * what it finds. Two properties, and they pull in opposite directions —
 *
 *   * it **finds** a bare decimal wherever a leak would put one, against any punctuation the RSC
 *     flight payload wraps a value in;
 *   * it **does not find** a decimal that is part of something else: a model version string
 *     (`gemini-3.1-pro`), or a token volume in the units the product now reads them in
 *     (`1.3M`, ticket 69). `1.3` is a real session cost in the committed fixture, so without the
 *     second property the People page's own Tokens column would fail this file.
 *
 * They are asserted here rather than in `vitest` because the scanner is E2E's own instrument and
 * this file is where its claims are made; `vitest`'s `include` is `src/**` by design.
 */
test.describe("T-E4 — the scanner", () => {
  test("finds a cost literal against every character a payload wraps one in", () => {
    const payload = `,${KNOWN_UNGRANTED_LITERAL}] "${KNOWN_UNGRANTED_LITERAL}" >${KNOWN_UNGRANTED_LITERAL}< $${KNOWN_UNGRANTED_LITERAL}`;

    expect(decimalsIn(payload)).toEqual(new Set([KNOWN_UNGRANTED_LITERAL]));
  });

  test("does not read a compact token figure as a cost", () => {
    // The People, History and session tables and both Adoption axes serialise figures of this
    // shape on every route below.
    const payload = '{"tokens":"1.3M","peak":"9.8K","total":"2.1B"}';

    expect(decimalsIn(payload)).toEqual(new Set());
  });

  test("reads the bare decimal beside a token figure, and only it", () => {
    // The discriminating case: the same digits, once as a volume and once as money. `1.30` is
    // what a cost of 1.3 reaches the wire as, and it is still searched for.
    const payload = '{"tokens":"1.3M","cost":1.30,"model":"gemini-3.1-pro-preview"}';

    expect(decimalsIn(payload)).toEqual(new Set(["1.30"]));
  });

  test("finds a bare 1.3, so the exclusion is about the unit and not about the value", () => {
    expect(decimalsIn('{"cost":1.3}')).toEqual(new Set(["1.3"]));
  });
});

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

  /**
   * **The positive control for the scanner's token exclusion** (ticket 69). The rule above is
   * only worth anything if this payload actually carries a figure of that shape: the restricted
   * account holds `self` and `team` over `tokens`, so its own Tokens cell reaches the wire as
   * `75K` or `1.3M`, and the exclusion is being applied to a real string on a real route rather
   * than kept as a regex with nothing to match. Asserted on the cell's own delimiters so that
   * chart path data — where an `M` legitimately follows a coordinate — cannot satisfy it.
   */
  test("carries its own token volume in compact units (R-N15)", async ({ page }) => {
    const payload = await payloadFor(page, `/${RESTRICTED_ACCOUNT.orgSlug}/people`);

    expect(payload).toMatch(/>\d{1,3}(\.\d)?[KMB]</);
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
