import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { CALIBRATION_IDS, hydrated, seed } from "./helpers";

/**
 * Discover's first card is on screen before any script runs (lib/firstCard):
 * it used to wait for the scripts, the catalogue index, the saved taste and the
 * deck, and every catalogue change brought the empty frame back.
 */
const shirts = full as { id: string; n: number; baseColor: string }[];
const FIRST = shirts.find((s) => s.id === CALIBRATION_IDS[0])!;
const firstPicture = `/img/m/${FIRST.n}-${FIRST.baseColor}-`;

test.describe("without scripts", () => {
  test.use({ javaScriptEnabled: false });

  test("a first visit's card and its picture are in the served page", async ({ page }) => {
    await page.goto("");
    const img = page.locator("main [data-first-card] img[data-mockup]");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", new RegExp(firstPicture.replace(/\//g, "\\/")));
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  });
});

test("a first visit: the card the deck opens on is the served one, its picture never drops out", async ({ page }) => {
  await page.goto("");
  // From the first frame to the swipe deck, the card on top always shows the same picture.
  const top = page.locator('main img[data-mockup][fetchpriority="high"]').first();
  await expect(top).toHaveAttribute("src", new RegExp(firstPicture.replace(/\//g, "\\/")));
  await hydrated(page);
  await expect(page.locator("main [data-first-card]")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /,/ }).locator("img[data-mockup]")).toHaveAttribute("src", new RegExp(firstPicture.replace(/\//g, "\\/")));
  // …and the next visit asks for it with the page.
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("mono-next-card")))!).id).toBe(FIRST.id);
});

test("a returning visit asks for its own top card with the page and never shows the served one", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const kept = JSON.parse((await page.evaluate(() => localStorage.getItem("mono-next-card")))!) as { id: string; srcset: string };
  expect(kept.id).not.toBe(FIRST.id);
  await page.reload();
  // The preload is in <head> before the scripts run, at the card's own sizes (one download, the same file the card uses).
  // (React also preloads the served card's picture: a first visit's.)
  const preload = page.locator('head link[rel="preload"][as="image"][fetchpriority="high"]');
  await expect(preload).toHaveAttribute("imagesrcset", kept.srcset);
  await expect(page.locator("html")).toHaveAttribute("data-card-other", "");
  await hydrated(page);
  const card = page.getByRole("group", { name: /,/ }).locator("img[data-mockup]");
  await expect.poll(() => card.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain(kept.srcset.split(" ")[0].replace(/-\d+\.webp(\?v=\w+)?$/, "-"));
});

test("a returning visit's own card is on screen with the scripts still loading", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const kept = JSON.parse((await page.evaluate(() => localStorage.getItem("mono-next-card")))!) as { id: string; srcset: string };
  // The site's scripts never arrive: only what the page itself carries runs.
  await page.route(/\/_next\/static\/chunks\//, (route) => route.abort());
  await page.reload();
  // The served card shows that card's picture, without the served card's name.
  const served = page.locator("main [data-first-card]");
  await expect(served).toHaveAttribute("data-swapped", "");
  // (Both faces have a heading; the back one is hidden anyway.)
  for (const h of await served.locator("h2").all()) await expect(h).toBeHidden();
  const img = served.locator("img[data-mockup]");
  await expect(img).toHaveAttribute("srcset", kept.srcset);
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && el.currentSrc)).toContain(kept.srcset.split(" ")[0].replace(/-\d+\.webp(\?v=\w+)?$/, "-"));
});
