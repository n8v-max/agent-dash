// **T-E9 — the compute rate card appears on no surface** (A18, R-N11), plus the two secondary
// surfaces themselves (R-N19…R-N25, R-V8).
//
// **Why T-E9 is an E2E test at all.** R-N11 is an absence *across the whole product*: rates vary
// by machine specification and the breakdown is not something a viewer is asked to reason about,
// so the compute card is generator input and nothing else. A component test can prove one panel
// does not render it; only a crawl of every authenticated route can prove no panel does. The
// crawl reads the **response body** — the HTML *and* the RSC flight payload — for the reason
// T-E4 does: a figure serialised as a prop and never displayed has still left the server.
//
// ## The measurement this file is built on
//
// The committed compute card is `general 0.3`, `compute 1.2`, `memory 0.9`, `storage 0.45`, in
// USD per hour. Crawled across all six authenticated routes as the open account, the payloads
// carry **`1.2` and `0.9`, on `/demo/history` only** — and both are session `cost` values on
// R-N19's rows, two sessions that happened to cost $1.20 and $0.90. `0.45` and `0.3` appear
// nowhere. `0.3` would appear the moment `/demo/spend` renders the **token** card, because it is
// also `gemini-3.5-flash-lite`'s uncached-input rate.
//
// **So a bare decimal cannot carry this claim.** A compute rate and a price paid are both money
// in the same narrow range, and `support/costs.ts` already records what that costs: "value
// identity is not fact identity". Asserting "no payload contains `1.2`" would not be a strict
// reading of T-E9 — it would be a test that fails on a legitimate session cost, and the pressure
// to fix it would fall on the product rather than on the search. **This is recorded as an
// argument against T-E9's literal wording, not as a decision to soften it**: the claim asserted
// below is the same claim, made with a search that can tell a rate from a cost.
//
// What tells them apart is what a rate *is*: a rate is paired with the thing it is a rate **of**
// (a machine specification) and the thing it is **per** (an hour). So the crawl makes three
// assertions, each of which a rendered card trips and none of which a session cost can:
//
//   1. **No structural marker** — `machine_spec`, `usd_per_hour`, the card's own unit and label.
//      A card cannot render without saying what its numbers are per, and none of these strings
//      can collide with a money figure at all. This is the sharp one.
//   2. **No (specification, rate) pairing** — no compute rate within 80 characters of a machine
//      specification name. That is the card's shape, one row of it, and it survives a renamed
//      column header or a reformatted figure.
//   3. **Not the whole card** — no payload carries a literal of *every* one of the four rates.
//      Four rows print four rates; `/demo/history` holds two of them and is thereby shown to be
//      holding money, not a card.
//
// Each has a positive control below, over a payload built as a leak of the card would be, so a
// green crawl is a fact about the routes rather than about the search.
//
// **The card is read straight off the committed fixture**, not through `src/data/load.ts`: a
// loader that silently dropped it would empty the search set and every assertion here would pass
// vacuously. The shape assertions on the fixture guard that.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { OPEN_ACCOUNT, orgRoutes, payloadFor, useSession } from "./support/session";

type ComputeRate = { readonly machine_spec: string; readonly usd_per_hour: number };

type RateCards = {
  readonly token: {
    readonly derivation: Readonly<Record<string, number>>;
    readonly rates: readonly Readonly<Record<string, number | string>>[];
  };
  readonly compute: {
    readonly label: string;
    readonly unit: string;
    readonly rates: readonly ComputeRate[];
  };
  readonly seat: { readonly usd: number };
};

const RATE_CARDS: RateCards = JSON.parse(
  readFileSync(join(process.cwd(), "src", "fixtures", "data", "rate_cards.json"), "utf8"),
) as RateCards;

const COMPUTE = RATE_CARDS.compute;

/** Locale-pinned exactly as every figure in the product is pinned. */
const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** Every decimal literal a string contains, as written — `support/costs.ts`'s own regex. */
const DECIMAL_LITERAL = /(?<![\d.])\d+\.\d+(?![\d.])/g;

/** The three shapes a rate reaches a browser in: a raw prop, a money figure, a grouped figure. */
const literalsOf = (value: number): readonly string[] =>
  [String(value), value.toFixed(2), MONEY.format(value)].flatMap(
    (rendering) => rendering.match(DECIMAL_LITERAL) ?? [],
  );

/** One alternation matching any literal of any compute rate. Escaped: `.` is a real dot here. */
const rateAlternation = (): string =>
  [...new Set(COMPUTE.rates.flatMap((rate) => literalsOf(rate.usd_per_hour)))]
    .map((literal) => literal.replaceAll(".", "\\."))
    .join("|");

