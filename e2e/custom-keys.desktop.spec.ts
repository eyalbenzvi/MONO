import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";
import { SKY } from "./fixtures/custom";

// The date field's typing order is the locale's (month first in en-US).
test.use({ locale: "en-US" });

test("Make it yours by keyboard: the place combobox (arrows, Enter, Esc), date, time, Use this; no CSP violation with the editor open", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && problems.push(m.text()));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => ((window as unknown as { __csp: string[] }).__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto(`shop/${SKY.id}/`);
  await hydrated(page);
  const line = page.getByRole("button", { name: "Your place, your date" });
  await line.focus();
  await page.keyboard.press("Enter");
  const place = page.getByRole("combobox", { name: "Place" });
  await place.focus();
  await page.keyboard.type("reykjavik");
  await expect(page.getByRole("option", { name: /Reykjavík/ })).toBeVisible();
  // Esc closes the list, not the sheet.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(place).toHaveValue("Reykjavík, Iceland");
  await page.keyboard.press("Tab");
  await page.keyboard.type("03141991");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2300");
  const use = page.getByRole("button", { name: /^Use this/ });
  await expect(use).toBeEnabled();
  await use.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("Night Sky over Reykjavík, 14 March 1991");
  expect([...problems, ...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []))]).toEqual([]);
});

test("Make it yours: no match says so", async ({ page }) => {
  await page.goto(`shop/${SKY.id}/`);
  await hydrated(page);
  await page.getByRole("button", { name: "Your place, your date" }).click();
  await page.getByRole("combobox", { name: "Place" }).fill("zzqx");
  await expect(page.getByText("No match. Try the nearest city")).toBeVisible();
});
