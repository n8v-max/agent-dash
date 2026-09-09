// **T-E14 — a Member subject is ranked bars, and Cost by Repository reads months** (A36, R-V12,
// R-N9.1, ticket 44).
//
// Both halves are proved elsewhere at a layer that cannot see the page: `viewmodel.ts` decides
// what a ranked chart's table is, `panels.ts` decides which subject level is ranked, and
// `chart-shapes.tsx` decides which element that draws. What none of them proves is that the
// decision **survives the whole stack** — the query, the RSC boundary, the panel's own named
// shape and Recharts — and arrives on a running page as bars rather than as lines.
//
// The bars are asserted as *marks*, because the ticket's claim is about the picture: at
// `subject=member` there is no line series left on this chart at all. The figures behind them go
// through the R-X1 mirror, for `testing-spec.md` P2's reason.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/** R-N9 panel 1, found by the `aria-label` `chart-frame.tsx` builds out of its roll-up level. */
const costPerJob = (page: Page): Locator =>
  page.getByRole("group", { name: /^Cost per completed Job, grouped by/ });

const mirrorOf = (chart: Locator): Locator => chart.getByRole("table");

test.describe("T-E14 — `?subject=member` draws ranked bars and no time axis (R-V12)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("draws one bar per Member and no line series at all", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?subject=member`);

    const chart = costPerJob(page);
    await expect(chart).toHaveCount(1);

    // R-V4's cap: four named Members plus "Other". One `<path>` line series would be one too
    // many — this is the geometry the ticket exists to remove.
    await expect(chart.locator(".recharts-line")).toHaveCount(0);
    await expect(chart.locator(".recharts-line-curve")).toHaveCount(0);
    await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(5);
  });

  test("mirrors one row per Member, headed by the grouping (R-X1)", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?subject=member`);

    const mirror = mirrorOf(costPerJob(page));

    await expect(mirror.locator("thead th").first()).toHaveText("Member");
    // One row per Member the cap named, plus "Other" — never one wide row of twenty columns.
    await expect(mirror.locator("tbody tr")).toHaveCount(5);
    await expect(mirror.locator("tbody tr").last().locator("th")).toHaveText("Other");
  });

  test("keeps the line where the subject is one the page can read over time", async ({ page }) => {
    // The control: without this, a page that had simply lost its charts would pass the file.
    await page.goto(`/${SLUG}/spend?subject=team`);

    const chart = costPerJob(page);

    await expect(chart.locator(".recharts-line")).not.toHaveCount(0);
    await expect(mirrorOf(chart).locator("thead th").first()).toHaveText("Period");
  });
});

test.describe("T-E14 — Cost by Repository reads months whatever the grain is (R-N9.1)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("holds month keys while the page beside it is bucketed by week", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?grain=week`);

    const byRepository = page.getByRole("group", { name: /^Cost by Repository, grouped by/ });
    const months = await mirrorOf(byRepository).locator("tbody th").allTextContents();

    expect(months.length).toBeGreaterThan(0);
    // `Apr 2026`, never `Week 15, 2026` — the same shape Total spend's mirror carries (A25).
    for (const month of months) expect(month).toMatch(/^\w{3} \d{4}$/);

    // The control: the panel beside it *is* on the page's weeks, so this is a decision about one
    // panel rather than a page that quietly stopped honouring its own grain control.
    const perSession = page.getByRole("group", { name: /^Cost per session, grouped by/ });
    const weeks = await mirrorOf(perSession).locator("tbody th").allTextContents();
    expect(weeks[0]).toMatch(/^Week \d+, \d{4}$/);
  });
});
