import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";

/**
 * The newer Make products, one by one as a visitor would: open the page, fill
 * its fields, see the print drawn and in the address, add it in M at $75, and
 * open the link in a fresh browser to find the same fields.
 */
interface Case {
  slug: string;
  fill: (page: Page) => Promise<void>;
  /** What the reopened link must show (a field and its value). */
  again: (page: Page) => Promise<void>;
}

const CASES: Case[] = [
  {
    slug: "telegram",
    fill: async (page) => {
      await page.locator("#make-telegram-to").fill("Maya");
      await page.locator("#make-telegram-message").fill("Landed. All well. Bring the good umbrella.");
    },
    again: async (page) => expect(page.locator("#make-telegram-message")).toHaveValue("Landed. All well. Bring the good umbrella."),
  },
  {
    slug: "editions",
    fill: async (page) => {
      await page.locator("#make-editions-n0").fill("Dana");
      await page.locator("#make-editions-y0").fill("1978");
      await page.locator("#make-editions-n1").fill("Avi");
      await page.getByRole("button", { name: "Add an edition" }).tap();
      await page.locator("#make-editions-n2").fill("Maya");
      await page.locator("#make-editions-role").fill("Grandpa");
      await page.locator("#make-editions-est").fill("1952");
    },
    again: async (page) => {
      await expect(page.locator("#make-editions-n2")).toHaveValue("Maya");
      await expect(page.locator("#make-editions-est")).toHaveValue("1952");
    },
  },
  {
    slug: "sayings",
    fill: async (page) => {
      await page.locator("#make-sayings-who").fill("Savta");
      await page.locator("#make-sayings-s0").fill("Put a jumper on.");
      await page.locator("#make-sayings-s1").fill("Eat, you’re too thin.");
      await page.locator("#make-sayings-s2").fill("Call when you get there.");
    },
    again: async (page) => expect(page.locator("#make-sayings-s2")).toHaveValue("Call when you get there."),
  },
];

for (const c of CASES)
  test(`${c.slug}: fill the fields, see it drawn and linked, add it in M, and the link reopens it`, async ({ page, browser }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`make/${c.slug}/`);
    await hydrated(page);
    await c.fill(page);
    await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]make=/, { timeout: 15_000 });
    await expect(page.locator("[data-print-problem]")).toHaveCount(0);
    const link = page.url();
    await page.getByRole("radio", { name: /^M\b/ }).first().tap();
    await page.getByRole("button", { name: /^Add to bag · M · \$75$/ }).tap();
    await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(link);
    await hydrated(p2);
    await c.again(p2);
    await expect(p2).toHaveURL(link);
    await other.close();
    expect(errors).toEqual([]);
  });
