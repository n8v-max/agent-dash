// **R-M18 — a ratio with a zero denominator is an absence on the page, not a zero** (ticket 40).
//
// The rule is one expression in `src/domain/ratio.ts` and is proved there, and its two rendering
// consequences are proved in the component layer: the mirror prints an em dash
// (`chart-frame.test.tsx`) and the marks carry `connectNulls={false}` (`chart-shapes.test.tsx`).
// What no other layer can prove is that the absence **survives the whole stack** — permission
// filter, week bucketing, the metric module, the ViewModel, the RSC boundary and the renderer —
// and arrives on a running page as a dash rather than as `$0.00`.
//
// **The restricted account at week grain, narrowed to one Repository, is the case the ticket
// names** — and it is real data rather than a constructed one. Ticket 40 found six bare weeks in
// the account's whole calendar; ticket 66's volume filled every one of them, because a Member
// running one to nine sessions a workday finishes something most weeks. What the same data still
// supplies, and supplies more sharply, is the *narrowed* reading a viewer actually reaches for:
// this account's `terraform-infra` work, where several weeks complete nothing and some of those
// cost real money. `?repository=` is a control this page offers (R-C1), so the case is a page a
// reader can land on rather than a URL invented for a test.
//
// **Which weeks those are is derived from the committed rows** (ticket 67). It was a written-down
// list of nine week labels, and every fixture regeneration made it a list to re-type — a literal
// that is re-typed on each change has stopped checking anything. The derivation below picks the
// weeks out of the same rows the page reads, and a control case asserts that all three
// populations are non-empty so the file cannot pass over an empty loop.
//
// The assertion is over the **R-X1 mirror**, for `testing-spec.md` P2's reason: it is the chart's
// claim in queryable DOM, so this asserts chart *output* with no SVG parsing. The chart beside it
// makes the same claim by breaking its line, which is not assertable here and does not need to be.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { civilDayIn, orgTimezone, periodKeysOf, visibleSessions } from "./support/fixture";
import { RESTRICTED_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = RESTRICTED_ACCOUNT.orgSlug;

/** R-X1's em dash, exactly as `table-mirror.tsx` spells it. */
const NO_READING = "—";

/** The selection: this account's `terraform-infra` work, by week (R-C1's Repository filter). */
const NARROWED = "?grain=week&repository=repo_terraform_infra";
const NARROWED_TO = "repo_terraform_infra";

/**
 * **The three populations, read off the committed rows rather than written down** (ticket 67).
 *
 * Which weeks of this selection finish nothing is a property of the fixture and moves whenever
 * the fixture does — ticket 66 filled the six bare weeks ticket 40 found, and ticket 67 moved
 * them again by changing what the sessions in them are. What does *not* move is the shape of the
 * case: some weeks of the selection hold rows and finish nothing, some hold no rows at all, and
 * some finish something. Naming the weeks made this file a list to re-type; deriving them makes
 * it a claim about the page.
 */
const weeklyReadings = (): {
  spentAndUnfinished: readonly string[];
  empty: readonly string[];
  drawn: string;
} => {
  const civilDayOf = civilDayIn(orgTimezone());
  const weekOf = (instant: string): string =>
    periodKeysOf(civilDayOf(instant)).find((key) => key.includes("-W")) ?? "";
  const held = new Map<string, { cost: number; completed: Set<string>; tasks: Set<string> }>();
  for (const row of visibleSessions()) {
    if (row.member_id !== RESTRICTED_ACCOUNT.memberId) continue;
    if (row.repository_id !== NARROWED_TO) continue;
    const week = weekOf(row.started_at);
    const bucket = held.get(week) ?? { cost: 0, completed: new Set(), tasks: new Set() };
    bucket.cost += row.cost;
    bucket.tasks.add(row.task_key);
    if (row.accepted) bucket.completed.add(row.task_key);
    held.set(week, bucket);
  }
  const worked = [...held.keys()].toSorted();
  const numberOf = (key: string): number => Number(key.slice(key.indexOf("-W") + 2));
  const label = (key: string): string => `Week ${numberOf(key)}, ${key.slice(0, 4)}`;
  const first = numberOf(worked[0]);
  const last = numberOf(worked[worked.length - 1]);
  const rendered = Array.from({ length: last - first + 1 }, (_, at) => `2026-W${first + at}`);
  return {
    spentAndUnfinished: worked
      .filter((key) => (held.get(key)?.completed.size ?? 0) === 0)
      .map(label),
    empty: rendered.filter((key) => !held.has(key)).map(label),
    drawn: label(worked.find((key) => (held.get(key)?.completed.size ?? 0) > 0) ?? ""),
  };
};

const WEEKS = weeklyReadings();

/**
 * The weeks of that selection that hold **real spend** and still finish nothing. They are the
 * sharp half of R-M18: a bucket with no rows at all has an obvious absence, and a bucket the
 * viewer paid for does not.
 */
const SPENT_AND_UNFINISHED = WEEKS.spentAndUnfinished;

/** The weeks inside the same span with no rows at all — the easy half, asserted beside it. */
const EMPTY_WEEKS = WEEKS.empty;

/** A week the same selection *did* finish work in, so a page of dashes cannot pass this file. */
const DRAWN_WEEK = WEEKS.drawn;

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

  test("the selection holds all three populations — the control for the three cases below", () => {
    // Without this the derivations above could all be empty and every case would pass over an
    // empty loop. P6, applied to a spec that reads the fixture to know what to look for.
    expect(SPENT_AND_UNFINISHED.length).toBeGreaterThan(0);
    expect(EMPTY_WEEKS.length).toBeGreaterThan(0);
    expect(DRAWN_WEEK).toMatch(/^Week \d+, 2026$/);
    expect(SPENT_AND_UNFINISHED).not.toContain(DRAWN_WEEK);
    expect(EMPTY_WEEKS).not.toContain(DRAWN_WEEK);
  });

  test("the mirror holds a dash in a week that was paid for and finished nothing", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/spend${NARROWED}`);

    for (const week of SPENT_AND_UNFINISHED) {
      await expect(weekRow(page, week).getByRole("cell")).toHaveText(NO_READING);
    }
  });

  test("and in every week of the same span the account ran nothing in", async ({ page }) => {
    await page.goto(`/${SLUG}/spend${NARROWED}`);

    for (const week of EMPTY_WEEKS) {
      await expect(weekRow(page, week).getByRole("cell")).toHaveText(NO_READING);
    }
  });

  test("while a week that finished something still carries its figure", async ({ page }) => {
    await page.goto(`/${SLUG}/spend${NARROWED}`);

    // Without this the file would pass against a panel that rendered nothing at all.
    await expect(weekRow(page, DRAWN_WEEK).getByRole("cell")).toHaveText(/^[\d,]+(\.\d+)?$/);
  });

  test("no bucket of this chart reads zero — a finished Job cannot have cost nothing", async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/spend${NARROWED}`);

    const cells = await costPerJobMirror(page).getByRole("cell").allTextContents();

    expect(cells.length).toBeGreaterThan(EMPTY_WEEKS.length);
    expect(cells).toContain(NO_READING);
    expect(cells).not.toContain("0");
  });
});
