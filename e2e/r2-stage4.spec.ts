import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { hydrated } from "./helpers";

const first = (full as { id: string; title: string; subject: string }[])[0];

test("I01: the product page names what the print shows, in the title and on the page", async ({ page }) => {
  await page.goto(`shop/${first.id}/`);
  await hydrated(page);
  await expect(page).toHaveTitle(new RegExp(`^${first.title} — ${first.subject}.* Tee \\| MONO$`));
  await expect(page.locator("main").getByText(`${first.subject} ·`)).toBeVisible();
  const meta = await page.locator('meta[name="description"]').getAttribute("content");
  expect(meta).toContain(`${first.title}: ${first.subject}.`);
});
