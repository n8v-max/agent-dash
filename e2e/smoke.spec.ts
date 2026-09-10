import { expect, test } from "@playwright/test";

const SLOGAN = "What your agents do, spend and solve, per finished job.";

test("the home route serves the slogan (R-N1; tickets 37 and 60)", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLOGAN);
});

test("the landing page makes no productivity claim", async ({ page }) => {
  // Ticket 05's position, at the one place it is easiest to lose. "Ship faster. Know why." is
  // what stood here before the product had one.
  await page.goto("/");

  await expect(page.getByRole("main")).not.toHaveText(/faster|productiv|velocity|ship more|10x/i);
  // R-N1's scope: the slogan, the reads, and one link to sign-in. No nav, no footer, no pricing.
  await expect(page.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("link")).toHaveAttribute("href", "/sign-in");
});

test("the four reads carry the demo-figure band label and the four verbs, in order (ticket 60)", async ({
  page,
}) => {
  // The band label is rendered once on a desktop (one figure band across four columns) and once
  // per read on a phone (each read keeps its own bands), so it is asserted as *at least once*.
  // The verbs are the four small-caps lines a reader acts on; their order is the argument's.
  await page.goto("/");

  const main = page.getByRole("main");
  await expect(main.getByText(/figures from the demo organisation/i).first()).toBeVisible();
  await expect(main).toHaveText(
    /Defend it to finance[\s\S]*Reclaim it[\s\S]*Redirect the work[\s\S]*Offload the right work/i,
  );
});

test("/sign-in is a mock provider page with one demo action (ticket 60)", async ({ page }) => {
  // Structure, not styling: the shape a visitor with no JavaScript needs. One plain form — the
  // demo card, posting to `/api/session` — with the page's one submit; three provider pills that
  // are links to the real provider sign-in pages in a new window; and a way back to `/`. The
  // button *label* is asserted where it matters, in enforcement.spec.ts, which clicks it and
  // checks where the browser lands.
  const response = await page.goto("/sign-in");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.locator("main form")).toHaveCount(1);
  await expect(page.locator("main button[type=submit]")).toHaveCount(1);

  const links = page.getByRole("link");
  await expect(links).toHaveCount(4);
  await expect(page.locator('a[target="_blank"]')).toHaveCount(3);
  for (const host of ["accounts.google.com", "appleid.apple.com", "github.com"]) {
    const pill = page.locator(`a[href*="${host}"]`);
    await expect(pill).toHaveAttribute("target", "_blank");
    await expect(pill).toHaveAttribute("rel", /noopener/);
  }
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");

  const sso = page.getByRole("button", { name: "Continue with SSO" });
  await expect(sso).toHaveAttribute("type", "button");
  await expect(sso).toBeDisabled();
});
