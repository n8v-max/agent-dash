// **T-E5** — control state does not survive navigation (A20, R-C5, R-T27).
// **T-E6** — the account switcher identifies the acting account and links out (R-A5 as amended
// by ticket 61).
//
// Both are end-to-end claims and neither is provable below this layer. T-E5's mechanism is an
// *absence* — nav `href`s carry no query — and an absence is only real once a browser has
// followed one. T-E6's claim is now about the running shell: the switcher used to cross a
// `Set-Cookie`, a 303 and a fresh render, and the requirement it served was withdrawn. What
// replaced it is a *shape* — one link out, no form, in a `<details>` rendered by a layout — and
// a unit test on the component cannot see that the layout ships it, that the link resolves, or
// that the page it lands on is still the one-action sign-in page.

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
    // R-C6 — `execution_mode` reads off the *panel* now rather than off the bar, so the handle is
    // the acceptance panel's own header. What R-C5 claims is unchanged by the move: the state is
    // in the query string, and navigation drops the query string.
    await page.goto(`/${SLUG}/work?execution_mode=headless&per_capita=1`);
    const acceptance = page.getByRole("region", { name: "Acceptance rate by template" });
    await expect(acceptance.getByTestId("control-executionMode")).toContainText("Headless");

    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "People" }).click();

    await expect(page).toHaveURL(`/${SLUG}/people`);
    await expect(page.getByTestId("page-toolbar")).not.toContainText("Headless");
  });
});

test.describe("T-E6 — the switcher identifies and links out (R-A5 as amended)", () => {
  const menu = (page: Page) => page.getByTestId("switch-account");

  test("names the acting Member and their Organization, and offers one link to /sign-in", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
    await page.goto(`/${SLUG}/people?sort=cost`);

    await expect(page.getByTestId("viewer")).toHaveText(OPEN_ACCOUNT.fullName);

    await openMenu(page, '[data-testid="account-switcher"]');

    await expect(menu(page)).toContainText(OPEN_ACCOUNT.fullName);
    await expect(menu(page)).toContainText(OPEN_ACCOUNT.orgName);
    // Exactly one, so an entry added back as a second link fails here rather than silently
    // re-offering an account the endpoint would refuse anyway.
    await expect(menu(page).getByRole("link")).toHaveCount(1);
    await expect(menu(page).getByRole("link")).toHaveAttribute("href", "/sign-in");
    await expect(menu(page).getByRole("link")).toHaveText("Add another account");
  });

  test("holds no form: nothing in the header posts, and nothing in it switches", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
    await page.goto(`/${SLUG}/people?sort=cost`);
    await openMenu(page, '[data-testid="account-switcher"]');

    // The form was the mechanism of the old R-A5. Its absence in the *served document* is the
    // claim: a component test proves what the component renders, not what the layout ships.
    await expect(menu(page).locator("form")).toHaveCount(0);
    await expect(menu(page).getByRole("button")).toHaveCount(0);
    await expect(page.locator("header form")).toHaveCount(0);
    await expect(menu(page)).not.toHaveText(/switch|restricted|contractor|fewer rows/i);
  });

  test("the link lands on /sign-in, which still has one form and one submit", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
    await page.goto(`/${SLUG}/people?sort=cost`);
    await openMenu(page, '[data-testid="account-switcher"]');

    await menu(page).getByRole("link").click();

    await expect(page).toHaveURL(/\/sign-in$/);
    // A session already exists and the page renders anyway: no redirect logic was added, and
    // the demo action simply re-issues the open account.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await expect(page.locator("main form")).toHaveCount(1);
    await expect(page.locator("main button[type=submit]")).toHaveCount(1);
  });

  // R-A8, restated for the world ticket 61 leaves behind: the switcher is still the one thing
  // in the header that differs between accounts, and it still differs only in what it *says*.
  test("the restricted account is offered the same one link, under its own name", async ({
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

    await expect(page.getByTestId("viewer")).toHaveText(RESTRICTED_ACCOUNT.fullName);

    await openMenu(page, '[data-testid="account-switcher"]');

    await expect(menu(page)).toContainText(RESTRICTED_ACCOUNT.fullName);
    await expect(menu(page).getByRole("link")).toHaveCount(1);
    await expect(menu(page).getByRole("link")).toHaveAttribute("href", "/sign-in");
    await expect(menu(page).locator("form")).toHaveCount(0);
  });
});

