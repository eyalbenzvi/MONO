import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";

const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function tenSwipes(page: Page, onEach?: () => Promise<void>) {
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: i % 2 ? "Pass" : "Like", exact: true }).tap();
    await page.waitForTimeout(450);
    await onEach?.();
  }
}

test.describe("Discover stays minimal (R01, R03, R14, R16, I02, I06, F01)", () => {
  test("taste test: no toasts, no pull-back tab, no trust line, and the card never moves", async ({ page }) => {
    await page.goto("");
    await hydrated(page);
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Free size exchanges|Ships in/)).toHaveCount(0);
    const strip = page.locator("[data-strip]");
    const before = await strip.boundingBox();
    const seen: string[] = [];
    await tenSwipes(page, async () => {
      const t = (await page.locator('div[role="status"][aria-live="polite"]').last().innerText()).trim();
      if (t) seen.push(t);
      expect(await page.getByRole("button", { name: /Bring back/ }).count()).toBe(0);
      if (seen.length === 0 && (await strip.count())) {
        const now = await strip.boundingBox();
        if (now && before) expect(Math.abs(now.height - before.height)).toBeLessThan(1);
      }
    });
    expect(seen).toEqual([]);
    await expect(page.getByText("Halfway there")).toHaveCount(0);
  });

  test("the taste-test screen: archetype, 3 traits, 3 tees, one CTA — and it fits 375×667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("");
    await hydrated(page);
    await tenSwipes(page);
    const dialog = page.getByRole("dialog", { name: /You're/ });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(900);
    const fits = await dialog.evaluate((d) => d.scrollHeight <= d.clientHeight + 1 && d.getBoundingClientRect().top >= 0 && d.getBoundingClientRect().bottom <= innerHeight + 1);
    expect(fits).toBe(true);
    await expect(dialog.getByRole("link", { name: /See my shop/ })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Keep swiping" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Share my taste" })).toBeVisible();
    await expect(dialog.locator('a[href*="/shop/mono-"]')).toHaveCount(3);
    await expect(dialog.getByText(/You liked|Your shop is ready|email|Notify/i)).toHaveCount(0);
    await expect(dialog.locator("input")).toHaveCount(0);
  });

  test("before the taste test the card has no Share and no quick add; after, the back offers both", async ({ page }) => {
    await page.goto("");
    await hydrated(page);
    await expect(page.getByRole("button", { name: /^Share / })).toHaveCount(0);
    await page.getByRole("button", { name: "Show details" }).tap();
    await page.waitForTimeout(700);
    await expect(page.getByText("Print DNA")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quick add|Add .* to bag/ })).toHaveCount(0);
  });

  test("after it: the back says 'Add to bag', has Share, no Print DNA; no streak in the header", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      const t = JSON.parse(localStorage.getItem("mono-taste")!);
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      t.state.daily = { day, count: 5, streak: 4, last: day };
      localStorage.setItem("mono-taste", JSON.stringify(t));
    });
    await page.goto("");
    await hydrated(page);
    await expect(page.getByLabel(/streak/i)).toHaveCount(0);
    await expect(page.locator("header svg.lucide-flame")).toHaveCount(0);
    await page.getByRole("button", { name: "Show details" }).tap();
    await page.waitForTimeout(700);
    const back = page.locator('[aria-roledescription="card"]');
    await expect(back.getByRole("button", { name: /Quick add/ })).toContainText("Add to bag");
    await expect(back.getByRole("button", { name: /^Share / }).last()).toBeVisible();
    await expect(page.getByText("Print DNA")).toHaveCount(0);
  });

  test("Your taste holds streak, Daily 5, level and Share my taste — no percentages", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    await page.getByRole("button", { name: /Open your taste profile/ }).tap();
    const sheet = page.getByRole("dialog", { name: "Your taste" });
    await expect(sheet.getByText("Daily 5")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share my taste" })).toBeVisible();
    await expect(sheet.getByText(/Sharpening|Focused|Dialled in/)).toBeVisible();
    expect(await sheet.innerText()).not.toMatch(/\d+%|Level \d/);
  });

  test("I09: a toast in Discover never covers the tee's name", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    await page.getByRole("button", { name: /Open your taste profile/ }).tap();
    await page.getByRole("button", { name: "Reset taste" }).tap();
    const toast = page.locator('div[role="status"][aria-live="polite"] > div').last();
    await expect(toast).toContainText("Started over");
    const title = page.locator('[aria-roledescription="card"] h2').first();
    expect(overlap((await toast.boundingBox())!, (await title.boundingBox())!)).toBe(false);
  });
});

