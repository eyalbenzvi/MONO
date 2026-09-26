import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";

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

test("U5 desktop: ctrl + wheel zooms at the cursor; + and 0 on the keyboard; arrows wait while zoomed", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const card = page.locator('[aria-roledescription="card"]').first();
  const title = await card.locator("h2").first().textContent();
  const box = (await card.locator("[data-zoom-stage]").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -30);
  await page.keyboard.up("Control");
  await page.waitForTimeout(200);
  expect(await scaleOf(page)).toBeGreaterThan(1.5);

  // Arrows pan the picture, not swipe the card.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  await expect(page.locator('[aria-roledescription="card"]').first().locator("h2").first()).toHaveText(title!);

  await page.keyboard.press("0");
  await page.waitForTimeout(700);
  expect(await scaleOf(page)).toBe(1);
  await page.keyboard.press("+");
  await page.waitForTimeout(600);
  expect(await scaleOf(page)).toBeGreaterThan(1.4);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  expect(await scaleOf(page)).toBe(1);
  // Back to normal: the arrow swipes again (after the brief grace).
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(700);
  await expect(page.locator('[aria-roledescription="card"]').first().locator("h2").first()).not.toHaveText(title!);
});