/**
 * **T-E12 — the controls stand where R-C6 put them, and the URLs did not move with them.**
 *
 * The two halves are asserted together on purpose. Placement alone would pass against a
 * rearrangement that quietly renamed a parameter, and the parameter alone would pass against a
 * page that never moved the control at all. What the ticket promised is both at once: a toggle in
 * a panel header producing the URL the bar produced.
 *
 * **1440px is the width the requirement is stated at.** The global bar's five groups have to fit
 * one row there, which is the whole reason four of the nine moved out of it — so the row is
 * measured rather than eyeballed, against the height a single row of controls occupies.
 */
test.describe("T-E12 — global bar, panel-local toggles, and the nav (R-C6, R-N2)", () => {
  const WIDE = { width: 1440, height: 1000 };

  test.beforeEach(async ({ context, baseURL, page }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    await page.setViewportSize(WIDE);
  });

  const panel = (page: Page, name: string) => page.getByRole("region", { name });

  test("the global bar on /spend holds five groups, in one row at 1440", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);
    const bar = page.getByTestId("page-toolbar");

    await expect(bar.locator('[data-testid^="control-"]')).toHaveCount(5);
    for (const key of ["period", "grain", "subject", "repository", "workType"]) {
      await expect(bar.locator(`[data-testid="control-${key}"]`)).toHaveCount(1);
    }

    // One row: a second row of controls roughly doubles the bar, so the threshold sits between
    // the two rather than at a pixel the design has to hit.
    const box = await bar.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeLessThan(72);
  });

  test("each moved toggle is in the header of the panel that reads it", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);

    await expect(panel(page, "Cost per session").getByTestId("control-accepted")).toHaveCount(1);
    await expect(panel(page, "Total spend").getByTestId("control-perCapita")).toHaveCount(1);
    await expect(panel(page, "Cost by Repository").getByTestId("control-perCapita")).toHaveCount(1);
    await expect(panel(page, "Model mix").getByTestId("control-modelLevel")).toHaveCount(1);
    // ...and nowhere else: the bar is the place these four are no longer.
    const bar = page.getByTestId("page-toolbar");
    for (const key of ["accepted", "perCapita", "modelLevel"]) {
      await expect(bar.locator(`[data-testid="control-${key}"]`)).toHaveCount(0);
    }
  });

  test("the URL after a toggle click is the URL it was before the move", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);

    await panel(page, "Total spend").getByRole("link", { name: "Per capita" }).click();
    await expect(page).toHaveURL(`/${SLUG}/spend?per_capita=1`);

    await page.goto(`/${SLUG}/spend`);
    await panel(page, "Cost per session").getByRole("link", { name: "Accepted", exact: true }).click();
    await expect(page).toHaveURL(`/${SLUG}/spend?accepted=accepted`);

    await page.goto(`/${SLUG}/spend`);
    await panel(page, "Model mix").getByRole("link", { name: "Tier" }).click();
    await expect(page).toHaveURL(`/${SLUG}/spend?model_level=tier`);
  });

  test("a toggle reaching two panels renders on both, bound to one parameter", async ({ page }) => {
    await page.goto(`/${SLUG}/work`);
    const onAcceptance = panel(page, "Acceptance rate by template").getByTestId(
      "control-executionMode",
    );
    const onDuration = panel(page, "Session duration").getByTestId("control-executionMode");
    await expect(onAcceptance).toHaveCount(1);
    await expect(onDuration).toHaveCount(1);

    await onDuration.getByText("Mode", { exact: true }).click();
    await onDuration.getByRole("link", { name: "Headless" }).click();

    await expect(page).toHaveURL(`/${SLUG}/work?execution_mode=headless`);
    // One parameter, so the copy in the other panel's header moved with it.
    await expect(onAcceptance).toContainText("Headless");
  });

  test("the nav has six links and no overflow button (R-N2)", async ({ page }) => {
    for (const path of ["", "/spend", "/history", "/projection"]) {
      await page.goto(`/${SLUG}${path}`);
      const sections = page.getByRole("navigation", { name: "Sections" });

      await expect(sections.getByRole("link")).toHaveCount(6);
      await expect(sections.getByRole("button")).toHaveCount(0);
      await expect(sections).not.toContainText("⋯");
      for (const label of ["Summary", "Spend", "Work", "People", "History", "Projection"]) {
        await expect(sections.getByRole("link", { name: label })).toBeVisible();
      }
    }
  });

  test("the page heading carries the active-filter sentence (R-C7)", async ({ page }) => {
    await page.goto(`/${SLUG}/spend`);
    await expect(page.getByTestId("active-filters")).toHaveText(
      "Week aggregation · per Organisation · all repositories · all templates",
    );

    await page.goto(`/${SLUG}/spend?subject=team&grain=month`);
    await expect(page.getByTestId("active-filters")).toHaveText(
      "Month aggregation · per Team · all repositories · all templates",
    );
  });

  /**
   * **Ticket 63 — the two controls read in the reader's words, and the URL is untouched.**
   *
   * `grain` and `subject` are this program's words for them; "Aggregation" and "Per" are the
   * words an engineering manager reading a spend chart would use. The parameters are asserted in
   * the same test as the labels, because a relabelling that also renamed a parameter would break
   * every share link cut before it — which is the constraint T-C14 states and the only way this
   * change could do damage.
   */
  test("Grain reads Aggregation and Subject reads Per, on the same parameters", async ({ page }) => {
    for (const path of ["/spend", "/work"]) {
      await page.goto(`/${SLUG}${path}`);
      const bar = page.getByTestId("page-toolbar");

      await expect(bar.getByRole("group", { name: "Aggregation" })).toHaveCount(1);
      await expect(bar.getByRole("group", { name: "Per" })).toHaveCount(1);
      await expect(bar.getByRole("group", { name: "Grain" })).toHaveCount(0);
      await expect(bar.getByRole("group", { name: "Subject" })).toHaveCount(0);
      // The Per strip offers the Member dimension's three roll-ups, in `ROLLUP_LEVELS` order —
      // finest first — and in the product's spelling.
      await expect(bar.getByTestId("control-subject").getByRole("link")).toHaveText([
        "Member",
        "Team",
        "Organisation",
      ]);
    }

    // The literal URLs, unchanged from before the relabelling (T-C14).
    await page.goto(`/${SLUG}/spend`);
    await page.getByTestId("control-grain").getByRole("link", { name: "Month" }).click();
    await expect(page).toHaveURL(`/${SLUG}/spend?grain=month`);

    await page.goto(`/${SLUG}/spend`);
    await page.getByTestId("control-subject").getByRole("link", { name: "Team" }).click();
    await expect(page).toHaveURL(`/${SLUG}/spend?subject=team`);
  });
});

