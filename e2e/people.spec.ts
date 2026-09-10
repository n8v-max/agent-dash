// `/demo/people`, end to end — **T-E2**, **T-E2.1**, **A24** and R-N16/R-N17.
//
// **T-E8 is gone, and this is the record of why.** It asserted that the permission matrix renders
// for the open account and not the restricted one (A28), which R-A10 and `spec.md` § 11 C6
// contradicted in terms. The earlier version of this file wrote out the disagreement at length and
// left the deciding assertion unwritten, because a spec contradicting itself is a human decision.
//
// It was decided on 2026-09-09 as **C9**: the matrix does not ship at all. The disagreement was
// about the audience for a table that should not exist — a second information architecture,
// rendered to end users, explaining a mechanism the account switcher already demonstrates.
//
// **T-E2.1 replaces it** below, and it is a sharper test than either reading of T-E8: both
// accounts render a visibility sentence, the two sentences *differ*, and the restricted one
// carries no digits. That last assertion is C10's, not C9's — C10 took the aggregate off this
// page, and an explanation that quotes a count would put one back under another name.

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, ungrantedNames, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;
const PEOPLE = `/${SLUG}/people`;

/** The two accounts of R-A3, as session claims. Inlined at each call site: a named wrapper
 * around `useSession` reads to `react-hooks` as a custom hook, which it emphatically is not. */
const OPEN_CLAIMS = { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG };
const RESTRICTED_CLAIMS = { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: SLUG };

/** The People table's accessible name — its `<caption>`, which is `sr-only` but announced. */
const TABLE_NAME = "Members, with their Jobs, tokens and cost";

const peopleTable = (page: Page) => page.getByRole("table", { name: TABLE_NAME });
const peopleRows = (page: Page) => peopleTable(page).locator("tbody tr");

/**
 * R-A3's grants, written out here rather than imported from `src/domain/access.ts`.
 *
 * What a test *allows* must not be decided by the code it is checking — the same rule
 * `e2e/support/costs.ts` states for the cost search set. These four cells are `spec.md` § 2's
 * table, plus R-A3.1's universal `self` row, transcribed.
 */
test.describe("T-E2 — one row against twenty (A9, R-D18, C10)", () => {
  test("the open account is given all 20 Members, every one of them named", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);

    await expect(peopleRows(page)).toHaveCount(20);
    // Named, not merely counted: every row's Member cell is a link to that Member's profile
    // (R-N16), which only an identifying grant can produce. Scoped to the body, because the
    // sortable headings are links too (R-N15).
    await expect(peopleRows(page).getByRole("link")).toHaveCount(20);
    // C10 — no note under the table, for either account. Nobody reached the open account's
    // totals without being named, and the restricted account's aggregate is not restated here.
    await expect(page.getByText(/counted and not named/)).toHaveCount(0);
  });

  test("the restricted account names itself and nobody else", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);

    const body = (await peopleTable(page).textContent()) ?? "";

    // The sharp half of "different in kind", and it holds whatever shape the aggregate row
    // takes: exactly one Member is named here, and it is the viewer.
    expect(body).toContain(RESTRICTED_ACCOUNT.fullName);
    expect(ungrantedNames(RESTRICTED_ACCOUNT.memberId).filter((name) => body.includes(name))).toEqual(
      [],
    );

  });

  test("it receives exactly one row against twenty (C10)", async ({ page, context, baseURL }) => {
    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);

    // An exact count, where the earlier version of this test asserted a range of 1–2 because the
    // spec asked for a Team aggregate row the build had not produced. C10 decided against that
    // row: the grant is real and stays legible on `/demo/work` and `/demo/spend`, but an
    // aggregate beside a named row in one column set invites the subtraction R-M17 forbids.
    await expect(peopleRows(page)).toHaveCount(1);
  });
});

