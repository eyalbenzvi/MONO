import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";

type Ev = Record<string, any> & { event: string };
const layer = (page: Page) => page.evaluate(() => (window.dataLayer ?? []) as Ev[]);
const count = (evs: Ev[], name: string) => evs.filter((e) => e.event === name).length;

test("R02/R06: a whole funnel sends each event once, with attribution carried to the purchase", async ({ page }) => {
  await seed(page);
  await page.goto("shop/?utm_source=news&utm_medium=email&utm_campaign=drop&ref=friend");
  await hydrated(page);
  // The grid, a product, add, bag, checkout, purchase — all client-side.
  const card = page.locator('main a[href*="/shop/mono-"]').first();
  await card.tap();
  await page.waitForURL(/\/shop\/mono-\d+\/$/);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.locator(".sticky.bottom-0").getByRole("button").last().tap();
  await page.getByRole("region", { name: "Added to bag" }).getByRole("link", { name: "View bag" }).tap();
  await page.waitForURL(/\/cart\/$/);
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

  const evs = await layer(page);
  const once = ["landing", "shop_view", "view_item_list", "select_item", "view_item", "add_to_cart", "view_cart", "begin_checkout", "purchase"];
  for (const name of once) expect(count(evs, name), name).toBe(1);
  expect(evs.find((e) => e.event === "landing")).toMatchObject({ utm_source: "news", utm_medium: "email", utm_campaign: "drop", ref: "friend", landing_path: "/shop/" });
  expect(evs.find((e) => e.event === "shop_view")).toMatchObject({ sort: "match" });
  expect(evs.find((e) => e.event === "add_to_cart")).toMatchObject({ source: "product", value: 48, currency: "USD" });
  const purchase = evs.find((e) => e.event === "purchase")!;
  expect(purchase.first_touch).toMatchObject({ utm_source: "news", ref: "friend" });
  expect(JSON.stringify(evs)).not.toContain("ada@example.com");
  // page_view: one per page, never twice in a row for the same page.
  const views = evs.filter((e) => e.event === "page_view").map((e) => e.page_path);
  expect(views).toEqual(["/shop/", expect.stringMatching(/^\/shop\/mono-\d+\/$/), "/cart/"]);
  expect(count(evs, "email_signup")).toBe(0);
});

test("R02: tags are recorded before they leave the address bar (shared product link)", async ({ page }) => {
  await page.goto("shop/mono-0001/?c=black&ref=whatsapp&utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share");
  await hydrated(page);
  await expect(page).toHaveURL(/\/shop\/mono-0001\/$/);
  const landing = (await layer(page)).find((e) => e.event === "landing");
  expect(landing).toMatchObject({ utm_source: "whatsapp", ref: "whatsapp", utm_campaign: "tee_share" });
});

test("R06: a dismissed share sheet sends nothing; a copied link counts once", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })) });
  });
  await seed(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("shop/mono-0001/");
  await hydrated(page);
  await page.getByRole("button", { name: /^More for / }).tap();
  await page.getByRole("button", { name: "Share", exact: true }).tap();
  const sheet = page.getByRole("dialog", { name: /^Share / });
  await sheet.getByRole("button", { name: "Share…" }).tap();
  await page.waitForTimeout(300);
  expect(count(await layer(page), "share")).toBe(0);
  await sheet.getByRole("button", { name: "Copy link" }).tap();
  await page.waitForTimeout(300);
  expect((await layer(page)).filter((e) => e.event === "share")).toEqual([expect.objectContaining({ channel: "copy", method: "copied" })]);
});
