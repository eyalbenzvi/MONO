import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed, storedTaste } from "./helpers";
import { B1, B2, B9, W1 } from "../tests/fixtures";

/** The reveal: a dialog named by its heading, the archetype ("The Maximalist"). */
const reveal = (page: Page) => page.getByRole("dialog", { name: /^The / });

/** The ten taste-test swipes, by keyboard. */
async function swipeTen(page: Page) {
  await page.goto("");
  await hydrated(page);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
    await page.waitForTimeout(420);
  }
  await expect(reveal(page)).toBeVisible();
  await expect(reveal(page).getByText("Your shop is now edited around this.")).toBeVisible();
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
    await expect(reveal(page)).toHaveCount(0);
  });
});

test("R19: Tab stays inside a sheet (radios with tabindex -1 don't count as its ends)", async ({ page }) => {
  await seed(page);
  await page.goto(`shop/${W1}/`);
  await hydrated(page);
  // Share sits beside the title now (the ⋯ menu is gone).
  await expect(page.getByRole("button", { name: /^More for / })).toHaveCount(0);
  await page.getByRole("button", { name: /^Share / }).click();
  const dialog = page.getByRole("dialog", { name: "Share this tee" });
  await expect(dialog).toBeVisible();
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await inside()).toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await inside()).toBe(true);
  }
});

test.describe("R26: focus never falls back to the page", () => {
  test("Reset taste on You keeps focus in the page’s content, not on the body", async ({ page }) => {
    // Reset lives on You now (the taste sheet's ⋯ menu is gone).
    await seed(page);
    await page.goto("");
    await hydrated(page);
    await page.getByRole("button", { name: /^Your taste · The / }).click();
    const taste = page.getByRole("dialog", { name: "Your taste" });
    await expect(taste).toBeVisible();
    await expect(taste.getByRole("button", { name: /^Reset taste/ })).toHaveCount(0);
    await expect(taste.getByRole("button", { name: /^More for / })).toHaveCount(0);
    await page.goto("me/");
    await hydrated(page);
    await page.getByRole("button", { name: "Reset taste" }).click();
    await expect(page.getByText("Not yet.")).toBeVisible();
    await expect(page.getByRole("status").or(page.getByRole("alert")).filter({ hasText: "Taste reset" }).first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const a = document.activeElement;
          return !!a && a !== document.body && !!a.closest("main");
        }),
      )
      .toBe(true);
  });

  test("an empty bag: no quick add, one CTA that the keyboard reaches", async ({ page }) => {
    // Quick add on the empty bag ("From your Saved" / "Picked for you") is gone: its CTA leads on.
    await seed(page, { likedIds: [B9, B1, B2], calibrated: false });
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Quick add / })).toHaveCount(0);
    await expect(page.getByText(/Picked for you|From your Saved/)).toHaveCount(0);
    const cta = page.getByRole("link", { name: "Start the taste test" });
    await expect(cta).toBeVisible();
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    await expect(page.locator("[data-strip]").first()).toContainText("Ten tees. Keep or pass.");
  });

  test("an empty bag after the taste test: the CTA is See your edit", async ({ page }) => {
    await seed(page);
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
    await page.getByRole("link", { name: "See your edit" }).click();
    await expect(page).toHaveURL(/\/shop\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your edit" })).toBeVisible();
  });
});

test("R28: no keyboard legend on a phone held sideways", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("");
  await hydrated(page);
  await expect(page.locator('[aria-roledescription="card"]').first()).toBeVisible();
  await expect(page.getByText(/← pass|→ save|→ like/)).toHaveCount(0);
  // The keys are described to screen readers only (sr-only), never as a visible legend.
  const keys = page.locator("#card-keys");
  if (await keys.count()) {
    const box = (await keys.first().boundingBox())!;
    expect(box.width * box.height).toBeLessThan(1.5);
  }
});

test("I16: another tab clearing storage resets Saved and the bag here", async ({ page, context }) => {
  await seed(page, { likedIds: [B9] }, [{ id: W1, size: "M", color: "black", qty: 1 }]);
  await page.goto("shop/");
  await hydrated(page);
  // The bag's count is on the tab bar's Bag tab ("Bag 1").
  const bag = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Bag/ });
  await expect(bag).toHaveAccessibleName(/^Bag 1$/);
  const other = await context.newPage();
  await other.goto("shop/");
  await hydrated(other);
  await other.evaluate(() => localStorage.clear());
  await expect(bag).toHaveAccessibleName("Bag");
  await openSavedHere(page);
  await expect(page.getByText("Tap ♥ to save a tee.")).toBeVisible();
});

/** You, by its tab (the list is empty, so the helper's wait for it would not apply). */
async function openSavedHere(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "You" }).click();
  await page.waitForURL(/\/me\/$/);
}
