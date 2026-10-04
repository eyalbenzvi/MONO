import { expect, test, type Page } from "@playwright/test";
import { hydrated, seed } from "./helpers";
import full from "../data/shirts.json";

const cardTitle = async (page: Page) => (await page.locator('[aria-roledescription="card"]').first().locator("h2").first().textContent())!;
/** The checkout step of /cart/ (#details): "Checkout" and its Delivery section. */
async function expectCheckout(page: Page) {
  await page.waitForURL(/\/cart\/(#details)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Delivery" })).toBeVisible();
}
const tab = (page: Page, name: string | RegExp) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

test("V1: Buy between Pass and Save opens a sheet in place: size, then Buy now goes straight to checkout", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  const title = await cardTitle(page);
  const buttons = page.locator("button[aria-label='Pass'], button[aria-label^='Buy '], button[aria-label='Save']");
  await expect(buttons).toHaveCount(3);
  // Order on screen: Pass · Buy · Save.
  const xs = await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect(xs[0]).toBeLessThan(xs[1]);
  expect(xs[1]).toBeLessThan(xs[2]);

  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  const sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await expect(sheet).toBeVisible();
  await expect(page).not.toHaveURL(/\/shop\//);
  await expect(page).toHaveURL(/#buy$/);
  // No size yet: the button (with the price, no size) highlights the sizes and moves focus there; nothing is added.
  await sheet.getByRole("button", { name: /^Buy now · \$\d+$/ }).tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radiogroup", { name: "Size" }).getByRole("radio").first()).toBeFocused();
  await expect(sheet.getByRole("status")).toHaveText("Select your size.");
  await sheet.getByRole("radio", { name: /^M\b/ }).tap();
  await sheet.getByRole("button", { name: /^Buy now · M · \$\d+$/ }).tap();
  await expectCheckout(page);
  await expect(page.getByRole("list", { name: "Items" })).toContainText(title);
});

test("V1: with a remembered size it's two taps to checkout; Add to bag keeps you on the same card; View tee opens the page", async ({ page }) => {
  await seed(page);
  await page.goto("");
  await hydrated(page);
  // Remember a size (any add does): Add to bag, keep swiping.
  let title = await cardTitle(page);
  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  let sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await sheet.getByRole("radio", { name: /^L\b/ }).tap();
  await sheet.getByRole("button", { name: "Add to bag", exact: true }).tap();
  await expect(sheet).toHaveCount(0);
  // The confirmation names the tee that went in, with its colour and size.
  await expect(page.getByRole("region", { name: "Added to bag" })).toContainText(`✓ Added: ${title}`);
  await expect(page.getByRole("region", { name: "Added to bag" })).toContainText(/(Black|White) · L/);
  // The deck didn't move.
  expect(await cardTitle(page)).toBe(title);

  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  sheet = page.getByRole("dialog", { name: `Buy ${title}` });
  await expect(sheet.getByRole("button", { name: /^Buy now · L · / })).toBeVisible();
  await sheet.getByRole("link", { name: /^View tee/ }).tap();
  await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.goto("");
  await hydrated(page);
  title = await cardTitle(page);
  await page.getByRole("button", { name: `Buy ${title}` }).tap();
  await page.getByRole("dialog", { name: `Buy ${title}` }).getByRole("button", { name: /^Buy now · L · / }).tap();
  await expectCheckout(page);
});

test("You: no Checkout CTA (the Bag tab counts the bag); a saved tee without a size opens its page, then adds in one tap", async ({ page }) => {
  const tee = (full as { id: string; colors: string[] }[])[0];
  await seed(page, {}, [{ id: tee.id, size: "M", color: tee.colors[0], qty: 1 }]);
  await page.goto("me/");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "You" })).toBeVisible();
  // The old "Checkout · 1 tee" CTA is gone: the bag is one tab away.
  await expect(page.getByRole("link", { name: /^Checkout/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Checkout/ })).toHaveCount(0);
  await expect(tab(page, /^Bag/)).toHaveAccessibleName("Bag 1");

  const saved = page.getByRole("list", { name: "Saved" });
  await expect(saved.getByRole("button", { name: /^Quick add / })).toHaveCount(0);
  // No size remembered yet: "+" is "Select size for …" and opens the tee to select one.
  const first = saved.getByRole("button", { name: /^Select size for / }).first();
  const title = (await first.getAttribute("aria-label"))!.replace(/^Select size for /, "");
  await first.tap();
  await page.waitForURL(/\/shop\/(mono-\d+\/|p\/\?id=)/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M · \$\d+$/ }).tap();
  await expect(page.getByRole("button", { name: "In your bag · Checkout" })).toBeVisible();

  // Back on You, with the size remembered: every "+" adds in one tap.
  await page.goBack();
  await page.waitForURL(/\/me\/$/);
  await expect(tab(page, /^Bag/)).toHaveAccessibleName("Bag 2");
  const add = saved.getByRole("button", { name: /^Add .+ to bag, size M$/ });
  await expect(add.first()).toBeVisible();
  await add.last().tap();
  // (The previous confirmation may still be animating out: the newest one is last.)
  await expect(page.getByRole("region", { name: "Added to bag" }).last()).toContainText(/(Black|White) · M/);
  await expect(tab(page, /^Bag/)).toHaveAccessibleName("Bag 3");
  await tab(page, /^Bag/).tap();
  await page.waitForURL(/\/cart\/$/);
  await page.getByRole("button", { name: /^Checkout · \$\d+$/ }).tap();
  await expectCheckout(page);
});

test("You: a long remembered size (Kids 3–4) keeps each row's buttons inside the row", async ({ page }) => {
  const tee = (full as { id: string; colors: string[] }[])[0];
  await seed(page, {}, [{ id: tee.id, size: "K4", color: tee.colors[0], qty: 1 }]);
  await page.addInitScript(() => {
    const c = JSON.parse(localStorage.getItem("mono-cart") ?? "{}");
    if (c.state) (c.state.preferredSize = "K4"), localStorage.setItem("mono-cart", JSON.stringify(c));
    // No first-open swipe hint: it slides the first row aside (e2e/saved-swipe covers it).
    localStorage.setItem("mono-saved-hint", "1");
  });
  await page.goto("me/");
  await hydrated(page);
  const rows = page.getByRole("list", { name: "Saved" }).locator("li");
  await expect(rows.first().getByRole("button", { name: /size Kids 3–4$/ })).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
  for (const li of await rows.all()) {
    await expect(li.getByRole("button")).toHaveCount(2);
    await expect(async () => {
      const row = (await li.boundingBox())!;
      for (const b of await li.getByRole("button").all()) {
        const button = (await b.boundingBox())!;
        expect(button.x).toBeGreaterThanOrEqual(row.x - 0.5);
        expect(button.x + button.width).toBeLessThanOrEqual(row.x + row.width + 0.5);
      }
    }).toPass();
  }
});
