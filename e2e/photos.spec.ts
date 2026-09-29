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
  // The credit sits behind ⓘ (About this design).
  await page.getByRole("button", { name: "About this design" }).tap();
  const credit = page.getByText(`Photo: ${photo.photo!.credit}`);
  await expect(credit).toBeVisible();
  // Named after its subject, which isn't repeated above the name.
  await expect(page.locator("main").getByText(`${photo.title} ·`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Source record" })).toHaveAttribute("href", photo.photo!.url);

  // On the tee: one baked picture, on its own tee colour.
  const tee = page.locator("main img[data-mockup]").first();
  await expect.poll(() => tee.evaluate((i: HTMLImageElement) => i.currentSrc)).toContain(`/img/m/${photo.n}-${photo.baseColor}-`);
  // The print alone.
  await page.getByRole("button", { name: `More for ${photo.title}` }).tap();
  await page.getByRole("button", { name: "Show the print only" }).tap();
  const print = page.locator(`main img[alt="${photo.title} print"]`).first();
  await expect(print).toHaveAttribute("src", new RegExp(`/img/p/${photo.n}-${photo.baseColor}-1500\\.webp$`));
  // T3: a photograph is sold on its own tee only — no colour choice, never inverted.
  await expect(page.getByText(`${photo.baseColor === "black" ? "Black" : "White"} tee only`)).toBeVisible();
  await expect(page.getByRole("radio", { name: new RegExp(`^${other === "black" ? "Black" : "White"} tee`) })).toHaveCount(0);
  await expect(print).not.toHaveClass(/\binvert\b/);
  await expect.poll(() => print.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await print.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(`/img/p/${photo.n}-${photo.baseColor}-`);
});

test("the shop's Photographs category shows the photographs", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  await pickCategories(page, ["Photographs"]);
  const cards = page.locator('main a[href*="/shop/mono-"]');
  await expect(cards.first()).toBeVisible();
  const ids = await cards.evaluateAll((as) => as.slice(0, 12).map((a) => Number(a.getAttribute("href")!.match(/mono-(\d+)/)![1])));
  expect(ids.every((n) => n > 2800)).toBe(true);
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
  await expect(page.getByText(/^Rate \d+ tees/)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const title = (await page.locator('[aria-roledescription="card"] h2').first().textContent())?.trim();
  expect(ALL_PHOTOS.map((s) => s.title)).toContain(title);
  const state = await storedTaste(page);
  expect(state.preferenceVector).toMatchObject({ wit: 0.8, photographic: 0.5 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste")!).version)).toBe(5);
});

test("sizes: XXL and kids' sizes on the product page, labelled in the bag", async ({ page }) => {
  await page.goto(`shop/${W1}/`);
  await hydrated(page);
  await page.getByRole("radio", { name: "XXL" }).tap();
  await page.getByRole("button", { name: "Kids' sizes" }).tap();
  await page.getByRole("radio", { name: "Kids 5–6" }).tap();
  await page.getByRole("button", { name: /^Add to bag/ }).last().tap();
  await page.goto("cart/");
  await hydrated(page);
  await expect(page.getByRole("combobox", { name: "Size" }).first()).toHaveValue("K6");
});

test("T5 / U6: the logo opens About — three words, one line on a line of its own, no small print", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await hydrated(page);
  await page.getByRole("link", { name: "About MONO" }).tap();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Black.White.One ink.");
  // Short on purpose: well under a hundred words on the page.
  const words = (await page.locator("main article").innerText()).split(/\s+/).filter(Boolean).length;
  expect(words).toBeLessThan(80);
  await expect(page.getByText("MONO ranks every design to your taste.")).toBeVisible();
  await expect(page.locator("#this-site")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Start swiping" })).toHaveAttribute("href", /\/$/);
  await page.evaluate((id) => localStorage.setItem("mono-cart", JSON.stringify({ state: { cart: [{ id, size: "M", color: "black", qty: 1 }], preferredSize: "M" }, version: 3 })), W1);
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Checkout/ }).first().tap();
  // The bag still says it's a demo store, where it matters.
  await expect(page.getByText("Demo store — no payment is taken and nothing ships.")).toBeVisible();
});
