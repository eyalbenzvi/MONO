import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import { MOON, OTHERS, SKY, TLV_1991, make } from "./fixtures/custom";

test("Make it yours: the quiet line and the menu item are on base designs' pages only", async ({ page }) => {
  for (const [s, line] of [
    [SKY, "Your place, your date"],
    [MOON, "Your year"],
  ] as const) {
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await expect(page.getByRole("button", { name: line })).toBeVisible();
    await page.getByRole("button", { name: /^More for/ }).tap();
    await expect(page.getByRole("button", { name: "Make it yours" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  for (const s of OTHERS) {
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await expect(page.locator("[data-make-it-yours]")).toHaveCount(0);
    await page.getByRole("button", { name: /^More for/ }).tap();
    await expect(page.getByRole("button", { name: "Make it yours" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  for (const route of ["shop/", ""]) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.getByText(/Your place, your date|Your year|Make it yours/)).toHaveCount(0);
  }
});

test("Make it yours: the page picture follows the editor; closing puts it back; Use this, then Use the original", async ({ page }) => {
  await page.goto(`shop/${MOON.id}/`);
  await hydrated(page);
  await page.getByRole("button", { name: "Your year" }).tap();
  await page.getByLabel("Year").fill("1991");
  // The preview is the page's own picture.
  await expect(page.locator("canvas[data-custom]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("canvas[data-custom]")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText(MOON.title);

  await page.getByRole("button", { name: "Your year" }).tap();
  await page.getByLabel("Year").fill("1991");
  await page.getByRole("button", { name: /^Use this · \+\$10$/ }).tap();
  await expect(page.locator("h1")).toHaveText("Moon Phases of 1991");
  await expect(page.locator("[data-custom-summary]")).toContainText("1991 · Edit");
  await expect(page).toHaveURL(/[?&]make=/);
  await expect(page).toHaveTitle(/^Moon Phases of 1991 \| MONO$/);
  // Reload keeps it.
  await page.reload();
  await hydrated(page);
  await expect(page.locator("h1")).toHaveText("Moon Phases of 1991");
  await page.getByRole("button", { name: "Edit" }).tap();
  await page.getByRole("button", { name: "Use the original" }).tap();
  await expect(page.locator("h1")).toHaveText(MOON.title);
  await expect(page).not.toHaveURL(/make=/);
});

test("Make it yours: a link with make opens that print in a fresh visit; a broken or mismatched one shows the original", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`shop/${SKY.id}/?make=${TLV_1991}`);
  await hydrated(page);
  await expect(page.locator("h1")).toHaveText("Night Sky over Tel Aviv, 14 March 1991");
  await expect(page.locator("canvas[data-custom]")).toHaveCount(1);
  for (const bad of ["garbage!", make({ t: "sky", v: 2, p: { c: 293397, d: "1991-03-14" } }), make({ t: "moon", v: 1, p: { y: 1991 } })]) {
    await page.goto(`shop/${SKY.id}/?make=${bad}`);
    await hydrated(page);
    await page.waitForTimeout(500);
    await expect(page.locator("h1")).toHaveText(SKY.title);
  }
  await ctx.close();
});
