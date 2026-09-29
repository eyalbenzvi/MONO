import { test } from "@playwright/test";
import { hydrated } from "./helpers";
test("dbg", async ({ page }) => {
  page.on("request", (r) => r.url().includes("/img/make/") && console.log("REQ", r.url()));
  page.on("requestfailed", (r) => console.log("FAIL", r.url()));
  await page.route("**/img/make/moon-*.webp", (r) => r.abort());
  await page.goto("make/");
  await hydrated(page);
  await page.waitForTimeout(3000);
  console.log("COUNT", await page.locator("img[data-card-baked]").count(), await page.locator("canvas[data-custom]").count());
});
