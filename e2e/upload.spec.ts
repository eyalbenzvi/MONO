import { expect, test, type Page } from "@playwright/test";
import { CALIBRATION_IDS, hydrated } from "./helpers";
import { bands, drawing, engraving, mediumPhoto, photo } from "./fixtures/uploads";

async function choose(page: Page, name: string, buffer: Buffer, mimeType = "image/png") {
  await page.locator("#upload-file").setInputFiles({ name, mimeType, buffer });
}
const ready = (page: Page) => expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 25_000 });
const primary = (page: Page) => page.locator("[data-primary]");

/** From Start to the bag: a file, Looks good, I confirm, M, Add to bag. */
async function uploadToBag(page: Page, name: string, buffer: Buffer, query = "") {
  await page.goto(`make/yours/${query}`);
  await hydrated(page);
  await choose(page, name, buffer);
  await ready(page);
  await primary(page).tap();
  await expect(page.locator('[data-step="rights"]')).toBeVisible();
  await primary(page).tap();
  await expect(page.locator('[data-step="size"]')).toBeVisible();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await expect(primary(page)).toHaveText(/^Add to bag · M · \$75$/);
  await primary(page).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
}

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

test("Make: From ours and From yours are two pages behind one switch; Back leaves Make", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  await page.goto("make/");
  await hydrated(page);
  await expect(page.locator('[data-make-switch] a[aria-current="page"]')).toHaveText("From ours");
  await expect(page.getByRole("heading", { name: "From a date" })).toBeVisible();
  await expect(page.getByText("Start with a file")).toHaveCount(0);
  await page.locator("[data-make-switch]").getByRole("link", { name: "From yours" }).tap();
  await expect(page).toHaveURL(/\/make\/yours\/$/);
  await expect(page.getByRole("heading", { name: "What do you have?" })).toBeVisible();
  // Every tile shows the converter's own before and after, never an empty box.
  for (const kind of ["photo", "drawing", "words", "link"]) await expect(page.locator(`[data-tile="${kind}"] img`)).toHaveCount(2);
  // A link opens Your Link (a QR code drawn from the address, not a file); Back returns here.
  await page.locator('[data-tile="link"]').tap();
  await expect(page).toHaveURL(/\/make\/qr\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/make\/yours\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/shop\/$/);
});

test("From yours, a photo: the print shows while converting, then Style, Size and Tee as real results; Lines; rights; size; the bag", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "IMG_2041 heron at dusk.png", await photo());
  await expect(page).toHaveURL(/#print$/);
  await ready(page);
  await expect(page.locator("[data-upload-line]")).toHaveText(/^A (light|dark) picture, so (black|white): the ink draws its (lights|darks)\.$/);
  await expect(page.getByRole("radiogroup", { name: "Style" }).getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radiogroup", { name: "Tee" }).getByText("Suggested")).toBeVisible();
  await page.getByRole("radio", { name: /^Lines/ }).tap();
  await ready(page);
  await expect(primary(page)).toHaveText(/^Looks good · \$(75|130)$/);
  await primary(page).tap();
  await expect(page).toHaveURL(/#rights$/);
  await page.getByRole("button", { name: "What we won’t print" }).tap();
  await expect(page.getByRole("dialog", { name: "What we won’t print" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).tap();
  await primary(page).tap();
  await expect(page).toHaveURL(/#size$/);
  await expect(page.locator("[data-title]")).toHaveValue("Heron At Dusk");
  await expect(page.locator("[data-summary]")).toContainText("Lines · Full ·");
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await primary(page).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByText("Heron At Dusk")).toBeVisible();
  await expect(page.getByText(/^Your file · (Black|White)/)).toBeVisible();
});

test("From yours: Back walks back through the steps, and the draft comes back after a reload", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  await primary(page).tap();
  await primary(page).tap();
  await expect(page).toHaveURL(/#size$/);
  await page.goBack();
  await expect(page.locator('[data-step="rights"]')).toBeVisible();
  await page.reload();
  await hydrated(page);
  // A reload opens the file in hand again, where it was.
  await expect(page.locator('[data-step="rights"]')).toBeVisible();
  await ready(page);
  await page.goBack();
  await expect(page.locator('[data-step="print"]')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "What do you have?" })).toBeVisible();
  await expect(page.locator("[data-draft]")).toContainText("Carry on with rings.png");
});

test("From yours: a print that fails shows itself, says why, and offers the fix that passes", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "bands.png", await bands());
  await ready(page);
  await page.getByRole("radio", { name: /^Lines/ }).tap();
  await expect(page.locator('[data-upload-preview="failed"]')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator("[data-fix-card] [data-upload-line]")).toHaveText(/^Gaps under 0\.6 mm\./);
  await expect(page.locator("[data-fix-card]")).toContainText("Gaps too narrow.");
  await expect(primary(page)).toHaveText("Use Dots", { timeout: 25_000 });
  await primary(page).tap();
  await ready(page);
  await expect(page.getByRole("radio", { name: /^Dots/ })).toHaveAttribute("aria-checked", "true");
  await expect(primary(page)).toHaveText(/^Looks good/);
});