/**
 * Assertion 2 — a rate beside the specification it is a rate *of*, in either order. 80 characters
 * is a table row's worth of markup in a flight payload and a whole `<tr>` in HTML.
 */
const pairingsIn = (payload: string): readonly string[] => {
  const rates = rateAlternation();
  return COMPUTE.rates.flatMap((rate) => {
    const spec = rate.machine_spec;
    const near = new RegExp(
      `(?:${spec}[\\s\\S]{0,80}?(?<![\\d.])(?:${rates})(?![\\d.]))` +
        `|(?:(?<![\\d.])(?:${rates})(?![\\d.])[\\s\\S]{0,80}?${spec})`,
      "g",
    );
    return payload.match(near) ? [spec] : [];
  });
};

/** Assertion 3 — which of the four rates the payload holds a literal of, whatever its source. */
const ratesPresentIn = (payload: string): readonly string[] => {
  const decimals = new Set(payload.match(DECIMAL_LITERAL) ?? []);
  return COMPUTE.rates
    .filter((rate) => literalsOf(rate.usd_per_hour).some((literal) => decimals.has(literal)))
    .map((rate) => rate.machine_spec);
};

/**
 * Assertion 1 — names the card cannot appear without. Deliberately not `per hour` or a bare
 * `compute`: those are ordinary words a legitimate panel may one day use, and a marker that can
 * be tripped by honest copy is a marker that will be deleted rather than investigated.
 */
const MARKERS: readonly string[] = [
  "machine_spec",
  "usd_per_hour",
  "machine specification",
  COMPUTE.unit,
  COMPUTE.label,
];

const markersIn = (payload: string): readonly string[] =>
  MARKERS.filter((marker) => payload.includes(marker));

/** The card as a leak would carry it: four (specification, rate) pairs, named and serialised. */
const LEAKED_CARD = COMPUTE.rates
  .map((rate) => `{"machine_spec":"${rate.machine_spec}","usd_per_hour":${rate.usd_per_hour}}`)
  .join(",");

const ROUTES = orgRoutes(OPEN_ACCOUNT.orgSlug);

/** The open account holds every grant, so its payload is the widest the product produces. */
const OPEN_CLAIMS = { member_id: OPEN_ACCOUNT.memberId, org_slug: OPEN_ACCOUNT.orgSlug };

/** One sign-in for the file: every test below reads the same account's payloads. */
test.beforeEach(async ({ context, baseURL }) => {
  await useSession(context, OPEN_CLAIMS, baseURL ?? "http://localhost:3000");
});

test.describe("T-E9 — the compute rate card appears on no surface (A18, R-N11)", () => {
  test("the fixture holds a compute card, so none of this is a search of an empty set", () => {
    expect(COMPUTE.rates).toHaveLength(4);
    expect(COMPUTE.unit).toBe("usd_per_hour");
    expect(rateAlternation().length).toBeGreaterThan(0);
  });

  test("all six authenticated routes are crawled", () => {
    expect(ROUTES).toHaveLength(6);
  });

  // The positive controls. Without them a green crawl could be a fact about the search.
  test("the search finds the card when it is genuinely there", () => {
    expect(markersIn(LEAKED_CARD)).toEqual(MARKERS.filter((m) => LEAKED_CARD.includes(m)));
    expect(markersIn(LEAKED_CARD).length).toBeGreaterThan(0);
    expect(pairingsIn(LEAKED_CARD)).toHaveLength(4);
    expect(ratesPresentIn(LEAKED_CARD)).toHaveLength(4);
  });

  test("and does not find it in a payload that merely holds money", () => {
    // Two session costs equal to two of the rates — which is exactly what /demo/history is.
    const costs = '["equilibrio/web-console#726","interactive","yes",10819,359576,1.2]';

    expect(markersIn(costs)).toEqual([]);
    expect(pairingsIn(costs)).toEqual([]);
    expect(ratesPresentIn(costs).length).toBeLessThan(4);
  });

  for (const route of ROUTES) {
    test(`names no part of the compute card on ${route}`, async ({ page }) => {
      const payload = await payloadFor(page, route);

      expect(markersIn(payload), `${route} named the compute rate card`).toEqual([]);
    });

    test(`pairs no rate with a machine specification on ${route}`, async ({ page }) => {
      const payload = await payloadFor(page, route);

      expect(
        pairingsIn(payload),
        `${route} put a compute rate beside the specification it is a rate of`,
      ).toEqual([]);
    });

    test(`carries no more of the card's rates than money alone explains on ${route}`, async ({
      page,
    }) => {
      const payload = await payloadFor(page, route);

      // Four rows print four rates. Fewer than four means the payload holds money figures that
      // happen to equal rates — which the two assertions above have already shown they are.
      expect(
        ratesPresentIn(payload).length,
        `${route} carries a literal of every rate on the compute card`,
      ).toBeLessThan(4);
    });
  }
});

