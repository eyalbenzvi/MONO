import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("waves: /shop/?wave=<n> shows only that wave (none yet: nothing), and the plain shop is untouched", async ({ page }) => {
  await page.goto("shop/?wave=999");
  await hydrated(page);
  await expect(page.getByText("Nothing here.")).toBeVisible();
  await expect(page.locator('main a[href*="/shop/mono-"]')).toHaveCount(0);
  await page.goto("shop/");
  await hydrated(page);
  await expect(page.locator('main a[href*="/shop/mono-"]').first()).toBeVisible();
});
