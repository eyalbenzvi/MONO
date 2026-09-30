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

/**
 * A quick double tap at a point of the card, through the browser's touch
 * input. The four touch events are queued at once (in order): awaited one by
 * one, a loaded machine can space the taps past the app's double-tap window
 * (DOUBLE_TAP_MS, 260 ms), and so can locator.tap's actionability checks.
 */
async function doubleTap(page: Page, card: import("@playwright/test").Locator, x: number, y: number) {
  const box = (await card.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touchPoints = [{ x: box.x + x, y: box.y + y, id: 1 }];
  const start = { type: "touchStart" as const, touchPoints };
  const end = { type: "touchEnd" as const, touchPoints: [] as typeof touchPoints };
  await Promise.all([start, end, start, end].map((e) => cdp.send("Input.dispatchTouchEvent", e)));
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
    // A double tap needs the card settled (its entrance done): taps during it can land as one.
    await expect(card).toBeVisible();
    await page.waitForTimeout(500);
    await doubleTap(page, card, 180, 250);
    await expect.poll(() => scaleOf(page)).toBeCloseTo(2.5, 1);
    await expect(page.getByText(/Zoomed 2.5×/)).toBeAttached();

    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(700);
    expect(await scaleOf(page)).toBe(1);
    await expect(card.getByRole("link", { name: /View tee/ })).toBeHidden();

    await card.tap({ position: { x: 180, y: 250 } });
    await page.waitForTimeout(800);
    await expect(card.getByRole("link", { name: /View tee/ })).toBeVisible();
  });

  test("Save while zoomed: the picture comes back and the card goes", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    const title = await card.locator("h2").first().textContent();
    await expect(card).toBeVisible();
    await page.waitForTimeout(500);
    await doubleTap(page, card, 180, 250);
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(2);
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await page.waitForTimeout(800);
    await expect(page.locator('[aria-roledescription="card"]').first().locator("h2").first()).not.toHaveText(title!);
    expect(await scaleOf(page)).toBe(1);
  });
});

test("recordings: zooming in brings the print's close-up (one plain picture, no canvas); zooming out never shows the frame behind the picture", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const card = () => page.locator('[aria-roledescription="card"]').first();
  // One baked picture of the tee, sized for the card on this phone (3×).
  const mockup = card().locator("[data-zoom-stage] img[data-mockup]");
  await expect.poll(() => mockup.evaluate((i: HTMLImageElement) => i.complete && i.currentSrc)).toMatch(/\/img\/m\/\d+-(black|white)-1080\.webp$/);
  expect(await card().locator("[data-zoom-stage] img").count()).toBe(1);

  // Zoom in: the close-up covers the print's area, drawn like any picture.
  const box = (await card().locator("[data-zoom-stage]").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await pinch(page, cx, cy, 60, 200);
  const detail = card().locator("img[data-detail]");
  await expect.poll(() => detail.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity === "1")).toBe(true);
  expect(await detail.getAttribute("src")).toMatch(/\/img\/d\/\d+-(black|white)\.webp$/);
  expect(await page.locator("canvas").count()).toBe(0);

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

test("recording: the flipped card's picture never shows through its details (hidden outright, not only by backface-visibility)", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const card = page.locator('[aria-roledescription="card"]').first();
  const faces = () =>
    card.evaluate((el) => {
      const [front, back] = [...el.querySelectorAll<HTMLElement>(".backface-hidden")];
      return [getComputedStyle(front).visibility, getComputedStyle(back).visibility];
    });
  expect(await faces()).toEqual(["visible", "hidden"]);
  await card.tap({ position: { x: 180, y: 250 } });
  await expect.poll(faces).toEqual(["hidden", "visible"]);
  await page.getByRole("button", { name: "Back to the tee" }).tap();
  await expect.poll(faces).toEqual(["visible", "hidden"]);
});
