import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import { MADE, MAKE_GROUPS } from "../lib/custom/products";
import { EXTRA } from "../lib/custom/specs";
import { make } from "./fixtures/custom";

/** Products whose fields start empty (M12): the stage shows the example until something is typed. */
const EMPTY = new Set(["family", "metro", "orbits", "weeks", "island", "rings", "crossword", "snowflake", "qr", "telegram", "editions", "sayings", "label"]);

/** The later products that ship (lib/custom/products SHIPPED): each is its own template. */
const LATER = MADE.filter((m) => Object.hasOwn(EXTRA, m.template));

test("every later product is on the Make index, in its group", async ({ page }) => {
  await page.goto("make/");
  await hydrated(page);
  for (const m of LATER) await expect(page.locator(`ul[data-group="${m.group}"] [data-made="${m.slug}"]`), m.slug).toHaveCount(1);
});

test("the Make index draws nothing: every card is its baked picture; one that won't load is drawn instead", async ({ page }) => {
  await page.route("**/img/make/moon-*.webp", (r) => r.abort());
  await page.goto("make/");
  await hydrated(page);
  const baked = page.locator("img[data-card-baked]");
  // Every product, and For two, less the one whose picture failed.
  await expect(baked).toHaveCount(MADE.length);
  await expect(page.locator('[data-made="sky"]').locator("xpath=../..").locator("img[data-card-baked]")).toHaveJSProperty("complete", true);
  // Only the failed card draws (and nothing else runs the drawing code).
  await expect(page.locator("canvas[data-custom]")).toHaveCount(1, { timeout: 20_000 });
});

test("the Make index's filter shows only the groups chosen, keeps them in the address, and All brings the rest back", async ({ page }) => {
  let crashed = false;
  page.on("crash", () => (crashed = true));
  await page.goto("make/");
  await hydrated(page);
  await page.getByRole("button", { name: "Categories" }).tap();
  await page.getByRole("checkbox", { name: /^From a name/ }).tap();
  await expect(page.getByRole("checkbox", { name: /^From a name/ })).toBeChecked();
  await expect(page).toHaveURL(/[?&]g=name$/);
  await expect(page.locator("ul[data-group]")).toHaveCount(1);
  await expect(page.locator('ul[data-group="name"]')).toHaveCount(1);
  await page.getByRole("checkbox", { name: /^From a place/ }).tap();
  await expect(page.getByRole("checkbox", { name: /^From a place/ })).toBeChecked();
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
  expect(crashed).toBe(false);
});

test("the Make index survives a filter changed again and again (each card's canvases give their memory back when hidden)", async ({ page }) => {
  let crashed = false;
  page.on("crash", () => (crashed = true));
  await page.goto("make/?g=date");
  await hydrated(page);
  await page.getByRole("button", { name: /^Categories/ }).tap();
  // Eight cards appear and go, twenty times: before the fix, the tab ran out of canvas memory within a few.
  for (let i = 0; i < 20; i++) {
    await page.getByRole("checkbox", { name: /^From a name/ }).tap();
    await page.waitForTimeout(150);
  }
  expect(crashed).toBe(false);
  await expect(page.getByRole("checkbox", { name: /^From a date/ })).toBeChecked();
});

for (const m of LATER)
  test(`${m.name}: the page opens with its example drawn, the print passes, and it goes into the bag`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`make/${m.slug}/`);
    await hydrated(page);
    await expect(page.locator("h1")).toHaveText(m.name);
    // The example is on the stage from the start.
    await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
    if (EMPTY.has(m.slug)) {
      // Empty fields: the example only shows (the address carries nothing, and nothing is on offer yet); a link with the print fills them.
      await page.waitForTimeout(1000);
      await expect(page).not.toHaveURL(/[?&]make=/);
      await page.goto(`make/${m.slug}/?make=${make(m.example)}`);
      await hydrated(page);
    }
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
