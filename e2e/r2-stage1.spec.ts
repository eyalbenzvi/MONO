import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed, openSaved } from "./helpers";
import { B9, W1 } from "../tests/fixtures";

const B = B9;
/** The product page's old "← Shop" row (removed: Back returns to the grid). */
const shopBack = (page: Page) => page.getByRole("link", { name: /← Shop/ }).or(page.getByRole("button", { name: "Shop", exact: true }));

/** A product page's address: pre-rendered (/shop/<id>/) or the client page (/shop/p/?id=<id>). */
const productUrl = (id: string) => new RegExp(`/shop/(${id}/|p/\\?id=${id})$`);

/** The grid's nth card link (not B). */
const gridCard = (page: Page, nth: number) => page.locator(`[data-product-card] a[href*="mono-"]:not([href*="${B}"])`).nth(nth);

/** Open a product in the grid (not B; the nth card, 0-based) and return its id. */
async function openFromGrid(page: Page, nth = 0) {
  await page.goto("shop/");
  await hydrated(page);
  const card = gridCard(page, nth);
  await card.scrollIntoViewIfNeeded();
  const href = (await card.getAttribute("href"))!;
  const id = href.match(/mono-\d+/)![0];
  await card.tap();
  await page.waitForURL(productUrl(id));
  return id;
}

/** The shop's scroller (the grid scrolls inside it, not the window). */
const scrollTop = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector("[data-product-card]");
    let el = grid?.parentElement ?? null;
    while (el && !(el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== "visible")) el = el.parentElement;
    return el ? el.scrollTop : window.scrollY;
  });

test.describe("R17: Back after moving between products (no ← Shop row)", () => {
  test("grid → product → Back returns to the grid where it was", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    // A card further down, so the grid has to scroll to reach it.
    const card = gridCard(page, 9);
    await card.scrollIntoViewIfNeeded();
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(0);
    const href = (await card.getAttribute("href"))!;
    await card.tap();
    await page.waitForURL((u) => !/\/shop\/$/.test(u.pathname));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(shopBack(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/shop\/$/);
    await expect(page.locator(`main a[href="${href}"]`).first()).toBeInViewport();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before / 2);
  });

  test("grid → A → You → B → Back returns to You, then to A, then to the grid", async ({ page }) => {
    await seed(page, { likedIds: [B] });
    const a = await openFromGrid(page);
    await openSaved(page);
    await page.getByRole("list", { name: "Saved" }).locator(`[data-saved-row="${B}"] a[href*="${B}"]:not([aria-hidden])`).tap();
    await page.waitForURL(new RegExp(`${B}/$`));
    await expect(shopBack(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/me\/$/);
    await expect(page.getByRole("list", { name: "Saved" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(productUrl(a));
    await page.goBack();
    await expect(page).toHaveURL(/\/shop\/$/);
  });

  test("grid → A → add to bag → mini bag → bag → B → Back returns to A, then the grid", async ({ page }) => {
    await seed(page);
    const a = await openFromGrid(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.getByRole("button", { name: /^Add to bag · M · \$\d+$/ }).tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Checkout" }).tap();
    // Checkout lands on the delivery form, a step of its own: Back goes to the bag, then to the product.
    await page.waitForURL(/\/cart\/#details$/);
    await page.goBack();
    await page.waitForURL(/\/cart\/$/);
    await page.goBack();
    await page.waitForURL(productUrl(a));
    const b = page.locator('section [data-product-card] a[href*="mono-"]').last();
    await b.scrollIntoViewIfNeeded();
    await b.tap();
    await page.waitForURL((u) => /mono-\d+/.test(u.href) && !u.href.includes(a));
    await expect(shopBack(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(productUrl(a));
    await page.goBack();
    await expect(page).toHaveURL(/\/shop\/$/);
  });
});

test.describe("R25–R27, R29: bag, checkout and Saved", () => {
  const LINE = { id: W1, size: "M", color: "black", qty: 1 };

  test("R26: moving between checkout steps puts focus on the new step's heading", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout · \$\d+$/ }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: "Delivery" })).toBeVisible();
    await page.getByRole("button", { name: "← Bag" }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeFocused();
  });

  test("R27: what was typed in Checkout survives a trip back to the bag", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout · / }).tap();
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("City").fill("Tel Aviv");
    await page.getByRole("button", { name: "← Bag" }).tap();
    await page.getByRole("button", { name: /^Checkout · / }).tap();
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
    await expect(page.getByLabel("City")).toHaveValue("Tel Aviv");
  });

  test("R25: the order confirmation lists shipping before the total", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout · / }).tap();
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Country").selectOption("IL");
    for (const [label, value] of [
      ["Address", "12 Analytical St"],
      ["City", "Tel Aviv"],
      ["Postcode / ZIP", "6100001"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await expect(page.getByText("Preview store. No payment is taken and nothing ships.")).toBeVisible();
    await page.getByRole("button", { name: /^Place order · \$\d+$/ }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, Ada." })).toBeVisible();
    await expect(page.getByText(/^Order .+ is confirmed\.$/)).toBeVisible();
    const rows = page.locator("main ul li");
    await expect(rows.filter({ hasText: "Shipping" })).toContainText("$10");
    const text = await page.locator("main ul", { hasText: "Total" }).innerText();
    expect(text.indexOf("Shipping")).toBeLessThan(text.indexOf("Total"));
    await expect(page.getByRole("link", { name: "Continue shopping" })).toBeVisible();
  });

  test("R29: a Saved row's picture link is out of the tab order and hidden from screen readers", async ({ page }) => {
    await seed(page, { likedIds: [B] });
    await page.goto("shop/");
    await hydrated(page);
    await openSaved(page);
    const row = page.locator(`[data-saved-row="${B}"]`);
    const pic = row.locator("a").first();
    await expect(pic).toHaveAttribute("tabindex", "-1");
    await expect(pic).toHaveAttribute("aria-hidden", "true");
  });
});
