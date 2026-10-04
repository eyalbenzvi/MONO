import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PRICE } from "../scripts/gen/constants";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { CALIBRATION_IDS, hydrated, seed } from "./helpers";
import { B1, B2, B3, B9, W1 } from "../tests/fixtures";

const OUT = path.resolve(__dirname, "..", "out");
const html = (route: string) => readFileSync(path.join(OUT, route, route.endsWith(".html") ? "" : "index.html"), "utf8");
const ldTypes = (page: string) => [...page.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]);

test.describe("static HTML (what crawlers read) — R08, R22, F03, R32", () => {
  test("home: an H1 that says what the ten cards are for, the description, canonical, Organization + WebSite", () => {
    const page = html("");
    // The H1 is the strip's first line; the description says how it works.
    expect(page).toMatch(/<h1[^>]*>Ten tees\. Keep or pass\. We’ll edit the shop to your taste\.<\/h1>/);
    expect(page).toContain('<meta name="description" content="One-ink tees in black and white. Swipe ten and the shop edits itself to your taste."/>');
    expect(page).toContain("<title>MONO · Black and white tees, one ink</title>");
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/"\/>/);
    expect(page).toMatch(/<meta property="og:url" content="[^"]+\/"\/>/);
    expect(page).toContain('<link rel="sitemap" type="application/xml"');
    expect(ldTypes(page)).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
  });

  test("shop: an H1, a real 'Show more' link, canonical", () => {
    const page = html("shop");
    // The static H1 is the default order's name (no personal data before the page runs).
    expect(page).toMatch(/<h1[^>]*>Our pick<\/h1>/);
    expect(page).toContain('href="/shop/?page=2"');
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/shop\/"\/>/);
  });

  test("product: links onward, ProductGroup with offers and policies, breadcrumb, og:type product", () => {
    const page = html(`shop/${W1}`);
    const nav = page.match(/aria-label="More like this"[\s\S]*?<\/nav>/)?.[0] ?? "";
    // Pre-rendered designs link to their page, the rest to the client route (/shop/p/?id=).
    const links = [...nav.matchAll(/href="(\/shop\/mono-\d{4}\/|\/shop\/p\/\?id=mono-\d{4})"/g)];
    expect(links.length).toBeGreaterThanOrEqual(4);
    expect(links.length).toBeLessThanOrEqual(8);
    const types = ldTypes(page);
    expect(types).toEqual(expect.arrayContaining(["ProductGroup", "BreadcrumbList", "OfferShippingDetails", "MerchantReturnPolicy", "Organization"]));
    expect(types.filter((t) => t === "Offer")).toHaveLength(24); // 2 colours × 12 sizes
    expect(page).toContain('"variesBy":["https://schema.org/color","https://schema.org/size"]');
    expect(page).toContain('"itemCondition":"https://schema.org/NewCondition"');
    expect(page).toMatch(/"priceValidUntil":"\d{4}-12-31"/);
    expect(page).toContain(`<meta property="og:type" content="product"/><meta property="product:price:amount" content="${PRICE}.00"/>`);
    expect(page).toMatch(new RegExp(`<link rel="canonical" href="[^"]+/shop/${W1}/"/>`));
  });

  test("404: canonical and noindex", () => {
    const page = html("404.html");
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/"\/>/);
    expect(page).toContain('<meta name="robots" content="noindex"/>');
  });

  test("R32: every pre-rendered product page has its link-preview image", () => {
    const og = path.join(OUT, "og");
    test.skip(!existsSync(og) || readdirSync(og).length < 2, "link-preview images not generated in this build (npm run og)");
    const ids = readdirSync(path.join(OUT, "shop")).filter((d) => /^mono-\d{4}$/.test(d));
    for (const id of ids) expect(existsSync(path.join(og, `${id}.jpg`)), id).toBe(true);
  });
});

test.describe("shared links (F04) and the empty bag (F05)", () => {
  test("a shared tee: one quiet line (Shared with you, Dismiss) and the page stays; saving it starts the taste test from it", async ({ page }) => {
    // B2 is not one of the ten test cards (B9 is card 1: saving it would count as that answer).
    expect(CALIBRATION_IDS).not.toContain(B2);
    await page.goto(`shop/${B2}/?c=white&ref=whatsapp&utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share`);
    await hydrated(page);
    const line = page.getByText("Shared with you", { exact: true });
    await expect(line).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/shop/${B2}/$`));
    // No "Save & find more like it": the line only says where the tee came from.
    await expect(page.getByRole("button", { name: /Save & find more like it/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /^White tee/ })).toBeChecked();
    // Saving is the tee's own heart; Discover then starts from it.
    // (The cards of "more like this" carry hearts too: this tee's own is named by its title, outside them.)
    const title = (await page.getByRole("heading", { level: 1 }).first().textContent())!.trim();
    await page.locator(":not([data-product-card]) > button").and(page.getByRole("button", { name: `Save ${title}`, exact: true })).filter({ visible: true }).first().tap();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste")!).state.likedIds)).toContain(B2);
    await page.getByRole("button", { name: "Dismiss" }).tap();
    await expect(line).toHaveCount(0);
    await page.goto("");
    await hydrated(page);
    await expect(page.locator("[data-strip]:visible")).toHaveText(/^Saved .+\. Ten more and your edit is ready\.$/);
  });

  test("a friend's taste link greets with their archetype", async ({ page }) => {
    await page.goto(`?taste=${"2i" + "0a".repeat(15)}`);
    await hydrated(page);
    await expect(page.locator("[data-strip]:visible")).toHaveText(/^Your friend is The [A-Za-z ]+\. Swipe ten to compare\.$/);
  });

  test("an empty bag says so and leads on: the taste test before it, your edit after — no Picked for you", async ({ page }) => {
    await seed(page, { likedIds: [B9, B1, B2, B3], calibrated: false });
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Picked for you" })).toHaveCount(0);
    await expect(page.locator('main a[href*="/shop/mono-"]')).toHaveCount(0);
    const start = page.getByRole("link", { name: "Start the taste test" });
    await expect(start).toHaveAttribute("href", /\/$/);
    await expect(page.getByRole("link", { name: "See your edit" })).toHaveCount(0);
    expect(CALIBRATION_IDS.length).toBe(10);
  });

  test("an empty bag after the taste test leads to your edit", async ({ page }) => {
    await seed(page);
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your edit" })).toHaveAttribute("href", /\/shop\/$/);
    await expect(page.getByRole("link", { name: "Start the taste test" })).toHaveCount(0);
  });

  test("shop/?page=2 opens with two pages of tees", async ({ page }) => {
    await page.goto("shop/?page=2");
    await hydrated(page);
    await expect(page.locator("main .grid > div")).toHaveCount(48);
    await expect(page).toHaveURL(/\/shop\/$/);
  });
});

test("a short link lands with its # tag: the channel says Shared with you, the colour opens, and the tag leaves the address", async ({ page }) => {
  await page.goto(`shop/${W1}/#w-b`);
  await hydrated(page);
  await expect(page.getByText("Shared with you", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Black tee/ })).toBeChecked();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  const landing = await page.evaluate(() => (window.dataLayer ?? []).find((e: { event?: string }) => e.event === "landing"));
  expect(landing).toMatchObject({ utm_source: "whatsapp", utm_medium: "share", utm_campaign: "tee_share" });
});
