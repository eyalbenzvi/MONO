import { expect, test } from "@playwright/test";
import { hydrated, LEANING, seed } from "./helpers";
import { W1 } from "../tests/fixtures";

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
    const panel = page.getByRole("region", { name: "Why it’s for you" });
    await expect(panel).toBeVisible();
    // One quiet line: the traits in common and the rank, and an arrow to the whole taste.
    await expect(panel.getByText(/ · Top \d+%$/)).toBeVisible();
    expect((await panel.innerText()).split(/\s+/).length).toBeLessThan(14);
    await expect(panel.getByRole("link", { name: "Your taste" })).toHaveAttribute("href", /\/me\/$/);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(line).toBeFocused();
  });

  test("shop: no text above the grid", async ({ page }) => {
    await seed(page, { vector: LEANING });
    await page.goto("shop/");
    await hydrated(page);
    await expect(page.getByText(/^For you · /)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Why it’s for you" })).toHaveCount(0);
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
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await expect(page.getByRole("button", { name: /for you$/ })).toHaveCount(0);
  });
});
