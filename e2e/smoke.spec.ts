import { expect, test } from "@playwright/test";

test("the home route serves a rendered page", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("main")).toContainText("Hello world!");
});
