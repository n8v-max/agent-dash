import { expect, test } from "@playwright/test";

test("the home route serves the positioning line (R-N1, ticket 37)", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Agent spend, measured per finished task. Not per token, not per seat.",
  );
});

test("the landing page makes no productivity claim", async ({ page }) => {
  // Ticket 05's position, at the one place it is easiest to lose. "Ship faster. Know why." is
  // what stood here before the product had one.
  await page.goto("/");

  await expect(page.getByRole("main")).not.toHaveText(/faster|productiv|velocity|10x/i);
  // R-N1's scope: the line, and one link to sign-in. No feature grid, no pricing.
  await expect(page.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("link")).toHaveAttribute("href", "/sign-in");
});