test.describe("Shop, product and bag (R12, F10, R13, R15, R18, R20, I07, I08, I13, I15, R04, R09)", () => {
  test("grid: one Top pick, no match badges, no Share, no Wildcard", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const grid = page.locator("main .grid").first();
    await expect(grid.getByText("Top pick", { exact: true })).toHaveCount(1);
    await expect(grid.getByText(/Strong match|Good match|Wildcard/)).toHaveCount(0);
    await expect(grid.getByRole("button", { name: /^Share / })).toHaveCount(0);
  });

  test("R18: at 375 px quick add's sizes (and their ✕) stay inside the card", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const card = page.locator("main .grid > div").nth(1);
    await card.getByRole("button", { name: /^Quick add/ }).tap();
    const close = card.getByRole("button", { name: "Close sizes" });
    await expect(close).toBeVisible();
    const img = (await card.locator("div.overflow-hidden").first().boundingBox())!;
    const x = (await close.boundingBox())!;
    expect(x.x + x.width).toBeLessThanOrEqual(img.x + img.width + 0.5);
    expect(x.x).toBeGreaterThanOrEqual(img.x);
  });

  test("R13: every add confirms in one row (Added · M, Undo, View bag), also from the grid", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const card = page.locator("main .grid > div").first();
    await card.getByRole("button", { name: /^Quick add/ }).tap();
    await card.getByRole("button", { name: "Size M" }).tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toContainText("Added · M");
    await expect(sheet.getByText("Pairs well with")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Bag \(1\)/ })).toBeVisible();
    await sheet.getByRole("button", { name: "Undo" }).tap();
    await expect(page.getByRole("link", { name: /^Bag \(0\)/ })).toBeVisible();
    await expect(sheet).toBeHidden();
  });

  test("R13: closing the mini bag after touching it doesn't leave the next one stuck open", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    const buy = page.locator(".sticky.bottom-0").getByRole("button").last();
    await buy.tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toBeVisible();
    await sheet.hover();
    await sheet.getByRole("button", { name: "Close" }).tap();
    await expect(sheet).toBeHidden();
    await page.getByRole("radio", { name: /^Black tee/ }).tap();
    await buy.tap();
    await expect(sheet).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(sheet).toBeHidden({ timeout: 4500 });
  });

  test("R13: the mini bag never covers the sizes or the trust line", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.locator(".sticky.bottom-0").getByRole("button").last().tap();
    const sheet = (await page.getByRole("region", { name: "Added to bag" }).boundingBox())!;
    for (const el of [page.getByRole("radiogroup", { name: "Size" }), page.getByText("Free size exchanges")]) {
      const b = await el.boundingBox();
      if (b) expect(overlap(sheet, b)).toBe(false);
    }
  });

  test("R20: at 375 px the price in the buy bar keeps its room", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    const bar = page.locator(".sticky.bottom-0");
    for (const step of ["idle", "added", "view", "both"]) {
      if (step === "added") await bar.getByRole("button").last().tap();
      if (step === "view") await page.waitForTimeout(1400);
      if (step === "both") await page.getByRole("radio", { name: /Both tees/ }).tap();
      const price = bar.locator("p.font-mono").first();
      expect(await price.evaluate((p) => p.scrollWidth <= p.clientWidth + 1)).toBe(true);
      const buy = bar.getByRole("button").last();
      const labels = buy.locator("span.truncate:visible");
      expect(await labels.evaluate((s) => s.scrollWidth <= s.clientWidth + 1)).toBe(true);
    }
    await expect(bar.getByRole("button").last()).toContainText(/Both|Complete|In your bag/);
  });

  test("R15: the buy bar stays above the similar prints scrolling under it", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    const similar = page.getByRole("heading", { name: "Similar prints" });
    await similar.scrollIntoViewIfNeeded();
    const bar = (await page.locator(".sticky.bottom-0").boundingBox())!;
    const ids = await page.evaluate(({ x, y }) => {
      const out: boolean[] = [];
      for (let dx = 20; dx < innerWidth - 20; dx += 40) out.push(!!document.elementFromPoint(dx, y)?.closest(".sticky.bottom-0"));
      return out;
    }, { x: bar.x, y: bar.y + 6 });
    expect(ids.every(Boolean)).toBe(true);
  });

  test("I07: one tee picker (black, white, both with its price anchor); no extra lines; details closed with the print size", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await expect(page.getByRole("radiogroup", { name: "Tee colour" })).toHaveCount(1);
    const both = page.getByRole("radio", { name: /Both tees/ });
    await expect(both).toContainText("$96");
    await expect(both).toContainText("$90");
    await expect(page.getByText(/One of a kind|Get it in both/)).toHaveCount(0);
    const details = page.getByRole("button", { name: "Details" });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await details.tap();
    // The real size of this print (its ink), from the generator: data/shirts.json.
    await expect(page.getByText(/^\d+ × \d+ cm$/)).toBeVisible();
  });

  test("I15: the zoom reads 'On the tee | Print' and opens in the view on screen", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("button", { name: "Print", exact: true }).first().tap();
    await page.getByRole("button", { name: "Zoom in on the print" }).tap();
    const zoom = page.getByRole("dialog", { name: /zoom/ });
    const views = zoom.getByRole("group", { name: "View" }).getByRole("button");
    await expect(views).toHaveText(["On the tee", "Print"]);
    await expect(views.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(zoom.getByText(/10 cm/)).toBeVisible();
  });

  test("I08: Saved — 'Add your top 3 · M · $144', Add all as a link, share by the title, icon-only +", async ({ page }) => {
    await seed(page, { likedIds: ["mono-0500", "mono-0600", "mono-0700", "mono-0800"] });
    await page.addInitScript(() => {
      const c = JSON.parse(localStorage.getItem("mono-cart")!);
      c.state.preferredSize = "M";
      localStorage.setItem("mono-cart", JSON.stringify(c));
    });
    await page.goto("shop/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Saved \(/ }).tap();
    const d = page.getByRole("dialog", { name: "Saved tees" });
    await expect(d.getByRole("button", { name: /Add your top 3 · M · \$144/ })).toBeVisible();
    await expect(d.getByRole("button", { name: /^Add all 6$/ })).toBeVisible();
    await expect(d.getByRole("button", { name: "Share my list" })).toBeVisible();
    const plus = d.locator("[data-saved-row] button[aria-label^='Add ']").first();
    expect((await plus.innerText()).trim()).toBe("");
    await expect(d.locator("input")).toHaveCount(0);
  });

  test("I13, R04, R09: the bag has no repeated meta line, checkout no promo code, confirmation no email capture", async ({ page }) => {
    await seed(page, {}, [{ id: "mono-0001", size: "M", color: "black", qty: 1 }]);
    await page.addInitScript(() => localStorage.setItem("mono-email", JSON.stringify({ email: "ada@example.com" })));
    await page.goto("cart/");
    await hydrated(page);
    expect(await page.evaluate(() => localStorage.getItem("mono-email"))).toBeNull();
    const line = page.locator("main li").first();
    await expect(line.getByText(/^Black · M$/)).toHaveCount(0);
    await page.getByRole("button", { name: /^Checkout/ }).tap();
    await expect(page.getByText(/promo/i)).toHaveCount(0);
    for (const [label, value] of [
      ["Full name", "Ada Lovelace"],
      ["Email", "ada@example.com"],
      ["Street address", "12 Analytical St"],
      ["City", "Tel Aviv"],
      ["Postcode / ZIP", "6100001"],
    ])
      await page.getByLabel(label).fill(value);
    await page.getByRole("button", { name: /Place demo order/ }).tap();
    await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByText(/Notify me|new drops/i)).toHaveCount(0);
  });

  test("Steps hide on an empty bag", async ({ page }) => {
    await seed(page);
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByRole("img", { name: /Step \d of 3/ })).toHaveCount(0);
  });
});
