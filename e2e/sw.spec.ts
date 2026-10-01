import { expect, test } from "@playwright/test";
import { hydrated, seed } from "./helpers";

test.use({ serviceWorkers: "allow" });

test.describe("Service worker (public/sw.js): the shop's pictures kept on the device", () => {
  test("it takes over the site, keeps the shop's pictures, and serves them again from its cache", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    // Registered when the page is idle; in control once it has claimed the page.
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);
    // A reload under its control: the cards' pictures go through it, and are kept.
    await page.reload();
    await hydrated(page);
    const first = page.locator("main img[data-mockup]").first();
    await expect(first).toHaveJSProperty("complete", true);
    const src = await first.evaluate((i: HTMLImageElement) => i.currentSrc);
    await expect.poll(() => page.evaluate((u) => caches.open("mono-pictures-v1").then((c) => c.match(u)).then((r) => !!r), src)).toBe(true);
    // The next visit's pictures come from the device: answered by the worker, from its cache.
    const fromWorker: string[] = [];
    page.on("response", (r) => {
      if (r.fromServiceWorker() && /\/img\/m\//.test(r.url())) fromWorker.push(r.url());
    });
    await page.reload();
    await hydrated(page);
    await expect.poll(() => fromWorker.includes(src)).toBe(true);
    // Pages are never kept: the shop is always the deployed one.
    const pages = await page.evaluate(() => caches.keys().then((keys) => Promise.all(keys.map((k) => caches.open(k).then((c) => c.keys())))).then((all) => all.flat().map((r) => r.url)));
    expect(pages.some((u) => /\/shop\/$|\.html$/.test(u))).toBe(false);
  });
});
