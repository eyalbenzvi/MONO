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

test("W1: at normal zoom the grid loads no full prints; pinch-zoomed, the prints on screen swap to the full file — never a blank frame", async ({ page }) => {
  const full: string[] = [];
  await page.route(/\/prints\/print_\d+\.webp$/, async (route) => {
    full.push(route.request().url());
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await page.goto("shop/");
  await hydrated(page);
  await page.waitForTimeout(800);
  expect(full).toHaveLength(0);
  // Watch the first raster print while it upgrades: some picture is always showing.
  // A raster print in the left column: a pinch at the top-left corner shows it.
  const index = await page.locator('main span:has(> img[src*="/prints/t/"])').evaluateAll((els) => els.findIndex((e) => e.getBoundingClientRect().left < 120));
  expect(index).toBeGreaterThanOrEqual(0);
  // Tagged: once upgraded it no longer matches the thumbnail selector.
  await page.locator('main span:has(> img[src*="/prints/t/"])').nth(index).evaluate((el) => {
    el.setAttribute("data-e2e-print", "");
    el.closest("[class*=group]")!.scrollIntoView({ block: "start" });
  });
  const box = page.locator("[data-e2e-print]");
  await page.waitForTimeout(300);
  await box.evaluate((el) => {
    const w = window as unknown as { __blank: number };
    w.__blank = 0;
    const tick = () => {
      // A picture file, or the print shrunk into a canvas (lib/downscale).
      const shown =
        [...el.querySelectorAll("img")].some((i) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity === "1") ||
        [...el.querySelectorAll("canvas")].some((c) => c.width > 0 && getComputedStyle(c).display !== "none");
      if (!shown) w.__blank++;
      requestAnimationFrame(tick);
    };
    tick();
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 3 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(box.locator("img[data-full]")).toHaveCount(1, { timeout: 5000 });
  await expect(box.locator('img[src*="/prints/t/"]')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => (window as unknown as { __blank: number }).__blank)).toBe(0);
  expect(full.length).toBeGreaterThan(0);
  expect(full.length).toBeLessThanOrEqual(12);
});
