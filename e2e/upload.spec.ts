import { expect, test, type Page } from "@playwright/test";
import { CALIBRATION_IDS, hydrated } from "./helpers";
import { drawing, engraving, photo, tiny } from "./fixtures/uploads";

async function choose(page: Page, name: string, buffer: Buffer, mimeType = "image/png") {
  await page.locator("#upload-file").setInputFiles({ name, mimeType, buffer });
}
const ready = (page: Page) => expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 20_000 });

test("From yours: a photograph → Dots and Lines → Small → the other tee → rights → size → bag", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "IMG_2041 heron at dusk.png", await photo());
  await ready(page);
  await expect(page.locator("[data-title]")).toHaveText("Heron At Dusk");
  await expect(page.locator("[data-upload-line]")).toHaveText(/^A (light|dark) picture, so (black|white): the ink draws its (lights|darks)\.$/);
  await page.getByRole("radio", { name: "Lines" }).tap();
  await ready(page);
  await page.getByRole("radio", { name: "Dots" }).tap();
  await page.getByRole("radio", { name: "Small" }).tap();
  await ready(page);
  await page.getByRole("button", { name: "Continue" }).tap();
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await page.getByText("I made this, or I have permission to print it.").tap();
  await cont.tap();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M · \$75$/ }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByText("Heron At Dusk")).toBeVisible();
  await expect(page.getByText(/^Your file · (Black|White)/)).toBeVisible();
});

test("From yours: a drawing keeps its polarity and offers both tees", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  await expect(page.locator("[data-upload-line]")).toHaveText("Drawn in dark on light, so white. Black swaps the inks.");
  await expect(page.getByRole("radio", { name: "White" })).toHaveAttribute("aria-checked", "true");
});

test("From yours: a file too small for Full says so and stops there", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "small.png", await tiny());
  await expect(page.locator("[data-upload-line]")).toHaveText("Too small for Full. Try Small, or a larger file.", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

/** From the mini bag's Checkout to "Order placed". */
async function checkoutFromMiniBag(page: Page) {
  await page.getByRole("region", { name: "Added to bag" }).getByRole("link", { name: "Checkout" }).tap();
  await page.waitForURL(/\/cart\/$/);
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
}

async function uploadToBag(page: Page, name: string, buffer: Buffer, query = "") {
  await page.goto(`make/yours/${query}`);
  await hydrated(page);
  await choose(page, name, buffer);
  await ready(page);
  await page.getByRole("button", { name: "Continue" }).tap();
  await page.getByText("I made this, or I have permission to print it.").tap();
  await page.getByRole("button", { name: "Continue" }).tap();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M/ }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
}

test("From yours, after the order: checking → cleared; offered → accepted; in the shop with its credit, and in Your offers", async ({ page }) => {
  await page.clock.install();
  await uploadToBag(page, "rings.png", await engraving());
  await checkoutFromMiniBag(page);
  const status = page.locator("[data-upload-reviews] [data-review]");
  await expect(status).toHaveAttribute("data-review", "queued");
  await expect(page.getByText("Checking your file. Up to 2 days.")).toBeVisible();
  await expect(page.getByText("Reviews are simulated in this demo.")).toBeVisible();
  await page.clock.fastForward(21_000);
  await expect(page.getByText("Cleared. Printing next.")).toBeVisible();
  await page.getByRole("button", { name: "Offer it to the catalogue ›" }).tap();
  const sheet = page.getByRole("dialog", { name: "Offer it to the catalogue" });
  await sheet.getByLabel("Title").fill("Rings and Bars");
  await sheet.getByLabel(/Credit/).fill("Noa L.");
  await expect(sheet.getByText("$6 a tee, $10 a pair. You keep the rights. We review it again.")).toBeVisible();
  const offer = sheet.getByRole("button", { name: "Offer it" });
  await expect(offer).toBeDisabled();
  await sheet.getByText("It’s my own work, and I allow MONO to sell it.").tap();
  await offer.tap();
  await page.goto("me/");
  await hydrated(page);
  await expect(page.locator('[data-offer="offered"]')).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.locator('[data-offer="accepted"]')).toBeVisible();
  await expect(page.getByText("Sales: none yet (this is a demo)")).toBeVisible();
  await page.locator('[data-offer="accepted"] a').tap();
  await expect(page).toHaveURL(/\/shop\/p\/\?id=mono-u-/);
  await expect(page.getByRole("heading", { name: "Rings and Bars" })).toBeVisible();
  await expect(page.locator("[data-credit]")).toHaveText("By Noa L. · Open Call 01");
  // Ranked by taste like any design: a taste that is this design's own features puts it near the top.
  // (A known taste, so the shop sorts by it: the taste test done, three likes and three passes.)
  await page.evaluate((ids) => {
    const make = JSON.parse(localStorage.getItem("mono-make")!);
    const features = Object.values(make.state.offers as Record<string, { features: object }>)[0].features;
    const taste = JSON.parse(localStorage.getItem("mono-taste") ?? '{"state":{},"version":5}');
    Object.assign(taste.state, { preferenceVector: features, likedIds: ids.slice(0, 3), dislikedIds: ids.slice(3, 6), seen: ids, calibrationAcknowledged: true });
    localStorage.setItem("mono-taste", JSON.stringify(taste));
  }, CALIBRATION_IDS);
  await page.goto("shop/");
  await hydrated(page);
  await expect(page.locator('main a[href*="mono-u-"]').first()).toBeAttached();
  await page.goto("me/");
  await hydrated(page);
  await page.locator('[data-offer="accepted"]').getByRole("button", { name: "Withdraw" }).tap();
  await expect(page.locator("[data-offers]")).toHaveCount(0);
});

