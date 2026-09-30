import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import shirts from "../data/shirts.json";

const PHOTOS = new Set((shirts as { id: string; medium: string }[]).filter((s) => s.medium === "photo").map((s) => s.id));

test("shop: tee colour shows every card on that tee, lands in the address, and survives a product and back", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  const colour = page.getByRole("group", { name: "Tee colour" });
  const black = colour.getByRole("button", { name: "Black tees" });
  await expect(black).toHaveAttribute("aria-pressed", "false");
  // The bottom row's toggle reads "Black" (its name says what it filters).
  await expect(black).toHaveText("Black");
  await black.tap();
  await expect(black).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]c=black/);
  // Every card shown is the design on a black tee.
  await expect.poll(() => page.locator("main img[data-mockup]").evaluateAll((els) => els.slice(0, 12).every((i) => /-black-\d+\.webp$/.test((i as HTMLImageElement).getAttribute("src")!)))).toBe(true);
  // Opening one shows it on black; back restores the filter.
  await page.locator('[data-product-card] a[href*="mono-"]').first().click();
  await expect(page).toHaveURL(/\/shop\/(p\/\?id=)?mono-/);
  await expect.poll(() => page.locator("main img[data-mockup]").first().evaluate((i: HTMLImageElement) => i.getAttribute("src"))).toMatch(/-black-\d+\.webp$/);
  await page.goBack();
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "Black tees" })).toHaveAttribute("aria-pressed", "true");
  // Tap again to clear; the other colour switches.
  await page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White tees" }).tap();
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "Black tees" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White tees" }).tap();
  await expect(page).not.toHaveURL(/[?&]c=/);
});

test("shop: a link with filters opens with them set; the filter sheet ticks categories, shows counts, and closes on Escape", async ({ page }) => {
  await page.goto("shop/?c=white&cat=photographs");
  await hydrated(page);
  await expect(page.getByRole("group", { name: "Tee colour" }).getByRole("button", { name: "White tees" })).toHaveAttribute("aria-pressed", "true");
  const filter = page.getByRole("button", { name: "Filter · 1" });
  await expect(filter).toBeVisible();
  const ids = await page.locator('[data-product-card] a[href*="mono-"]').evaluateAll((as) => as.slice(0, 12).map((a) => a.getAttribute("href")!.match(/mono-[\w-]+/)![0]));
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(PHOTOS.has(id), id).toBe(true);
  await expect.poll(() => page.locator("main img[data-mockup]").evaluateAll((els) => els.slice(0, 8).every((i) => /-white-\d+\.webp$/.test((i as HTMLImageElement).getAttribute("src")!)))).toBe(true);
  // The sheet: focus on All, Photographs ticked; adding one more lands in the address in the catalogue's order.
  await filter.click();
  const sheet = page.getByRole("dialog", { name: "Categories" });
  await expect(sheet.getByRole("checkbox", { name: /^All/ })).toBeFocused();
  await expect(sheet.getByRole("checkbox", { name: /^Photographs/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("checkbox", { name: /^Maps & Sky/ }).click();
  await expect(page).toHaveURL(/[?&]cat=photographs\.sky/);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter · 2" })).toBeFocused();
  // All clears them.
  await page.getByRole("button", { name: /^Filter/ }).click();
  await sheet.getByRole("checkbox", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/[?&]cat=/);
  // Counts in one unit, formatted: "All 1,377" and "Show 1,377 tees" agree.
  const all = (await sheet.getByRole("checkbox", { name: /^All/ }).innerText()).match(/[\d,]+/)![0];
  await expect(sheet.getByRole("button", { name: `Show ${all} tees` })).toBeVisible();
  expect(all).toMatch(/^\d{1,3}(,\d{3})*$/);
  await sheet.getByRole("button", { name: `Show ${all} tees` }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
});

test("shop: an old style link (?m=photo) opens on the photographs", async ({ page }) => {
  await page.goto("shop/?m=photo");
  await hydrated(page);
  await expect(page).toHaveURL(/[?&]cat=photographs(&|$)/);
  await expect(page).not.toHaveURL(/[?&]m=/);
  await expect(page.getByRole("button", { name: "Filter · 1" })).toBeVisible();
});
