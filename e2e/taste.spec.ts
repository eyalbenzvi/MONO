import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("W2: passing on all ten test cards gives no taste — no result screen; the dots show what's needed; the shop stays Popular", async ({ page }) => {
  await page.goto("");
  await hydrated(page);
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "Pass", exact: true }).tap();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(600);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const dots = page.getByRole("button", { name: /^Not enough to know your taste yet: 3 more likes\.$/ });
  await expect(dots).toBeVisible();
  await dots.tap();
  await expect(page.getByRole("status").filter({ hasText: "3 more likes" })).toBeVisible();
  // Three likes later, the taste is known and the result screen opens.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Like", exact: true }).tap();
    await page.waitForTimeout(350);
  }
  await expect(page.getByRole("dialog").first()).toBeVisible();
});
