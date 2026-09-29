import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import { MADE, MAKE_GROUPS } from "../lib/custom/products";
import { EXTRA } from "../lib/custom/specs";

/** The later products that ship (lib/custom/products SHIPPED): each is its own template. */
const LATER = MADE.filter((m) => Object.hasOwn(EXTRA, m.template));

test("every later product is on the Make index, in its group", async ({ page }) => {
  await page.goto("make/");
  await hydrated(page);
  test("the Make index's filter shows only the groups chosen, keeps them in the address, and All brings the rest back", async ({ page }) => {
  await page.goto("make/");
  await hydrated(page);
  await page.getByRole("button", { name: "Categories" }).tap();
  await page.getByRole("checkbox", { name: /^From a name/ }).tap();
  await expect(page).toHaveURL(/[?&]g=name$/);
  await expect(page.locator("ul[data-group]")).toHaveCount(1);
  await expect(page.locator('ul[data-group="name"]')).toHaveCount(1);
  await page.getByRole("checkbox", { name: /^From a place/ }).tap();
  await expect(page).toHaveURL(/[?&]g=name\.place$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Categories, 2 selected" })).toBeVisible();
  // A reload (or a shared link) opens with the same groups.
  await page.reload();
  await hydrated(page);
  await expect(page.locator("ul[data-group]")).toHaveCount(2);
  await page.getByRole("button", { name: "Categories, 2 selected" }).tap();
  await page.getByRole("checkbox", { name: /^All/ }).tap();
  await expect(page).toHaveURL(/\/make\/$/);
  await expect(page.locator("ul[data-group]")).toHaveCount(MAKE_GROUPS.filter((g) => MADE.some((m) => m.group === g.id)).length);
});

for (const m of LATER) await expect(page.locator(`ul[data-group="${m.group}"] [data-made="${m.slug}"]`), m.slug).toHaveCount(1);
});

test("the Make index's filter shows only the groups chosen, keeps them in the address, and All brings the rest back", async ({ page }) => {
  await page.goto("make/");
  await hydrated(page);
  await page.getByRole("button", { name: "Categories" }).tap();
  await page.getByRole("checkbox", { name: /^From a name/ }).tap();
  await expect(page).toHaveURL(/[?&]g=name$/);
  await expect(page.locator("ul[data-group]")).toHaveCount(1);
  await expect(page.locator('ul[data-group="name"]')).toHaveCount(1);
  await page.getByRole("checkbox", { name: /^From a place/ }).tap();
  await expect(page).toHaveURL(/[?&]g=name\.place$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Categories, 2 selected" })).toBeVisible();
  // A reload (or a shared link) opens with the same groups.
  await page.reload();
  await hydrated(page);
  await expect(page.locator("ul[data-group]")).toHaveCount(2);
  await page.getByRole("button", { name: "Categories, 2 selected" }).tap();
  await page.getByRole("checkbox", { name: /^All/ }).tap();
  await expect(page).toHaveURL(/\/make\/$/);
  await expect(page.locator("ul[data-group]")).toHaveCount(MAKE_GROUPS.filter((g) => MADE.some((m) => m.group === g.id)).length);
});

for (const m of LATER)
  test(`${m.name}: the page opens with its example drawn, the print passes, and it goes into the bag`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`make/${m.slug}/`);
    await hydrated(page);
    await expect(page.locator("h1")).toHaveText(m.name);
    // Drawn, checked (the address carries the print only once it passes), no problem line.
    await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]make=/, { timeout: 15_000 });
    await expect(page.locator("[data-print-problem]")).toHaveCount(0);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.getByRole("button", { name: /^Add to bag · M · \$75$/ }).tap();
    await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByText(m.name, { exact: false }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
