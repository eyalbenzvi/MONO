// End-to-end smoke test of the static export (out/), in Chromium.
//   npm run build && npm run smoke
// Serves out/ itself (honouring NEXT_PUBLIC_BASE_PATH), then on a phone
// viewport with touch: 10 swipes → taste-test screen, zoom open / Escape,
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

    // 10 swipes via the action buttons (alternating like / pass)
    for (let i = 0; i < 10; i++) {
      await p.getByRole("button", { name: i % 2 ? "Pass" : "Like", exact: true }).tap();
      await p.waitForTimeout(450);
    }
    const done = p.getByRole("dialog").filter({ hasText: /taste test complete|your shop is ready/i });
    await done.waitFor({ timeout: 5000 }).catch(() => {});
    ok(await done.isVisible(), "10 swipes → taste-test complete screen");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);

    // zoom: tap the card for its details, then ⋯ → Zoom
    await p.locator('[aria-roledescription="card"]').first().tap();
    await p.waitForTimeout(700);
    await p.getByRole("button", { name: /^more for /i }).first().tap();
    await p.getByRole("button", { name: /zoom in on the print/i }).first().tap();
    const zoom = p.getByRole("dialog", { name: /zoom/i });
    await zoom.waitFor({ timeout: 3000 }).catch(() => {});
    ok(await zoom.isVisible(), "zoom opens");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    ok((await zoom.count()) === 0, "Escape closes zoom");

    // shop → product
    await p.getByRole("link", { name: /^shop$/i }).first().tap();
    await p.waitForURL(/\/shop\/?$/);
    const firstProduct = p.locator('a[href*="/shop/mono-"]').first();
    await firstProduct.waitFor();
    ok((await p.locator('a[href*="/shop/mono-"]').count()) >= 12, "shop grid renders products");
    await firstProduct.tap();
    await p.waitForURL(/\/shop\/mono-\d+/);
    const toggle = p.getByRole("radiogroup", { name: /tee colou?r/i }).first();
    await toggle.waitFor();
    const box = await toggle.boundingBox();
    ok(box && box.y + box.height < 844, "colour toggle visible without scrolling");
    const unchecked = toggle.getByRole("radio", { checked: false }).first();
    await unchecked.tap();
    await p.waitForTimeout(300);
    ok((await toggle.getByRole("radio", { checked: true }).count()) === 1, "colour toggle switches");

    // size + add to bag
    await p.getByRole("radio", { name: /^M\b/ }).first().tap();
    // The phone's sticky buy bar (its last button is "Add to bag · M").
    await p.locator(".sticky.bottom-0").getByRole("button").last().tap();
    await p.waitForTimeout(500);
    const bagCount = await p.getByRole("link", { name: /bag \((\d+)\)/i }).first().getAttribute("aria-label");
    ok(/\(1\)/.test(bagCount || ""), `bag count updated (${bagCount})`);

    // checkout
    await p.goto(BASE + "cart/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /checkout/i }).first().tap();
    const fields = { "Full name": "Test Person", Email: "test@example.com", "Street address": "1 Test St", City: "Testville" };
    for (const [label, value] of Object.entries(fields)) {
      const f = p.getByLabel(new RegExp(`^${label}`, "i")).first();
      if (await f.count()) await f.fill(value);
    }
    for (const [label, value] of Object.entries({ Country: "Israel", "Postcode": "12345", "ZIP": "12345", "Postal code": "12345" })) {
      const f = p.getByLabel(new RegExp(`^${label}`, "i")).first();
      if ((await f.count()) && (await f.evaluate((el) => el.tagName !== "SELECT"))) await f.fill(value);
    }
    await p.getByRole("button", { name: /place .*order/i }).first().tap();
    await p.waitForTimeout(800);
    ok(await p.getByRole("heading", { name: /order placed|thank/i }).first().isVisible(), "checkout completes");
    await ctx.close();

    /* ---------------- desktop ---------------- */
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const d = await dctx.newPage();
    watch(d, "desktop");
    for (const route of ["", "shop/", "shop/mono-0001/", "cart/"]) {
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
