// @ts-check
import { test, expect } from "@playwright/test";

test("MM-T103 has title", async ({ page }) => {
  await page.goto("");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Not found/);
});
