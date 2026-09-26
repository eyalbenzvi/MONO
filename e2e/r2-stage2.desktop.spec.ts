import { expect, test } from "@playwright/test";
import index from "../data/shirts.index.json";
import { hydrated, seed } from "./helpers";

test("I14 / T1: on desktop the categories are one row; every chip can be scrolled fully into view", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  const group = page.getByRole("group", { name: "Category" });
  const box = (await group.boundingBox())!;
  expect(box.height).toBeLessThan(56); // one row
  const chips = await group.getByRole("button").all();
  expect(chips.length).toBe(index.categories.length + 1); // "All" + every category
  const last = chips[chips.length - 1];
  await last.scrollIntoViewIfNeeded();
  const b = (await last.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
});

test("R12 / T1: with a mouse, a card's heart shows on hover only; no quick add", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  await page.mouse.move(2, 2);
  const card = page.locator("main .grid > div").nth(2);
  await expect(card.getByRole("button", { name: /^Quick add/ })).toHaveCount(0);
  const heart = card.getByRole("button", { name: "Save" });
  const opacity = () => heart.evaluate((el) => Number(getComputedStyle(el).opacity));
  await page.waitForTimeout(400);
  expect(await opacity()).toBe(0);
  await card.hover();
  await page.waitForTimeout(400);
  expect(await opacity()).toBe(1);
});

test("R30: on a product 404 the Shop tab is readable (black on the white pill)", async ({ page }) => {
  await page.goto("shop/mono-9999/");
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: /isn't in the drop/ })).toBeVisible();
  const color = await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Shop" }).evaluate((a) => getComputedStyle(a).color);
  expect(color).toBe("rgb(0, 0, 0)");
});
