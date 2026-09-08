// **R-M18 — a ratio with a zero denominator is an absence on the page, not a zero** (ticket 40).
//
// The rule is one expression in `src/domain/ratio.ts` and is proved there, and its two rendering
// consequences are proved in the component layer: the mirror prints an em dash
// (`chart-frame.test.tsx`) and the marks carry `connectNulls={false}` (`chart-shapes.test.tsx`).
// What no other layer can prove is that the absence **survives the whole stack** — permission
// filter, week bucketing, the metric module, the ViewModel, the RSC boundary and the renderer —
// and arrives on a running page as a dash rather than as `$0.00`.
//
// **The restricted account at week grain is the case the ticket names**, and it is real data
// rather than a constructed one: that account's sessions are sparse, so six weeks of the
// committed window hold no Completed Job to divide by. Every one of them drew `$0` before this
// rule, under panel copy promising a gap.
//
// The assertion is over the **R-X1 mirror**, for `testing-spec.md` P2's reason: it is the chart's
// claim in queryable DOM, so this asserts chart *output* with no SVG parsing. The chart beside it
// makes the same claim by breaking its line, which is not assertable here and does not need to be.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { RESTRICTED_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = RESTRICTED_ACCOUNT.orgSlug;

/** R-X1's em dash, exactly as `table-mirror.tsx` spells it. */
const NO_READING = "—";

/** The weeks the ticket names: spend, or nothing at all, and no Completed Job to divide it by. */
const EMPTY_WEEKS = [
  "Week 15, 2026",
  "Week 16, 2026",
  "Week 17, 2026",
  "Week 20, 2026",
  "Week 21, 2026",
  "Week 23, 2026",
];

/** A week the same account *did* finish work in, so a page of dashes cannot pass this file. */
const DRAWN_WEEK = "Week 18, 2026";

/** The mirror of R-N9 panel 1, found by its caption — `chart-frame.ts`'s `mirrorCaption`. */
const costPerJobMirror = (page: Page): Locator =>
  page.getByRole("table", { name: /^Cost per completed Job, grouped by/ });

const weekRow = (page: Page, label: string): Locator =>
  costPerJobMirror(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) });

test.describe("R-M18 — a week with no Completed Job draws nothing (ticket 40)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("the mirror holds a dash in week 15, not a zero", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?grain=week`);

    await expect(weekRow(page, "Week 15, 2026").getByRole("cell")).toHaveText(NO_READING);
  });

  test("and in every other week the account finished nothing in", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?grain=week`);

    for (const week of EMPTY_WEEKS) {
      await expect(weekRow(page, week).getByRole("cell")).toHaveText(NO_READING);
    }
  });

  test("while a week that finished something still carries its figure", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?grain=week`);

    // Without this the file would pass against a panel that rendered nothing at all.
    await expect(weekRow(page, DRAWN_WEEK).getByRole("cell")).toHaveText(/^[\d,]+(\.\d+)?$/);
  });

  test("no bucket of this chart reads zero — a finished Job cannot have cost nothing", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/spend?grain=week`);

    const cells = await costPerJobMirror(page).getByRole("cell").allTextContents();

    expect(cells.length).toBeGreaterThan(EMPTY_WEEKS.length);
    expect(cells).toContain(NO_READING);
    expect(cells).not.toContain("0");
  });
});