test.describe("A24 — no surface defaults to sort-by-cost (R-M15, R-N15)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
  });

  test("the bare route opens sorted by Completed Jobs, descending, and by nothing else", async ({
    page,
  }) => {
    await page.goto(PEOPLE);
    const headings = peopleTable(page).getByRole("columnheader");

    await expect(headings.filter({ hasText: "Completed Jobs" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    // The claim is exclusive: exactly one column is sorted, and it is not Cost.
    await expect(page.locator("th[aria-sort]")).toHaveCount(1);
    await expect(page.locator("th[aria-sort]")).toContainText("Completed Jobs");
  });

  test("the rows arrive in that order, highest output first", async ({ page }) => {
    await page.goto(PEOPLE);
    const completed = await peopleRows(page).locator("td:nth-child(4)").allTextContents();
    const figures = completed.map((text) => Number(text.replaceAll(",", "")));

    expect(figures).toEqual([...figures].sort((left, right) => right - left));
  });

  test("every numeric column offers a sort, and no ordering is editorialised (R-M15)", async ({
    page,
  }) => {
    await page.goto(PEOPLE);
    const headings = peopleTable(page).locator("th");

    for (const label of ["Completed Jobs", "Sessions", "Tokens", "Cost"]) {
      await expect(headings.filter({ hasText: label }).getByRole("link")).toHaveCount(1);
    }

    const text = (await page.locator("main").textContent()) ?? "";
    for (const editorial of [/percentile/i, /top spend/i, /leaderboard/i, /\brank(ed|ing)?\b/i]) {
      expect(text).not.toMatch(editorial);
    }
  });

  test("following a heading link re-sorts through the query string (R-C3, A19)", async ({
    page,
  }) => {
    await page.goto(PEOPLE);
    await peopleTable(page).locator("th").filter({ hasText: "Cost" }).getByRole("link").click();

    await expect(page).toHaveURL(/[?&]sort=-?cost/);
    await expect(page.locator("th[aria-sort]")).toContainText("Cost");
  });
});

/**
 * **Ticket 63 — what this page's controls are, and what they are not.**
 *
 * Three claims, and they are one decision seen from three sides:
 *
 *   * the **period is calendar months**, opening on the month `now` falls in. "All data" is a
 *     career total on a page whose every row is a Member *over the period*: it grows without
 *     bound and puts a Member who left in March beside one who arrived last week.
 *   * the **Sort menu is gone and the ordering is the headings**. The menu listed every sortable
 *     column twice, in a bar, beside a table whose headings already set the same parameter and
 *     already show which column is ordering it (R-N15) — two widgets for one parameter, only one
 *     of which could be read off the rows in front of the viewer. `?sort=` is unchanged.
 *   * **Team is a filter**, and what it narrows is asserted rather than assumed: both the rows
 *     and the population behind them, which is the distinction that matters on a page where a
 *     Member with no session in the period is still a row (R-M14's denominator).
 */
test.describe("R-C1, R-C6 — People's controls are Period, Team and Kind (ticket 63)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
  });

  const bar = (page: Page) => page.getByTestId("page-toolbar");

  test("the toolbar holds three groups, and no Sort menu", async ({ page }) => {
    await page.goto(PEOPLE);

    await expect(bar(page).locator('[data-testid^="control-"]')).toHaveCount(3);
    for (const key of ["period", "team", "memberKind"]) {
      await expect(bar(page).locator(`[data-testid="control-${key}"]`)).toHaveCount(1);
    }
    await expect(bar(page).locator('[data-testid="control-sort"]')).toHaveCount(0);
    await expect(bar(page)).not.toContainText("high to low");
    // The ordering did not go with the menu: it is on the heading, where it acts.
    await expect(page.locator("th[aria-sort]")).toHaveCount(1);
  });

  test("the period offers months only, and opens on the month `now` falls in", async ({ page }) => {
    await page.goto(PEOPLE);
    const period = page.getByTestId("control-period");
    await expect(period.locator("summary")).toHaveText(/^PeriodSeptember 2026/);

    await period.locator("summary").click();
    await expect(period.getByRole("link")).toHaveText([
      "September 2026",
      "August 2026",
      "July 2026",
      "June 2026",
      "May 2026",
      "April 2026",
    ]);

    await period.getByRole("link", { name: "August 2026" }).click();
    await expect(page).toHaveURL(`${PEOPLE}?period=2026-08`);
  });

  test("a URL still carrying the whole window opens on the current month instead", async ({
    page,
  }) => {
    // A shared link is a viewer's, not an error: the token names no period this page offers, so
    // the page default stands (R-C4, R-T26).
    await page.goto(`${PEOPLE}?period=window`);

    await expect(page.getByTestId("control-period").locator("summary")).toHaveText(
      /^PeriodSeptember 2026/,
    );
  });

  test("clicking a heading changes `?sort=` and nothing else", async ({ page }) => {
    await page.goto(`${PEOPLE}?team=team_platform`);
    await peopleTable(page).locator("th").filter({ hasText: "Tokens" }).getByRole("link").click();

    // The heading link is a control link like any other: it carries the page's other parameters,
    // and it writes the same `?sort=` the departed menu wrote.
    await expect(page).toHaveURL(`${PEOPLE}?team=team_platform&sort=-tokens`);
    await expect(page.locator("th[aria-sort]")).toContainText("Tokens");
  });

  test("Team narrows the rows and the population it reads them off", async ({ page }) => {
    await page.goto(PEOPLE);
    await expect(peopleRows(page)).toHaveCount(20);

    await page.goto(`${PEOPLE}?team=team_platform`);

    // The Platform team's six Members, and nobody else: the population is the roster narrowed by
    // the control, not the roster with six rows highlighted.
    await expect(peopleRows(page)).toHaveCount(6);
    const teams = await peopleRows(page).locator("td:nth-child(2)").allTextContents();
    for (const cell of teams) expect(cell).toContain("Platform");
    await expect(page.getByTestId("active-filters")).toHaveText("Platform team · all kinds");
  });

  test("Kind is unchanged, and stacks with Team", async ({ page }) => {
    await page.goto(`${PEOPLE}?member_kind=service_account`);
    const kinds = new Set(await peopleRows(page).locator("td:nth-child(3)").allTextContents());

    expect([...kinds]).toEqual(["Service account"]);
    await expect(page.getByTestId("active-filters")).toHaveText(
      "all teams · Service accounts only",
    );
  });
});

