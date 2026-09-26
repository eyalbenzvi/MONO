import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("V3: switching categories never shows a tee without its print — even on a slow network; the grid loads thumbnails", async ({ page }) => {
  // Every print takes 400 ms, like a phone on a weak connection.
  await page.route(/\/prints\//, async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.goto("shop/");
  await hydrated(page);
  const chips = page.getByRole("group", { name: "Category" }).getByRole("button");
  await chips.nth(2).tap();
  // Sample the grid while it loads: any mockup shown has its print in.
  let shownWithPrint = 0;
  for (let i = 0; i < 20; i++) {
    const r = await page.evaluate(() =>
      [...document.querySelectorAll("main [data-ready]")].map((el) => {
        const print = el.querySelector<HTMLImageElement>('img[alt$=" print"]');
        return !print || (print.complete && print.naturalWidth > 0);
      }),
    );
    expect(r.every(Boolean)).toBe(true);
    shownWithPrint = Math.max(shownWithPrint, r.length);
    await page.waitForTimeout(60);
  }
  expect(shownWithPrint).toBeGreaterThan(0);
  const srcs = await page.locator('main img[alt$=" print"]').evaluateAll((els) => els.slice(0, 6).map((e) => e.getAttribute("src")!));
  expect(srcs.some((s) => s.includes("/prints/t/"))).toBe(true);
});
