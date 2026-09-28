import { expect, test } from "@playwright/test";
import shirts from "../data/shirts.json";
import { CALIBRATION_IDS, hydrated, seed } from "./helpers";

const titleOf = (id: string) => (shirts as unknown as { id: string; title: string }[]).find((s) => s.id === id)!.title;

// A returning visitor with a finished taste test: three tees liked (helpers seed).
const LIKED = [CALIBRATION_IDS[0], CALIBRATION_IDS[3], CALIBRATION_IDS[6]];

test("Like → heart → liked tees → pick, colour, size → Add selected to bag → bag → checkout → payment → order", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const heart = page.getByRole("link", { name: /^Liked tees \(\d+\)$/ });
  await expect(heart).toHaveAccessibleName("Liked tees (3)");
  // A like in Discover is saved at once, and counted on the heart.
  await page.getByRole("button", { name: "Like", exact: true }).tap();
  await expect(heart).toHaveAccessibleName("Liked tees (4)");

  await heart.tap();
  await expect(page).toHaveURL(/\/liked\/$/);
  await expect(page.locator("h1")).toHaveText("Liked tees");
  await expect(page.locator("[data-liked]")).toHaveCount(4);
  // Nothing picked yet: no add button.
  await expect(page.getByRole("button", { name: /Add selected to bag/i })).toHaveCount(0);

  const [first, second] = LIKED;
  const card = (id: string) => page.locator(`[data-liked="${id}"]`);
  await card(first).getByRole("button", { name: "Select" }).tap();
  await card(second).getByRole("button", { name: "Select" }).tap();
  await expect(page.getByRole("button", { name: /Add selected to bag · 2/i })).toBeVisible();
  // Without a size, the button says which one needs it.
  await page.getByRole("button", { name: /Add selected to bag · 2/i }).tap();
  await expect(page).toHaveURL(/\/liked\/$/);
  await expect(page.getByRole("alert").filter({ hasText: "Choose a size" }).first()).toBeVisible();

  await card(first).getByRole("combobox", { name: /^Size for/ }).selectOption("M");
  await card(second).getByRole("combobox", { name: /^Size for/ }).selectOption("L");
  const colour = card(second).getByRole("combobox", { name: /^Colour for/ });
  if (await colour.isEnabled()) {
    const other = (await colour.inputValue()) === "black" ? "white" : "black";
    await colour.selectOption(other);
  }
  const secondColour = await colour.inputValue();
  await page.getByRole("button", { name: /Add selected to bag · 2/i }).tap();

  await expect(page).toHaveURL(/\/cart\/$/);
  const lines = page.locator("main li").filter({ has: page.getByRole("combobox", { name: "Size" }) });
  await expect(lines).toHaveCount(2);
  const line = (id: string) => lines.filter({ hasText: titleOf(id) });
  await expect(line(first).getByRole("combobox", { name: "Size" })).toHaveValue("M");
  await expect(line(second).getByRole("combobox", { name: "Size" })).toHaveValue("L");
  await expect(line(second).getByRole("combobox", { name: "Colour" })).toHaveValue(secondColour);
  // Each line: its picture, name, colour, size, quantity and price.
  for (const id of [first, second]) {
    await expect(line(id).locator("img").first()).toBeVisible();
    await expect(line(id)).toContainText(/\$\d+ each/);
  }
  // Quantity is there from one, and changes the total.
  const total = page.getByRole("button", { name: /^Checkout · \$\d+/ });
  const before = await total.textContent();
  await page.getByRole("button", { name: "Increase quantity" }).first().tap();
  await expect(total).not.toHaveText(before!);
  await page.getByRole("button", { name: "Decrease quantity" }).first().tap();
  await expect(total).toHaveText(before!);

  await total.tap();
  for (const [label, value] of [
    ["Full name", "Ada Lovelace"],
    ["Email", "ada@example.com"],
    ["Street address", "12 Analytical St"],
    ["City", "Tel Aviv"],
    ["Postcode / ZIP", "6100001"],
  ])
    await page.getByLabel(label).fill(value);
  await page.getByRole("button", { name: /^Continue to payment/ }).tap();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await page.getByRole("button", { name: /^Place demo order/ }).tap();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
});

test("liked tees: open one full size; take one out of the selection or out of the likes (with Undo)", async ({ page }) => {
  await seed(page);
  await page.goto("liked/");
  await hydrated(page);
  const card = page.locator(`[data-liked="${LIKED[0]}"]`);
  await card.getByRole("button", { name: /full size$/ }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await card.getByRole("button", { name: "Select" }).tap();
  await expect(page.getByRole("button", { name: /Add selected to bag · 1/i })).toBeVisible();
  await card.getByRole("button", { name: "Remove from selection" }).tap();
  await expect(page.getByRole("button", { name: /Add selected to bag/i })).toHaveCount(0);

  await card.getByRole("button", { name: /from likes$/ }).tap();
  await expect(page.locator("[data-liked]")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Liked tees (2)" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).tap();
  await expect(page.locator("[data-liked]")).toHaveCount(3);
});

test("liked tees: none yet says how to get some", async ({ page }) => {
  await seed(page, { calibrated: false });
  await page.goto("liked/");
  await hydrated(page);
  await expect(page.getByText("Nothing liked yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Discover" })).toBeVisible();
});