/**
 * **Ticket 41 — the Cost column is money, on the page, in the browser.**
 *
 * It rendered through a bare `maximumFractionDigits: 2`, so a column of costs read `310.5`,
 * `220.25`, `41.2` — three different shapes of one quantity, on one column, one click from a
 * summary tile reading `$310.50`. The shape is asserted here rather than a value: what a cell
 * *says* is a unit test's claim (`figures.test.ts`), and what reaches a reader is this one's.
 */
test.describe("R-N15 — the Cost column reads as currency (ticket 41)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
  });

  test("every cost cell carries a symbol, grouped thousands and exactly two decimals", async ({
    page,
  }) => {
    await page.goto(PEOPLE);
    const costs = await peopleRows(page).locator("td:nth-child(7)").allTextContents();

    // Non-vacuity: twenty rows, and none of them withheld for this account (R-A9).
    expect(costs).toHaveLength(20);
    for (const cost of costs) expect(cost).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  test("the Kind column reads as words, and never as the enum", async ({ page }) => {
    await page.goto(PEOPLE);
    const kinds = new Set(await peopleRows(page).locator("td:nth-child(3)").allTextContents());

    // R-D3's roster: 18 `human` and 2 `service_account`, both spelled for a reader.
    expect([...kinds].sort()).toEqual(["Human", "Service account"]);
  });
});

