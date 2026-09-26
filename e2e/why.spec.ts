import { expect, test } from "@playwright/test";
import { hydrated, LEANING, seed } from "./helpers";

test.describe("V4: a personal line opens why", () => {
  test("product page: the Top pick line opens real reasons; Esc closes it and focus returns to the line", async ({ page }) => {
    await seed(page, { vector: LEANING });
    await page.goto("shop/");
    await hydrated(page);
    // The first card of the "For you" ranking is a top pick for this taste.
    await page.locator('main a[href*="/shop/"][aria-label*="Top pick"]').first().click();
    await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
    await hydrated(page);
    const line = page.getByRole("button", { name: /^(Top pick for you|A strong match for you)$/ });
    await expect(line).toHaveAttribute("aria-expanded", "false");
    await line.click();
    const panel = page.getByRole("region", { name: "Why it's for you" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Shared")).toBeVisible();
    await expect(panel.getByText(/^Top \d+% of [\d,]+$/)).toBeVisible();
    await expect(panel.getByRole("link", { name: "Your taste →" })).toHaveAttribute("href", /\/me\/$/);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(line).toBeFocused();
  });

  test("shop: 'For you' says how the order was made", async ({ page }) => {
    await seed(page, { vector: LEANING });
    await page.goto("shop/");
    await hydrated(page);
    await page.getByRole("button", { name: /^For you · / }).tap();
    const panel = page.getByRole("region", { name: "Why it's for you" });
    await expect(panel.getByText("Ranked by")).toBeVisible();
    await expect(panel.getByText(/Nature/)).toBeVisible();
    await expect(panel.getByText(/wildcard every 8th/)).toBeVisible();
    // The taste test's cards were swiped: they sit lower, and the panel says so.
    await expect(panel.getByText(/already swiped sit a bit lower/)).toBeVisible();
  });

  test("a taste with no leanings gets no personal line (a percentile alone is no reason)", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await page.locator('main a[href*="/shop/"][aria-label*="Top pick"]').first().click();
    await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Top pick for you|A strong match for you)$/ })).toHaveCount(0);
  });

  test("before any taste, no personal line at all", async ({ page }) => {
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await expect(page.getByRole("button", { name: /for you$/ })).toHaveCount(0);
  });
});
