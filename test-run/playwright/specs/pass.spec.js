// @ts-check
import { test, expect } from "@playwright/test";

test("MM-T101 has title", async ({ page }) => {
  await page.goto("");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Example Domain/);
});

test("MM-T102 has heading", async ({ page }) => {
  await page.goto("");

  await expect(page.getByRole("heading", { name: "Example Domain" })).toBeVisible();
});
