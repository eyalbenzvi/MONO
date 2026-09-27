import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

test("I14 / T1: on desktop the filter row is one line, all five controls in view, no sort", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  const colour = page.getByRole("group", { name: "Tee colour" });
  const style = page.getByRole("group", { name: "Style" });
  await expect(colour.getByRole("button")).toHaveText(["Black", "White"]);
  await expect(style.getByRole("button")).toHaveText(["Drawn", "Archive", "Photo"]);
  const row = [(await colour.boundingBox())!, (await style.boundingBox())!];
  expect(Math.abs(row[0].y - row[1].y)).toBeLessThan(4); // one line
  for (const b of await page.locator('[role="group"][aria-label="Tee colour"] button, [role="group"][aria-label="Style"] button').all()) await expect(b).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: /^Sort/ })).toHaveCount(0);
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
