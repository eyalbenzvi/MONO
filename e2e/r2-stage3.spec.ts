import { expect, test, type Page } from "@playwright/test";
import { PRICE } from "../scripts/gen/constants";
import { hydrated, seed } from "./helpers";
import { W1 } from "../tests/fixtures";

type Ev = Record<string, any> & { event: string };
const layer = (page: Page) => page.evaluate(() => (window.dataLayer ?? []) as Ev[]);
const count = (evs: Ev[], name: string) => evs.filter((e) => e.event === name).length;
/** The product page's buy button on a phone (the page's own bottom bar; the desktop copy is hidden). */
const buyButton = (page: Page) => page.getByRole("button", { name: /^(Add to bag|Add the pair|Complete the pair|In your bag)/ }).filter({ visible: true });

test("R02/R06: a whole funnel sends each event once, with attribution carried to the purchase", async ({ page }) => {
  await seed(page);
  await page.goto("shop/?utm_source=news&utm_medium=email&utm_campaign=drop&ref=friend");
  await hydrated(page);
  // The grid, a product, add, bag, checkout, purchase — all client-side.
  const card = page.locator('main a[href*="/shop/mono-"]').first();
  await card.tap();
  await page.waitForURL(/\/shop\/mono-\d+\/$/);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await expect(buyButton(page)).toHaveText(`Add to bag · M · $${PRICE}`);
  await buyButton(page).tap();
  // The confirmation's Checkout goes straight to the checkout form.
  await page.getByRole("region", { name: "Added to bag" }).getByRole("link", { name: "Checkout" }).tap();
  await page.waitForURL(/\/cart\/(#details)?$/);
  await expect(page.getByRole("heading", { name: "Checkout", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delivery" })).toBeVisible();
  for (const [label, value] of [
    ["Email", "ada@example.com"],
    ["Full name", "Ada Lovelace"],
    ["Address", "12 Analytical St"],
    ["City", "Tel Aviv"],
    ["Postcode / ZIP", "6100001"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Country").selectOption("IL");
  // $50 + $10 shipping (free from two tees).
  await page.getByRole("button", { name: /^Place order · \$\d+$/ }).tap();
  await expect(page.getByRole("heading", { name: "Thank you, Ada." })).toBeVisible();

  const evs = await layer(page);
  const once = ["landing", "shop_view", "view_item_list", "select_item", "view_item", "add_to_cart", "begin_checkout", "purchase"];
  for (const name of once) expect(count(evs, name), name).toBe(1);
  // The mini bag's Checkout opens the form directly: the bag itself was never on screen, so no view_cart.
  expect(count(evs, "view_cart")).toBe(0);
  expect(evs.find((e) => e.event === "landing")).toMatchObject({ utm_source: "news", utm_medium: "email", utm_campaign: "drop", ref: "friend", landing_path: "/shop/" });
  expect(evs.find((e) => e.event === "shop_view")).toMatchObject({ sort: "match" });
  expect(evs.find((e) => e.event === "add_to_cart")).toMatchObject({ source: "product", value: PRICE, currency: "USD" });
  const purchase = evs.find((e) => e.event === "purchase")!;
  expect(purchase.first_touch).toMatchObject({ utm_source: "news", ref: "friend" });
  expect(JSON.stringify(evs)).not.toContain("ada@example.com");
  // page_view: one per page, never twice in a row for the same page.
  const views = evs.filter((e) => e.event === "page_view").map((e) => e.page_path);
  expect(views).toEqual(["/shop/", expect.stringMatching(/^\/shop\/mono-\d+\/$/), "/cart/"]);
  expect(count(evs, "email_signup")).toBe(0);
});

test("R02: tags are recorded before they leave the address bar (shared product link)", async ({ page }) => {
  await page.goto(`shop/${W1}/?c=black&ref=whatsapp&utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share`);
  await hydrated(page);
  await expect(page).toHaveURL(new RegExp(`/shop/${W1}/$`));
  const landing = (await layer(page)).find((e) => e.event === "landing");
  expect(landing).toMatchObject({ utm_source: "whatsapp", ref: "whatsapp", utm_campaign: "tee_share" });
});

test("R06: a dismissed share sheet sends nothing; a copied link counts once", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })) });
  });
  await seed(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`shop/${W1}/`);
  await hydrated(page);
  // Share sits beside the title (no ⋯ menu any more).
  await expect(page.getByRole("button", { name: /^More for / })).toHaveCount(0);
  await page.getByRole("button", { name: /^Share / }).tap();
  const sheet = page.getByRole("dialog", { name: /^Share / });
  await sheet.getByRole("button", { name: "Share…" }).tap();
  await page.waitForTimeout(300);
  expect(count(await layer(page), "share")).toBe(0);
  await sheet.getByRole("button", { name: "Copy link" }).tap();
  await page.waitForTimeout(300);
  expect((await layer(page)).filter((e) => e.event === "share")).toEqual([expect.objectContaining({ channel: "copy", method: "copied" })]);
});
