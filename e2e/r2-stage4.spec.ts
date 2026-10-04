import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { hydrated } from "./helpers";

const first = (full as { id: string; title: string }[])[0];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("I01: the product page names the design, its tees and 'T-Shirt' in the title; the description is its own sentence; the link preview is short", async ({ page }) => {
  await page.goto(`shop/${first.id}/`);
  await hydrated(page);
  await expect(page).toHaveTitle(new RegExp(`^${esc(first.title)}( · (Black|White|Black or White) (One-Ink )?T-Shirt)? \\| MONO$`));
  const meta = await page.locator('meta[name="description"]').getAttribute("content");
  expect(meta).toMatch(/tee(, also in (black|white)| only) · \$\d+\.$/);
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  expect(ogTitle).toMatch(new RegExp(`^${esc(first.title)}( · One-ink tee)? · MONO$`));
});
