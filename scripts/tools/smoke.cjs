// End-to-end smoke test of the static export (out/), in Chromium.
//   npm run build && npm run smoke
// Serves out/ itself (honouring NEXT_PUBLIC_BASE_PATH), then on a phone
// viewport with touch: 10 swipes → the reveal, zoom in place / tap back,
// shop, product page colour toggle on the image, add to bag, checkout.
// Also loads the main pages on desktop. Fails on any console / page error.
const fs = require("fs");
const path = require("path");
const { chromium, devices } = (() => {
  try {
    return require("playwright");
  } catch {
    return require("/opt/node22/lib/node_modules/playwright");
  }
})();
const { serve, OUT, BASE_PATH } = require("./serveOut.cjs");

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

(async () => {
  if (!fs.existsSync(path.join(OUT, "index.html"))) {
    console.error("out/ not found — run `npm run build` first");
    process.exit(1);
  }
  const server = await serve();
  const BASE = `http://127.0.0.1:${server.address().port}${BASE_PATH}/`;
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${tag} console: ${m.text()}`));
  };

  try {
    /* ---------------- phone ---------------- */
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    watch(p, "mobile");
    await p.goto(BASE, { waitUntil: "networkidle" });

    // 10 swipes via the action buttons (alternating save / pass)
    for (let i = 0; i < 10; i++) {
      await p.getByRole("button", { name: i % 2 ? "Pass" : "Save", exact: true }).tap();
      await p.waitForTimeout(450);
    }
    const done = p.getByRole("dialog").filter({ hasText: /your shop is now edited around this/i });
    await done.waitFor({ timeout: 5000 }).catch(() => {});
    ok(await done.isVisible(), "10 swipes → the reveal");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);

    // zoom in place: a double tap zooms the picture on the card, a tap brings it back
    const card = p.locator('[aria-roledescription="card"]').first();
    const layer = card.locator("[data-zoom-stage] > div").first();
    await card.tap({ position: { x: 180, y: 250 } });
    await p.waitForTimeout(80);
    await card.tap({ position: { x: 180, y: 250 } });
    await p.waitForTimeout(700);
    const scaled = await layer.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    ok(scaled > 2 && (await p.getByRole("dialog").count()) === 0, "double tap zooms the picture in place");
    await card.tap({ position: { x: 180, y: 250 } });
    await p.waitForTimeout(700);
    const back = await layer.evaluate((el) => getComputedStyle(el).transform);
    ok(back === "none" || new DOMMatrix(back).a === 1, "a tap returns the picture");

    // shop → product
    await p.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop", exact: true }).tap();
    await p.waitForURL(/\/shop\/?$/);
    const firstProduct = p.locator('[data-product-card] a[href*="/shop/"]').first();
    await firstProduct.waitFor();
    // The grid fills in once the catalogue has loaded.
    await p.waitForFunction(() => document.querySelectorAll('[data-product-card] a[href*="/shop/"]').length >= 12, null, { timeout: 10000 }).catch(() => {});
    ok((await p.locator('[data-product-card] a[href*="/shop/"]').count()) >= 12, "shop grid renders products");
    // Open the first design that comes in both tee colours: a one-colour design has no colour toggle,
    // and which design leads the grid shifts with the catalogue and the swipes above.
    const twoColour = require("../../data/shirts.json").filter((t) => t.colors.length > 1).map((t) => t.id);
    const hrefs = await p.locator('[data-product-card] a[href*="/shop/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const pick = hrefs.findIndex((h) => twoColour.some((id) => h.includes(`/shop/${id}/`)));
    ok(pick >= 0, "shop grid has a design in both colours");
    await p.locator('[data-product-card] a[href*="/shop/"]').nth(Math.max(pick, 0)).tap();
    await p.waitForURL(/\/shop\/(mono-\d+|p\/)/);
    const toggle = p.getByRole("radiogroup", { name: /tee colou?r/i }).first();
    await toggle.waitFor();
    const box = await toggle.boundingBox();
    ok(box && box.y + box.height < 844, "colour toggle visible without scrolling");
    const unchecked = toggle.getByRole("radio", { checked: false }).filter({ hasNotText: /both/i }).first();
    await unchecked.tap();
    await p.waitForTimeout(300);
    ok((await toggle.getByRole("radio", { checked: true }).count()) === 1, "colour toggle switches");

    // size + add to bag
    await p.getByRole("radio", { name: /^M\b/ }).first().tap();
    // The phone's sticky buy bar: "Add to bag · M · $50", then "In your bag · Checkout".
    await p.getByRole("button", { name: /^Add to bag · M · \$/ }).last().tap();
    await p.waitForTimeout(500);
    ok(await p.getByRole("button", { name: "In your bag · Checkout" }).last().isVisible(), "added to bag");

    // checkout
    await p.goto(BASE + "cart/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /^Checkout · \$/ }).first().tap();
    const fields = { "Full name": "Test Person", Email: "test@example.com", Address: "1 Test St", City: "Testville" };
    for (const [label, value] of Object.entries(fields)) {
      const f = p.getByLabel(new RegExp(`^${label}`, "i")).first();
      if (await f.count()) await f.fill(value);
    }
    await p.getByLabel(/^Country/i).first().selectOption({ label: "Israel" });
    for (const [label, value] of Object.entries({ Postcode: "12345", ZIP: "12345" })) {
      const f = p.getByLabel(new RegExp(`^${label}`, "i")).first();
      if (await f.count()) await f.fill(value);
    }
    await p.getByRole("button", { name: /^place order/i }).first().tap();
    await p.waitForTimeout(800);
    ok(await p.getByRole("heading", { name: /^thank you/i }).first().isVisible(), "checkout completes");
    await ctx.close();

    /* ---------------- desktop ---------------- */
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const d = await dctx.newPage();
    watch(d, "desktop");
    // A product page: the first design the catalogue has (reviews retire designs; ids never move).
    const firstId = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "shirts.json"), "utf8"))[0].id;
    for (const route of ["", "shop/", `shop/${firstId}/`, "cart/"]) {
      const r = await d.goto(BASE + route, { waitUntil: "networkidle" });
      ok(r && r.status() === 200, `desktop ${route || "/"} loads`);
    }
    await d.keyboard.press("ArrowRight");
    await dctx.close();
  } catch (e) {
    ok(false, `unexpected: ${e.message.split("\n")[0]}`);
  }

  const real = errors.filter((e) => !/favicon/i.test(e));
  ok(real.length === 0, `no console/page errors${real.length ? `:\n  ${real.join("\n  ")}` : ""}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} smoke check(s) failed` : "\nsmoke OK");
  process.exit(failures ? 1 : 0);
})();
