import { expect, test } from "@playwright/test";
import { captionLine, hydrated, seed } from "./helpers";
import { B1 } from "../tests/fixtures";

test("checkout: the phone's Back on Checkout returns to the bag, and Forward keeps what was typed", async ({ page }) => {
  await seed(page, {}, [{ id: B1, size: "M", color: "black", qty: 1 }]);
  await page.goto("shop/");
  await hydrated(page);
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Checkout · \$\d+$/ }).tap();
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  await expect(page).toHaveURL(/#details$/);
  await page.getByLabel("Full name").fill("Noa Levin");
  await page.goBack();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Noa Levin");
  // The on-page link does the same as Back.
  await page.getByRole("button", { name: "← Bag" }).tap();
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
  // The brand's error line and one way on (the overhaul's copy).
  await expect(page.locator("[data-load-failed]")).toHaveAttribute("role", "alert");
  await expect(page.locator("[data-load-failed]")).toContainText("Something went wrong.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("Make: a character the print can't set is named (never 'too long'), and Add brings the field into view with the focus", async ({ page }) => {
  await page.goto("make/sky/");
  await hydrated(page);
  const words = await captionLine(page, 0);
  await words.fill("שלום");
  const described = await words.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${described}"]`)).toHaveText(/We can’t print “ש”/);
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

test("shop grid on touch: the corner heart saves and unsaves without opening the tee; the rest of the card opens it", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  const card = page.locator("[data-product-card]").first();
  const box = (await card.boundingBox())!;
  const heart = card.getByRole("button", { name: /^Save / });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await page.touchscreen.tap(box.x + box.width - 22, box.y + 22);
  await expect(card.getByRole("button", { name: /^Remove .+ from Saved$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/shop\/$/);
  await page.touchscreen.tap(box.x + box.width - 22, box.y + 22);
  await expect(card.getByRole("button", { name: /^Save / })).toHaveAttribute("aria-pressed", "false");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 3);
  await expect(page).toHaveURL(/\/shop\/(p\/\?id=)?mono-/);
});

test("shop grid: a design in the bag says so on its card (In bag); the others don't", async ({ page }) => {
  await seed(page, {}, [{ id: B1, size: "M", color: "black", qty: 1 }]);
  await page.goto(`shop/${B1}/`);
  await hydrated(page);
  const title = (await page.getByRole("heading", { level: 1 }).first().textContent())!.trim();
  // Find it by its name (the shop's order rotates): its card carries the tag, and the link says so.
  await page.goto(`shop/?q=${encodeURIComponent(title)}`);
  await hydrated(page);
  const b1 = page.locator("[data-product-card]").filter({ has: page.locator(`a[href*="/shop/${B1}/"]`) }).first();
  await expect(b1.locator("[data-in-bag]")).toHaveText("In bag");
  await expect(b1.getByRole("link")).toHaveAccessibleName(/, in your bag/);
  const others = page.locator("[data-product-card]").filter({ hasNot: page.locator(`a[href*="/shop/${B1}/"]`) });
  await expect(others.locator("[data-in-bag]")).toHaveCount(0);
});

test("a white message bar swipes away to the left: the bag confirmation and a toast with Undo; a short drag springs back", async ({ page }) => {
  const swipe = async (box: { x: number; y: number; width: number; height: number }, dx: number) => {
    const y = box.y + box.height / 2;
    const x = box.x + box.width * 0.4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y, { steps: 2 });
    await page.mouse.up();
  };
  await seed(page);
  await page.goto(`shop/${B1}/`);
  await hydrated(page);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M/ }).last().tap();
  const added = page.getByRole("region", { name: "Added to bag" });
  await expect(added).toBeVisible();
  // A short drag: it stays.
  await swipe((await added.boundingBox())!, -40);
  await page.waitForTimeout(400);
  await expect(added).toBeVisible();
  // A swipe left: it goes, long before its 5 s.
  await swipe((await added.boundingBox())!, -220);
  await expect(added).toHaveCount(0, { timeout: 1500 });
  // A toast with Undo (unsaving a tee from a shop card) swipes away the same way.
  await page.goto("shop/");
  await hydrated(page);
  const card = page.locator("[data-product-card]").first();
  await card.getByRole("button", { name: /^Save / }).tap();
  await card.getByRole("button", { name: /^Remove .+ from Saved$/ }).tap();
  const toast = page.getByRole("status").filter({ hasText: "Removed from Saved" });
  await expect(toast).toBeVisible();
  // (The first save's "Saved" may still be leaving: take the bar that says "Removed from Saved".)
  await swipe((await toast.locator("div").filter({ hasText: "Removed from Saved" }).last().boundingBox())!, -220);
  await expect(page.getByText("Removed from Saved")).toHaveCount(0, { timeout: 1500 });
});

test("In bag shows wherever the design is shown: the product page's picture, the saved list, and a Discover card bought with Buy", async ({ page }) => {
  // Product page and saved list: a design already in the bag (an earlier visit).
  await seed(page, { likedIds: [B1] }, [{ id: B1, size: "M", color: "black", qty: 1 }]);
  await page.goto(`shop/${B1}/`);
  await hydrated(page);
  await expect(page.locator("main [data-in-bag]").first()).toHaveText("In bag");
  await page.goto("me/");
  await hydrated(page);
  await expect(page.locator(`[data-saved-row="${B1}"] [data-in-bag]`)).toContainText("In bag");
  await expect(page.locator("[data-saved-row]").filter({ hasNot: page.locator("[data-in-bag]") }).first()).toBeVisible();
  // Discover: Buy on the card, and the card says so.
  await page.goto("");
  await hydrated(page);
  const card = page.locator('[aria-roledescription="card"]').first();
  const title = (await card.locator("h2").first().textContent())!;
  await expect(card.locator("[data-in-bag]")).toHaveCount(0);
  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  const sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await sheet.getByRole("radio", { name: /^M\b/ }).tap();
  await sheet.getByRole("button", { name: "Add to bag", exact: true }).tap();
  await expect(sheet).toHaveCount(0);
  await expect(card.locator("[data-in-bag]")).toHaveText("In bag");
});
