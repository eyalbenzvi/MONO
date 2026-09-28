import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";
import { make } from "./fixtures/custom";
import catalogue from "../data/shirts.json";

const shirts = catalogue as unknown as { id: string; variant: string }[];

/** The print on screen, and the address it keeps. */
async function drawn(page: Page) {
  await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
  await expect(page).toHaveURL(/[?&]make=/);
}

/** Adds the print on screen in M and opens the bag's lines. */
async function addAndOpenBag(page: Page) {
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M · \$75$/ }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  await page.goto("cart/");
  await hydrated(page);
}

test("Your Name: a name in a code, redrawn as it changes; a character the code lacks is refused as typed; into the bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/code/");
  await hydrated(page);
  await page.getByLabel("Your name", { exact: true }).fill("Noa");
  await drawn(page);
  const card = page.url();
  await page.getByRole("radio", { name: "Morse" }).tap();
  await expect.poll(() => page.url()).not.toBe(card);
  await page.getByRole("radio", { name: "Paper tape" }).tap();
  await page.getByLabel("Your name", { exact: true }).fill("René");
  await expect(page.getByText('Paper tape has no "é". Try "e".')).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Rene");
  await page.getByText("Keep it secret").tap();
  await expect(page.getByRole("switch", { name: "Keep it secret" })).toBeChecked();
  // The address carries exactly this print once it's drawn.
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "code", v: 1, p: { x: "RENE", k: "tape", h: 1 } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your Name · RENE")).toBeVisible();
  // The link opens that very print in a fresh visit.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.getByLabel("Your name", { exact: true })).toHaveValue("RENE");
  await expect(p2.getByRole("radio", { name: "Paper tape" })).toHaveAttribute("aria-checked", "true");
  await expect(p2.getByRole("switch", { name: "Keep it secret" })).toBeChecked();
  await other.close();
});

test("Your Name: the lexicon refuses a brand as a name", async ({ page }) => {
  await page.goto("make/code/");
  await hydrated(page);
  await page.getByLabel("Your name", { exact: true }).fill("N1KE");
  await expect(page.getByText("Those words name a brand.")).toBeVisible();
});

test("the designs a product is drawn like lead to it (Make your own →)", async ({ page }) => {
  for (const [variant, slug] of [
    ["type-data", "code"],
    ["terminal-data", "code"],
  ] as const) {
    const s = shirts.find((x) => x.variant === variant)!;
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await page.locator("[data-make-your-own]").tap();
    await expect(page).toHaveURL(new RegExp(`/make/${slug}/`));
  }
});
