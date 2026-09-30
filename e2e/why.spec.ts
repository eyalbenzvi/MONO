import { expect, test } from "@playwright/test";
import { hydrated, LEANING, seed } from "./helpers";
import { W1 } from "../tests/fixtures";

/** The product page's Why line. */
const WHY = /^(Top pick|For you) · \S/;

test.describe("V4: a personal line opens why", () => {
  test("product page: the Top pick line opens real reasons; Esc closes it and focus returns to the line", async ({ page }) => {
    await seed(page, { vector: LEANING });
    await page.goto("shop/");
    await hydrated(page);
    // The first card of Your edit is the top pick for this taste.
    await page.locator('main a[href*="/shop/"][aria-label*="Top pick"]').first().click();
    await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
    await hydrated(page);
    // One line, only when it's true: "Top pick · a, b" or "For you · a, b"; the whole line opens Your taste.
    const line = page.getByRole("button", { name: WHY });
    await expect(line).toHaveAttribute("aria-haspopup", "dialog");
    await line.click();
    const sheet = page.getByRole("dialog", { name: "Your taste" });
    await expect(sheet).toBeVisible();
    // Real reasons: the archetype, its sentence and traits in words — no percentile.
    await expect(sheet.getByRole("heading", { name: /^The / })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "See your edit" })).toBeVisible();
    expect(await sheet.innerText()).not.toMatch(/\d+%/);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(line).toBeFocused();
  });

  test("shop: no text above the grid but its quiet heading", async ({ page }) => {
    await seed(page, { vector: LEANING });
    await page.goto("shop/");
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your edit");
    await expect(page.getByText(/^(For you|Top pick) · /)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a taste with no leanings gets no personal line (a percentile alone is no reason)", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await page.locator('main a[href*="/shop/"][aria-label*="Top pick"]').first().click();
    await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: WHY })).toHaveCount(0);
  });

  test("before any taste, no personal line at all", async ({ page }) => {
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: WHY })).toHaveCount(0);
  });
});
