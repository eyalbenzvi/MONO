import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";
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
    ["dial", "number"],
    ["slide-rule", "number"],
    ["facade", "house"],
    ["brick-bond", "house"],
  ] as const) {
    const s = shirts.find((x) => x.variant === variant)!;
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await page.locator("[data-make-your-own]").tap();
    await expect(page).toHaveURL(new RegExp(`/make/${slug}/`));
  }
});

test("Your Line: draw a line on the pad, turn it 8 times, mirror it; into the bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/line/");
  await hydrated(page);
  await drawn(page);
  const before = page.url();
  await page.locator("[data-pad]").scrollIntoViewIfNeeded();
  const box = (await page.locator("[data-pad]").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.03), box.y + box.height * (0.5 + Math.sin(i / 3) * 0.2));
  await page.mouse.up();
  await expect.poll(() => page.url()).not.toBe(before);
  await page.getByRole("radio", { name: "8", exact: true }).tap();
  await page.getByText("Mirror", { exact: true }).tap();
  await expect(page.getByRole("switch", { name: "Mirror" })).toBeChecked();
  await expect.poll(() => new URL(page.url()).searchParams.get("make") ?? "").toMatch(/./);
  await page.waitForTimeout(400);
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your Line · 8-fold")).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.getByRole("radio", { name: "8", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(p2.getByRole("switch", { name: "Mirror" })).toBeChecked();
  await other.close();
});

test("Your Taste: before the taste test, the example and a way to Discover (no bag); after it, your plant, into the bag", async ({ page, browser }) => {
  await page.goto("make/taste/");
  await hydrated(page);
  await expect(page.getByRole("link", { name: "Ten swipes first →" })).toBeVisible();
  await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add to bag|Choose size/ })).toHaveCount(0);

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await seed(p2);
  await p2.goto("make/taste/");
  await hydrated(p2);
  await expect(p2.getByText("Grown from your swipes.", { exact: false })).toBeVisible();
  await drawn(p2);
  await addAndOpenBag(p2);
  await expect(p2.getByText("Your Taste", { exact: true })).toBeVisible();
  await ctx.close();
});

test("Your Taste: a friend's taste that came with the visit can be grown instead (the gift)", async ({ page }) => {
  await seed(page);
  await page.goto("make/taste/?taste=2i1e1e2n1e1e1e1e1e1e1e281e1e1e1e1e");
  await hydrated(page);
  await drawn(page);
  const mine = new URL(page.url()).searchParams.get("make");
  await page.getByRole("button", { name: "Grow your friend's instead" }).tap();
  await expect(page.getByText("Grown from your friend's taste.")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("make")).not.toBe(mine);
  await page.getByRole("button", { name: "Grow yours instead" }).tap();
  await expect.poll(() => new URL(page.url()).searchParams.get("make")).toBe(mine);
});

test("Your Number: a time takes the stopwatch (the face control appears only then); a label; into the bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/number/");
  await hydrated(page);
  await drawn(page);
  await expect(page.getByRole("radiogroup", { name: "Face" })).toHaveCount(0);
  await page.locator("#make-number").fill("3:41:07");
  await expect(page.getByRole("radio", { name: "Stopwatch" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#make-unit")).toHaveCount(0);
  await page.locator("#make-label").fill("First marathon");
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "number", v: 1, p: { v: "3:41:07", u: "", l: "First marathon", face: "stopwatch" } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your Number · First marathon")).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.locator("#make-number")).toHaveValue("3:41:07");
  await expect(p2.getByRole("radio", { name: "Stopwatch" })).toHaveAttribute("aria-checked", "true");
  await other.close();
});

test("Your Number: a word in the label goes through the lexicon", async ({ page }) => {
  await page.goto("make/number/");
  await hydrated(page);
  await page.locator("#make-label").fill("Nike run");
  await expect(page.getByText("Those words name a brand.")).toBeVisible();
});

test("Your House: floors by keyboard, a dome, the door to the left, a number; into the bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/house/");
  await hydrated(page);
  await drawn(page);
  const floors = page.getByRole("spinbutton", { name: "Floors" });
  await floors.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(floors).toHaveAttribute("aria-valuenow", "5");
  await page.getByRole("radio", { name: "Dome" }).tap();
  await page.getByRole("radio", { name: "Left" }).tap();
  await page.locator("#make-house-no").fill("221");
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "house", v: 1, p: { fl: 5, wn: 3, r: "dome", dr: "l", no: 221 } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your House · No. 221")).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.getByRole("spinbutton", { name: "Floors" })).toHaveAttribute("aria-valuenow", "5");
  await expect(p2.getByRole("radio", { name: "Dome" })).toHaveAttribute("aria-checked", "true");
  await other.close();
});