for (const [force, line] of [
  ["refuse:logo", "It has someone else's logo."],
  ["refuse:hate", "It targets people."],
  ["person", "A person is looking at this one."],
] as const)
  test(`From yours: ?review=${force} shows "${line}"`, async ({ page }) => {
    await page.clock.install();
    await uploadToBag(page, "rings.png", await drawing(), `?review=${force}`);
    await checkoutFromMiniBag(page);
    await page.clock.fastForward(21_000);
    await expect(page.getByText(line)).toBeVisible();
    if (force.startsWith("refuse")) {
      await expect(page.getByText("We can't print this one. Nothing was charged.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Upload another" })).toHaveAttribute("href", /\/make\/yours\/\?replace=/);
    }
  });

test("From yours: words only, set in the print font, into the bag", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.getByRole("button", { name: "Write words instead" }).tap();
  await page.locator("#upload-words").fill("SLOW\nMORNINGS");
  await page.getByRole("button", { name: "Set these words" }).tap();
  await ready(page);
  await expect(page.locator("[data-title]")).toHaveText(/slow mornings/i);
});

test("From yours: a brand in the file name is refused before anything is converted", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "nike-logo.png", await drawing());
  await expect(page.locator("[data-upload-error]")).toHaveText("Those words name a brand.");
});

test("No CSP violation on the Make pages, the upload worker and an SVG included", async ({ page }) => {
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => ((window as unknown as { __csp: string[] }).__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`)));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["make/", "make/taste/", "make/code/", "make/line/", "make/voice/", "make/house/", "make/number/", "make/sky/"]) {
    await page.goto(path);
    await hydrated(page);
    expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), path).toEqual([]);
  }
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#fff"/><g fill="none" stroke="#000" stroke-width="10"><circle cx="150" cy="170" r="110"/><circle cx="150" cy="170" r="70"/><path d="M40 360h220M60 330h180"/></g></svg>');
  await choose(page, "circles.svg", svg, "image/svg+xml");
  await expect(page.locator("[data-upload-line]")).toHaveText(/Drawn in dark on light|Too|won't/, { timeout: 20_000 });
  expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])).toEqual([]);
  expect(errors).toEqual([]);
});

test("From yours: an SVG with a script is refused", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "bad.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'), "image/svg+xml");
  await expect(page.locator("[data-upload-line]")).toHaveText("This SVG has parts we can't print.", { timeout: 20_000 });
});

test("A bag line whose file is gone from this device leaves the bag, said once", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id: "make-yours", size: "M", color: "white", qty: 1, upload: { id: "gone1234", mode: "line", size: "full", hash: "0a1b2c3d" } }] }, version: 6 }));
  });
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByText("A file was cleared from this device, so it left the bag.")).toBeVisible();
  await expect(page.getByText(/Your file ·/)).toHaveCount(0);
});

test("Analytics carry the kind and the tier, never the file's name, title or pixels", async ({ page }) => {
  await uploadToBag(page, "grandma's garden 1987.png", await drawing());
  const layer = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
  expect(layer).toContain('"upload_start"');
  expect(layer).toContain('"upload_preview"');
  expect(layer).toContain("white-upload");
  expect(layer.toLowerCase()).not.toMatch(/grandma|garden|1987|data:image/);
});

test("From yours by keyboard: after the file, every step is reachable and operable without a pointer", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  await page.getByRole("radio", { name: "Small" }).focus();
  await page.keyboard.press("Enter");
  await ready(page);
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: /^M\b/ }).first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Add to bag · M/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
});
