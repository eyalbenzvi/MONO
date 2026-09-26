import { expect, test } from "@playwright/test";
import index from "../data/shirts.index.json";
import { hydrated, seed } from "./helpers";

test("I14: on desktop no category chip is cut off", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  const group = page.getByRole("group", { name: "Category" });
  const box = (await group.boundingBox())!;
  const chips = await group.getByRole("button").all();
  expect(chips.length).toBe(index.categories.length + 1); // "All" + every category
  for (const chip of chips) {
    const b = (await chip.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  }
});

test("R12: with a mouse, quick add shows on hover only", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  await page.mouse.move(2, 2);
  const card = page.locator("main .grid > div").nth(2);
  const add = card.getByRole("button", { name: /^Quick add/ });
  const opacity = () => add.evaluate((el) => Number(getComputedStyle(el.parentElement!.closest("[class*=absolute]")!).opacity));
  await page.waitForTimeout(400);
  expect(await opacity()).toBe(0);
  await card.hover();
  await page.waitForTimeout(400);
  expect(await opacity()).toBe(1);
  await expect(add).toContainText("Add");
});

test("R30: on a product 404 the Shop tab is readable (black on the white pill)", async ({ page }) => {
  await page.goto("shop/mono-9999/");
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: /isn't in the drop/ })).toBeVisible();
  const color = await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Shop" }).evaluate((a) => getComputedStyle(a).color);
  expect(color).toBe("rgb(0, 0, 0)");
});
