// **T-E17 — no surface scrolls sideways on a phone** (A40, R-V15, ticket 46).
//
// The claim is one number per route and it is measurable rather than eyeballed:
// `document.documentElement.scrollWidth <= 390` at a 390×844 viewport, for every one of R-N1's
// six authenticated surfaces. A horizontal scrollbar on the document is the failure a reviewer
// meets in the first second on a phone, and it is invisible at 1440 — which is why it is the one
// layout claim in this suite asserted at a width no other test runs at.
//
// **It runs in its own Playwright project.** `mobile-chromium` is the only project that matches
// this file, and the desktop `chromium` project ignores it, so the suite pays for one width per
// spec rather than two. The two existing tests that genuinely need both widths — the R-N8
// breakdown tile in `summary.spec.ts` and the R-C6 toolbar in `controls.spec.ts` — set their own
// viewport inside the desktop project and are unaffected.
//
// **Why the document and not the elements.** A panel that overflows *inside its own card* is
// fine and is in fact the design: R-V15 lets a table scroll within its card. What is forbidden is
// the overflow reaching `<html>`, because that is the one scroll container a reader cannot avoid.
// So the assertion is on the document, and the diagnostic below names the widest element inside
// it purely so a failure says *what* to fix rather than *that* something broke.

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, orgRoutes, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;
const ROUTES = orgRoutes(SLUG);

/** The phone the ticket states the requirement at: 390×844, the iPhone 14 CSS viewport. */
const PHONE_WIDTH = 390;

/**
 * The document's scroll width, plus the widest element under it and how it is described — a
 * `data-testid`, an id, or the tag and its classes. Read in one evaluate so the failure message
 * carries the culprit rather than requiring a second run to find it.
 */
const overflowReport = async (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const nameOf = (element: Element): string => {
      const testid = element.getAttribute("data-testid");
      if (testid) return `[data-testid="${testid}"]`;
      const className =
        typeof element.className === "string" ? element.className.slice(0, 120) : "";
      return `<${element.tagName.toLowerCase()} class="${className}">`;
    };
    const widest = [...document.querySelectorAll("body *")]
      .map((element) => ({ element, right: element.getBoundingClientRect().right }))
      .filter((entry) => entry.right > root.clientWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 3)
      .map((entry) => `${Math.round(entry.right)}px ${nameOf(entry.element)}`);
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, widest };
  });

test.describe("T-E17 — every surface fits a 390px phone (A40, R-V15)", () => {
  test.beforeEach(async ({ context }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: OPEN_ACCOUNT.orgSlug },
      BASE,
    );
  });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const report = await overflowReport(page);

      expect(
        report.scrollWidth,
        `${route} overflows by ${report.scrollWidth - PHONE_WIDTH}px. ` +
          `Widest elements: ${report.widest.join(" · ") || "none — the culprit is a margin or a fixed width on the root"}`,
      ).toBeLessThanOrEqual(PHONE_WIDTH);
    });
  }

  /**
   * The restricted account on the widest surface. It renders *fewer* rows, not narrower ones,
   * so this is not a second copy of the sweep above: R-A10's visibility sentence and the
   * one-row table are markup the open account never shows, and either could be the thing that
   * does not fit.
   */
  test("/people fits for the restricted account too", async ({ context, page }) => {
    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: RESTRICTED_ACCOUNT.orgSlug },
      BASE,
    );
    await page.goto(`/${SLUG}/people`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const report = await overflowReport(page);

    expect(report.scrollWidth, `widest: ${report.widest.join(" · ")}`).toBeLessThanOrEqual(
      PHONE_WIDTH,
    );
  });
});

/**
 * The rest of R-V15, stated as structure rather than as pixels. Each of these is a *mechanism*
 * the scroll-width sweep above depends on, and each fails silently in a way the sweep would not
 * catch: a nav that fits because two items vanished passes the sweep and breaks R-A8.
 */
test.describe("T-E17 — what the fit is made of (R-V15)", () => {
  test.beforeEach(async ({ context }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: OPEN_ACCOUNT.orgSlug },
      BASE,
    );
  });

  test("all six nav links survive the phone, and none is a menu (R-N2, A33)", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);

    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("button")).toHaveCount(0);
    await expect(nav).not.toHaveText(/⋯|More/);
    // Visible, not merely present: `hidden` would satisfy a count and break R-A8.
    for (const label of ["Summary", "Spend", "Work", "People", "History", "Projection"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

    // And the six *fit* — the nav does not overflow its own row. The document sweep above
    // cannot see this: a nav that overflowed into a scroller of its own would leave the page
    // 390px wide and two of R-N1's surfaces off the edge of a bar nothing suggests can scroll.
    const overflows = await nav.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("the account switcher is the avatar alone, and still switches (R-A5)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    // The name and Role line are the two things the header drops at this width; the control
    // itself is untouched, so the menu still opens and still offers both accounts.
    await expect(page.getByTestId("viewer")).toBeHidden();
    await expect(page.getByTestId("account-switcher")).toBeVisible();
    await page.getByTestId("account-switcher").click();
    await expect(page.getByTestId("switch-account").getByRole("button")).toHaveCount(2);
  });

  test("a wide table scrolls inside its own card, not the page (R-V15)", async ({ page }) => {
    await page.goto(`/${SLUG}/history`);

    // The scroller is the mechanism the sweep leans on: without it the ten-column session table
    // would push the document instead. Asserted as a real overflow — the element scrolls — so a
    // card that merely *clipped* its table would not pass.
    const scroller = page.getByTestId("table-scroller").first();
    await expect(scroller).toBeVisible();
    const scrolls = await scroller.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(scrolls).toBe(true);
  });
});
