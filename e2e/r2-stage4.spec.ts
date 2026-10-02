import { expect, test } from "@playwright/test";
import full from "../data/shirts.json";
import { hydrated } from "./helpers";

const first = (full as { id: string; title: string; subject: string }[])[0];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("I01: the product page names what the print shows, in the title and on the page", async ({ page }) => {
  await page.goto(`shop/${first.id}/`);
  await hydrated(page);
  // A title that is its subject (Part 5: titles name what they show) isn't said twice.
  const same = first.title === first.subject;
  await expect(page).toHaveTitle(new RegExp(`^${esc(first.title)}${same ? "" : ` · ${esc(first.subject)}`}.* Tee \\| MONO$`));
  // T1: on the page itself the subject lives in the description (no extra kicker line).
  const meta = await page.locator('meta[name="description"]').getAttribute("content");
  expect(meta).toContain(same ? `${first.title}. ` : `${first.title}: ${first.subject}.`);
});