test("From yours: big enough for Small, not Full — it goes to Small and says so; Full is greyed with why", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "medium.png", await mediumPhoto());
  await ready(page);
  await expect(page.getByText("Big enough for Small, not Full. We’ve set Small.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Small/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /^Full: File too small/ })).toHaveAttribute("aria-disabled", "true");
});

test("From yours: words set as you type, no button; a brand is refused as typed", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.locator('[data-tile="words"]').tap();
  await expect(page).toHaveURL(/#print$/);
  await expect(page.locator('[data-upload-preview="empty"]')).toBeVisible();
  await page.locator("#upload-words").fill("SLOW\nMORNINGS");
  await ready(page);
  await expect(primary(page)).toHaveText(/^Looks good/);
  await page.locator("#upload-words").fill("NIKE");
  await expect(page.locator("[data-words-error]")).toHaveText("Those words name a brand.");
});

test("From yours: Edit from the bag opens the same file at Your print; rights aren't asked again; Save changes replaces the line", async ({ page }) => {
  await uploadToBag(page, "rings.png", await drawing());
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("link", { name: "Edit" }).first().tap();
  await expect(page).toHaveURL(/\/make\/yours\/\?edit=.*#print$/);
  await ready(page);
  await primary(page).tap();
  await expect(page).toHaveURL(/#size$/);
  await expect(primary(page)).toHaveText(/^Save changes · M · \$75$/);
  await primary(page).tap();
  await page.waitForURL(/\/cart\/$/);
  await expect(page.getByText(/^Your file ·/)).toHaveCount(1);
});

test("From yours, after the order: checking → cleared; offered → accepted; in the shop with its credit, and in Your offers", async ({ page }) => {
  await page.clock.install();
  await uploadToBag(page, "rings.png", await engraving());
  await checkoutFromMiniBag(page);
  await expect(page.locator("[data-upload-reviews] [data-review]")).toHaveAttribute("data-review", "queued");
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
  for (const path of ["make/", "make/taste/", "make/code/", "make/line/", "make/voice/", "make/house/", "make/number/", "make/place/", "make/ascii/", "make/sky/"]) {
    await page.goto(path);
    await hydrated(page);
    expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), path).toEqual([]);
  }
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  await page.goto("make/yours/");
  await hydrated(page);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#fff"/><g fill="none" stroke="#000" stroke-width="10"><circle cx="150" cy="170" r="110"/><circle cx="150" cy="170" r="70"/><path d="M40 360h220M60 330h180"/></g></svg>');
  await choose(page, "circles.svg", svg, "image/svg+xml");
  await expect(page.locator('[data-upload-preview="ready"], [data-upload-preview="failed"]')).toBeVisible({ timeout: 25_000 });
  expect(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])).toEqual([]);
  expect(errors).toEqual([]);
});

test("From yours: an SVG with a script is refused", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "bad.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'), "image/svg+xml");
  await expect(page.locator("[data-fix-card] [data-upload-line]")).toHaveText("This SVG has parts we can't print.", { timeout: 25_000 });
  await expect(primary(page)).toHaveText("Choose another file");
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
  for (const e of ["upload_start", "upload_preview", "yours_step", "upload_rights_confirm"]) expect(layer).toContain(`"${e}"`);
  expect(layer).toContain("white-upload");
  expect(layer.toLowerCase()).not.toMatch(/grandma|garden|1987|data:image/);
});

test("From yours by keyboard: tiles, choices, rights and size without a pointer", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await choose(page, "rings.png", await drawing());
  await ready(page);
  await page.getByRole("radio", { name: /^Small/ }).focus();
  await page.keyboard.press("Enter");
  await ready(page);
  await primary(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-step="rights"]')).toBeFocused();
  await primary(page).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: /^M\b/ }).first().focus();
  await page.keyboard.press("Enter");
  await primary(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
});
