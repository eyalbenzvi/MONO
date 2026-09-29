import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";
import { B1 } from "../tests/fixtures";

test("checkout: the phone's Back on Delivery details returns to the bag, and Forward keeps what was typed", async ({ page }) => {
  await seed(page, {}, [{ id: B1, size: "M", color: "black", qty: 1 }]);
  await page.goto("shop/");
  await hydrated(page);
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Checkout/ }).tap();
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
  await expect(page).toHaveURL(/#details$/);
  await page.getByLabel("Full name").fill("Noa Levin");
  await page.goBack();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Noa Levin");
  // The on-page link does the same as Back.
  await page.getByRole("button", { name: "Bag" }).tap();
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
});

test("the bag's heading isn't focused (no ring) when the bag page simply loads", async ({ page }) => {
  await seed(page, {}, [{ id: B1, size: "M", color: "black", qty: 1 }]);
  await page.goto("cart/");
  await hydrated(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("H1");
});

test("a catalogue that won't load says so, with a reload, instead of a page that never wakes", async ({ page }) => {
  await page.route(/\/data\/index\.\w+\.json/, (r) => r.abort());
  await page.goto("shop/");
  await expect(page.locator("[data-load-failed]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});

test("Make: a character the print can't set is named (never 'too long'), and Add brings the field into view with the focus", async ({ page }) => {
  await page.goto("make/sky/");
  await hydrated(page);
  const words = page.getByLabel(/^Your words/);
  await words.fill("שלום");
  await expect(page.locator("#make-words-error")).toHaveText(/We can’t print “ש”/);
  await expect(words).toHaveAttribute("aria-describedby", "make-words-error");
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M/ }).tap();
  await expect(words).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mono-cart") ?? "{}").state?.cart ?? [])).toEqual([]);
});

test("shop search on a phone: what's typed is never cut off", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  await page.getByRole("button", { name: "Search" }).last().tap();
  const field = page.getByRole("combobox", { name: "Search tees" });
  await field.fill("botanical");
  // The whole word fits: the field isn't scrolled to hide its start.
  const { scroll, width, fits } = await field.evaluate((el: HTMLInputElement) => ({ scroll: el.parentElement!.scrollLeft, width: el.clientWidth, fits: el.scrollWidth <= el.clientWidth + 1 }));
  expect(scroll).toBe(0);
  expect(width).toBeGreaterThan(100);
  expect(fits).toBe(true);
});

test("shop grid on touch: tapping a card's corner opens the tee (the hidden heart doesn't take the tap)", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  const card = page.locator("[data-product-card]").first();
  const box = (await card.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width - 18, box.y + 18);
  await expect(page).toHaveURL(/\/shop\/(p\/\?id=)?mono-/);
});
