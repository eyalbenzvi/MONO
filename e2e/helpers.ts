import type { Page } from "@playwright/test";
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
      likedIds: calibrated ? [...new Set([CALIBRATION_IDS[0], CALIBRATION_IDS[3], ...likedIds])] : likedIds,
      dislikedIds: calibrated ? CALIBRATION_IDS.filter((_, i) => i !== 0 && i !== 3) : [],
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

/** Saved lives in the personal area now: the person icon, then "Edit" (the Saved drawer). */
export async function openSaved(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "You: taste, saved, orders" }).click();
  await page.waitForURL(/\/me\/$/);
  await page.getByRole("button", { name: "Edit saved" }).click();
}

/** A taste that leans somewhere (pictures of nature, classic, figurative), for personal lines. */
export const LEANING: Record<string, number> = Object.fromEntries(
  index.keys.map((k: string) => [k, { nature: 0.82, pictorial: 0.78, classic: 0.74, figurative: 0.7 }[k] ?? 0.42]),
);
