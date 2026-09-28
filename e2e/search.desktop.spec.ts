import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import shirts from "../data/shirts.json";
import manifest from "../data/search.manifest.json";

type Entry = { id: string; title: string; family: string };
const CATALOG = shirts as unknown as Entry[];
const INDEX = JSON.parse(readFileSync(`public/data/${manifest.file}`, "utf8")) as { tables: { look: { id: string; label: string }[] } };

/** A title word only its own design has (picked at run time, so the catalogue can change under it), and a typo of it. */
function target() {
  const words = new Map<string, Entry[]>();
  for (const s of CATALOG) for (const w of new Set(s.title.toLowerCase().match(/[a-z]{8,}/g) ?? [])) words.set(w, [...(words.get(w) ?? []), s]);
  const [word, [shirt]] = [...words].find(([w, list]) => list.length === 1 && !/(.)\1/.test(w))!;
  return { word, shirt, typo: word.slice(0, 2) + word[3] + word[2] + word.slice(4) };
}

test("search: \"/\" opens it; a typo still finds the design and says what it read; a LOOK chip, a reload and Back keep the state", async ({ page }) => {
  const { word, shirt, typo } = target();
  await page.goto("shop/");
  await hydrated(page);
  await page.keyboard.press("/");
  const field = page.getByRole("combobox", { name: "Search tees" });
  await expect(field).toBeFocused();
  await field.pressSequentially(`${typo} `);
  await expect(page.getByText(/^Showing/)).toContainText(word);
  await expect(page.getByRole("button", { name: `Search “${typo}” instead` })).toBeVisible();
  await expect(page.locator(`main a[href*="${shirt.id}"]`).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]q=${typo}`));

  // Clear the words (Esc), then a LOOK chip from the prepared parameters.
  await field.press("Escape");
  await expect(field).toHaveValue("");
  const look = INDEX.tables.look[0];
  await page.getByRole("button", { name: look.label, exact: true }).click();
  const pill = page.getByRole("button", { name: `Remove ${look.label}` });
  await expect(pill).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]f=look%3A${look.id}`));
  // The visible count, not the screen-reader line that repeats it half a second later.
  await expect(page.locator("p:not(.sr-only)").getByText(/^\d+ tees$/)).toBeVisible();

  // A reload opens the same search.
  await page.reload();
  await hydrated(page);
  await expect(page.getByRole("button", { name: `Remove ${look.label}` })).toBeVisible();

  // Back undoes the facet.
  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]f=/);
  await expect(page.getByRole("button", { name: `Remove ${look.label}` })).toHaveCount(0);
});

test("search: \"More like this\" on a product opens the shop ordered by closeness, without the design's own family", async ({ page }) => {
  const shirt = CATALOG[40];
  await page.goto(`shop/${shirt.id}/`);
  await hydrated(page);
  await page.getByRole("link", { name: "More like this" }).click();
  await expect(page).toHaveURL(new RegExp(`/shop/\\?like=${shirt.id}`));
  await expect(page.getByRole("button", { name: "Remove Like this" })).toBeVisible();
  const ids = await page.locator('main a[href*="/shop/mono-"]').evaluateAll((as) => as.slice(0, 12).map((a) => a.getAttribute("href")!.match(/mono-\d+/)![0]));
  expect(ids.length).toBeGreaterThan(0);
  const family = new Set(CATALOG.filter((s) => s.family === shirt.family).map((s) => s.id));
  expect(ids.some((id) => family.has(id))).toBe(false);
});
