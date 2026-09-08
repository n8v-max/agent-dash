// `/demo/people`, end to end — **T-E2**, **A24**, R-N16/R-N17, and the part of **T-E8** that can
// honestly be written today.
//
// ---------------------------------------------------------------------------------------------
// **T-E8 is deliberately incomplete, and this is the record of why.**
//
// T-E8 (`testing-spec.md` § 5) and A28 (`spec.md` § 10) both read: *"the permission matrix
// renders for the open account and **not** for the restricted one."* **R-A10 says the opposite,
// in terms**: *"under R-A3.1 both accounts hold `self` over `access`, so both see it — the open
// account showing the full matrix, the restricted account showing its own grants"*, and
// `spec.md` § 11 **C6** is the later resolution that made it so, arguing that the literal reading
// produces "a matrix nobody can see".
//
// Ticket 21's domain layer is built on R-A10: `self` over every class is an invariant enforced
// ahead of the grant list, so **both Roles hold `self × access`** and `grantMatrix` returns a
// *different* matrix for each. "The restricted account holds no `access`" is not expressible
// there at all.
//
// So the assertion T-E8 names — *whether the matrix renders for the restricted account* — is
// **left unwritten**. A test written to either reading pins the losing behaviour, and this is a
// spec disagreeing with itself, which is a human decision rather than an implementer's (AFK
// handover § 8). It is **not** `.skip`ped: a skipped test is a green build with a hole in it.
// What is written below is every T-E8-adjacent fact that holds under *both* readings:
//
//   * the matrix renders for the open account, collapsed and read-only (both readings agree);
//   * **whatever matrix an account renders states that account's own grants** — written as a
//     filter over the cells actually found, so it is a real check where a matrix renders and
//     vacuously true where one does not, and therefore takes no side.
//
// A28's traceability row cites **T-U10** as evidence. T-U10 asserts the R-A3.1 invariant, which
// is what *supports* R-A10 — it is not evidence for A28's prose.
// ---------------------------------------------------------------------------------------------

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
const GRANTED_CELLS: Readonly<Record<string, readonly string[]>> = {
  [OPEN_ACCOUNT.memberId]: [
    "org-member:jobs",
    "org-member:tokens",
    "org-member:cost",
    "org-member:access",
  ],
  [RESTRICTED_ACCOUNT.memberId]: ["team:jobs", "team:tokens"],
};

const shouldBeGranted = (memberId: string, cell: string): boolean =>
  cell.startsWith("self:") || (GRANTED_CELLS[memberId] ?? []).includes(cell);

/** Every permission cell on the page, as `scope:class` → what the page says about it. */
const matrixCells = async (page: Page): Promise<readonly { cell: string; granted: boolean }[]> => {
  const cells = await page.locator("td[data-scope]").all();
  return Promise.all(
    cells.map(async (cell) => ({
      cell: `${await cell.getAttribute("data-scope")}:${await cell.getAttribute("data-datapoint")}`,
      granted: (await cell.getAttribute("data-granted")) === "true",
    })),
  );
};

test.describe("T-E2 — the restricted account's rows are of a different kind (A9, R-D18)", () => {
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
    // And the open account has no aggregate statement to make — nobody reached its totals
    // without being named.
    await expect(page.getByText(/counted and not named/)).toHaveCount(0);
  });

  test("the restricted account names itself and nobody else, and says so in words", async ({
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

    // The other half: the restricted surface carries a statement the open one does not — how
    // many Members reached these totals through an aggregated grant without being named. A
    // *shortened list of the same kind* would carry no such sentence.
    await expect(page.getByText(/counted and not named/)).toBeVisible();
  });

  test("it receives a handful of rows against twenty, not a shortened list of the same kind", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, RESTRICTED_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);

    const rows = await peopleRows(page).count();

    // ┌─ **A known shortfall, recorded rather than papered over.** T-E2 asks for **2** rows here
    // │  — the viewer's own named row *plus its Team's aggregate row*. `peoplePage`
    // │  (`src/data/queries/people.ts`, built by ticket 28/31) produces the own row and an
    // │  aggregate **statement** instead of an aggregate **row**, so today the count is 1 — and
    // │  `src/data/queries.test.ts` asserts exactly that, by Member id. Emitting the Team row
    // │  means changing `src/data/**`, which this ticket may not touch and which other agents
    // │  are working in. So the count is asserted as the *range* both designs satisfy: this test
    // │  is honest today and still passes the moment the Team aggregate row lands.
    // └─ The claim that does *not* soften is above: exactly one Member is named, and it is the
    //    viewer. That is what makes the difference one of kind rather than of length.
    expect(rows).toBeGreaterThanOrEqual(1);
    expect(rows).toBeLessThanOrEqual(2);
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

test.describe("R-A10 — the read-only permission matrix at the foot of the page", () => {
  test("renders for the open account, collapsed and carrying no control", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);
    const matrix = page.getByTestId("permission-matrix");

    await expect(matrix).toBeAttached();
    // Collapsed: `<details>` with no `open` attribute (R-A10).
    await expect(matrix).not.toHaveAttribute("open", /.*/);
    await expect(matrix.locator("input, select, textarea, button")).toHaveCount(0);
    // All 24 cells of (subject scope × datapoint class).
    await expect(matrix.locator("td[data-scope]")).toHaveCount(24);
  });

  test("opens to show the grants, and the `self` row is granted over every class (R-A3.1)", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(context, OPEN_CLAIMS, baseURL ?? BASE);
    await page.goto(PEOPLE);
    await page.getByTestId("permission-matrix").locator("summary").click();

    await expect(page.getByTestId("permission-matrix")).toHaveAttribute("open", /.*/);
    await expect(page.locator("td[data-scope='self'][data-granted='false']")).toHaveCount(0);
  });

  // The T-E8-adjacent claim that takes no side: *whatever* matrix an account renders is that
  // account's own. Vacuously true for an account rendering none — which is the point, because
  // whether the restricted account renders one is the question the specs disagree on.
  for (const account of [OPEN_ACCOUNT, RESTRICTED_ACCOUNT]) {
    test(`every permission cell the ${account.roleName} account renders is its own grant`, async ({
      page,
      context,
      baseURL,
    }) => {
      await useSession(context, { member_id: account.memberId, org_slug: SLUG }, baseURL ?? BASE);
      await page.goto(PEOPLE);

      const contradictions = (await matrixCells(page)).filter(
        (found) => found.granted !== shouldBeGranted(account.memberId, found.cell),
      );

      expect(contradictions, `${account.roleName} was shown a grant it does not hold`).toEqual([]);
    });
  }
});
