// **T-E7 — `/demo` renders four tiles and nothing else**, each linking to its evidence page
// (A1, A2, and the summary's half of A24).
//
// It is the one E2E test about layout, and it is at this layer for a reason the other structural
// claims are not: **"nothing else" is a claim about the whole document**. A component test proves
// that `SummaryTiles` renders four tiles; only the running route proves that nothing *besides*
// `SummaryTiles` reached the page — no fifth panel, no link row under the tiles (R-N5 folds that
// row into the tiles themselves), no second chart. So the assertions below are counts over
// `<main>`, and they are deliberately exact: an extra panel almost certainly brings a link, a
// heading, a list or a table with it, and every one of those is pinned here.
//
// **A2 — month only.** `/demo` declares one control (R-C1, R-N6) and the values it offers are
// months and the whole window. `quarter` was dropped in `spec.md` § 11 C7: it never entered the
// glossary and over the 150-day window it yields two buckets, both partial. This asserts both
// halves — that nothing on the surface offers one, and that asking for one in the URL does not
// produce one either (R-T26: an unknown token is dropped and the default stands).

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/** R-N4's four tiles, in the order they make the argument. */
const TILE_TITLES = [
  "Total spend",
  "Completed Jobs",
  "Cost per completed Job",
  "Completed Jobs by template",
];

/** R-N5 — where each tile's evidence lives. Two pages, four tiles. */
const EVIDENCE = [`/${SLUG}/spend`, `/${SLUG}/work`, `/${SLUG}/spend`, `/${SLUG}/work`];

const main = (page: Page) => page.getByRole("main");
const toolbar = (page: Page) => page.getByTestId("page-toolbar");
const periodMenu = (page: Page) => toolbar(page).locator('[data-testid="control-period"]');

test.describe("T-E7 — /demo is four tiles and nothing else (A1, A2, A24)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
  });

  test("renders exactly four tiles", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    await expect(main(page).getByRole("listitem")).toHaveCount(4);
    await expect(main(page).getByRole("listitem").locator("h2")).toHaveText(TILE_TITLES);
  });

  test("each tile is itself the link to the page carrying its evidence (R-N5)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    const links = main(page).getByRole("link");

    await expect(links).toHaveCount(4);
    await expect(links).toHaveText(TILE_TITLES);
    expect(await links.evaluateAll((held) => held.map((link) => link.getAttribute("href")))).toEqual(
      EVIDENCE,
    );
  });

  test("following a tile lands on its evidence page", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    await main(page).getByRole("link", { name: "Cost per completed Job" }).click();

    await expect(page).toHaveURL(`/${SLUG}/spend`);
  });

  // The structural claim. Everything a panel brings with it is counted, so a fifth panel — or the
  // separate link row R-N5 folded into the tiles — cannot arrive unnoticed.
  test("carries nothing else: one list, one chart, and no panel below the tiles", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    // One list, and every item in it is a tile.
    await expect(main(page).getByRole("list")).toHaveCount(1);
    // The page heading plus one per tile. A panel heading would be a sixth.
    await expect(main(page).getByRole("heading")).toHaveCount(1 + TILE_TITLES.length);
    // Exactly one chart (R-N8's, in the fourth tile), hence exactly one R-X1 mirror.
    await expect(main(page).getByRole("group", { name: /grouped by/ })).toHaveCount(1);
    await expect(main(page).locator("table")).toHaveCount(1);
    // R-N5 — the tiles do both jobs, so there is no other link anywhere below them.
    await expect(main(page).getByRole("link")).toHaveCount(4);
  });

  test("the fourth tile is the WorkType mix, stacked and unlabelled at tile size (R-N8)", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}`);

    const mix = main(page).getByRole("group", { name: /grouped by WorkType/ });
    await expect(mix).toHaveCount(1);

    // All five WorkTypes and no "Other" — the cap engages only above five (R-V4).
    const columns = mix.locator("table thead th");
    await expect(columns).toHaveCount(6);
    await expect(columns.filter({ hasText: "Other" })).toHaveCount(0);

    // R-N8 — no axis labels at tile size. Recharts 3 puts every tick label in its own layer,
    // one per axis, and the assertion is over those layers' computed `display`: neither
    // Playwright's visibility heuristics nor `Element.checkVisibility()` reports an SVG `<text>`
    // as hidden when it is an unrendered descendant of a `display: none` ancestor — both say
    // "visible" for a node whose bounding box is 0×0. The count above zero is what keeps this
    // from passing on a selector that matches nothing at all.
    const axisLabels = await mix
      .locator(".recharts-cartesian-axis-tick-labels")
      .evaluateAll((held) => held.map((layer) => window.getComputedStyle(layer).display));

    expect(axisLabels.length).toBeGreaterThan(0);
    expect(axisLabels.filter((display) => display !== "none")).toEqual([]);
  });

  test("offers month and nothing else; no quarter is reachable (A2)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    // R-C1 — the page declares one control, and a control it does not declare is absent, never
    // greyed. No grain control means no day and no week, and so no sub-monthly Total spend (A25).
    await expect(toolbar(page).locator('[data-testid^="control-"]')).toHaveCount(1);
    await expect(periodMenu(page)).toHaveCount(1);

    await periodMenu(page).locator("summary").click();
    const offered = await periodMenu(page).getByRole("link").allTextContents();

    expect(offered.length).toBeGreaterThan(1);
    expect(offered.filter((label) => !/^(All data|[A-Z][a-z]+ \d{4})$/.test(label))).toEqual([]);
    expect(offered.filter((label) => /quarter|\bQ[1-4]\b/i.test(label))).toEqual([]);
  });

  // R-N6 read from the page rather than from the control: the surface reports one month, and
  // R-E2 flags it rather than withholding or pro-rating it. The clock is clamped to the window's
  // last day, so the reported month is September for as long as the fixture is the fixture.
  test("reports a single month, flagged as unfinished (R-N6, R-E2)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    await expect(page.getByTestId("summary-period")).toHaveText(/^Sep 2026Partial month/);
  });

  test("a quarter asked for in the URL is dropped, not rendered (A2, R-T26)", async ({ page }) => {
    await page.goto(`/${SLUG}?period=2026-Q3`);

    // The token names no period the glossary defines, so the page default stands and the surface
    // is the one a bare route renders (R-C4).
    await expect(periodMenu(page).locator("summary")).toHaveText(/^PeriodAll data/);
    await expect(main(page).getByRole("listitem")).toHaveCount(4);
  });

  // A24's summary half: the surface carries no ordering at all, so it cannot default to one.
  test("declares no sort, so no surface here defaults to sort-by-cost (A24)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    await expect(toolbar(page).locator('[data-testid="control-sort"]')).toHaveCount(0);
    expect(
      await main(page)
        .getByRole("link")
        .evaluateAll((held) => held.map((link) => link.getAttribute("href") ?? "")),
    ).toEqual(EVIDENCE);
  });
});