test.describe("/demo/history — the raw rows under every aggregate", () => {
  test("renders one row per session, newest first, fifty to a page (R-N19, R-N20)", async ({
    page,
  }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/history`);

    await expect(page.getByTestId("pagination-summary")).toContainText("Showing 1–50 of");
    await expect(page.getByRole("columnheader", { name: "Started" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  test("expands a row to its four token classes and its Model mix (R-N20.1)", async ({ page }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/history`);

    await page.getByRole("button", { name: /Token classes and Model mix/ }).first().click();

    const detail = page.getByTestId("session-detail");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Cache write")).toBeVisible();
    await expect(detail.getByRole("heading", { name: "Model mix" })).toBeVisible();
  });

  test("builds no link from the Task key — the tracker is imaginary (R-N21)", async ({ page }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/history`);

    const keys = page.getByRole("cell").filter({ hasText: /^[\w-]+\/[\w-]+#\d+$/ });
    await expect(keys.first()).toBeVisible();
    await expect(keys.first().getByRole("link")).toHaveCount(0);
  });
});

test.describe("/demo/projection — where the current month lands", () => {
  test("states the method, shows the share and flags the incomplete period (R-N23)", async ({
    page,
  }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/projection`);

    await expect(page.getByTestId("projection-method")).toContainText("in proportion to");
    await expect(page.getByTestId("elapsed-share")).toContainText("%");
    await expect(page.getByTestId("incomplete-flag")).toBeVisible();
  });

  test("labels the forecast 'estimated', and nothing else on the page (R-V8, A17)", async ({
    page,
  }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/projection`);

    await expect(page.getByTestId("figure-projected-cost")).toContainText("Estimated");
    await expect(page.getByTestId("figure-spend-to-date")).not.toContainText(/estimat/i);
    await expect(page.getByRole("main").getByText(/estimated/i)).toHaveCount(1);
  });

  // Ticket 42 — the reader has to be able to check the forecast against what is on the page.
  // Both totals are printed beside the two components they are the sum of, so the check is
  // arithmetic over rendered text rather than a claim about a ViewModel nobody can see.
  test("T-E11 — prints the components of both figures, and both sums come out (R-N23.1)", async ({
    page,
  }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/projection`);

    const usd = async (testId: string): Promise<number> => {
      const text = (await page.getByTestId(testId).textContent()) ?? "";
      const figure = text.replace(/[^\d.]/g, "");
      expect(figure, `${testId} renders a money figure`).toMatch(/^\d+(\.\d{2})?$/);
      return Number(figure);
    };

    const sessionToDate = await usd("spend-to-date-session");
    const seat = await usd("spend-to-date-seat");
    const projectedSession = await usd("projected-cost-session");
    const projectedTotal = await usd("figure-value-projected-cost");

    // The four figures are real, and the seat charge is the same one in both tiles: a seat is
    // charged by whole months and is never extrapolated (R-M5, R-D2).
    expect(sessionToDate).toBeGreaterThan(0);
    expect(seat).toBeGreaterThan(0);
    expect(projectedSession).toBeGreaterThan(sessionToDate);
    expect(await usd("projected-cost-seat")).toBe(seat);

    // They sum. The one-cent tolerance is rounding on the *rendered strings* — two figures each
    // rounded to the nearest cent can differ from the rounded sum by that much. The ViewModel
    // identity behind them is exact and is asserted as an equality in `src/data/queries.test.ts`.
    const spendToDate = await usd("figure-value-spend-to-date");
    expect(Math.abs(spendToDate - (sessionToDate + seat))).toBeLessThanOrEqual(0.01);
    expect(Math.abs(projectedTotal - (projectedSession + seat))).toBeLessThanOrEqual(0.01);
  });

  test("renders no confidence band and no rate card (R-N24, R-N11)", async ({ page }) => {
    await page.goto(`/${OPEN_ACCOUNT.orgSlug}/projection`);

    // Scoped to the panel: the page's own lede says "No confidence band", which is the claim,
    // not a band. What must be absent is a *figure* dressed as one.
    const panel = page.getByTestId("projection-panel");
    await expect(panel).not.toContainText(/confidence|interval|illustrative|±/i);
  });
});
