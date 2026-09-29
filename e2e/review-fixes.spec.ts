import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";
import { make } from "./fixtures/custom";
import { drawing } from "./fixtures/uploads";

// Make and From yours draw and convert on the device: slow when the suite runs four at once.
test.describe.configure({ timeout: 120_000 });

const night = (d: string) => `make/night/?make=${make({ t: "night", v: 1, p: { d } })}`;
/** The phone's buy bar on a Make page. */
const buy = (page: Page) => page.locator("div.sticky button").filter({ hasText: /Add|Save|Choose|Added/ });
const cartItems = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("mono-cart") ?? "{}").state?.cart ?? []) as { size: string; qty: number; color: string; upload?: { id: string } }[]);

async function addNight(page: Page, d: string, size = "M") {
  await page.goto(night(d));
  await hydrated(page);
  await page.getByRole("radio", { name: new RegExp(`^${size}\\b`) }).first().tap();
  await expect(buy(page)).toHaveText(new RegExp(`^Add to bag · ${size} · \\$75$`), { timeout: 20_000 });
  await buy(page).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
}

test("B1: Edit from the bag replaces the Make line and keeps its quantity", async ({ page }) => {
  await addNight(page, "2021-11-19");
  await expect(buy(page)).toHaveText(/^Add to bag · M · \$75$/, { timeout: 5_000 });
  await buy(page).tap();
  expect(await cartItems(page)).toEqual([expect.objectContaining({ size: "M", qty: 2 })]);
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("link", { name: "Edit" }).first().tap();
  await expect(page).toHaveURL(/\/make\/night\/\?make=.*&edit=/);
  await expect(buy(page)).toHaveText(/^Save changes · M · \$75$/, { timeout: 20_000 });
  await page.getByRole("radio", { name: /^L\b/ }).first().tap();
  await expect(buy(page)).toHaveText(/^Save changes · L · \$75$/);
  await buy(page).tap();
  await page.waitForURL(/\/cart\/$/);
  // One line, not two: the same print in L, still two of it.
  expect(await cartItems(page)).toEqual([expect.objectContaining({ size: "L", qty: 2 })]);
});

test("B2 + B6: two Make prints of one kind tell apart in the bag, and checkout shows each one's own picture", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`make/night/?make=${make({ t: "night", v: 1, p: { d: "2021-11-19", w: "First" } })}`);
  await hydrated(page);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await expect(buy(page)).toHaveText(/^Add to bag · M · \$75$/, { timeout: 20_000 });
  await buy(page).tap();
  await page.goto(`make/night/?make=${make({ t: "night", v: 1, p: { d: "2021-11-19", w: "Second" } })}`);
  await hydrated(page);
  await expect(buy(page)).toHaveText(/^Add to bag · M · \$75$/, { timeout: 20_000 });
  await buy(page).tap();
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByText("Your Moon · 19 November 2021 · First")).toBeVisible();
  await expect(page.getByText("Your Moon · 19 November 2021 · Second")).toBeVisible();
  await page.getByRole("button", { name: /^Checkout/ }).tap();
  const items = page.getByRole("list", { name: "Items" }).locator("li");
  await expect(items).toHaveCount(2);
  // Each is its own print, drawn (never the base design's baked picture, never a broken image).
  await expect(items.locator("canvas[data-custom]")).toHaveCount(2);
  expect(errors.filter((e) => /same key|404/.test(e))).toEqual([]);
});

test("B5: Enter in a Make field closes the keyboard and never adds to the bag", async ({ page }) => {
  await page.goto(night("2021-11-19"));
  await hydrated(page);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await expect(buy(page)).toHaveText(/^Add to bag · M · \$75$/, { timeout: 20_000 });
  const field = page.locator("form input").first();
  await field.focus();
  await field.press("Enter");
  await page.waitForTimeout(500);
  expect(await cartItems(page)).toEqual([]);
  await expect(page.getByRole("region", { name: "Added to bag" })).toHaveCount(0);
});

test("M1 + B3: From yours is Start, Your print, Size; the rights are one line above the button; Change goes back to Your print", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.locator('[data-tile="words"]').tap();
  await page.locator("#upload-words").fill("SLOW\nMORNINGS");
  await expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("[data-primary]")).toHaveText(/^Next · \$75$/);
  await page.locator("[data-primary]").tap();
  await expect(page).toHaveURL(/#size$/);
  await expect(page.locator("[data-rights]")).toContainText("confirms you made it or have permission");
  await expect(page.locator("[data-rights]").getByRole("button", { name: "What we won’t print" })).toBeVisible();
  await page.locator("[data-summary]").getByRole("button", { name: "Change" }).tap();
  await expect(page).toHaveURL(/#print$/);
  await expect(page.locator('[data-step="print"]')).toBeVisible();
  await page.locator("[data-primary]").tap();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.locator("[data-primary]").tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  // No rights step anywhere in the flow.
  await expect(page).not.toHaveURL(/#rights/);
});

test("B8: editing an upload from the bag keeps each of its lines' size and quantity", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.locator("#upload-file").setInputFiles({ name: "rings.png", mimeType: "image/png", buffer: await drawing() });
  await expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 45_000 });
  await page.locator("[data-primary]").tap();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.locator("[data-primary]").tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  // The same print three times in M and once in L.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("mono-cart")!);
    const [line] = s.state.cart;
    s.state.cart = [{ ...line, qty: 3 }, { ...line, size: "L", qty: 1 }];
    localStorage.setItem("mono-cart", JSON.stringify(s));
  });
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("link", { name: "Edit" }).first().tap();
  await expect(page).toHaveURL(/\/make\/yours\/\?edit=.*#print$/);
  await expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 45_000 });
  await page.locator("[data-primary]").tap();
  // Straight to Size: the rights are the file's, confirmed when it was added.
  await expect(page).toHaveURL(/#size$/);
  await expect(page.locator("[data-primary]")).toHaveText(/^Save changes · /);
  await page.locator("[data-primary]").tap();
  await page.waitForURL(/\/cart\/$/);
  const lines = await cartItems(page);
  expect(lines.map((l) => [l.size, l.qty])).toEqual([
    ["M", 3],
    ["L", 1],
  ]);
  expect(new Set(lines.map((l) => l.upload?.id)).size).toBe(1);
});
