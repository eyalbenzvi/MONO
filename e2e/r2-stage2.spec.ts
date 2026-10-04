import { expect, test, type Page } from "@playwright/test";
import { PRICE } from "../scripts/gen/constants";
import { hydrated, seed, openSaved } from "./helpers";
import { B1, B2, B3, B9, W1 } from "../tests/fixtures";

const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function tenSwipes(page: Page, onEach?: () => Promise<void>) {
  const said = page.locator('main p[role="status"]');
  for (let i = 0; i < 10; i++) {
    const before = (await said.textContent()) ?? "";
    await page.getByRole("button", { name: i % 2 ? "Pass" : "Save", exact: true }).tap();
    // The live region names each swipe ("Saved X. 1 of 10."): the deck has taken it.
    await expect(said).not.toHaveText(before);
    await onEach?.();
  }
}

/** The product page's buy button on a phone (the page's own bottom bar; the desktop copy is hidden). */
const buyButton = (page: Page) => page.getByRole("button", { name: /^(Add to bag|Add the pair|Complete the pair|In your bag)/ }).filter({ visible: true });

test.describe("Discover stays minimal (R01, R03, R14, R16, I02, I06, F01)", () => {
  test("taste test: no toasts, no pull-back tab, no trust line, and the card never moves", async ({ page }) => {
    await page.goto("");
    await hydrated(page);
    await expect(page.getByText(/Free size exchanges|Ships in|Free returns/)).toHaveCount(0);
    const strip = page.locator("[data-strip]:visible");
    await expect(strip).toHaveText("Ten tees. Keep or pass. We’ll edit the shop to your taste.");
    const before = await strip.boundingBox();
    const seen: string[] = [];
    // No Buy during the test (it comes back once the taste is known).
    await expect(page.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    let n = 0;
    await tenSwipes(page, async () => {
      if (++n < 10) expect(await page.getByRole("button", { name: /^Buy / }).count()).toBe(0);
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

  test("the reveal: the archetype, one sentence, 3 tees, one CTA — and it fits 375×667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("");
    await hydrated(page);
    await tenSwipes(page);
    // Named by its heading, the archetype (no "You’re", no "Taste test complete").
    const dialog = page.getByRole("dialog", { name: /^The [A-Za-z ]+$/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Your taste", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Your shop is now edited around this.")).toBeVisible();
    // Settled (the sheet slides up): all of it on screen, nothing to scroll.
    await expect
      .poll(() =>
        dialog.evaluate((d) => {
          const r = d.getBoundingClientRect();
          const inner = [...d.querySelectorAll<HTMLElement>("*")].every((el) => el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY === "visible");
          return d.scrollHeight <= d.clientHeight + 1 && inner && r.top >= 0 && r.bottom <= innerHeight + 1;
        }),
      )
      .toBe(true);
    await expect(dialog.getByRole("link", { name: "See your edit" })).toHaveAttribute("href", /\/shop\/$/);
    await expect(dialog.getByRole("button", { name: "Keep swiping" })).toBeVisible();
    // No share here (sharing your taste lives in Your taste), no trait chips or percentages.
    await expect(dialog.getByRole("button", { name: /^Share/ })).toHaveCount(0);
    await expect(dialog.locator('a[href*="mono-"]')).toHaveCount(3);
    await expect(dialog.getByText(/You liked|You’re|Taste test complete|email|Notify|% alike/i)).toHaveCount(0);
    await expect(dialog.locator("input")).toHaveCount(0);
  });

  test("T1: the card face holds the tee and its name only — no share, zoom or info buttons; tapping it shows the details", async ({ page }) => {
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    await expect(page.getByRole("button", { name: /^Share |Zoom in on the print|Show details/ })).toHaveCount(0);
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
    // No text stamps on the card (a tint instead).
    await expect(card.getByText(/^(LIKE|PASS|SAVE|Details)$/)).toHaveCount(0);
    await card.tap();
    await expect(card.getByRole("link", { name: "View tee →" })).toBeVisible();
    await expect(page).toHaveURL(/#details-card$/);
    await expect(page.getByText("Print DNA")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quick add|Add .* to bag/ })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Back to the tee" })).toBeVisible();
    // Back turns the card back.
    await page.goBack();
    await expect(card.getByRole("link", { name: "View tee →" })).toBeHidden();
  });

  test("T1: after the taste test the back has one action (View tee); Share is a direct button (zoom is a pinch on the picture); no streak anywhere", async ({ page }) => {
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
    // An old stored streak / Daily 5 is ignored: none of it shows.
    await expect(page.getByLabel(/streak/i)).toHaveCount(0);
    await expect(page.getByText(/streak|Daily 5|day \d/i)).toHaveCount(0);
    const back = page.locator('[aria-roledescription="card"]').first();
    await back.tap();
    await expect(back.getByRole("link", { name: "View tee →" })).toBeVisible();
    await expect(back.getByRole("button", { name: /Quick add/ })).toHaveCount(0);
    // No ⋯ menu holding one item: share is a direct button (undo too, once there's a swipe).
    await expect(back.getByRole("button", { name: /^More for / })).toHaveCount(0);
    await expect(back.getByRole("button", { name: /^Share / })).toBeVisible();
    await expect(back.getByRole("button", { name: "Zoom in on the print" })).toHaveCount(0);
  });

  test("Your taste holds the archetype, its sentence and Share your taste — no streak, Daily 5, level or percentages", async ({ page }) => {
    await seed(page);
    await page.goto("");
    await hydrated(page);
    const open = page.getByRole("button", { name: /^Your taste · The / });
    await expect(open).toHaveAttribute("aria-haspopup", "dialog");
    await open.tap();
    const sheet = page.getByRole("dialog", { name: "Your taste" });
    await expect(sheet.getByRole("heading", { name: /^The / })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Share your taste" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "See your edit" })).toBeVisible();
    await expect(page).toHaveURL(/#taste$/);
    const text = await sheet.innerText();
    expect(text).not.toMatch(/\d+%|Level \d|Daily 5|streak|Sharpening|Focused|Dialled in/i);
    // Resetting lives on You, not here.
    await expect(sheet.getByRole("button", { name: /Reset taste|More for your taste/ })).toHaveCount(0);
    await page.goBack();
    await expect(sheet).toHaveCount(0);
  });

  test("I09: a toast in Discover never covers the tee's name", async ({ page }) => {
    await seed(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("");
    await hydrated(page);
    const card = page.locator('[aria-roledescription="card"]').first();
    const title = card.locator("h2").first();
    await expect(title).toBeVisible();
    const titleBox = (await title.boundingBox())!;
    // A toast from Discover: Share on the card's details, then Copy link.
    await card.tap();
    await card.getByRole("button", { name: /^Share / }).tap();
    await page.getByRole("dialog", { name: /^Share / }).getByRole("button", { name: "Copy link" }).tap();
    const toast = page.locator('div[role="status"][aria-live="polite"] > div').last();
    await expect(toast).toContainText(/Link copied|Couldn’t copy/);
    // The toast is fixed at the bottom, above whatever bar is there; the card doesn't move.
    const toastBox = (await toast.boundingBox())!;
    expect(overlap(toastBox, titleBox)).toBe(false);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(title).toBeVisible();
    expect(overlap(toastBox, (await title.boundingBox())!)).toBe(false);
  });
});

test.describe("Shop, product and bag (R12, F10, R13, R15, R18, R20, I07, I08, I13, I15, R04, R09)", () => {
  test("grid (T1 minimal): one tag only, Top pick on the first card of Your edit — no New, match or Wildcard, and no Share", async ({ page }) => {
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your edit");
    const grid = page.locator("main .grid").first();
    await expect(grid.getByText("Top pick", { exact: true })).toHaveCount(1);
    await expect(grid.locator("> div").first().getByText("Top pick", { exact: true })).toBeVisible();
    await expect(grid.getByText(/New this week/)).toHaveCount(0);
    await expect(grid.getByText(/Strong match|Good match|Wildcard/)).toHaveCount(0);
    await expect(grid.getByRole("button", { name: /^Share / })).toHaveCount(0);
  });

  test("T1: a grid card is one link and one heart — no quick add, no price; the heart is on every card, outlined until saved", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    const cards = page.locator("main .grid > div");
    const card = cards.filter({ hasNot: page.getByRole("button", { name: /from Saved$/ }) }).nth(1);
    await expect(card.getByRole("link")).toHaveCount(1);
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(card.getByRole("button", { name: /^Save / })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Save / })).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByText(/\$\d/)).toHaveCount(0);
    // A saved tee keeps its heart, to unsave. The taste test's saves step back in the shop (seen in
    // Discover) and the order rotates per browser and day, so they need not be on the first page:
    // save a tee this grid does show (the ranking ignores saves; the vector, seen and seed stay put).
    const href = await cards.nth(2).getByRole("link").getAttribute("href");
    const id = href?.match(/\/shop\/([^/?#]+)/)?.[1];
    expect(id).toBeTruthy();
    await page.evaluate((id) => {
      const t = JSON.parse(localStorage.getItem("mono-taste") || "{}");
      t.state.likedIds = [...t.state.likedIds, id];
      localStorage.setItem("mono-taste", JSON.stringify(t));
    }, id!);
    await page.reload();
    await hydrated(page);
    await expect(cards.filter({ has: page.locator(`a[href*="/shop/${id}/"]`) }).getByRole("button", { name: /^Remove .+ from Saved$/ })).toBeVisible();
    const saved = cards.filter({ has: page.getByRole("button", { name: /from Saved$/ }) }).first();
    await expect(saved.getByRole("link")).toHaveCount(1);
    await expect(saved.getByRole("button")).toHaveCount(1);
    await expect(saved.getByRole("button", { name: /^Remove .+ from Saved$/ })).toBeVisible();
  });

  test("R13: every add confirms in one row (the tee, its colour and size, Checkout) — nothing else to press", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await buyButton(page).tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toContainText("✓ Added");
    await expect(sheet).toContainText(/(Black|White) · M/);
    await expect(sheet.getByRole("link", { name: "Checkout" })).toBeVisible();
    await expect(sheet.getByRole("button")).toHaveCount(0);
    // The buy button now leads to the bag, and never adds a second one silently.
    await expect(buyButton(page)).toHaveText("In your bag · Checkout");
    // The tab bar (hidden on a product page) counts it elsewhere.
    await page.goto("shop/");
    await hydrated(page);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bag 1" })).toBeVisible();
  });

  test("R13: the mini bag stays while hovered and leaves by itself after; the next add shows again", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    const buy = buyButton(page);
    await buy.tap();
    const sheet = page.getByRole("region", { name: "Added to bag" });
    await expect(sheet).toBeVisible();
    await sheet.hover();
    // Past its own 5 s while held.
    await page.waitForTimeout(5600);
    await expect(sheet).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(sheet).toBeHidden({ timeout: 7000 });
    await page.getByRole("radio", { name: /^Black tee/ }).tap();
    await buy.tap();
    await expect(sheet).toBeVisible();
  });

  test("R13: the mini bag never covers the sizes", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await buyButton(page).tap();
    const region = page.getByRole("region", { name: "Added to bag" });
    await expect(region).toBeVisible();
    // Settled (it slides up 8 px as it appears).
    await expect(region).toHaveCSS("transform", "none");
    const sheet = (await region.boundingBox())!;
    for (const el of [page.getByRole("radiogroup", { name: "Size" })]) {
      const b = await el.boundingBox();
      if (b) expect(overlap(sheet, b)).toBe(false);
    }
  });

  test("R20: at 375 px the buy button's label (with the price) fits in every state", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    const expected: Record<string, string | RegExp> = {
      none: `Add to bag · $${PRICE}`,
      idle: `Add to bag · M · $${PRICE}`,
      added: "In your bag · Checkout",
      both: /^Complete the pair · \+\$\d+$/,
    };
    for (const step of ["none", "idle", "added", "both"]) {
      if (step === "idle") await page.getByRole("radio", { name: /^M\b/ }).first().tap();
      if (step === "added") await buyButton(page).tap();
      if (step === "both") await page.getByRole("radio", { name: /Both tees/ }).tap();
      const buy = buyButton(page);
      await expect(buy).toHaveText(expected[step]);
      const labels = buy.locator("span.truncate:visible");
      expect(await labels.evaluate((s) => s.scrollWidth <= s.clientWidth + 1)).toBe(true);
    }
  });

  test("R15: the buy bar stays above the similar prints scrolling under it", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    const similar = page.getByRole("heading", { name: "Similar prints" });
    await similar.scrollIntoViewIfNeeded();
    // The bar is the buy button's row (the Save heart and the button).
    await buyButton(page).evaluate((b) => b.parentElement!.setAttribute("data-e2e-bar", ""));
    const bar = (await page.locator("[data-e2e-bar]").boundingBox())!;
    const ids = await page.evaluate(({ y }) => {
      const out: boolean[] = [];
      for (let dx = 20; dx < innerWidth - 20; dx += 40) out.push(!!document.elementFromPoint(dx, y)?.closest("[data-e2e-bar]"));
      return out;
    }, { y: bar.y + 6 });
    expect(ids.every(Boolean)).toBe(true);
  });

  test("I07 / T4: one tee picker (black, white, both · $90); otherwise the price only on the buy button; details closed with the print size", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await expect(page.getByRole("radiogroup", { name: "Tee colour" })).toHaveCount(1);
    const both = page.getByRole("radio", { name: /Both tees/ });
    // The pair is itself a buying choice, so its price is on it.
    await expect(both).toHaveText("Both · $90");
    await expect(page.locator("main h1 + span, main h1 ~ span.font-mono")).toHaveCount(0);
    // Any other price on the page is a buy button's.
    for (const t of await page.getByRole("main").getByText(/\$\d/).allInnerTexts()) expect(t).toMatch(new RegExp(`^(Both · \\$90|Add to bag · \\$${PRICE})$`));
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await expect(buyButton(page)).toHaveText(`Add to bag · M · $${PRICE}`);
    await both.tap();
    await expect(buyButton(page)).toHaveText("Add the pair · M · $90");
    await expect(page.getByText(/One of a kind|Get it in both/)).toHaveCount(0);
    const details = page.getByRole("button", { name: "Details", exact: true });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await details.tap();
    // The real size of this print (its ink), from the generator: data/shirts.json.
    await expect(page.getByText(/^\d+ × \d+ cm$/)).toBeVisible();
  });

  test("I15 / T1: the print-only view is the gallery's second slide (no ⋯ menu); tapping the picture zooms, in the view on screen", async ({ page }) => {
    await seed(page);
    await page.goto(`shop/${W1}/`);
    await hydrated(page);
    await expect(page.getByRole("button", { name: /^More for / })).toHaveCount(0);
    const dots = [page.getByRole("button", { name: "On the tee", exact: true }), page.getByRole("button", { name: "Print", exact: true })];
    await expect(dots[0]).toHaveAttribute("aria-pressed", "true");
    await dots[1].tap();
    await expect(dots[1]).toHaveAttribute("aria-pressed", "true");
    const print = page.getByRole("button", { name: "Zoom in on the print" });
    await expect(print).toBeInViewport({ ratio: 0.9 });
    await print.tap();
    const zoom = page.getByRole("dialog", { name: /zoom/ });
    const views = zoom.getByRole("group", { name: "View" }).getByRole("button");
    await expect(views).toHaveText(["On the tee", "Print"]);
    await expect(views.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(zoom.getByText(/10 cm/)).toBeVisible();
  });

  test("I08 / T1 / T4: Saved lives on You, in full — + per row with the remembered size, × per row, Share list; no drawer, top 3, prices or ⋯", async ({ page }) => {
    await seed(page, { likedIds: [B9, B1, B2, B3] });
    await page.addInitScript(() => {
      const c = JSON.parse(localStorage.getItem("mono-cart")!);
      c.state.preferredSize = "M";
      localStorage.setItem("mono-cart", JSON.stringify(c));
    });
    await page.goto("shop/");
    await hydrated(page);
    await openSaved(page);
    await expect(page).toHaveURL(/\/me\/$/);
    const list = page.getByRole("list", { name: "Saved" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add your top 3|Edit saved|More for Saved|^Checkout/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Picked for you" })).toHaveCount(0);
    await expect(list.getByText(/\$\d/)).toHaveCount(0);
    // Every saved tee (the seeded saves and the taste test's, which can overlap), each with + and ×.
    const rows = list.locator("[data-saved-row]");
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(4);
    await expect(list.getByRole("button", { name: /^Add .+ to bag, size M$/ })).toHaveCount(n);
    await expect(list.getByRole("button", { name: /^Remove / })).toHaveCount(n);
    await expect(page.getByRole("button", { name: "Share list" })).toBeVisible();
    await expect(page.locator("main input")).toHaveCount(0);
    // + adds that tee in the remembered size.
    await list.getByRole("button", { name: /^Add .+ to bag, size M$/ }).first().tap();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bag 1" })).toBeVisible();
  });

  test("I13, R04, R09: the bag has no repeated meta line, checkout no promo code, confirmation no email capture", async ({ page }) => {
    await seed(page, {}, [{ id: W1, size: "M", color: "black", qty: 1 }]);
    await page.addInitScript(() => localStorage.setItem("mono-email", JSON.stringify({ email: "ada@example.com" })));
    await page.goto("cart/");
    await hydrated(page);
    expect(await page.evaluate(() => localStorage.getItem("mono-email"))).toBeNull();
    const line = page.locator("main li").first();
    await expect(line.getByText(/^Black · M$/)).toHaveCount(0);
    await page.getByRole("button", { name: /^Checkout · \$\d+$/ }).tap();
    await expect(page.getByRole("heading", { name: "Checkout", level: 1 })).toBeVisible();
    await expect(page.getByText(/promo/i)).toHaveCount(0);
    for (const [label, value] of [
      ["Email", "ada@example.com"],
      ["Full name", "Ada Lovelace"],
      ["Address", "12 Analytical St"],
      ["City", "Tel Aviv"],
      ["Postcode / ZIP", "6100001"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel("Country").selectOption("IL");
    await page.getByRole("button", { name: /^Place order · \$\d+$/ }).tap();
    await expect(page.getByRole("heading", { name: "Thank you, Ada." })).toBeVisible();
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
