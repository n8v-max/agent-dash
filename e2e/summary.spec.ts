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
// **the fixture's months, and nothing else** (ticket 39): no whole window, because every figure
// on the page is a month against the month before, and no `quarter` — dropped in `spec.md` § 11
// C7, having never entered the glossary and yielding two partial buckets over a 150-day window.
// This asserts both halves — that nothing on the surface offers either, and that asking for one
// in the URL does not produce one either (R-T26: an unknown token is dropped, the default stands).

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

/**
 * R-N4's four tiles, in the order they make the argument — the breakdown **third**, beside the
 * count it breaks down (ticket 39), and the ratio last, where the sentence ends.
 */
const TILE_TITLES = [
  "Total spend",
  "Completed Jobs",
  "Completed Jobs by template",
  "Cost per completed Job",
];

/** R-N5 — where each tile's evidence lives. Two pages, four tiles. */
const EVIDENCE = [`/${SLUG}/spend`, `/${SLUG}/work`, `/${SLUG}/work`, `/${SLUG}/spend`];

/** A finished month, and the only kind that carries a change figure at all (C13). */
const WHOLE_MONTH = "?period=2026-08";

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
    // Exactly one chart (R-N8's, in the breakdown tile), hence exactly one R-X1 mirror.
    await expect(main(page).getByRole("group", { name: /grouped by/ })).toHaveCount(1);
    await expect(main(page).locator("table")).toHaveCount(1);
    // R-N5 — the tiles do both jobs, so there is no other link anywhere below them.
    await expect(main(page).getByRole("link")).toHaveCount(4);
  });

  test("the breakdown tile is the WorkType mix, with no axis at tile size (R-N8, C11)", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}`);

    const mix = main(page).getByRole("group", { name: /grouped by WorkType/ });
    await expect(mix).toHaveCount(1);

    // All five WorkTypes and no "Other" — the cap engages only above five (R-V4).
    const columns = mix.locator("table thead th");
    await expect(columns).toHaveCount(6);
    await expect(columns.filter({ hasText: "Other" })).toHaveCount(0);

    // C11 — one bucket, the reported month. The tile was a time series over every month in the
    // range; narrowing it to one bucket is what makes R-V5's ranking the bars' sorted order.
    await expect(mix.locator("table tbody tr")).toHaveCount(1);

    // R-N8 — **no axis at tile size**, and none drawn rather than one hidden with CSS. The
    // difference is layout: a rendered-but-invisible axis keeps its reserved width, which was a
    // third of the card at 1440 and half of it at 390, and the bars had what was left. The grid
    // goes with it — a dashed grid against no scale is a texture, not a reading aid.
    await expect(mix.locator(".recharts-cartesian-axis")).toHaveCount(0);
    await expect(mix.locator(".recharts-cartesian-grid")).toHaveCount(0);

    // …and the panels that *do* carry a scale still carry one, so this is a decision about a
    // tile rather than a rule the product acquired by accident.
    await page.goto(`/${SLUG}/work`);
    await expect(
      page.getByRole("main").locator(".recharts-cartesian-axis").first(),
    ).toBeAttached();
  });

  /**
   * Ticket 39 — the tile has to *read*, and at the narrow breakpoint as well as the wide one.
   *
   * With no axis, the value on the bar is the only figure on the picture, so the claim is five
   * bars and five labels — at 1440 where the tile is two columns of a five-column grid, and at
   * 390 where it is the whole width of a phone. Asserted at both, because the failure mode is
   * a label drawn past the plot's edge and clipped, and that only happens at one of them.
   */
  test("shows five labelled bars, at 1440 and at 390 (R-N8)", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${SLUG}`);

      const mixTile = main(page)
        .getByRole("listitem")
        .filter({ hasText: "Completed Jobs by template" });

      await expect(mixTile.locator(".recharts-bar-rectangle")).toHaveCount(5);

      const labels = mixTile.locator(".recharts-label-list text");
      await expect(labels).toHaveCount(5);

      // Inside the card, not spilling out of it: a label past the right edge of the plot is
      // drawn into the margin, and without room for it the longest bar loses its figure.
      const card = await mixTile.boundingBox();
      const drawn = await labels.evaluateAll((held) =>
        held.map((label) => label.getBoundingClientRect()),
      );
      expect(drawn).toHaveLength(5);
      for (const box of drawn) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.right).toBeLessThanOrEqual((card?.x ?? 0) + (card?.width ?? 0));
      }
    }
  });

  test("the mix tile carries no figure of its own, and does not stack (C11)", async ({ page }) => {
    // Over a *finished* month: on the month in progress every change is withheld (C13), and a
    // page carrying no percentages at all would satisfy the first assertion vacuously.
    await page.goto(`/${SLUG}${WHOLE_MONTH}`);

    const tiles = main(page).getByRole("listitem");
    const mixTile = tiles.filter({ hasText: "Completed Jobs by template" });

    // Three change figures, not four. The mix tile was built from the Completed Jobs tile's own
    // reading, so `/demo` printed one number and one delta twice, side by side.
    await expect(tiles.filter({ hasText: /%/ })).toHaveCount(3);
    await expect(mixTile).not.toHaveText(/%/);

    // Unstacked, asserted as geometry rather than as a class name: in a horizontal bar chart
    // every unstacked bar starts at the axis, so they share one `x`. Stacked, each would begin
    // where the last ended, and there would be five different values here.
    const bars = mixTile.locator(".recharts-bar-rectangle path");

    // `evaluateAll` does not auto-wait — it returns whatever matches at the instant it runs, so
    // on a slow first paint it reads an empty list and the geometry claim below passes over
    // nothing. The count is the gate that makes the measurement deterministic, and it is the
    // same gate the labelled-bars test above puts in front of its own `evaluateAll`.
    await expect(bars).toHaveCount(5);

    const barStarts = await bars.evaluateAll((held) =>
      held.map((bar) => Math.round(bar.getBoundingClientRect().left)),
    );

    expect(barStarts).toHaveLength(5);
    expect(new Set(barStarts).size).toBe(1);
  });

  test("offers month and nothing else; no quarter is reachable (A2)", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    // R-C1 — the page declares one control, and a control it does not declare is absent, never
    // greyed. No grain control means no day and no week, and so no sub-monthly Total spend (A25).
    await expect(toolbar(page).locator('[data-testid^="control-"]')).toHaveCount(1);
    await expect(periodMenu(page)).toHaveCount(1);

    await periodMenu(page).locator("summary").click();
    const offered = periodMenu(page).getByRole("link");

    // The fixture's six months, newest first, and nothing else on the list: no whole window and
    // no period the committed data does not hold (ticket 39). Asserted as the whole list rather
    // than as a search through it, so an extra option fails here rather than passing unnoticed.
    await expect(offered).toHaveText([
      "September 2026",
      "August 2026",
      "July 2026",
      "June 2026",
      "May 2026",
      "April 2026",
    ]);
  });

  /**
   * Ticket 39 — "All data" is dropped **on this page only**, and a URL still carrying it is a
   * viewer's link rather than an error: the token names no period `/demo` offers, so the page
   * default stands (R-C4, R-T26). The other pages keep the option, which is asserted beside it
   * so that dropping it everywhere would fail here too.
   */
  test("drops a whole-window period, and opens on the current month instead", async ({ page }) => {
    for (const token of ["all", "window"]) {
      await page.goto(`/${SLUG}?period=${token}`);

      await expect(periodMenu(page).locator("summary")).toHaveText(/^PeriodSeptember 2026/);
      await expect(page.getByTestId("summary-period")).toHaveText(/^Sep 2026/);
      await expect(main(page).getByRole("listitem")).toHaveCount(4);
    }

    await page.goto(`/${SLUG}/spend?period=window`);
    await expect(page.getByTestId("control-period")).toHaveText(/^PeriodAll data/);
  });

  // R-N6 read from the page rather than from the control: the surface reports one month, and
  // R-E2 flags it rather than withholding or pro-rating it. The clock is clamped to the window's
  // last day, so the reported month is September for as long as the fixture is the fixture.
  /**
   * C12 — the defect that made the page's only control degrade it.
   *
   * Selecting a month clipped the range to a single bucket, leaving no prior month inside it, so
   * all four change figures suppressed at once. The comparison now reads outside the selected
   * window: August is compared with July whether or not July is in view.
   */
  test("keeps its change figures when a single month is selected (C12)", async ({ page }) => {
    await page.goto(`/${SLUG}?period=2026-08`);

    const tiles = main(page).getByRole("listitem");

    await expect(page.getByTestId("summary-period")).toHaveText(/^Aug 2026/);
    await expect(tiles.filter({ hasText: /%/ })).toHaveCount(3);
    // The words the suppression would have printed, on none of them.
    await expect(main(page)).not.toHaveText(/no prior period to compare against/);
  });

  /**
   * C13 — and the limit of C12. May's baseline is April, which the fixture's window clips, so a
   * whole May against half an April would report a rise the data does not contain. It suppresses,
   * and says which month was unfinished rather than saying nothing.
   */
  test("withholds the change where the baseline month is unfinished (C13)", async ({ page }) => {
    await page.goto(`/${SLUG}?period=2026-05`);

    await expect(page.getByTestId("summary-period")).toHaveText(/^May 2026/);
    await expect(main(page)).toHaveText(/2026-04 is unfinished/);
    await expect(main(page).getByRole("listitem").filter({ hasText: /%/ })).toHaveCount(0);
  });

  /**
   * C13 as ticket 39 amended it, read off the running page.
   *
   * The bare route opens on the current month, which the committed window leaves eight days
   * into: every tile carries R-E2's flag where its change figure would have been, and **no tile
   * carries a percentage**. Eight days against a whole August is the calendar rather than the
   * spend, and this page is the one graded for the ten-second read.
   */
  test("flags every tile and shows no change on the month in progress (C13, R-E2)", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}`);

    const tiles = main(page).getByRole("listitem");

    await expect(page.getByTestId("summary-period")).toHaveText(/^Sep 2026/);
    await expect(tiles.filter({ hasText: "Partial month" })).toHaveCount(4);
    await expect(tiles.filter({ hasText: /%/ })).toHaveCount(0);
    // The reason, once, above the row — not four times inside it.
    await expect(page.getByTestId("summary-period")).toHaveText(/unfinished/);
  });

  /**
   * The contrast case, and the one that stops the test above passing against a page that simply
   * lost its change figures. August is whole, July is whole, so the three figure tiles carry
   * three percentages — and the breakdown tile carries none, which is C11 and not an omission.
   */
  test("shows a change on every figure tile of a finished month (R-N7)", async ({ page }) => {
    await page.goto(`/${SLUG}${WHOLE_MONTH}`);

    const tiles = main(page).getByRole("listitem");

    await expect(page.getByTestId("summary-period")).toHaveText(/^Aug 2026/);
    await expect(tiles.filter({ hasText: "Partial month" })).toHaveCount(0);
    await expect(tiles.filter({ hasText: /%/ })).toHaveCount(3);
  });

  test("a quarter asked for in the URL is dropped, not rendered (A2, R-T26)", async ({ page }) => {
    await page.goto(`/${SLUG}?period=2026-Q3`);

    // The token names no period the glossary defines, so the page default stands and the surface
    // is the one a bare route renders (R-C4).
    await expect(periodMenu(page).locator("summary")).toHaveText(/^PeriodSeptember 2026/);
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
