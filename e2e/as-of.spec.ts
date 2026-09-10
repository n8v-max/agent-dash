// **T-E19 — the product shows the data to `now` and nothing later** (R-D2, R-N3.1, A42,
// ticket 62).
//
// The layers below each prove a piece. `as-of.test.ts` proves the slice drops a session that had
// not finished; `clock.test.ts` proves the window ends on `now`'s civil day; `queries.test.ts`
// proves the projection reads the rows its own chart draws. None of them proves that the
// **served document** carries no instant from the future, and none of them can: the pages compose
// eleven query results and a toolbar, and a row from the future is exactly the kind of thing that
// survives every unit test and appears on the page.
//
// So this is asserted where a reader would see it — over the rendered document, on every route,
// against a `now` the suite itself fixed.
//
// **The pin is what makes the claim checkable at all** (`./support/now.ts`). `AGENT_DASH_NOW` is
// set on the server `playwright.config.ts` spawns, so "later than now" is a comparison against a
// literal this file knows rather than against whenever the suite happened to run. It also makes
// every other assertion in the suite a property of the product instead of a property of today.

import { expect, test, type Page } from "@playwright/test";
import { orgTimezone } from "./support/fixture";
import { pinnedNowIn, PINNED_NOW } from "./support/now";
import { OPEN_ACCOUNT, orgRoutes, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/** `now`, spelled the way every instant on the page is spelled (R-M10, R-N19). */
const NOW_LABEL = pinnedNowIn(orgTimezone());

/** The civil day `now` falls on in the Organization's timezone — the window's cut end (R-D2). */
const NOW_DAY = NOW_LABEL.slice(0, 10);

/**
 * Every instant the document prints, as text. The product has exactly one instant formatter
 * (`src/data/instant.ts`) and it writes `YYYY-MM-DD HH:MM`, so the pattern finds all of them and
 * nothing else: civil dates carry no time, and bucket labels are spelled `8 Sep 2026`.
 *
 * Read off the body's text rather than off named cells, because the claim is about the page and
 * not about one table — a future instant in a tooltip, a caption or a detail panel is the same
 * defect as one in a row.
 */
const instantsOn = async (page: Page): Promise<readonly string[]> => {
  const text = (await page.locator("body").innerText()) || "";
  return text.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) ?? [];
};

test.describe("T-E19 — no surface names an instant later than `now` (A42)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
  });

  test("the server really is pinned — the control for every assertion below", async ({ page }) => {
    // Without this, the whole file could be passing against a server reading the wall clock and
    // a `NOW_LABEL` that happens to be in the past.
    await page.goto(`/${SLUG}/history`);

    const bounds = page.getByLabel("To", { exact: true });
    await expect(bounds).toHaveAttribute("max", NOW_DAY);
    expect(PINNED_NOW).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  for (const path of orgRoutes(SLUG)) {
    test(`${path} prints no instant after ${NOW_LABEL}`, async ({ page }) => {
      await page.goto(path);
      const printed = await instantsOn(page);

      // The as-of stamp is on every surface (R-N3.1), so every route prints at least one.
      expect(printed.length).toBeGreaterThan(0);
      // Both sides are `YYYY-MM-DD HH:MM` in the same timezone, so text order is time order.
      expect(printed.filter((instant) => instant > NOW_LABEL)).toEqual([]);
    });
  }

  test("`/history` lists rows, and every Started cell is at or before `now`", async ({ page }) => {
    await page.goto(`/${SLUG}/history`);
    const started = await page.locator("tbody tr[data-session] td:nth-child(2)").allInnerTexts();

    // The control: this is the page the claim is really about, and it must be showing rows.
    expect(started.length).toBeGreaterThan(10);
    expect(started.filter((cell) => cell.trim() > NOW_LABEL)).toEqual([]);
  });

  test("the as-of stamp is inside the slice, and still names a row the page is showing", async ({
    page,
  }) => {
    // T-E15's identity, re-asserted under the pin. It is the assertion the slice could most
    // easily break: the stamp is read off the last session to *end*, and cutting the rows moves
    // which session that is — so the row it names has to move with it.
    //
    // The row is found **by id** rather than taken off the top of the table (ticket 66). The
    // page is ordered by `started_at` and the stamp is the last session to *end*, and at this
    // volume those are different rows: a long session that opened at 10:03 can finish after a
    // short one that opened at 12:51. Both are inside the slice, which is what this asserts.
    await page.goto(`/${SLUG}/history`);

    const label = ((await page.getByTestId("data-as-of").textContent()) ?? "").replace(
      "Data to ",
      "",
    );
    expect(label <= NOW_LABEL).toBe(true);

    const named = await page.getByTestId("data-as-of").getAttribute("data-session");
    const row = page.locator(`tbody tr[data-session="${named}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(1)).toHaveText(label);
  });

  test("the period menu stops at the month `now` falls in", async ({ page }) => {
    // R-C4's default and R-D2's cut, read off the control: a month after `now` is a period with
    // nothing in it, and R-E1 says the product has no designed zero-data state to offer.
    await page.goto(`/${SLUG}/spend`);
    const menu = page.locator('[data-testid="control-period"]');
    const offered = await menu.locator("a[href]").evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).searchParams.get("period")),
    );
    const months = offered.filter((value): value is string => /^\d{4}-\d{2}$/.test(value ?? ""));

    expect(months.length).toBeGreaterThan(1);
    expect(months.filter((month) => month > NOW_DAY.slice(0, 7))).toEqual([]);
  });
});
