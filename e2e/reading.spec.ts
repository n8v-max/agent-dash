// **What the page says, on the served document** — two claims from ticket 45, both of which are
// about the whole surface rather than about any one component.
//
// **T-E15 — the as-of stamp** (R-N3.1, A39). Every layer below proves a piece: the domain layer
// decides which session is the dataset's edge, `clock.ts` prints it in the Organization's
// timezone, and the toolbar renders it. None of them proves the same string reaches all six
// surfaces, and none of them proves the claim is *checkable* — that the instant on the bar is the
// one at the top of `/demo/history`, which is the page a reader would go to to check it.
//
// **T-E16 — one sentence per panel** (R-V14, A38). The rule is stated at the panel, so it is
// asserted at the panel: every panel region on the two panelled pages carries at most one visible
// paragraph above its chart, and the argument that used to sit beside it is in the panel's own
// "Why this number" disclosure. Both halves are needed — "at most one paragraph" passes against a
// product that deleted the other three, which is the failure R-V14 exists to forbid.

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/** R-N1's six authenticated surfaces, as paths under the Organization slug. */
const ROUTES = ["", "/spend", "/work", "/people", "/history", "/projection"] as const;

const stamp = (page: Page) => page.getByTestId("data-as-of");

test.describe("T-E15 — the as-of stamp stands on every surface (R-N3.1, A39)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
  });

  test("names the same instant on all six routes, in the global bar", async ({ page }) => {
    const seen: string[] = [];

    for (const path of ROUTES) {
      await page.goto(`/${SLUG}${path}`);
      // In the bar, not merely on the page: the stamp is chrome for the surface, and R-N3.1 is
      // what makes the bar present on `/demo/projection` at all.
      const inBar = page.getByTestId("page-toolbar").getByTestId("data-as-of");
      await expect(inBar).toBeVisible();
      await expect(inBar).toHaveText(/^Data to \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      seen.push((await inBar.textContent()) ?? "");
    }

    expect(seen).toHaveLength(ROUTES.length);
    expect(new Set(seen).size).toBe(1);
  });

  test("matches the History page's top row, by instant and by session", async ({ page }) => {
    await page.goto(`/${SLUG}/history`);

    const label = ((await stamp(page).textContent()) ?? "").replace("Data to ", "");
    const top = page.locator("tbody tr[data-session]").first();

    // The instant. `/demo/history` is newest first by default (R-N20) and its Started column is
    // the Organization's timezone (R-N19), so the stamp and the cell are the same string or the
    // stamp is describing a dataset the table is not showing.
    await expect(top.getByRole("cell").nth(1)).toHaveText(label);
    // And the row: the stamp carries the id of the session it was read off, so this is an
    // identity rather than two formatters agreeing by luck.
    const named = await stamp(page).getAttribute("data-session");
    expect(named).toMatch(/^ses_/);
    await expect(top).toHaveAttribute("data-session", named ?? "");
  });

  test("does not move when a filter narrows the page", async ({ page }) => {
    // The stamp is the *dataset's* edge, not the selection's. A stamp that tracked the filtered
    // rows would answer "when did this selection stop" — which is a different question, and one
    // the period control already answers.
    await page.goto(`/${SLUG}/spend`);
    const bare = await stamp(page).textContent();

    await page.goto(`/${SLUG}/spend?period=2026-05&grain=month`);
    await expect(stamp(page)).toHaveText(bare ?? "");
  });

  test("says the same thing to an account that sees fewer rows", async ({
    page,
    context,
    baseURL,
  }) => {
    // How fresh the Organization's data is carries no cost, no name and no count, so it is not a
    // figure R-A6 gates. Both accounts are told the same thing about the same calendar.
    await page.goto(`/${SLUG}/spend`);
    const open = await stamp(page).textContent();

    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    await page.goto(`/${SLUG}/spend`);

    await expect(stamp(page)).toHaveText(open ?? "");
  });
});

test.describe("T-E16 — a panel states one sentence and folds the rest (R-V14, A38)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
  });

  /**
   * The panel's prose block — the one element R-V14 governs. Asserted through it rather than
   * over every `<p>` in the panel, because a panel's *figures* are paragraphs too: the acceptance
   * multiples print a rate and a denominator above each tile's sparkline, and neither is prose.
   */
  const prose = (page: Page) => page.getByTestId("panel-prose");

  /** The two panelled surfaces, each with a named panel whose prose is checked on its own. */
  const SURFACES = [
    { path: "/spend", panel: "Cost per completed Job" },
    { path: "/work", panel: "Session duration" },
  ] as const;

  for (const { path, panel: named } of SURFACES) {
    test(`${path} shows one visible paragraph in each panel's prose`, async ({ page }) => {
      await page.goto(`/${SLUG}${path}`);
      const blocks = prose(page);
      const count = await blocks.count();

      expect(count).toBeGreaterThan(3);
      for (let at = 0; at < count; at += 1) {
        await expect(blocks.nth(at).locator("p:visible")).toHaveCount(1);
      }
      // And one block per panel, named rather than counted over every region: `/demo/spend`'s
      // Adoption **section** is a region holding two panels, so a blanket per-region count would
      // be asserting something the layout does not claim.
      // `exact`, because "Cost per completed Job" is a prefix of the by-template panel beside it
      // and an accessible-name substring match would resolve to both.
      const panel = page.getByRole("region", { name: named, exact: true });
      await expect(panel.getByTestId("panel-prose")).toHaveCount(1);
      // The requirement said literally: at most one visible paragraph before the chart. It holds
      // over the whole panel here — its figures are a `<dl>`, so the lead sentence is the only
      // `<p>` the panel renders at all.
      await expect(panel.locator("p:visible")).toHaveCount(1);
    });

    test(`${path} keeps the argument, one click behind "Why this number"`, async ({ page }) => {
      await page.goto(`/${SLUG}${path}`);
      const disclosures = prose(page).locator("details");

      // The affordance exists, on most panels rather than on one.
      expect(await disclosures.count()).toBeGreaterThan(2);

      const first = disclosures.first();
      const folded = first.locator("p");
      await expect(first.getByText("Why this number")).toBeVisible();
      await expect(folded).toBeHidden();

      await first.getByText("Why this number").click();
      await expect(folded).toBeVisible();
      // The folded half is the argument, not a stub: a fold that shortened one shows up here.
      expect(((await folded.textContent()) ?? "").length).toBeGreaterThan(40);
    });
  }
});
