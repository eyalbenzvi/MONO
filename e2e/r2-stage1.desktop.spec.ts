import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed, storedTaste } from "./helpers";

/** The ten taste-test swipes, by keyboard. */
async function swipeTen(page: Page) {
  await page.goto("");
  await hydrated(page);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
    await page.waitForTimeout(420);
  }
  await expect(page.getByRole("dialog", { name: /You're/ })).toBeVisible();
}

test.describe("R24: keys right after the taste-test screen closes", () => {
  test("the first key after closing isn't swallowed by the closing animation", async ({ page }) => {
    await swipeTen(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    expect((await storedTaste(page)).swipeHistory.length).toBe(11);
  });

  test("Z right after closing doesn't take back the tenth card", async ({ page }) => {
    await swipeTen(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    await page.keyboard.press("z");
    await page.waitForTimeout(700);
    const s = await storedTaste(page);
    expect(s.seen.length).toBe(10);
    expect(s.calibrationAcknowledged).toBe(true);
    await expect(page.getByRole("dialog", { name: /You're/ })).toHaveCount(0);
  });
});

test("R19: Tab stays inside the sort sheet (radios with tabindex -1 don't count as its ends)", async ({ page }) => {
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Sort:/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
});

test.describe("R26: focus never falls back to the page", () => {
  test("Reset taste puts focus on the strip above the card", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    await page.getByRole("button", { name: /Open your taste profile/ }).click();
    await page.getByRole("button", { name: "Reset taste" }).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-strip]"))).toBe(true);
  });

  test("picking a size in quick add focuses the button that replaces the sizes", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const add = page.getByRole("button", { name: /^Quick add / }).first();
    await add.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Size M" }).first().click();
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", /size M$/);
  });
});

test("R28: no keyboard legend on a phone held sideways", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("");
  await hydrated(page);
  await expect(page.getByText("← pass · → like")).toBeHidden();
});

test("I16: another tab clearing storage resets Saved and the bag here", async ({ page, context }) => {
  await seed(page, { likedIds: ["mono-0500"] }, [{ id: "mono-0001", size: "M", color: "black", qty: 1 }]);
  await page.goto("shop/");
  await hydrated(page);
  await expect(page.getByRole("button", { name: /^Saved \(3\)/ })).toBeVisible();
  const other = await context.newPage();
  await other.goto("shop/");
  await hydrated(other);
  await other.evaluate(() => localStorage.clear());
  await expect(page.getByRole("button", { name: /^Saved \(0\)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Bag \(0\)/ })).toBeVisible();
});
