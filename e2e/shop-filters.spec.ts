import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import shirts from "../data/shirts.json";

const PHOTOS = new Set((shirts as { id: string; medium: string }[]).filter((s) => s.medium === "photo").map((s) => s.id));

test("shop: tee colour shows every card on that tee, lands in the address, and survives a product and back", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  const colour = page.getByRole("group", { name: "Tee colour" });
  const black = colour.getByRole("button", { name: "Black" });
  await expect(black).toHaveAttribute("aria-pressed", "false");
  await black.tap();
  await expect(black).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]c=black/);
  // Every card shown is the design on a black tee.
  await expect.poll(() => page.locator("main img[data-mockup]").evaluateAll((els) => els.slice(0, 12).every((i) => /-black-\d+\.webp$/.test((i as HTMLImageElement).getAttribute("src")!)))).toBe(true);
  // Opening one shows it on black; back restores the filter.
  await page.locator('main a[href*="/shop/mono-"]').first().click();
  await expect(page).toHaveURL(/\/shop\/(p\/\?id=)?mono-/);
  await expect.poll(() => page.locator("main img[data-mockup]").first().evaluate((i: HTMLImageElement) => i.getAttribute("src"))).toMatch(/-black-\d+\.webp$/);
  await page.goBack();
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "true");
  // Tap again to clear; the other colour switches.
  await page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White" }).tap();
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White" }).tap();
  await expect(page).not.toHaveURL(/[?&]c=/);
});

test("shop: a link with filters opens with them set (white photographs)", async ({ page }) => {
  await page.goto("shop/?c=white&m=photo");
  await hydrated(page);
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Style" }).getByRole("button", { name: "Photo" })).toHaveAttribute("aria-pressed", "true");
  const ids = await page.locator('main a[href*="/shop/mono-"]').evaluateAll((as) => as.slice(0, 12).map((a) => a.getAttribute("href")!.match(/mono-[\w-]+/)![0]));
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(PHOTOS.has(id), id).toBe(true);
  await expect.poll(() => page.locator("main img[data-mockup]").evaluateAll((els) => els.slice(0, 8).every((i) => /-white-\d+\.webp$/.test((i as HTMLImageElement).getAttribute("src")!)))).toBe(true);
});
