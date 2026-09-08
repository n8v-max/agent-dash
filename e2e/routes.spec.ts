// **T-E1 — every route renders for both accounts** (A9, R-A8).
//
// Six authenticated routes × two accounts = twelve navigations, each asserting a page landmark
// and no error boundary. It is the cheapest test in the suite and the one that would catch the
// most embarrassing failure: a page that throws for the account holding fewer grants.
//
// **Why it is a sweep and not a smoke test.** Every other panel test in this suite runs as the
// *open* account, because that is the account whose payload is widest and whose rows are worth
// asserting. The restricted account reaches the same six pages holding `self` over every class
// and `team` over two — so every query on every page takes a different branch for it, and a
// `null` where the open account has a figure is exactly the shape of value that crashes a
// formatter. Twelve navigations is the whole cost of knowing it does not.
//
// **What "no error boundary" means here.** The app ships no `error.tsx` and no `not-found.tsx`
// (they are route shells, deliberately untested per `testing-spec.md` § 7), so a failure inside a
// page does not degrade into a panel — it takes the whole document: Next answers non-200 and
// replaces the tree, and the `<h1>` this file asserts is gone. So the assertion is made four
// ways, each catching a different failure mode:
//
//   * the **status code**, read off the response — a server-side throw is a 500 and nothing else;
//   * the **landmark and its heading**, which a replaced tree cannot carry, and which name the
//     route that was asked for rather than merely "a page";
//   * the **rendered text**, for the soft case `enforcement.spec.ts` names: Next can render a
//     not-found *body* behind a 200 when the check lands after streaming begins;
//   * **`pageerror`**, which is the only witness to a client-side exception. A React error boundary
//     re-renders on the client and can leave a 200 and a landmark behind it.
//
// **A9/R-A8's navigation claim is the last test in the file**, and it is asserted as an equality
// of nav item sets — label, `href` and `aria-current`, per route — rather than eyeballed. It lives
// here rather than in `enforcement.spec.ts`, where a single-route version of it stood in until
// this sweep existed: T-E1 owns the claim across all six routes, and two copies of it would be one
// too many. The set is scoped to the shell's own `<nav aria-label="Sections">`, because
// `/demo/history` carries a second navigation — the R-N20 pager — whose items are genuinely a
// function of how many rows the viewer can see.

import { expect, test, type Page } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, orgRoutes, useSession } from "./support/session";

const BASE = "http://localhost:3000";
const SLUG = OPEN_ACCOUNT.orgSlug;
const ROUTES = orgRoutes(SLUG);

/** R-A3's two accounts, in the order `/sign-in` offers them (R-A4). */
const ACCOUNTS = [OPEN_ACCOUNT, RESTRICTED_ACCOUNT] as const;

/**
 * Each route's `PageFrame` title, in `orgRoutes` order. Stated here rather than read from the
 * page, because "the page landmark rendered" is only a claim if the landmark that rendered is the
 * one the route was asked for — a redirect to the summary would otherwise pass six times.
 */
const TITLES = ["Summary", "Spend", "Work", "People", "History", "Projection"] as const;

/**
 * The strings Next's own error surfaces are made of.
 *
 * Matched against the **rendered text** of `<body>`, not against `page.content()`. The markup
 * carries Next's error-overlay module inline in development, so every one of these literals is
 * in the document of a page that rendered perfectly — a scan of the HTML fails all twelve
 * navigations and would have to be deleted or defanged. `innerText` is what a reader sees, which
 * is the thing the claim is actually about, and it excludes `<script>` bodies.
 *
 * It is deliberately *not* the only witness: an error surface that replaced the tree takes the
 * `<main>` landmark and its heading with it, and those are asserted separately above. This
 * catches the narrower case the layout's own header warns about — an error *body* rendered
 * beside a 200.
 */
const ERROR_SURFACE =
  /Application error|client-side exception|Internal Server Error|This page could not be found|Unhandled Runtime Error/i;

/** The shell's navigation, as a comparable set. `/demo/history`'s pager is a different `<nav>`. */
const navItemsOf = async (page: Page): Promise<readonly string[]> =>
  page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link")
    .evaluateAll((links) =>
      links.map(
        (link) =>
          `${link.textContent ?? ""} → ${link.getAttribute("href") ?? ""}` +
          ` [${link.getAttribute("aria-current") ?? "-"}]`,
      ),
    );

/** The shell nav on each of the six routes, for whichever account currently holds the cookie. */
const navAcrossRoutes = async (page: Page): Promise<Record<string, readonly string[]>> => {
  const perRoute: Record<string, readonly string[]> = {};
  for (const route of ROUTES) {
    await page.goto(route);
    perRoute[route] = await navItemsOf(page);
  }
  return perRoute;
};

test.describe("T-E1 — every route renders for both accounts (A9, R-A8)", () => {
  test("the sweep is six routes and two accounts", () => {
    // The guard on everything below: a route dropped from `orgRoutes` would silently shrink the
    // sweep, and a route added without a title would assert against `undefined`.
    expect(ROUTES).toHaveLength(6);
    expect(TITLES).toHaveLength(ROUTES.length);
    expect(ACCOUNTS).toHaveLength(2);
  });

  for (const [index, route] of ROUTES.entries()) {
    for (const account of ACCOUNTS) {
      test(`${route} renders for the ${account.roleName} account`, async ({
        page,
        context,
        baseURL,
      }) => {
        // Registered before the navigation, so an exception thrown during hydration is caught.
        const crashes: string[] = [];
        page.on("pageerror", (error) => crashes.push(error.message));

        await useSession(
          context,
          { member_id: account.memberId, org_slug: SLUG },
          baseURL ?? BASE,
        );
        const response = await page.goto(route);

        expect(response?.status(), `${route} did not answer 200`).toBe(200);

        // The landmark, and the heading that says it is *this* route's landmark.
        const main = page.getByRole("main");
        await expect(main).toBeVisible();
        await expect(main.getByRole("heading", { level: 1 })).toHaveText(TITLES[index] ?? "");
        // The shell rendered around it: a page that threw takes the header with it.
        await expect(page.getByRole("banner")).toBeVisible();

        expect(await page.locator("body").innerText()).not.toMatch(ERROR_SURFACE);
        expect(crashes, `${route} threw in the browser`).toEqual([]);
      });
    }
  }

  // A9/R-A8 — same doors, fewer rows. Twelve navigations again, in one test, because the claim
  // is a comparison between two accounts and neither half of it is assertable alone.
  //
  // The two accounts are written out rather than looped over: `useSession` is not a React hook,
  // but `react-hooks/rules-of-hooks` cannot know that from its name, and calling it inside a
  // loop or inside `navAcrossRoutes` below reads to the rule as a conditional hook call. Two
  // accounts do not need a loop, and silencing the rule to have one would be the wrong trade.
  test("the nav is the same set of items on every route for both accounts", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    const open = await navAcrossRoutes(page);

    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: SLUG },
      baseURL ?? BASE,
    );
    const restricted = await navAcrossRoutes(page);

    // Non-vacuity: every route was visited and every visit found items. Without this the
    // equality below passes on two empty maps, which is what a broken selector produces.
    expect(Object.keys(open)).toHaveLength(ROUTES.length);
    expect(Object.values(open).filter((items) => items.length === 0)).toEqual([]);

    expect(restricted, "the restricted account was shown a different set of doors").toEqual(open);
  });
});
