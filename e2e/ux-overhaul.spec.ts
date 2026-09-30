import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CALIBRATION_IDS, hydrated, seed } from "./helpers";

/**
 * The overhaul's definition of done, measured on a phone (390 × 844, touch):
 * every screen's primary action in the bottom third, 44 px targets on the
 * core path, the five tabs fitting at 320 px, Back closing every overlay,
 * and no axe violations on the main screens.
 */
const AXE = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

/** Swipes `n` cards with the buttons, each after the last has landed (a card on its way out takes no presses). */
async function swipe(page: Page, n: number, each?: () => Promise<void>) {
  for (let i = 0; i < n; i++) {
    if (i > 0) await expect(page.getByRole("status").filter({ hasText: / of 10\./ }).first()).toContainText(`${i} of 10.`);
    await each?.();
    await page.getByRole("button", { name: i % 2 ? "Pass" : "Save" }).click();
  }
}

async function centreY(page: Page, name: string | RegExp, role: "button" | "link" = "button") {
  const box = await page.getByRole(role, { name }).last().boundingBox();
  expect(box, String(name)).not.toBeNull();
  return box!.y + box!.height / 2;
}

/** Every visible button, link and form control on screen at least 44 × 44 (text links inside prose aside). */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, a[href], select, input:not([type=hidden]), [role=radio], [role=checkbox]"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      if (el.closest("[aria-hidden=true], [inert]") || getComputedStyle(el).visibility === "hidden") continue;
      // A picture link out of the tab order (the card's own link covers it) is judged by that one.
      if (el.tabIndex < 0 && el.tagName === "A") continue;
      // A stretched link's target is its whole card (its ::after covers it).
      if (el.className.includes("after:inset-0")) {
        const card = el.closest(".relative, [data-product-card]")?.getBoundingClientRect();
        if (card && card.width >= 44 && card.height >= 44) continue;
      }
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push(`${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
}

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      rules: { region: { enabled: false } },
    });
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  });
}

test.describe("the thumb: primary actions in the bottom third, 44 px targets", () => {
  test("Discover during the test: Pass and Save low, 44 px, no Buy, the line always there", async ({ page }) => {
    await page.goto("./");
    await hydrated(page);
    expect(await centreY(page, "Save")).toBeGreaterThanOrEqual(560);
    expect(await centreY(page, "Pass")).toBeGreaterThanOrEqual(560);
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await swipe(page, 9, () => expect(page.locator("[data-strip]").first().locator("p").first()).not.toBeEmpty());
    await expect(page.locator("[data-strip]").first()).toContainText(/Last one\.|Undo/);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("the reveal, shop, product, bag and checkout keep their one action low", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1, name: "Your edit" })).toBeVisible();
    expect(await centreY(page, /^Filter/)).toBeGreaterThanOrEqual(560);
    expect(await smallTargets(page)).toEqual([]);
    await page.locator("[data-product-card] a").first().click();
    await page.waitForURL(/\/shop\/.+/);
    await hydrated(page);
    expect(await centreY(page, /^Add to bag/)).toBeGreaterThanOrEqual(560);
    await page.getByRole("radio", { name: "M", exact: true }).click();
    await page.getByRole("button", { name: /^Add to bag · M · \$/ }).last().click();
    await expect(page.getByRole("button", { name: "In your bag · Checkout" }).last()).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await page.goto("cart/");
    await hydrated(page);
    expect(await centreY(page, /^Checkout · \$/)).toBeGreaterThanOrEqual(560);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole("button", { name: /^Checkout · \$/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
    // Opening checkout submits nothing (no errors before a field is touched).
    await expect(page.getByRole("alert")).toHaveText("");
    expect(await centreY(page, /^Place order · \$/)).toBeGreaterThanOrEqual(560);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("the reveal's See your edit sits low", async ({ page }) => {
    await seed(page, { calibrated: false });
    await page.goto("./");
    await hydrated(page);
    await swipe(page, CALIBRATION_IDS.length);
    await expect(page.getByText("Your shop is now edited around this.")).toBeVisible();
    expect(await centreY(page, "See your edit", "link")).toBeGreaterThanOrEqual(560);
  });
});

test("the five tabs fit at 320 px, each at least 44 px tall, without wrapping or truncation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page);
  await page.goto("shop/");
  await hydrated(page);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Discover", "Shop", "Make", "Bag", "You"]);
  for (const link of await nav.getByRole("link").all()) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const fits = await link.evaluate((el) => {
      const span = el.firstElementChild as HTMLElement;
      return span.scrollWidth <= el.clientWidth && span.getClientRects().length === 1;
    });
    expect(fits).toBe(true);
  }
  await expect(nav.getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
});

test.describe("Back closes every overlay without leaving the page", () => {
  const closesWithBack = async (page: Page, open: () => Promise<unknown>, dialog: string | RegExp) => {
    const url = page.url();
    await open();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog", { name: dialog })).toHaveCount(0);
    expect(page.url().replace(/#.*$/, "")).toBe(url.replace(/#.*$/, ""));
  };

  test("Discover: taste sheet, Buy sheet, share; the card's details", async ({ page }) => {
    await seed(page);
    await page.goto("./");
    await hydrated(page);
    await closesWithBack(page, () => page.getByRole("button", { name: /^Your taste · / }).click(), "Your taste");
    await closesWithBack(page, () => page.getByRole("button", { name: /^Buy / }).click(), /^Buy /);
    await page.locator('[aria-roledescription="card"]').click();
    await expect(page.getByRole("button", { name: "Back to the tee" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("button", { name: "Back to the tee" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("shop: filter and search; product: zoom, share, Your taste", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await closesWithBack(page, () => page.getByRole("button", { name: /^Filter/ }).click(), "Categories");
    await closesWithBack(page, () => page.getByRole("button", { name: "Search" }).click(), "Search");
    await page.locator("[data-product-card] a").first().click();
    await page.waitForURL(/\/shop\/.+/);
    await hydrated(page);
    await closesWithBack(page, () => page.getByRole("button", { name: "Zoom in on the tee" }).click(), /zoom/);
    await closesWithBack(page, () => page.getByRole("button", { name: /^Share / }).first().click(), "Share this tee");
  });

  test("the reveal: Back is Keep swiping", async ({ page }) => {
    await seed(page, { calibrated: false });
    await page.goto("./");
    await hydrated(page);
    await swipe(page, CALIBRATION_IDS.length);
    await expect(page.getByText("Your shop is now edited around this.")).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Your shop is now edited around this.")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    // Seen: the tab bar appears after the reveal.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });
});

test.describe("axe: no violations on the main screens", () => {
  // axe is injected as a script: the page's CSP (hash-only scripts) would refuse it.
  test.use({ bypassCSP: true });
  for (const [name, path] of [
    ["Discover", "./"],
    ["Shop", "shop/"],
    ["Bag", "cart/"],
    ["You", "me/"],
    ["Make", "make/"],
    ["About", "about/"],
  ] as const)
    test(name, async ({ page }) => {
      await seed(page);
      await page.goto(path);
      await hydrated(page);
      await page.waitForTimeout(400);
      expect(await axe(page)).toEqual([]);
    });

  test("a product page, the filter sheet and the Buy sheet", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Filter/ }).click();
    await expect(page.getByRole("dialog", { name: "Categories" })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.locator("[data-product-card] a").first().click();
    await page.waitForURL(/\/shop\/.+/);
    await hydrated(page);
    await page.waitForTimeout(400);
    expect(await axe(page)).toEqual([]);
    await page.goto("./");
    await hydrated(page);
    await page.getByRole("button", { name: /^Buy / }).click();
    await expect(page.getByRole("dialog", { name: /^Buy / })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await axe(page)).toEqual([]);
  });
});
