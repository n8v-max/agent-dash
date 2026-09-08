// T-E3 — enforcement (A11, R-A7, R-T15).
//
// Three cases, and the two 404s are the point: a token naming another Organization and a slug
// naming no Organization must be indistinguishable from outside. A 403 on the first would
// confirm that `/demo` exists and is somebody else's, which is the tenancy leak.
//
// The status code is read off the response, not inferred from the page. Next can render a
// not-found *body* while answering 200 if the check lands after streaming begins, and a soft
// 404 is not what R-A7 asks for.

import { expect, test } from "@playwright/test";
import { OPEN_ACCOUNT, RESTRICTED_ACCOUNT, useSession } from "./support/session";

const BASE = "http://localhost:3000";

test.describe("T-E3 — the authoritative boundary", () => {
  test("a token whose Organization does not match the path segment yields 404", async ({
    page,
    context,
    baseURL,
  }) => {
    // Signed with the real key, so verification passes; only the tenancy claim is wrong.
    await useSession(
      context,
      { member_id: RESTRICTED_ACCOUNT.memberId, org_slug: "other-org" },
      baseURL ?? BASE,
    );

    const response = await page.goto(`/${OPEN_ACCOUNT.orgSlug}`);

    expect(response?.status()).toBe(404);
  });

  test("an unknown Organization slug yields 404", async ({ page, context, baseURL }) => {
    await useSession(
      context,
      { member_id: OPEN_ACCOUNT.memberId, org_slug: OPEN_ACCOUNT.orgSlug },
      baseURL ?? BASE,
    );

    const response = await page.goto("/no-such-organization");

    expect(response?.status()).toBe(404);
  });

  test("a valid token names a Member the Organization does not have, and yields 404", async ({
    page,
    context,
    baseURL,
  }) => {
    await useSession(
      context,
      { member_id: "mem_not_a_member", org_slug: OPEN_ACCOUNT.orgSlug },
      baseURL ?? BASE,
    );

    const response = await page.goto(`/${OPEN_ACCOUNT.orgSlug}`);

    expect(response?.status()).toBe(404);
  });

  test("no cookie on an /[org] path redirects to /sign-in", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto(`/${OPEN_ACCOUNT.orgSlug}`);

    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("R-A4 / R-T13 — issuing a session", () => {
  test("continuing as an account sets an httpOnly session cookie and lands on its org", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/sign-in");

    await page
      .getByRole("button", { name: `Continue as ${RESTRICTED_ACCOUNT.fullName}` })
      .click();

    await expect(page).toHaveURL(new RegExp(`/${RESTRICTED_ACCOUNT.orgSlug}$`));
    const [cookie] = await context.cookies();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBe(true);
  });

  test("DELETE clears the session, so the next /[org] request is redirected", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/sign-in");
    await page.getByRole("button", { name: `Continue as ${OPEN_ACCOUNT.fullName}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${OPEN_ACCOUNT.orgSlug}$`));

    const cleared = await page.request.delete("/api/session");
    expect(cleared.status()).toBe(204);

    await page.goto(`/${OPEN_ACCOUNT.orgSlug}`);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

// R-A8 — navigation is identical for both accounts — **moved to `routes.spec.ts`**.
//
// A single-route version of that equality stood here while the shell was being built and T-E1's
// sweep did not exist. T-E1 owns it now, across all six routes and comparing `href` and
// `aria-current` as well as the label; keeping a `/demo`-only copy beside it would be one test
// paying for the same claim twice.