test.describe("R-N16 / R-N17 — `?member=` is a surface, and the comparator is paired bars", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
  });

  test("a Member's row opens that Member's profile in place of the list", async ({ page }) => {
    await page.goto(PEOPLE);
    const name = (await peopleRows(page).first().locator("td").first().textContent()) ?? "";
    await peopleRows(page).first().getByRole("link").click();

    await expect(page).toHaveURL(/[?&]member=mem_/);
    // The list is *replaced*, not filtered: there is no table of Members on this surface.
    await expect(peopleTable(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
    await expect(page.getByRole("group", { name: "Headline figures" }).locator("> div")).toHaveCount(
      4,
    );
  });

  test("the comparator names its group in words and draws three pairs, never a strip", async ({
    page,
  }) => {
    await page.goto(PEOPLE);
    await peopleRows(page).first().getByRole("link").click();

    const comparator = page.getByRole("region", { name: "Comparator" });
    // R-N17's key, in words: "api-gateway · implementation, 6 members" — the Repository and the
    // template, then the size of the group.
    const key = comparator.getByText(/, \d+ members$/);
    await expect(key).toBeVisible();
    expect((await key.textContent()) ?? "").toContain(" · ");
    // Three metrics (R-N17), two bars each — a pair, not a position within a spread.
    await expect(comparator.getByRole("group")).toHaveCount(3);
    await expect(comparator.getByTestId("comparator-bar")).toHaveCount(6);
    // R-N18 — acceptance rate is not one of the three. Asserted over the metrics rather than
    // over the panel's text, because the panel's footnote *names* the absence in words.
    await expect(comparator.getByRole("group").filter({ hasText: /accept/i })).toHaveCount(0);
  });

  test("a Member the viewer cannot name has no profile, and says why (R-A6)", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(`${PEOPLE}?member=${OPEN_ACCOUNT.memberId}`);

    await expect(page.getByRole("region", { name: "Withheld profile" })).toBeVisible();
    const payload = (await page.content()) ?? "";
    expect(payload).not.toContain(OPEN_ACCOUNT.fullName);
  });
});

test.describe("T-E2.1 — the page says what this account can see (A28, R-A10, C9)", () => {
  test("each account is told what it can see, and the two are told different things", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);
    // Asserted as two specific sentences rather than as "they differ": presence alone would pass
    // against a line hard-coded into the page, and inequality alone would pass against two
    // hard-coded lines. What C9 claims is that the sentence is *read off the grants*, and the
    // evidence for that is each account being told the thing its own grants imply.
    await expect(page.getByTestId("visibility-statement")).toHaveText(
      /yourself by name, and every other Member of this Organization by name/,
    );

    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);
    await expect(page.getByTestId("visibility-statement")).toHaveText(
      /yourself by name\. Other Members' work reaches the totals on this page without being named/,
    );
  });

  test("the restricted sentence explains the one row and quotes no figure (C10)", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);
    const sentence = page.getByTestId("visibility-statement");

    await expect(sentence).toBeVisible();
    await expect(sentence).toHaveText(/without being named/);
    // C10 took an aggregate off this page; an explanation carrying a count puts one back.
    await expect(sentence).not.toHaveText(/\d/);
  });

  /**
   * An absence, asserted on the two things the matrix carried that nothing else does — its test
   * id, and the `data-scope` cells that were the whole point of it. Both accounts, and both the
   * table and profile arms, because the matrix used to render on every arm.
   */
  for (const account of [OPEN_ACCOUNT, RESTRICTED_ACCOUNT]) {
    test(`no permission matrix renders for the ${account.roleName} account (C9)`, async ({
      page,
      context,
      baseURL,
    }) => {
      await useSession(context, { member_id: account.memberId, org_slug: SLUG }, baseURL ?? BASE);

      await page.goto(PEOPLE);
      await expect(page.getByTestId("permission-matrix")).toHaveCount(0);
      await expect(page.locator("td[data-scope]")).toHaveCount(0);

      await page.goto(`${PEOPLE}?member=${account.memberId}`);
      await expect(page.getByTestId("permission-matrix")).toHaveCount(0);
      await expect(page.locator("td[data-scope]")).toHaveCount(0);
    });
  }
});
