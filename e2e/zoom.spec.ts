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
