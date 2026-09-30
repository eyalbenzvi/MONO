import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("waves: /shop/?wave=<n> shows only that wave (none yet: nothing), and the plain shop is untouched", async ({ page }) => {
  await page.goto("shop/?wave=999");
  await hydrated(page);
  // The empty grid's one line, with its way out.
  await expect(page.getByText("No tees match.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  await expect(page.locator('main a[href*="/shop/mono-"]')).toHaveCount(0);
  await page.goto("shop/");
  await hydrated(page);
  await expect(page.locator('main a[href*="/shop/mono-"]').first()).toBeVisible();
});
