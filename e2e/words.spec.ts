import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";

// Each words state converts the print and, when idle, its other two sizes.
test.describe.configure({ timeout: 120_000 });
const ready = (page: Page) => expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 45_000 });
const primary = (page: Page) => page.locator("[data-primary]");
const face = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Type" }).getByRole("radio", { name: new RegExp(`^${name}`) });
async function words(page: Page, text: string) {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.locator('[data-tile="words"]').tap();
  await page.locator("#upload-words").fill(text);
}

test("Words: six types, each named in itself; a type loads only its own font", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => r.url().includes("/fonts/words/") && fonts.push(r.url().split("/fonts/words/")[1]));
  await words(page, "SLOW\nMORNINGS");
  await ready(page);
  await expect(page.getByRole("radiogroup", { name: "Type" }).getByRole("radio")).toHaveText(["", "", "", "", "", ""]);
  await expect(page.getByRole("radiogroup", { name: "Type" }).getByRole("radio")).toHaveCount(6);
  await expect(face(page, "Mono")).toHaveAttribute("aria-checked", "true");
  await face(page, "Serif").tap();
  await expect(face(page, "Serif")).toHaveAttribute("aria-checked", "true");
  await ready(page);
  await expect(primary(page)).toHaveText(/^Looks good/);
  expect(fonts.filter((f) => f.endsWith(".woff2")).sort()).toEqual(["dejavu-sans-mono-bold.woff2", "fraunces-black.woff2"]);
  // The picker's names are one sprite of outlines, not fonts.
  expect(fonts).toContain("names.svg");
});

test("Words: a short word prints at Full, its letters capped (in cm); Medium and Small are real results", async ({ page }) => {
  await words(page, "YES");
  await ready(page);
  await expect(page.locator("[data-cap-readout]")).toHaveText(/^Letters (\d|10)\.\d cm tall\.$/);
  const size = page.getByRole("radiogroup", { name: "Size" });
  await expect(size.getByRole("radio")).toHaveText([/^Full · 28 cm/, /^Medium · 18 cm/, /^Small · 12 cm/]);
  const before = await page.locator("[data-cap-readout]").textContent();
  await size.getByRole("radio", { name: /^Medium/ }).tap();
  await ready(page);
  await expect(size.getByRole("radio", { name: /^Medium/ })).toHaveAttribute("aria-checked", "true");
  // Short enough that the cap, not the width, sets it at Full: at 18 cm it's no taller.
  const after = await page.locator("[data-cap-readout]").textContent();
  expect(parseFloat(after!.replace(/[^\d.]/g, ""))).toBeLessThanOrEqual(parseFloat(before!.replace(/[^\d.]/g, "")));
});

test("Words: Condensed holds 32 letters a line; Mono says its 24", async ({ page }) => {
  await words(page, "HOLD FAST TO WHAT IS GOOD ALWAYS");
  await expect(page.locator("[data-words-error]")).toHaveText("Lines of up to 24 letters in Mono.");
  await expect(page.locator("[data-words-count]")).toHaveText("32 / 24");
  // Types whose limit the line is over are dimmed and say why; Condensed isn't.
  await expect(face(page, "Serif")).toHaveAttribute("aria-disabled", "true");
  await expect(face(page, "Serif")).toHaveAccessibleName("Serif: Lines too long");
  await face(page, "Condensed").tap();
  await expect(page.locator("[data-words-error]")).toHaveCount(0);
  await expect(page.locator("[data-words-count]")).toHaveText("32 / 32");
  await ready(page);
});

test("Words: Lines and Align only with two lines or more; Capitals sets them in capitals; arrows move the type", async ({ page }) => {
  await words(page, "Slow mornings");
  await ready(page);
  await expect(page.locator('[data-segmented="lines"]')).toHaveCount(0);
  await expect(page.locator('[data-segmented="align"]')).toHaveCount(0);
  await page.getByRole("radio", { name: "Capitals" }).tap();
  await expect(page.getByRole("radio", { name: "Capitals" })).toHaveAttribute("aria-checked", "true");
  await ready(page);
  await page.locator("#upload-words").fill("Slow\nmornings");
  await expect(page.locator('[data-segmented="lines"]')).toBeVisible();
  await expect(page.locator('[data-segmented="align"]')).toBeVisible();
  await page.getByRole("radio", { name: "Fill width" }).tap();
  // Fill width is centred: Align goes.
  await expect(page.locator('[data-segmented="align"]')).toHaveCount(0);
  await ready(page);
  await face(page, "Mono").focus();
  await page.keyboard.press("ArrowRight");
  await expect(face(page, "Grotesk")).toHaveAttribute("aria-checked", "true");
  await expect(face(page, "Grotesk")).toBeFocused();
});

test("Words: Edit from the bag keeps the type, the case and the size", async ({ page }) => {
  await words(page, "MODERATE\nBECOMING\nGOOD");
  await ready(page);
  await face(page, "Gothic").tap();
  await page.getByRole("radio", { name: "Capitals" }).tap();
  await ready(page);
  await primary(page).tap();
  await primary(page).tap();
  await expect(page.locator("[data-summary]")).toContainText(/^Words · Gothic · Full · /);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await primary(page).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  await page.goto("cart/");
  await hydrated(page);
  await page.getByRole("link", { name: "Edit" }).first().tap();
  await expect(page).toHaveURL(/\/make\/yours\/\?edit=.*#print$/);
  await expect(face(page, "Gothic")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Capitals" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#upload-words")).toHaveValue("MODERATE\nBECOMING\nGOOD");
  await ready(page);
});
