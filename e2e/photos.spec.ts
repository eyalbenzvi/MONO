import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { CALIBRATION_IDS, hydrated, pickCategories, storedTaste } from "./helpers";
import { W1 } from "../tests/fixtures";

type Entry = { id: string; n: number; title: string; baseColor: "black" | "white"; category: string; variant: string; medium: string; photo?: { credit: string; url: string } };
/** Every photograph (the fourth set's and the archive's); the fourth set's first. */
const ALL_PHOTOS = (full as unknown as Entry[]).filter((s) => s.medium === "photo");
const PHOTOS = ALL_PHOTOS.filter((s) => s.variant.startsWith("photo-"));
const photo = PHOTOS[0];
const other = photo.baseColor === "black" ? "white" : "black";

test("a photo tee: credit and source link; the whole greyscale photograph, on its own tee only, never inverted", async ({ page }) => {
  await page.goto(`shop/${photo.id}/`);
  await hydrated(page);
  // The credit sits behind the "Details" disclosure.
  const details = page.getByRole("button", { name: "Details", exact: true });
  await details.tap();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  const credit = page.getByText(`Photo: ${photo.photo!.credit}`);
  await expect(credit).toBeVisible();
  // Named after its subject, which isn't repeated above the name.
  await expect(page.locator("main").getByText(`${photo.title} ·`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Source record" })).toHaveAttribute("href", photo.photo!.url);

  // On the tee: one baked picture, on its own tee colour.
  const tee = page.locator("main img[data-mockup]").first();
  await expect.poll(() => tee.evaluate((i: HTMLImageElement) => i.currentSrc)).toContain(`/img/m/${photo.n}-${photo.baseColor}-`);
  // The print alone: the gallery's second slide (its dot "Print").
  await page.getByRole("button", { name: "Print", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Print", exact: true })).toHaveAttribute("aria-pressed", "true");
  const print = page.locator(`main img[alt="${photo.title} print"]`).first();
  await expect(print).toHaveAttribute("src", new RegExp(`/img/p/${photo.n}-${photo.baseColor}-1500\\.webp$`));
  // T3: a photograph is sold on its own tee only — no colour choice, never inverted.
  await expect(page.getByText(`${photo.baseColor === "black" ? "Black" : "White"} tee only`)).toBeVisible();
  await expect(page.getByRole("radio", { name: new RegExp(`^${other === "black" ? "Black" : "White"} tee`) })).toHaveCount(0);
  await expect(print).not.toHaveClass(/\binvert\b/);
  await expect.poll(() => print.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await print.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(`/img/p/${photo.n}-${photo.baseColor}-`);
});

test("a shop category by subject holds its photographs with its drawings (Workshop & Kitchen)", async ({ page }) => {
  const workshop = new Set((full as unknown as Entry[]).filter((s) => s.category === "workshop").map((s) => s.id));
  expect(PHOTOS.some((s) => workshop.has(s.id))).toBe(true);
  await page.goto("shop/");
  await hydrated(page);
  await pickCategories(page, ["Workshop & Kitchen"]);
  const cards = page.locator('main a[href*="/shop/mono-"]');
  await expect(cards.first()).toBeVisible();
  const ids = await cards.evaluateAll((as) => as.slice(0, 12).map((a) => a.getAttribute("href")!.match(/mono-\d+/)![0]));
  for (const id of ids) expect(workshop.has(id), id).toBe(true);
});

test("someone who took the taste test before the photographs: not sent back into it, profile upgraded, a photo dealt first", async ({ page }) => {
  // A v3 profile: the old taste test done (everything in today's list but the photos), no "photographic" key.
  const photoIds = new Set(ALL_PHOTOS.map((s) => s.id));
  const seen = CALIBRATION_IDS.filter((id) => !photoIds.has(id));
  const v3 = Object.fromEntries(["geometric", "typography", "architectural", "abstract", "line_art", "halftone_raster", "density", "contrast", "dark_industrial", "clean_minimal", "pictorial", "wit", "retro", "nature", "figurative", "classic"].map((k) => [k, 0.5]));
  await page.addInitScript(
    (t) => {
      if (sessionStorage.getItem("e2e-seeded")) return;
      sessionStorage.setItem("e2e-seeded", "1");
      localStorage.setItem("mono-taste", t);
    },
    JSON.stringify({ state: { likedIds: [seen[0]], seen, preferenceVector: { ...v3, wit: 0.8 }, calibrationAcknowledged: true, onboardingSeen: true }, version: 3 }),
  );
  await page.goto("");
  await hydrated(page);
  // Not the taste test again: no first-card line, no "Learning your taste", no progress bar.
  await expect(page.locator("[data-strip]:visible")).not.toContainText(/Ten tees\. Keep or pass|Learning your taste|Last one\./);
  await expect(page.getByRole("progressbar", { name: "Taste test progress" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const title = (await page.locator('[aria-roledescription="card"] h2').first().textContent())?.trim();
  expect(ALL_PHOTOS.map((s) => s.title)).toContain(title);
  const state = await storedTaste(page);
  expect(state.preferenceVector).toMatchObject({ wit: 0.8, photographic: 0.5 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste")!).version)).toBe(6);
});

test("sizes: XXL and kids' sizes on the product page, labelled in the bag", async ({ page }) => {
  await page.goto(`shop/${W1}/`);
  await hydrated(page);
  await page.getByRole("radio", { name: "XXL" }).tap();
  await page.getByRole("button", { name: "Kids’ sizes" }).tap();
  await page.getByRole("radio", { name: "Kids 5–6" }).tap();
  await page.getByRole("button", { name: /^Add to bag/ }).last().tap();
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByRole("combobox", { name: "Size" }).first()).toHaveValue("K6");
});

test("T5 / U6: the wordmark goes home; About (from You) is one image, three words, one line, no small print", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("shop/");
  await hydrated(page);
  // The header's only link, the wordmark, leads home (not to About).
  await page.getByRole("link", { name: "MONO, home" }).tap();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  // About is reached from You's "About" row.
  await page.goto("me/");
  await hydrated(page);
  await page.getByRole("link", { name: "About", exact: true }).tap();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Black. White. One ink.");
  // One image, one paragraph, one way in.
  await expect(page.locator("main article img")).toHaveCount(1);
  await expect(page.locator("main article p")).toHaveCount(1);
  // Short on purpose: well under a hundred words on the page.
  const words = (await page.locator("main article").innerText()).split(/\s+/).filter(Boolean).length;
  expect(words).toBeLessThan(80);
  await expect(page.locator("#this-site")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Start the taste test" })).toHaveAttribute("href", /\/$/);
  await page.evaluate((id) => localStorage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id, size: "M", color: "black", qty: 1 }], preferredSize: "M" }, version: 3 })), W1);
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Checkout/ }).first().tap();
  // Checkout still says it's a preview store, where it matters: under the order button.
  await expect(page.getByText("Preview store. No payment is taken and nothing ships.")).toBeVisible();
});
