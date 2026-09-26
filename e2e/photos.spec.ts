import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { CALIBRATION_IDS, hydrated, storedTaste } from "./helpers";

type Entry = { id: string; n: number; title: string; baseColor: "black" | "white"; category: string; photo?: { credit: string; url: string } };
const PHOTOS = (full as unknown as Entry[]).filter((s) => s.photo);
const photo = PHOTOS[0];
const other = photo.baseColor === "black" ? "white" : "black";

test("a photo tee: credit and source link; the other colour loads its own positive print, never an inverted one", async ({ page }) => {
  await page.goto(`shop/${photo.id}/`);
  await hydrated(page);
  const credit = page.getByText(`Photo: ${photo.photo!.credit}`);
  await expect(credit).toBeVisible();
  // Named after its subject, which isn't repeated above the name.
  await expect(page.locator("main").getByText(`${photo.title} ·`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Source record" })).toHaveAttribute("href", photo.photo!.url);

  const print = page.locator(`main img[alt="${photo.title} print"]`).first();
  await expect(print).toHaveAttribute("src", new RegExp(`/prints/print_${photo.n}\\.svg$`));
  await page.getByRole("radio", { name: new RegExp(`^${other === "black" ? "Black" : "White"} tee`) }).first().tap();
  await expect(print).toHaveAttribute("src", new RegExp(`/prints/print_${photo.n}_${other}\\.svg$`));
  await expect(print).not.toHaveClass(/\binvert\b/);
  expect(await print.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("the shop filters the photo categories", async ({ page }) => {
  await page.goto("shop/");
  await hydrated(page);
  await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "Wildlife" }).tap();
  const cards = page.locator('main a[href*="/shop/mono-"]');
  await expect(cards.first()).toBeVisible();
  const ids = await cards.evaluateAll((as) => as.slice(0, 12).map((a) => Number(a.getAttribute("href")!.match(/mono-(\d+)/)![1])));
  expect(ids.every((n) => n > 2800)).toBe(true);
});

test("someone who took the taste test before the photographs: not sent back into it, profile upgraded, a photo dealt first", async ({ page }) => {
  // A v3 profile: the old taste test done (everything in today's list but the photos), no "photographic" key.
  const photoIds = new Set(PHOTOS.map((s) => s.id));
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
  expect(PHOTOS.map((s) => s.title)).toContain(title);
  const state = await storedTaste(page);
  expect(state.preferenceVector).toMatchObject({ wit: 0.8, photographic: 0.5 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste")!).version)).toBe(4);
});
