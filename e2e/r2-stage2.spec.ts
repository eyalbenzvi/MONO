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
    // T1: no share icon here (sharing your taste lives in Your taste).
    await expect(dialog.getByRole("button", { name: "Share my taste" })).toHaveCount(0);
    await expect(dialog.locator('a[href*="/shop/mono-"]')).toHaveCount(3);
    await expect(dialog.getByText(/You liked|Your shop is ready|email|Notify/i)).toHaveCount(0);
    await expect(dialog.locator("input")).toHaveCount(0);
  });

  test("T1: the card face holds the tee and its name only — no share, zoom or info buttons; tapping it shows the details", async ({ page }) => {
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    await expect(page.getByRole("button", { name: /^Share |Zoom in on the print|Show details/ })).toHaveCount(0);
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
    await card.tap();
    await page.waitForTimeout(700);
    await expect(page.getByText("Print DNA")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quick add|Add .* to bag/ })).toHaveCount(0);
    await expect(card.getByRole("link", { name: /View tee/ })).toBeVisible();
  });

  test("T1: after the taste test the back has one action (View tee); Share and Zoom are behind ⋯; no streak in the header", async ({ page }) => {
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
    const back = page.locator('[aria-roledescription="card"]').first();
    await back.tap();
    await page.waitForTimeout(700);
    await expect(back.getByRole("link", { name: /View tee/ })).toBeVisible();
    await expect(back.getByRole("button", { name: /Quick add|^Share / })).toHaveCount(0);
    await back.getByRole("button", { name: /^More for / }).tap();
    const menu = page.getByRole("dialog", { name: /^More for / });
    await expect(menu.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Zoom in on the print" })).toBeVisible();
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
    await page.getByRole("button", { name: "More for your taste" }).tap();
    await page.getByRole("button", { name: /^Reset taste/ }).tap();
    const toast = page.locator('div[role="status"][aria-live="polite"] > div').last();
    await expect(toast).toContainText("Started over");
    const title = page.locator('[aria-roledescription="card"] h2').first();
    expect(overlap((await toast.boundingBox())!, (await title.boundingBox())!)).toBe(false);
  });
});

test.describe("Shop, product and bag (R12, F10, R13, R15, R18, R20, I07, I08, I13, I15, R04, R09)", () => {
  test("grid (T1 minimal): no tags or badges at all — no Top pick, New, match or Wildcard — and no Share", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const grid = page.locator("main .grid").first();
    await expect(grid.getByText(/Top pick|New this week/)).toHaveCount(0);
    await expect(grid.getByText(/Strong match|Good match|Wildcard/)).toHaveCount(0);
    await expect(grid.getByRole("button", { name: /^Share / })).toHaveCount(0);
  });

  test("T1: a grid card is one link and a heart — no quick add, no price", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const card = page.locator("main .grid > div").nth(1);
    await expect(card.getByRole("link")).toHaveCount(1);
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(card.getByRole("button", { name: /Save/ })).toBeVisible();
    await expect(card.getByText(/\$\d/)).toHaveCount(0);
  });

  test("R13: every add confirms in one row (Added · M, View bag) — nothing else to press", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.locator(".sticky.bottom-0").getByRole("button").last().tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toContainText("Added · M");
    await expect(sheet.getByRole("link", { name: "View bag" })).toBeVisible();
    await expect(sheet.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Bag \(1\)/ })).toBeVisible();
  });

  test("R13: the mini bag stays while hovered and leaves by itself after; the next add shows again", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    const buy = page.locator(".sticky.bottom-0").getByRole("button").last();
    await buy.tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toBeVisible();
    await sheet.hover();
    await page.waitForTimeout(3000);
    await expect(sheet).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(sheet).toBeHidden({ timeout: 4500 });
    await page.getByRole("radio", { name: /^Black tee/ }).tap();
    await buy.tap();
    await expect(sheet).toBeVisible();
  });

  test("R13: the mini bag never covers the sizes", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.locator(".sticky.bottom-0").getByRole("button").last().tap();
    const sheet = (await page.getByRole("region", { name: "Added to bag" }).boundingBox())!;
    for (const el of [page.getByRole("radiogroup", { name: "Size" })]) {
      const b = await el.boundingBox();
      if (b) expect(overlap(sheet, b)).toBe(false);
    }
  });

  test("R20: at 375 px the buy button's label (with the price) fits in every state", async ({ page }) => {
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

  test("I07 / T4: one tee picker (black, white, both); the price only on the buy button; details closed with the print size", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await expect(page.getByRole("radiogroup", { name: "Tee colour" })).toHaveCount(1);
    const both = page.getByRole("radio", { name: /Both tees/ });
    await expect(both).not.toContainText("$");
    await expect(page.locator("main h1 + span, main h1 ~ span.font-mono")).toHaveCount(0);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await expect(page.getByRole("button", { name: /^Add to bag · \$48$/ }).last()).toBeVisible();
    await both.tap();
    await expect(page.getByRole("button", { name: /^Add both · \$90$/ }).last()).toBeVisible();
    await expect(page.getByText(/One of a kind|Get it in both/)).toHaveCount(0);
    const details = page.getByRole("button", { name: "Details" });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await details.tap();
    // The real size of this print (its ink), from the generator: data/shirts.json.
    await expect(page.getByText(/^\d+ × \d+ cm$/)).toBeVisible();
  });

  test("I15 / T1: the print-only view is in ⋯; tapping the picture zooms, in the view on screen", async ({ page }) => {
    await seed(page);
    await page.goto("shop/mono-0001/");
    await hydrated(page);
    await page.getByRole("button", { name: /^More for / }).tap();
    await page.getByRole("button", { name: "Show the print only" }).tap();
    await page.waitForTimeout(500); // the picture cross-fades to the print
    await page.getByRole("button", { name: "Zoom in on the print" }).tap();
    const zoom = page.getByRole("dialog", { name: /zoom/ });
    const views = zoom.getByRole("group", { name: "View" }).getByRole("button");
    await expect(views).toHaveText(["On the tee", "Print"]);
    await expect(views.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(zoom.getByText(/10 cm/)).toBeVisible();
  });

  test("I08 / T1 / T4: Saved — one button 'Add your top 3 · M' (no prices); Add all and Share behind ⋯; rows without +", async ({ page }) => {
    await seed(page, { likedIds: ["mono-0501", "mono-0601", "mono-0701", "mono-0801"] });
    await page.addInitScript(() => {
      const c = JSON.parse(localStorage.getItem("mono-cart")!);
      c.state.preferredSize = "M";
      localStorage.setItem("mono-cart", JSON.stringify(c));
    });
    await page.goto("shop/");
    await hydrated(page);
    await page.getByRole("button", { name: /^Saved \(/ }).tap();
    const d = page.getByRole("dialog", { name: "Saved tees" });
    await expect(d.getByRole("button", { name: /^Add your top 3 · M$/ })).toBeVisible();
    await expect(d.getByText(/\$\d/)).toHaveCount(0);
    await expect(d.locator("[data-saved-row] button[aria-label^='Add ']")).toHaveCount(0);
    await d.getByRole("button", { name: "More for Saved" }).tap();
    const menu = page.getByRole("dialog", { name: "More for Saved" });
    await expect(menu.getByRole("button", { name: "Add all 6 to bag" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Share my list" })).toBeVisible();
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
