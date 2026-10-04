import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

test("I14 / T1: on desktop the shop's controls are one row: Black · White, Search and Filter, in view, no sort", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  const colour = page.getByRole("group", { name: "Tee colour" });
  const search = page.getByRole("button", { name: "Search", exact: true });
  const filter = page.getByRole("button", { name: /^Filter/ });
  await expect(colour.getByRole("button")).toHaveCount(2);
  await expect(colour.getByRole("button")).toHaveText(["Black", "White"]);
  const mid = async (l: typeof filter) => {
    const b = (await l.boundingBox())!;
    return b.y + b.height / 2;
  };
  const y = await mid(colour);
  for (const l of [search, filter]) expect(Math.abs((await mid(l)) - y)).toBeLessThan(4); // one line
  for (const b of [...(await colour.getByRole("button").all()), search, filter]) await expect(b).toBeInViewport({ ratio: 1 });
  // Filter opens the categories in a sheet, in view.
  await filter.click();
  await expect(page.getByRole("dialog", { name: "Categories" })).toBeInViewport();
  await expect(page.getByRole("button", { name: /^Sort/ })).toHaveCount(0);
});

test("R12 / T1: with a mouse too, every card shows its heart (no hover needed); no quick add", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  await page.mouse.move(2, 2);
  const card = page.locator("main .grid > div").nth(2);
  await expect(card.getByRole("button", { name: /^Quick add/ })).toHaveCount(0);
  const heart = card.getByRole("button", { name: /^Save / });
  const opacity = () => heart.evaluate((el) => Number(getComputedStyle(el).opacity));
  await page.waitForTimeout(400);
  expect(await opacity()).toBe(1);
  await expect(heart).toBeVisible();
});

test("R30: a product 404 is no dead end: the Shop link is readable (black on white) and leads to the shop", async ({ page }) => {
  await page.goto("shop/mono-9999/");
  await expect(page.getByRole("heading", { name: /isn’t in the drop/ })).toBeVisible();
  const shop = page.getByRole("main").getByRole("link", { name: "Shop", exact: true });
  await expect(shop).toHaveAttribute("href", /\/shop\/$/);
  await expect(page.getByRole("main").getByRole("link", { name: "Discover", exact: true })).toBeVisible();
  expect(await shop.evaluate((a) => [getComputedStyle(a).color, getComputedStyle(a).backgroundColor])).toEqual(["rgb(0, 0, 0)", "rgb(255, 255, 255)"]);
  await shop.click();
  await page.waitForURL(/\/shop\/$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
});
