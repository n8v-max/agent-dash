// **T-E20 — the Model mix is a closed roster drawn over time** (R-V7 as amended, R-D17, R-M7,
// ticket 70).
//
// Three layers below this one prove pieces of it and none of them proves the whole. `series.ts`
// decides that a palette is a cap; `viewmodel.ts` decides which palette a `model` grouping
// takes; `adoption.ts` decides that the measure is a share of a period's tokens. What only a
// running page can show is that **ten Models arrive in the legend** — that the amended cap
// survived the query, the RSC boundary, the panel's named shape and Recharts, and that no
// "Other" is folded out of a roster the reader is choosing between.
//
// **The figures are read off the R-X1 mirror** (`testing-spec.md` P2, T-C1): the mirror is the
// chart's own output as queryable DOM, so a share asserted here is the share the line was drawn
// at rather than an SVG coordinate parsed back into a number.
//
// The counts are derived from the committed `models.json`, not written down. Ticket 70 took the
// roster from seven to ten and the next roster edit will move it again; a literal here is a
// literal that has stopped checking anything.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { models } from "./support/fixture";
import { OPEN_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;

const ROSTER = models();
const EXACT = ROSTER.length;
const FAMILIES = new Set(ROSTER.map((model) => model.family)).size;
const TIERS = new Set(ROSTER.map((model) => model.tier)).size;

/** R-N9 panel 7, by the `aria-label` `chart-frame.tsx` builds from its roll-up level. */
const modelMix = (page: Page): Locator =>
  page.getByRole("group", { name: /^Model mix, grouped by Model/ });

const mirrorOf = (chart: Locator): Locator => chart.getByRole("table");

/** The legend's series names — one `role="img"` swatch per series (`chart-config.tsx`). */
const legendNames = async (chart: Locator): Promise<readonly string[]> => {
  // The legend is rendered by Recharts after the container has measured itself, so the first
  // swatch is the handle that says the chart has drawn. Without it a `goto` in a loop reads an
  // empty legend and the assertion fails on timing rather than on the roster.
  await expect(chart.getByRole("img").first()).toBeAttached();
  const labels = await chart.getByRole("img").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  return labels.map((label) => label.replace(/ legend icon$/u, ""));
};

test.describe("T-E20 — every Model on the roster reaches the legend (R-V7, ticket 70)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
  });

  test("lists all ten Models at the exact level, and folds none into Other", async ({ page }) => {
    await page.goto(`/${SLUG}/spend?model_level=exact`);

    const chart = modelMix(page);
    await expect(chart).toHaveCount(1);

    const names = await legendNames(chart);
    expect(names).toHaveLength(EXACT);
    expect(new Set(names).size).toBe(EXACT);
    expect(names).not.toContain("Other");
    // Every id on the committed roster, and nothing that is not on it.
    expect([...names].sort()).toEqual([...ROSTER.map((model) => model.id)].sort());
  });

  test("carries the roster's own count at each roll-up level", async ({ page }) => {
    for (const [level, expected] of [
      ["exact", EXACT],
      ["family", FAMILIES],
      ["tier", TIERS],
    ] as const) {
      await page.goto(`/${SLUG}/spend?model_level=${level}`);
      const names = await legendNames(modelMix(page));

      expect(names, level).toHaveLength(expected);
      expect(names, level).not.toContain("Other");
    }
  });

  test("draws lines and not stacked bars, because a share is not a part of a whole", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/spend?model_level=exact`);

    const chart = modelMix(page);
    // One line per Model, and no bar mark at all — the geometry this ticket replaced.
    await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(0);
    await expect(chart.locator(".recharts-line")).toHaveCount(EXACT);
  });
});

test.describe("T-E20 — the mix moves across the window (R-D17)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG }, baseURL ?? BASE);
  });

  /** Every reading in one mirror column, by its heading — an em dash is a bucket with none. */
  const columnOf = async (chart: Locator, heading: string): Promise<readonly number[]> => {
    const headings = await mirrorOf(chart).locator("thead th").allTextContents();
    const at = headings.indexOf(heading);
    expect(at, `mirror column ${heading}`).toBeGreaterThan(0);
    const cells = await mirrorOf(chart)
      .locator("tbody tr")
      .evaluateAll(
        (rows, index) =>
          rows.map((row) => row.querySelectorAll("th, td")[index]?.textContent ?? ""),
        at,
      );
    return cells.filter((cell) => /^-?\d/u.test(cell)).map(Number);
  };

  test("reads Claude Haiku down to a tenth of the tokens by September (R-D17)", async ({
    page,
  }) => {
    // Month grain, because R-D17 is a monthly claim and the page's own week buckets split
    // September into two. The control offers it (R-C4) and the URL is the whole gesture.
    await page.goto(`/${SLUG}/spend?model_level=exact&grain=month`);

    const chart = modelMix(page);
    const haiku = await columnOf(chart, "claude-haiku-4-5");

    expect(haiku.length).toBeGreaterThan(1);
    // The optimisation story R-D17 now tells: the cheap model stops being the default.
    expect(haiku.at(-1)).toBeLessThanOrEqual(12);
    expect(haiku[0]).toBeGreaterThan((haiku.at(-1) as number) + 10);
  });

  test("reads Claude Fable arriving from nothing, which is why frontier rises", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/spend?model_level=exact&grain=month`);

    const fable = await columnOf(modelMix(page), "claude-fable-5-1");

    expect(fable.length).toBeGreaterThan(1);
    expect(fable[0]).toBe(0);
    expect(fable.at(-1)).toBeGreaterThan(5);
  });
});
