import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { CALIBRATION_IDS, hydrated, seed } from "./helpers";

const OUT = path.resolve(__dirname, "..", "out");
const html = (route: string) => readFileSync(path.join(OUT, route, route.endsWith(".html") ? "" : "index.html"), "utf8");
const ldTypes = (page: string) => [...page.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]);

test.describe("static HTML (what crawlers read) — R08, R22, F03, R32", () => {
  test("home: an H1, how it works, canonical, Organization + WebSite", () => {
    const page = html("");
    expect(page).toMatch(/<h1[^>]*>Swipe (<!-- -->)?10(<!-- -->)? tees\. Get a shop ranked for you\.<\/h1>/);
    expect(page).toContain("swipes → your shop.");
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/"\/>/);
    expect(page).toMatch(/<meta property="og:url" content="[^"]+\/"\/>/);
    expect(page).toContain('<link rel="sitemap" type="application/xml"');
    expect(ldTypes(page)).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
  });

  test("shop: an H1, a real 'Show more' link, canonical", () => {
    const page = html("shop");
    expect(page).toMatch(/<h1[^>]*>Shop /);
    expect(page).toContain('href="/shop/?page=2"');
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/shop\/"\/>/);
  });

  test("product: links onward, ProductGroup with offers and policies, breadcrumb, og:type product", () => {
    const page = html("shop/mono-0001");
    const nav = page.match(/aria-label="More like this"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const links = [...nav.matchAll(/href="(\/shop\/mono-\d{4}\/)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(6);
    expect(links.length).toBeLessThanOrEqual(8);
    const types = ldTypes(page);
    expect(types).toEqual(expect.arrayContaining(["ProductGroup", "BreadcrumbList", "OfferShippingDetails", "MerchantReturnPolicy", "Organization"]));
    expect(types.filter((t) => t === "Offer")).toHaveLength(24); // 2 colours × 12 sizes
    expect(page).toContain('"variesBy":["https://schema.org/color","https://schema.org/size"]');
    expect(page).toContain('"itemCondition":"https://schema.org/NewCondition"');
    expect(page).toMatch(/"priceValidUntil":"\d{4}-12-31"/);
    expect(page).toContain('<meta property="og:type" content="product"/><meta property="product:price:amount" content="48.00"/>');
    expect(page).toMatch(/<link rel="canonical" href="[^"]+\/shop\/mono-0001\/"\/>/);
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
    for (const id of ids) expect(existsSync(path.join(og, `${id}.png`)), id).toBe(true);
  });
});

test.describe("shared links (F04) and the empty bag (F05)", () => {
  test("a shared tee: the page stays until asked; 'Save & find more like it' saves and starts the test", async ({ page }) => {
    await page.goto("shop/mono-0501/?c=white&ref=whatsapp&utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share");
    await hydrated(page);
    const banner = page.getByRole("status").filter({ hasText: "A friend shared this tee" });
    await expect(banner).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/shop\/mono-0501\/$/);
    await expect(banner.getByRole("link")).toHaveCount(0);
    await banner.getByRole("button", { name: "Save & find more like it" }).tap();
    await page.waitForURL((u) => u.pathname === "/" || u.pathname.endsWith("/MONO/"));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste")!).state.likedIds);
    expect(saved).toContain("mono-0501");
  });

  test("a friend's taste link greets with their archetype", async ({ page }) => {
    await page.goto(`?taste=${"2i" + "0a".repeat(15)}`);
    await hydrated(page);
    await expect(page.getByText(/^Your friend is The [A-Za-z ]+ — swipe 10 to see how alike you are$/)).toBeVisible();
  });

  test("an empty bag starts from Saved: three with quick add", async ({ page }) => {
    await seed(page, { likedIds: ["mono-0501", "mono-0601", "mono-0701", "mono-0801"], calibrated: false });
    await page.goto("cart/");
    await hydrated(page);
    const section = page.locator("section", { has: page.getByRole("heading", { name: "From your Saved" }) });
    await expect(section).toBeVisible();
    await expect(section.locator('a[href*="/shop/mono-"]')).toHaveCount(3);
    await expect(section.getByRole("button", { name: /^Quick add|^Add / })).toHaveCount(3);
    expect(CALIBRATION_IDS.length).toBe(10);
  });

  test("shop/?page=2 opens with two pages of tees", async ({ page }) => {
    await page.goto("shop/?page=2");
    await hydrated(page);
    await expect(page.locator("main .grid > div")).toHaveCount(48);
    await expect(page).toHaveURL(/\/shop\/$/);
  });
});
