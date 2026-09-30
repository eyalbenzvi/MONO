import { expect, test, type Page } from "@playwright/test";
import { hydrated, LEANING, seed } from "./helpers";

/** Answers one card with a button and waits until the deck has taken it (the live region names each swipe). */
async function answer(page: Page, action: "Pass" | "Save") {
  const said = page.locator('main p[role="status"]');
  const before = await said.textContent();
  await page.getByRole("button", { name: action, exact: true }).tap();
  await expect(said).not.toHaveText(before ?? "");
}

test("W2: passing on all ten test cards gives no taste — no reveal; the strip says what's needed; the shop stays Our pick", async ({ page }) => {
  await page.goto("");
  await hydrated(page);
  for (let i = 0; i < 10; i++) await answer(page, "Pass");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // After "Passed · Undo" (4 s), the one line says what's missing; no dots, levels or meters.
  const strip = page.locator("[data-strip]:visible");
  await expect(strip).toHaveText("Almost there. Keep 3 you’d wear.", { timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Not enough to know your taste/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
  // No taste yet: the shop is still "Our pick", with no Top pick.
  const shop = await page.context().newPage();
  await shop.goto("shop/");
  await hydrated(shop);
  await expect(shop.getByRole("heading", { level: 1 })).toHaveText("Our pick");
  await expect(shop.locator('main a[aria-label*="Top pick"]')).toHaveCount(0);
  await shop.close();
  // Three saves later, the taste is known and the reveal opens.
  for (let i = 0; i < 2; i++) await answer(page, "Save");
  await expect(strip).toHaveText("Almost there. Keep 1 you’d wear.", { timeout: 10_000 });
  await answer(page, "Save");
  const reveal = page.getByRole("dialog").first();
  await expect(reveal).toBeVisible();
  await expect(reveal.getByText("Your taste", { exact: true })).toBeVisible();
  await expect(reveal.getByRole("heading", { level: 2 })).toHaveText(/^The [A-Za-z ]+$/);
});

for (const lean of ["retro", "abstract", "photographic"]) {
  test(`W3: a long taste name (${lean}) fits the personal area on a narrow phone — no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const vector = Object.fromEntries(Object.keys(LEANING).map((k) => [k, k === lean ? 0.9 : 0.45]));
    await seed(page, { vector });
    await page.goto("me/");
    await hydrated(page);
    // The archetype heads Your taste on You.
    const name = page.getByRole("heading", { level: 3 }).first();
    await expect(name).toHaveText(/^The /);
    const r = await name.evaluate((h) => ({ right: h.getBoundingClientRect().right, sw2: h.scrollWidth - h.clientWidth, vw: innerWidth, sw: document.documentElement.scrollWidth }));
    expect(r.sw2).toBeLessThanOrEqual(1);
    expect(r.right).toBeLessThanOrEqual(r.vw);
    expect(r.sw).toBeLessThanOrEqual(r.vw);
  });
}
