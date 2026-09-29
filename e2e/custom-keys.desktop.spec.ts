import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

// The date field's typing order is the locale's (month first in en-US).
test.use({ locale: "en-US", timezoneId: "Europe/London" });

test("Your Night Sky by keyboard: words, date, time, the place combobox (arrows, Enter, Esc), size, bag; no CSP violation", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && problems.push(m.text()));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => ((window as unknown as { __csp: string[] }).__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto("make/sky/");
  await hydrated(page);
  await expect(page.locator("[data-place]")).toContainText("London, United Kingdom (your time zone)");
  await page.getByLabel("Your words").focus();
  await page.keyboard.type("The night we met");
  await page.keyboard.press("Tab");
  await page.keyboard.type("03141991");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2300");
  await page.getByRole("button", { name: "Change" }).focus();
  await page.keyboard.press("Enter");
  const place = page.getByRole("combobox", { name: "Place" });
  await place.focus();
  await page.keyboard.type("reykjavik");
  await expect(page.getByRole("option", { name: /Reykjavík/ })).toBeVisible();
  // Esc closes the list and leaves the typing.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(place).toHaveValue("reykjavik");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-place]")).toContainText("Reykjavík, Iceland");
  await expect(page.locator("canvas[data-custom]")).toBeVisible();
  await expect(page).toHaveURL(/[?&]make=/);
  await page.getByRole("radio", { name: /^L\b/ }).first().click();
  await page.getByRole("button", { name: /^Add to bag · L · \$75$/ }).click();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  expect([...problems, ...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []))]).toEqual([]);
});

test("Your Night Sky: no place match says so", async ({ page }) => {
  await page.goto("make/sky/");
  await hydrated(page);
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("combobox", { name: "Place" }).fill("zzqx");
  await expect(page.getByText("No match. Try the nearest city")).toBeVisible();
});
