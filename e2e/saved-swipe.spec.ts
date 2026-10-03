import { expect, test, type Page } from "@playwright/test";
import { hydrated, openSaved, seed } from "./helpers";
import { B1, B9 } from "../tests/fixtures";

const cart = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("mono-cart") ?? "{}").state?.cart ?? []) as { id: string; size: string }[]);

/** Drags a row sideways by `dx`, stopping halfway to look, then lets go. */
async function swipe(page: Page, id: string, dx: number, look?: () => Promise<void>) {
  const row = page.locator(`[data-saved-row="${id}"] > div`).last();
  // The list may still be settling (layout animation): measure the row once it has stopped moving.
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

/** The same swipe with a finger (touch events), as on a phone. */
async function touchSwipe(page: Page, id: string, dx: number, dy = 0, steps = 10) {
  const box = (await page.locator(`[data-saved-row="${id}"] > div`).last().boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", px: number, py: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py }] });
  await touch("touchStart", x, y);
  for (let i = 1; i <= steps; i++) await touch("touchMove", x + (dx * i) / steps, y + (dy * i) / steps);
  await touch("touchEnd", x + dx, y + dy);
}

/** A fast flick, as a finger makes one: pointer events a few ms apart (velocity well over the flick threshold). */
async function flick(page: Page, id: string, dx: number, dy = 0) {
  const box = (await page.locator(`[data-saved-row="${id}"] > div`).last().boundingBox())!;
  await page.evaluate(
    async ({ x, y, dx, dy, id }) => {
      const el = document.querySelector(`[data-saved-row="${id}"] > div:last-child`)!;
      const ev = (type: string, px: number, py: number) =>
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: px, clientY: py, buttons: type === "pointerup" ? 0 : 1 });
      el.dispatchEvent(ev("pointerdown", x, y));
      for (let i = 1; i <= 4; i++) {
        await new Promise((r) => setTimeout(r, 8));
        window.dispatchEvent(ev("pointermove", x + (dx * i) / 4, y + (dy * i) / 4));
      }
      window.dispatchEvent(ev("pointerup", x + dx, y + dy));
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, dx, dy, id },
  );
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

test("Saved: the first time it opens, the first row slides aside once to show the swipe; never again", async ({ page }) => {
  // Saved is a list on You now (no drawer to close): start again from the shop with the hint unseen.
  await page.evaluate(() => localStorage.removeItem("mono-saved-hint"));
  await page.goto("shop/");
  await hydrated(page);
  await openSaved(page, { hint: true });
  // Mid-hint the first row is pulled right: its "Add" label shows, then it settles back.
  const label = page.locator("[data-saved-row] [data-swipe-action]").first();
  await expect(label).toHaveAttribute("data-swipe-action", "add", { timeout: 4000 });
  await expect(label).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate(() => localStorage.getItem("mono-saved-hint"))).toBe("1");
});

test("Saved: with no size known, swiping a row right says Select size and opens the tee's page", async ({ page }) => {
  // Runs after the size set in beforeEach, on every load: no size remembered.
  await page.addInitScript(() => {
    const c = JSON.parse(localStorage.getItem("mono-cart")!);
    delete c.state.preferredSize;
    localStorage.setItem("mono-cart", JSON.stringify(c));
  });
  await page.reload();
  await hydrated(page);
  await openSaved(page);
  const row = page.locator(`[data-saved-row="${B9}"]`);
  await swipe(page, B9, 160, async () => {
    await expect(row.locator("[data-swipe-action]")).toHaveText("Select size");
  });
  await expect(page).toHaveURL(new RegExp(`/shop/${B9}/?$`));
  expect(await cart(page)).toEqual([]);
});

test("Saved: with no size known, a finger swipe right opens the tee's page too", async ({ page }) => {
  await page.addInitScript(() => {
    const c = JSON.parse(localStorage.getItem("mono-cart")!);
    delete c.state.preferredSize;
    localStorage.setItem("mono-cart", JSON.stringify(c));
  });
  await page.reload();
  await hydrated(page);
  await openSaved(page);
  await touchSwipe(page, B9, 160);
  await expect(page).toHaveURL(new RegExp(`/shop/${B9}/?$`));
});

test("Saved: a quick short flick (the row hardly moves, nothing shows under it) does nothing", async ({ page }) => {
  await flick(page, B9, 30);
  await page.waitForTimeout(400);
  await expect(page.locator(`[data-saved-row="${B9}"]`)).toBeVisible();
  expect(await cart(page)).toEqual([]);
});

test("Saved: scrolling the list with a finger that drifts sideways is not a swipe", async ({ page }) => {
  await flick(page, B9, 30, -120);
  await page.waitForTimeout(400);
  expect(await cart(page)).toEqual([]);
  await expect(page.locator(`[data-saved-row="${B9}"]`)).toBeVisible();
});

test("Saved: a long fast flick right still adds (the row moved far enough to show Add to bag)", async ({ page }) => {
  await flick(page, B9, 140);
  await expect.poll(() => cart(page)).toEqual([expect.objectContaining({ id: B9, size: "M" })]);
});
