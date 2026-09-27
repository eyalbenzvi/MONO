import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("V3: switching categories never shows a tee without its print — one baked picture each, sized for the screen, even on a slow network", async ({ page }) => {
  const paths: string[] = [];
  page.on("request", (r) => paths.push(new URL(r.url()).pathname));
  // Every picture takes 400 ms, like a phone on a weak connection.
  await page.route(/\/img\//, async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.goto("shop/");
  await hydrated(page);
  const chips = page.getByRole("group", { name: "Category" }).getByRole("button");
  await chips.nth(2).tap();
  // Sample the grid while it loads: a mockup is one picture — the print can't arrive apart from the tee.
  for (let i = 0; i < 12; i++) {
    const counts = await page.locator('main [role="img"]').evaluateAll((els) => els.map((el) => el.querySelectorAll("img").length));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((n) => n === 1)).toBe(true);
    await page.waitForTimeout(60);
  }
  // The files are the baked ones, the size a grid card needs on this phone (390 px wide at 3×).
  await expect.poll(() => page.locator("main img[data-mockup]").first().evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/\/img\/m\/\d+-(black|white)-720\.webp$/);
  expect(paths.filter((p) => /\/(prints|models)\//.test(p))).toEqual([]);
});

test("W1: a pinch-zoomed shop grid lays bigger pictures over its own — never a blank frame", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  await page.waitForTimeout(600);
  const first = page.locator("main img[data-mockup]").first();
  await first.evaluate((el) => {
    el.setAttribute("data-e2e", "");
    el.scrollIntoView({ block: "start" });
  });
  const img = page.locator("img[data-e2e]");
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && i.currentSrc)).toMatch(/-720\.webp$/);
  await img.evaluate((el: HTMLImageElement) => {
    const w = window as unknown as { __blank: number };
    w.__blank = 0;
    const tick = () => {
      // naturalWidth is the picture on screen (while a bigger file loads, `complete` reads false but the old one stays).
      if (!(el.naturalWidth > 0)) w.__blank++;
      requestAnimationFrame(tick);
    };
    tick();
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 3 });
  await page.evaluate(() => window.visualViewport?.dispatchEvent(new Event("resize")));
  // Over it, once loaded: the same picture at the size the zoom needs.
  const sharper = page.locator("[role=img]:has(img[data-e2e]) img[data-sharper]");
  await expect.poll(() => sharper.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity === "1" && i.currentSrc), { timeout: 5000 }).toMatch(/-1080\.webp$/);
  expect(await page.evaluate(() => (window as unknown as { __blank: number }).__blank)).toBe(0);
});
