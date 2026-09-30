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

test("search: \"/\" opens the sheet; a typo still finds the design and says what it read; a Look chip, a reload and Back keep the state", async ({ page }) => {
  const { word, shirt, typo } = target();
  await page.goto("shop/");
  await hydrated(page);
  await page.keyboard.press("/");
  const sheet = page.getByRole("dialog", { name: "Search" });
  await expect(sheet).toBeVisible();
  const field = sheet.getByRole("combobox", { name: "Search tees" });
  await expect(field).toBeFocused();
  await field.pressSequentially(`${typo} `);
  await expect(sheet.getByText(/^Showing/)).toContainText(word);
  // The literal: "Search for “typo”".
  await expect(sheet.getByRole("button", { name: `Search for “${typo}”` })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]q=${typo}`));
  // Enter shows the grid: the design is in it, and the control row names the search.
  await field.press("Enter");
  await expect(sheet).toHaveCount(0);
  await expect(page.locator(`[data-product-card] a[href*="${shirt.id}"]`).first()).toBeVisible();
  await expect(page.getByRole("button", { name: `Search: ${typo}` })).toBeVisible();

  // Clear the words, then a Look chip from the prepared parameters.
  await page.getByRole("button", { name: `Search: ${typo}` }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Clear" }).click();
  await expect(field).toHaveValue("");
  const look = INDEX.tables.look[0];
  await sheet.getByRole("button", { name: look.label, exact: true }).click();
  // A filter chosen shows the grid; the control row names the search.
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`[?&]f=look%3A${look.id}`));
  await expect(page.getByRole("button", { name: "Search: filters" })).toBeVisible();
  await page.getByRole("button", { name: "Search: filters" }).click();
  await expect(sheet.getByRole("button", { name: `Remove ${look.label}` })).toBeVisible();
  // The visible count ("1,234 tees"), not the screen-reader line that repeats it half a second later.
  await expect(sheet.locator("p:not(.sr-only)").getByText(/^[\d,]+ tees$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // A reload opens the same search.
  await page.reload();
  await hydrated(page);
  await expect(page.getByRole("button", { name: "Search: filters" })).toBeVisible();
  await page.getByRole("button", { name: "Search: filters" }).click();
  await expect(sheet.getByRole("button", { name: `Remove ${look.label}` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // Back undoes the facet (to the words searched before it).
  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]f=/);
  await expect(page.getByRole("button", { name: "Search: filters" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Search: ${typo}` })).toBeVisible();
});

test("search: \"See all\" beside Similar prints opens the shop ordered by closeness, without the design's own family", async ({ page }) => {
  const shirt = CATALOG[40];
  await page.goto(`shop/${shirt.id}/`);
  await hydrated(page);
  await page.getByRole("link", { name: "See all" }).click();
  await expect(page).toHaveURL(new RegExp(`/shop/\\?like=${shirt.id}`));
  // The control row names the search; the sheet shows it as a "Like this" pill and says what it's close to.
  await page.getByRole("button", { name: "Search: filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Search" });
  await expect(sheet.getByRole("button", { name: "Remove Like this" })).toBeVisible();
  await expect(sheet.locator("p:not(.sr-only)").getByText(/^Closest to /)).toContainText(shirt.title);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  const ids = await page.locator('[data-product-card] a[href*="mono-"]').evaluateAll((as) => as.slice(0, 12).map((a) => a.getAttribute("href")!.match(/mono-\d+/)![0]));
  expect(ids.length).toBeGreaterThan(0);
  const family = new Set(CATALOG.filter((s) => s.family === shirt.family).map((s) => s.id));
  expect(ids.some((id) => family.has(id))).toBe(false);
});
