import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

const cardTitle = async (page: import("@playwright/test").Page) => (await page.locator('[aria-roledescription="card"]').first().locator("h2").first().textContent())!;

test("V1: Buy between Pass and Like opens a sheet in place: size, then Buy now goes straight to the delivery form", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const title = await cardTitle(page);
  const buttons = page.locator("button[aria-label='Pass'], button[aria-label^='Buy '], button[aria-label='Like']");
  await expect(buttons).toHaveCount(3);
  // Order on screen: Pass · Buy · Like.
  const xs = await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect(xs[0]).toBeLessThan(xs[1]);
  expect(xs[1]).toBeLessThan(xs[2]);

  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  const sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await expect(sheet).toBeVisible();
  await expect(page).not.toHaveURL(/\/shop\//);
  // No size yet: the button asks for one and nothing is added.
  await sheet.getByRole("button", { name: "Choose size" }).tap();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: /^M\b/ }).tap();
  await sheet.getByRole("button", { name: /^Buy now · M · \$\d+$/ }).tap();
  await page.waitForURL(/\/cart\/$/);
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Items" })).toContainText(title);
});

test("V1: with a remembered size it's two taps to checkout; Add to bag keeps you on the same card; Details opens the page", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  // Remember a size (any add does): Add to bag, keep swiping.
  let title = await cardTitle(page);
  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  let sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await sheet.getByRole("radio", { name: /^L\b/ }).tap();
  await sheet.getByRole("button", { name: "Add to bag, keep swiping" }).tap();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Added to bag" })).toContainText("Added · L");
  // The deck didn't move.
  expect(await cardTitle(page)).toBe(title);

  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await expect(sheet.getByRole("button", { name: /^Buy now · L · / })).toBeVisible();
  await sheet.getByRole("link", { name: "Details" }).tap();
  await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.goto("");
  await hydrated(page);
  title = await cardTitle(page);
  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  await page.getByRole("dialog", { name: `Buy ${title}` }).getByRole("button", { name: /^Buy now · L · / }).tap();
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
});

test("personal area: with a bag, Checkout comes first (to the delivery form); saved tees add in one tap", async ({ page }) => {
  await seed(page, {}, [{ id: "mono-0004", size: "M", color: "black", qty: 1 }]);
  await page.goto("me/");
  await hydrated(page);
  const checkout = page.getByRole("link", { name: /^Checkout · 1 tee · \$\d+$/ });
  await expect(checkout).toBeVisible();
  // Saved (the taste test's likes): quick add right on the tile (no size remembered yet: pick one).
  const saved = page.getByRole("list", { name: "Saved" });
  await saved.getByRole("button", { name: /^Quick add / }).first().tap();
  await saved.getByRole("button", { name: "Size M" }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toContainText("Added · M");
  await expect(page.getByRole("link", { name: /^Checkout · 2 tees · \$\d+$/ })).toBeVisible();
  await page.getByRole("link", { name: /^Checkout · 2 tees/ }).tap();
  await page.waitForURL(/\/cart\/$/);
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
});
