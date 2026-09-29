import { expect, test, type Page } from "@playwright/test";
import { hydrated, openSaved, seed } from "./helpers";
import { B1, B9 } from "../tests/fixtures";

const cart = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("mono-cart") ?? "{}").state?.cart ?? []) as { id: string; size: string }[]);

/** Drags a row sideways by `dx`, stopping halfway to look, then lets go. */
async function swipe(page: Page, id: string, dx: number, look?: () => Promise<void>) {
  const row = page.locator(`[data-saved-row="${id}"] > div`).last();
  // The drawer slides in: measure the row once it has stopped moving.
  let box = (await row.boundingBox())!;
  await expect
    .poll(async () => {
      const now = (await row.boundingBox())!;
      const still = now.x === box.x && now.y === box.y;
      box = now;
      return still;
    })
    .toBe(true);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 10 });
  await look?.();
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await seed(page, { likedIds: [B9, B1] });
  await page.addInitScript(() => {
    const c = JSON.parse(localStorage.getItem("mono-cart")!);
    c.state.preferredSize = "M";
    localStorage.setItem("mono-cart", JSON.stringify(c));
  });
  await page.goto("shop/");
  await hydrated(page);
  await openSaved(page);
});

test("Saved: swiping a row right says Add to bag · M while it moves, and adds it in the size remembered", async ({ page }) => {
  const row = page.locator(`[data-saved-row="${B9}"]`);
  await swipe(page, B9, 160, async () => {
    await expect(row.locator("[data-swipe-action]")).toHaveAttribute("data-swipe-action", "add");
    await expect(row.locator("[data-swipe-action]")).toHaveText("Add to bag · M");
  });
  await expect.poll(() => cart(page)).toEqual([expect.objectContaining({ id: B9, size: "M" })]);
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  // Still saved: adding doesn't take it off the list.
  await expect(row).toBeVisible();
});

test("Saved: swiping a row left says Remove while it moves, and removes it (with Undo)", async ({ page }) => {
  const row = page.locator(`[data-saved-row="${B1}"]`);
  await swipe(page, B1, -160, async () => {
    await expect(row.locator("[data-swipe-action]")).toHaveText("Remove");
  });
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  expect(await cart(page)).toEqual([]);
});

test("Saved: a short drag springs back and does nothing", async ({ page }) => {
  await swipe(page, B9, 40);
  await expect(page.locator(`[data-saved-row="${B9}"]`)).toBeVisible();
  expect(await cart(page)).toEqual([]);
});
