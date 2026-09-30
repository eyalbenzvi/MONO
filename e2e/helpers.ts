import { expect, type Page } from "@playwright/test";
import index from "../data/shirts.index.json";

/** The taste test's ten designs (precomputed by the generator). */
export const CALIBRATION_IDS: string[] = index.calibration;

/** Everything a stored taste profile may hold (the app fills in the rest). */
export interface SeedTaste {
  likedIds?: string[];
  calibrated?: boolean;
  onboardingSeen?: boolean;
  /** A formed taste (feature → 0–1); unset = the app's neutral start. */
  vector?: Record<string, number>;
}

/**
 * Start a page with stored state: a finished taste test (by default), saved
 * tees and bag lines. Written before the app loads, as a returning visitor's.
 */
export async function seed(page: Page, { likedIds = [], calibrated = true, onboardingSeen = true, vector }: SeedTaste = {}, cart: { id: string; size: string; color: string; qty: number }[] = []) {
  const taste = {
    state: {
      // A known taste needs at least 3 likes and 3 passes (store/tasteStore MIN_LIKES / MIN_PASSES).
      likedIds: calibrated ? [...new Set([CALIBRATION_IDS[0], CALIBRATION_IDS[3], CALIBRATION_IDS[6], ...likedIds])] : likedIds,
      dislikedIds: calibrated ? CALIBRATION_IDS.filter((_, i) => i !== 0 && i !== 3 && i !== 6) : [],
      seen: calibrated ? [...CALIBRATION_IDS] : [],
      calibrationAcknowledged: calibrated,
      onboardingSeen,
      ...(vector ? { preferenceVector: vector } : {}),
    },
    version: 3,
  };
  const bag = { state: { cart, preferredSize: null }, version: 3 };
  await page.addInitScript(
    ([t, c]) => {
      // Once per tab: later reloads keep whatever the app saved since.
      if (sessionStorage.getItem("e2e-seeded")) return;
      sessionStorage.setItem("e2e-seeded", "1");
      localStorage.setItem("mono-taste", t);
      localStorage.setItem("mono-cart", c);
    },
    [JSON.stringify(taste), JSON.stringify(bag)],
  );
}

/** The persisted taste store, as the app last wrote it. */
export async function storedTaste(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("mono-taste") || "{}").state ?? {});
}

/** Wait until the stores have loaded (the header counts render after hydration). */
export async function hydrated(page: Page) {
  await page.locator("[data-hydrated]").waitFor({ state: "attached" });
}

/** Saved lives on You (/me/), in full: the You tab (or the address when the tab bar is hidden), then the list. */
export async function openSaved(page: import("@playwright/test").Page, { hint = false } = {}) {
  // The first-open swipe hint moves the first row: tests that swipe turn it off (e2e/saved-swipe covers it).
  if (!hint) await page.evaluate(() => localStorage.setItem("mono-saved-hint", "1"));
  const tab = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "You" });
  if (await tab.count()) await tab.click();
  else await page.goto("me/");
  await page.waitForURL(/\/me\/$/);
  await page.getByRole("list", { name: "Saved" }).waitFor();
}

/** A taste that leans somewhere (pictures of nature, classic, figurative), for personal lines. */
export const LEANING: Record<string, number> = Object.fromEntries(
  index.keys.map((k: string) => [k, { nature: 0.82, pictorial: 0.78, classic: 0.74, figurative: 0.7 }[k] ?? 0.42]),
);

/** Opens the shop's filter (the bottom row's "Filter"), ticks these categories and closes it. */
export async function pickCategories(page: Page, labels: string[]) {
  await page.getByRole("button", { name: /^Filter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Categories" });
  for (const l of labels) await sheet.getByRole("checkbox", { name: new RegExp(`^${l}`) }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
}

/** A caption line's field ("Edit the text under the print", opened when it's closed): 0 the title, 1 and 2 the lines under it. */
export async function captionLine(page: Page, i: 0 | 1 | 2) {
  const toggle = page.locator("[data-caption] > button");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return page.locator(`[data-cap-line="${i}"]`);
}
