import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

test("V1: Buy between Pass and Like opens the product page of the tee on the card", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const title = (await page.locator('[aria-roledescription="card"]').first().locator("h2").first().textContent())!;
  const buttons = page.locator("button[aria-label='Pass'], a[aria-label^='Buy '], button[aria-label='Like']");
  await expect(buttons).toHaveCount(3);
  // Order on screen: Pass · Buy · Like.
  const xs = await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect(xs[0]).toBeLessThan(xs[1]);
  expect(xs[1]).toBeLessThan(xs[2]);
  const buy = page.getByRole("link", { name: `Buy ${title}` });
  await expect(buy).toBeVisible();
  await buy.tap();
  await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});
