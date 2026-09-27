import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";

/** The zoomed layer's scale (1 when not zoomed). */
const scaleOf = (page: Page) =>
  page
    .locator('[aria-roledescription="card"]')
    .first()
    .locator("[data-zoom-stage] > div")
    .first()
    .evaluate((el) => {
      const t = getComputedStyle(el).transform;
      return t === "none" ? 1 : new DOMMatrix(t).a;
    });

/** A two-finger pinch through the browser's touch input, from `from` to `to` px apart. */
async function pinch(page: Page, cx: number, cy: number, from: number, to: number) {
  const cdp = await page.context().newCDPSession(page);
  const at = (d: number) => [
    { x: cx - d / 2, y: cy, id: 1 },
    { x: cx + d / 2, y: cy, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(from) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(from + ((to - from) * i) / 8) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("U5: zoom in place on the Discover card", () => {
  test("a pinch zooms the picture itself — no dialog, no swipe; pinching back out returns the card, ready to swipe", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    const title = await card.locator("h2").first().textContent();
    const box = (await card.locator("[data-zoom-stage]").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await pinch(page, cx, cy, 60, 220);
    await page.waitForTimeout(500);
    expect(await scaleOf(page)).toBeGreaterThan(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card.locator("h2").first()).toHaveText(title!);

    await pinch(page, cx, cy, 220, 60);
    await page.waitForTimeout(700);
    expect(await scaleOf(page)).toBe(1);
    await page.getByRole("button", { name: "Pass", exact: true }).tap();
    await page.waitForTimeout(700);
    await expect(page.locator('[aria-roledescription="card"]').first().locator("h2").first()).not.toHaveText(title!);
  });

  test("double tap zooms in; a tap while zoomed returns it (not the details); a single tap still shows the details", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(60);
    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(600);
    expect(await scaleOf(page)).toBeCloseTo(2.5, 1);
    await expect(page.getByText(/Zoomed 2.5×/)).toBeAttached();

    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(700);
    expect(await scaleOf(page)).toBe(1);
    await expect(card.getByRole("link", { name: /View tee/ })).toBeHidden();

    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(800);
    await expect(card.getByRole("link", { name: /View tee/ })).toBeVisible();
  });

  test("Like while zoomed: the picture comes back and the card goes", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    const title = await card.locator("h2").first().textContent();
    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(60);
    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(500);
    expect(await scaleOf(page)).toBeGreaterThan(2);
    await page.getByRole("button", { name: "Like", exact: true }).tap();
    await page.waitForTimeout(800);
    await expect(page.locator('[aria-roledescription="card"]').first().locator("h2").first()).not.toHaveText(title!);
    expect(await scaleOf(page)).toBe(1);
  });
});

test("recordings: zooming out never shows the frame behind the picture; a halftone print is shrunk properly at every zoom", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  // A raster print (a halftone or ink one) on the top card.
  const card = () => page.locator('[aria-roledescription="card"]').first();
  const print = () => card().locator("[data-zoom-stage] img[src$='.webp']:not([src*='/models/'])").first();
  for (let i = 0; i < 12 && !(await print().count()); i++) {
    await page.getByRole("button", { name: "Pass", exact: true }).tap();
    await page.waitForTimeout(600);
  }
  const shrunk = () => card().locator("[data-zoom-stage] canvas").first();
  // Shown at its size in device pixels, over the file.
  const measure = () =>
    shrunk().evaluate((c: HTMLCanvasElement) => ({ visible: getComputedStyle(c).display !== "none", w: c.width, shown: c.getBoundingClientRect().width * devicePixelRatio }));
  await expect.poll(async () => (await measure()).visible).toBe(true);
  const at1 = await measure();
  expect(at1.w).toBeGreaterThanOrEqual(at1.shown - 1);
  expect(at1.w).toBeLessThan(at1.shown * 1.3);
  expect(await print().evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

  // Zoom in: the canvas follows the size (or gives way to the file itself).
  const box = (await card().locator("[data-zoom-stage]").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await pinch(page, cx, cy, 60, 200);
  await page.waitForTimeout(600);
  const zoomed = await measure();
  if (zoomed.visible) expect(zoomed.w).toBeGreaterThanOrEqual(zoomed.shown - 1);
  else expect(await print().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  // Pan, then pinch back out: at no frame is the picture under 1× or off its frame.
  await page.evaluate(() => {
    const layer = document.querySelector('[aria-roledescription="card"] [data-zoom-stage] > div') as HTMLElement;
    const stage = layer.parentElement!.getBoundingClientRect();
    (window as unknown as { gaps: number[] }).gaps = [];
    const tick = () => {
      const r = layer.getBoundingClientRect();
      (window as unknown as { gaps: number[] }).gaps.push(Math.max(r.left - stage.left, r.top - stage.top, stage.right - r.right, stage.bottom - r.bottom));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await pinch(page, cx, cy, 200, 40);
  await page.waitForTimeout(700);
  const gaps = await page.evaluate(() => (window as unknown as { gaps: number[] }).gaps);
  expect(gaps.length).toBeGreaterThan(10);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(0.5);
  expect(await scaleOf(page)).toBe(1);
});