/**
 * **T-E13 — `/demo/history` applies its date range on change** (R-N20).
 *
 * The Apply button is gone, and the claim it leaves behind is only checkable in a browser: the
 * unit layer can prove the form asks to submit (`auto-submit-form.test.tsx`), and only this can
 * prove the browser answered, wrote the query string and re-rendered the table over the narrower
 * range. The carried filter is asserted in the same navigation, because a `GET` form replaces the
 * query string wholesale and dropping the other parameters is the way this feature breaks.
 */
test.describe("T-E13 — the history date range applies on change (R-N20)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("changing a date navigates, with no Apply click", async ({ page }) => {
    await page.goto(`/${SLUG}/history`);
    await expect(page.getByRole("button", { name: "Apply" })).toHaveCount(0);

    // `exact`, because `/demo/history`'s expander buttons are labelled "…for session owner/repo#n"
    // and a substring match on "To" finds every one of them.
    await page.getByLabel("From", { exact: true }).fill("2026-08-01");

    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-08-01");
  });

  test("keeps the page's other filters across the change", async ({ page }) => {
    await page.goto(`/${SLUG}/history?work_type=bugfix`);

    await page.getByLabel("To", { exact: true }).fill("2026-08-31");

    await expect(page).toHaveURL(/to=2026-08-31/);
    await expect(page).toHaveURL(/work_type=bugfix/);
  });
});

/**
 * **R-N3.1 — the bar is on every surface, and it offers no control a page's panels cannot use.**
 *
 * This block used to assert the bar was *absent* on `/demo/projection`, on R-N3's argument that
 * an empty toolbar promises controls that never arrive. Ticket 45 put the as-of stamp in the bar,
 * so the bar there is no longer empty — and a freshness claim standing on five surfaces out of
 * six would read as the sixth being stale. The half of R-N3 that mattered is asserted instead,
 * and asserted more sharply than before: `/demo/projection` renders the bar **and no control in
 * it**, which is R-C1's ban read at the page that declares nothing.
 */
test.describe("R-N3.1 — every surface has the bar; the one with no controls shows none", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("every page has a toolbar, and /projection's holds no control", async ({ page }) => {
    for (const path of ["", "/spend", "/work", "/people", "/history"]) {
      await page.goto(`/${SLUG}${path}`);
      await expect(page.getByTestId("page-toolbar")).toHaveCount(1);
      await expect(
        page.getByTestId("page-toolbar").locator('[data-testid^="control-"]'),
      ).not.toHaveCount(0);
    }

    await page.goto(`/${SLUG}/projection`);
    await expect(page.getByTestId("page-toolbar")).toHaveCount(1);
    await expect(page.getByTestId("page-toolbar").locator('[data-testid^="control-"]')).toHaveCount(
      0,
    );
  });
});
