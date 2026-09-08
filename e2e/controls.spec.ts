// **T-E5** — control state does not survive navigation (A20, R-C5, R-T27).
// **T-E6** — the account switcher re-issues the token and stays on the current URL (A5, R-A5).
//
// Both are end-to-end claims and neither is provable below this layer. T-E5's mechanism is an
// *absence* — nav `href`s carry no query — and an absence is only real once a browser has
// followed one. T-E6 crosses a `Set-Cookie`, a 303 and a fresh render, which is the whole
// feature: the unit layer can prove the endpoint computes the right redirect, and only this can
// prove the viewer ends up on the page they were reading with fewer rows on it.

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/** Opens a `<details>`-backed control. Every menu in the shell is one; none holds any state. */
const openMenu = async (page: Page, selector: string): Promise<void> => {
  await page.locator(selector).click();
};

/**
 * The period control's *current value*, not the toolbar's whole text. The menu always lists every
 * period the window carries, so "August 2026 is on the page" is true whatever is selected — the
 * claim R-C5 makes is about which one the summary reads.
 */
const currentPeriod = (page: Page) => page.locator('[data-testid="control-period"] summary');

/**
 * The switcher's entries name **Roles, not people** (R-A6): a Member name in that menu would be a
 * named individual in a payload whose viewer holds no identifying scope over them, which is the
 * leak T-E4 catches. So the handle here is the Role.
 */
const switchTo = async (page: Page, roleName: string): Promise<void> => {
  await page.getByTestId("switch-account").getByRole("button", { name: roleName }).click();
};

test.describe("T-E5 — control state does not survive navigation (A20, R-C5)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("a period set on /spend is gone on /work, which opens at its default", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);
    await expect(currentPeriod(page)).toHaveText(/^PeriodAll data/);

    await openMenu(page, '[data-testid="control-period"] summary');
    await page.getByRole("link", { name: "August 2026" }).click();

    await expect(page).toHaveURL(`/${SLUG}/spend?period=2026-08`);
    await expect(currentPeriod(page)).toHaveText(/^PeriodAugust 2026/);

    await page.getByRole("navigation").getByRole("link", { name: "Work" }).click();

    // The whole of R-C5: same shell, same toolbar, and the period back at the page default.
    await expect(page).toHaveURL(`/${SLUG}/work`);
    await expect(currentPeriod(page)).toHaveText(/^PeriodAll data/);
  });

  test("the mechanism is the absence: no nav href carries a query (R-T27)", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?period=2026-08&grain=day&subject=team`);
    await expect(page).toHaveURL(/period=2026-08/);

    const hrefs = await page.getByRole("navigation").getByRole("link").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).not.toContain("?");
  });

  /**
   * C14 — R-C1 says no page shows a control its panels cannot use. Per-capita was declared for
   * `/demo/spend` and read by nothing there, so it rendered and changed the page not at all.
   * T-C6 passed throughout, because the control *rendered*; what it never asserted is that
   * anything downstream read it.
   */
  test("per-capita changes /spend, where it used to change nothing (C14)", async ({ page }) => {
    // Asserted as two specific readings rather than as "they differ", so the test says what the
    // control does rather than only that it does something.
    await page.goto(`/${SLUG}/spend`);
    await expect(page.getByRole("main")).toHaveText(/Total spend/);
    await expect(page.getByRole("main")).not.toHaveText(/per Member/);

    await page.goto(`/${SLUG}/spend?per_capita=1`);
    await expect(page.getByRole("main")).toHaveText(/Total spend, per Member/);
    await expect(page.getByRole("main")).toHaveText(/Cost by Repository, per Member/);
    await expect(page.getByRole("main")).toHaveText(/active human Members/);
    // The three ratios are left alone: dividing a rate by a headcount states nothing.
    await expect(page.getByRole("main")).not.toHaveText(/Cost per session, per Member/);
  });

  test("a filter set on /work is gone on /people", async ({ page }) => {
    await page.goto(`/${SLUG}/work?execution_mode=headless&per_capita=1`);
    await expect(page.getByTestId("page-toolbar")).toContainText("Headless");

    await page.getByRole("navigation").getByRole("link", { name: "People" }).click();

    await expect(page).toHaveURL(`/${SLUG}/people`);
    await expect(page.getByTestId("page-toolbar")).not.toContainText("Headless");
  });
});

test.describe("T-E6 — the account switcher stays on the current URL (A5, R-A5)", () => {
  const rowsOn = (page: Page) => page.locator("tbody tr");

  test("the same path and query, with fewer rows on it", async ({ page, context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );

    const target = `/${SLUG}/people?sort=cost`;
    await page.goto(target);
    await expect(page.getByTestId("viewer")).toHaveText(OPEN_ACCOUNT.fullName);
    const before = await rowsOn(page).count();
    expect(before).toBeGreaterThan(1);

    await openMenu(page, '[data-testid="account-switcher"]');
    await switchTo(page, RESTRICTED_ACCOUNT.roleName);

    // R-A5 — in place: the same page, the same control state, a different viewer.
    await expect(page).toHaveURL(target);
    await expect(page.getByTestId("viewer")).toHaveText(RESTRICTED_ACCOUNT.fullName);

    const after = await rowsOn(page).count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test("re-issues the token rather than reusing the old one", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    await page.goto(`/${SLUG}/history`);
    const [issued] = await context.cookies();

    await openMenu(page, '[data-testid="account-switcher"]');
    await switchTo(page, RESTRICTED_ACCOUNT.roleName);
    await expect(page).toHaveURL(`/${SLUG}/history`);

    const [reissued] = await context.cookies();
    expect(reissued?.value).not.toBe(issued?.value);
    expect(reissued?.httpOnly).toBe(true);
  });

  test("switching from a page with no toolbar keeps that page too", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    await page.goto(`/${SLUG}/projection`);
    await expect(page.getByTestId("page-toolbar")).toHaveCount(0);

    await openMenu(page, '[data-testid="account-switcher"]');
    await switchTo(page, OPEN_ACCOUNT.roleName);

    await expect(page).toHaveURL(`/${SLUG}/projection`);
    await expect(page.getByTestId("viewer")).toHaveText(OPEN_ACCOUNT.fullName);
  });
});

test.describe("R-N3 — the toolbar is absent, not empty, where a page declares no controls", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("every page that declares controls has a toolbar, and /projection has none", async ({
    page,
  }) => {
    for (const path of ["", "/spend", "/work", "/people", "/history"]) {
      await page.goto(`/${SLUG}${path}`);
      await expect(page.getByTestId("page-toolbar")).toHaveCount(1);
    }

    await page.goto(`/${SLUG}/projection`);
    await expect(page.getByTestId("page-toolbar")).toHaveCount(0);
  });
});
