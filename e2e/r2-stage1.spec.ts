import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

const B = "mono-0500";
const shopBack = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Shop", exact: true });

/** Open the first product in the grid (not B) and return its id. */
async function openFromGrid(page: import("@playwright/test").Page) {
  await page.goto("shop/");
  await hydrated(page);
  const card = page.locator(`main a[href*="/shop/mono-"]:not([href*="${B}"])`).first();
  const href = (await card.getAttribute("href"))!;
  await card.tap();
  await page.waitForURL(/\/shop\/mono-\d+\/$/);
  return href.match(/mono-\d+/)![0];
}

test.describe("R17: ← Shop after moving between products", () => {
  test("grid → product → ← Shop returns to the grid", async ({ page }) => {
    await seed(page);
    await openFromGrid(page);
    await shopBack(page).tap();
    await expect(page).toHaveURL(/\/shop\/$/);
  });

  test("grid → A → Saved → B → ← Shop returns to the grid, not A", async ({ page }) => {
    await seed(page, { likedIds: [B] });
    const a = await openFromGrid(page);
    await page.getByRole("button", { name: /^Saved \(/ }).tap();
    await page.getByRole("dialog", { name: "Saved tees" }).locator(`a[href*="${B}"]`).last().tap();
    await page.waitForURL(new RegExp(`${B}/$`));
    await shopBack(page).tap();
    await expect(page).toHaveURL(/\/shop\/$/);
    expect(page.url()).not.toContain(a);
  });

  test("grid → A → add to bag → mini bag → bag → B → ← Shop returns to the grid", async ({ page }) => {
    await seed(page);
    const a = await openFromGrid(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.locator(".sticky.bottom-0").getByRole("button", { name: /Add/ }).tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "View bag" }).tap();
    await page.waitForURL(/\/cart\/$/);
    const b = page.locator('main section a[href*="/shop/mono-"]').first();
    await b.tap();
    await page.waitForURL((u) => /\/shop\/mono-\d+\/$/.test(u.pathname) && !u.pathname.includes(a));
    await shopBack(page).tap();
    await expect(page).toHaveURL(/\/shop\/$/);
  });
});

test.describe("R25–R27, R29: bag, checkout and Saved", () => {
  const LINE = { id: "mono-0001", size: "M", color: "black", qty: 1 };

  test("R26: moving between checkout steps puts focus on the new step's heading", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout/ }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Delivery details" })).toBeFocused();
    await page.getByRole("button", { name: "Bag", exact: true }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeFocused();
  });

  test("R27: what was typed in Details survives a trip back to the bag", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout/ }).tap();
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("City").fill("Tel Aviv");
    await page.getByRole("button", { name: "Bag", exact: true }).tap();
    await page.getByRole("button", { name: /^Checkout/ }).tap();
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
    await expect(page.getByLabel("City")).toHaveValue("Tel Aviv");
  });

  test("R25: the order confirmation lists shipping before the total", async ({ page }) => {
    await seed(page, {}, [LINE]);
    await page.goto("cart/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Checkout/ }).tap();
    for (const [label, value] of [
      ["Full name", "Ada Lovelace"],
      ["Email", "ada@example.com"],
      ["Street address", "12 Analytical St"],
      ["City", "Tel Aviv"],
      ["Postcode / ZIP", "6100001"],
    ])
      await page.getByLabel(label).fill(value);
    await page.getByRole("button", { name: /Place demo order/ }).tap();
    await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
    const rows = page.locator("main ul li");
    await expect(rows.filter({ hasText: "Shipping" })).toContainText("$6");
    const text = await page.locator("main ul", { hasText: "Total" }).innerText();
    expect(text.indexOf("Shipping")).toBeLessThan(text.indexOf("Total"));
  });

  test("R29: a Saved row's picture link is out of the tab order and hidden from screen readers", async ({ page }) => {
    await seed(page, { likedIds: [B] });
    await page.goto("shop/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Saved \(/ }).tap();
    const row = page.locator(`[data-saved-row="${B}"]`);
    const pic = row.locator("a").first();
    await expect(pic).toHaveAttribute("tabindex", "-1");
    await expect(pic).toHaveAttribute("aria-hidden", "true");
  });
});
