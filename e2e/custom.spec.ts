import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";
import { MOON, OTHERS, PLANETS, SKY, TEL_AVIV, TLV_1991, make } from "./fixtures/custom";

// The visitor's zone decides the place a sky starts from.
test.use({ timezoneId: "Asia/Jerusalem" });

test("Made for you is in plain sight: a header tab, the shop's first card, and a way in from the designs it's drawn like", async ({ page }) => {
  await page.goto("");
  await hydrated(page);
  await page.getByRole("link", { name: "Make", exact: true }).tap();
  await expect(page).toHaveURL(/\/make\/$/);
  await expect(page.locator("h1")).toHaveText("Made for you");
  for (const name of ["Your Night Sky", "Your Moon", "Your Planets", "Your Year of Moons"]) await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  // Each card is a real print, drawn in the browser.
  await expect(page.locator("canvas[data-custom]")).toHaveCount(4);

  await page.goto("shop/");
  await hydrated(page);
  const first = page.locator("main a").first();
  await expect(first).toHaveAttribute("data-made-tile");
  await first.tap();
  await expect(page).toHaveURL(/\/make\/$/);

  for (const [s, slug] of [
    [SKY, "sky"],
    [MOON, "year"],
    [PLANETS, "planets"],
  ] as const) {
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await page.locator("[data-make-your-own]").tap();
    await expect(page).toHaveURL(new RegExp(`/make/${slug}/`));
  }
  for (const s of OTHERS) {
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    await expect(page.locator("[data-make-your-own]")).toHaveCount(0);
  }
});

/** The print on screen, and the address it keeps. */
async function drawn(page: Page) {
  await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
  await expect(page).toHaveURL(/[?&]make=/);
}

test("Your Moon: words and a night, drawn as you go; into the bag as its own line, with its own title, price and returns", async ({ page }) => {
  await page.goto("make/moon/");
  await hydrated(page);
  await page.getByLabel("Your words").fill("Noa, welcome");
  await page.getByLabel("Night", { exact: true }).fill("2021-11-19");
  await drawn(page);
  await expect(page.locator("h1")).toHaveText("Your Moon");
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag · M · \$75$/ }).tap();
  await page.getByRole("region", { name: "Added to bag" }).getByRole("link", { name: "View bag" }).tap();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(page.getByText("Your Moon · 19 November 2021")).toBeVisible();
  await expect(page.getByText("Made for you: size exchanges only")).toBeVisible();
  await expect(page.locator("canvas[data-custom]").first()).toBeAttached();
  // Edit goes back to that very print.
  await page.getByRole("link", { name: "Edit" }).tap();
  await expect(page).toHaveURL(/\/make\/moon\/\?make=/);
  await expect(page.getByLabel("Your words")).toHaveValue("Noa, welcome");
  await expect(page.getByLabel("Night", { exact: true })).toHaveValue("2021-11-19");
});

test("Your Night Sky: the place comes from your time zone and can be changed; a link opens that print; a broken one starts fresh", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "Asia/Jerusalem" });
  const page = await ctx.newPage();
  await page.goto("make/sky/");
  await hydrated(page);
  await expect(page.locator("[data-place]")).toContainText("Jerusalem, Israel (your time zone)");
  await page.getByRole("button", { name: "Change" }).tap();
  await page.getByRole("combobox", { name: "Place" }).fill("reykjavik");
  await page.getByRole("option", { name: /Reykjavík/ }).tap();
  await expect(page.locator("[data-place]")).toContainText("Reykjavík, Iceland");
  await expect(page.locator("[data-place]")).not.toContainText("your time zone");
  await drawn(page);

  await page.goto(`make/sky/?make=${TLV_1991}`);
  await hydrated(page);
  await expect(page.locator("[data-place]")).toContainText("Tel Aviv");
  await expect(page.getByLabel("Your words")).toHaveValue("The night we met");
  await expect(page.getByLabel("Night", { exact: true })).toHaveValue("1991-03-14");
  for (const bad of ["garbage!", make({ t: "sky", v: 2, p: { c: TEL_AVIV, d: "1991-03-14" } }), make({ t: "moon", v: 1, p: { y: 1991 } })]) {
    await page.goto(`make/sky/?make=${bad}`);
    await hydrated(page);
    await expect(page.locator("[data-place]")).toContainText("(your time zone)");
    await expect(page.getByLabel("Your words")).toHaveValue("");
  }
  await ctx.close();
});

test("Your Planets stops at the planets' last year; Your Year of Moons takes a year", async ({ page }) => {
  await page.goto("make/planets/");
  await hydrated(page);
  await expect(page.getByLabel("Day", { exact: true })).toHaveAttribute("max", "2050-12-31");
  await page.goto("make/year/");
  await hydrated(page);
  await expect(page.getByRole("switch", { name: "Seen from the south" })).not.toBeChecked();
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await drawn(page);
  // Bought straight after typing (before the preview catches up): it's the year typed that goes in the bag.
  await page.getByLabel("Year", { exact: true }).fill("1969");
  await page.getByRole("button", { name: /^Add to bag/ }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("mono-cart")!).state.cart);
  expect(cart.map((l: { custom: unknown }) => l.custom)).toEqual([{ t: "moon", v: 1, p: { y: 1969 } }]);
});

test("privacy: the date, place and words stay on the device: never in analytics, and stored only in the bag line itself", async ({ page }) => {
  await page.goto(`make/sky/?make=${TLV_1991}`);
  await hydrated(page);
  await drawn(page);
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add to bag/ }).tap();
  await page.getByRole("button", { name: "Share" }).tap();
  await expect(page.locator("[data-share-note]")).toHaveText("This link includes the date and place and your words");
  await page.keyboard.press("Escape");
  const leaks = await page.evaluate(
    ([id]) => {
      const secrets = ["1991-03-14", "14 March 1991", "Tel Aviv", String(id), "The night we met", "make="];
      const layer = JSON.stringify(window.dataLayer ?? []);
      const out: string[] = secrets.filter((s) => layer.includes(s)).map((s) => `dataLayer: ${s}`);
      for (const store of [localStorage, sessionStorage])
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i)!;
          let value = store.getItem(key) ?? "";
          // The bag's lines may carry the print (that's the order); nothing else in it may.
          if (key === "mono-cart") {
            const state = JSON.parse(value).state;
            value = JSON.stringify({ ...state, cart: undefined });
          }
          for (const s of secrets) if (value.includes(s)) out.push(`${key}: ${s}`);
        }
      return out;
    },
    [TEL_AVIV],
  );
  expect(leaks).toEqual([]);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("mono-cart")!).state.cart);
  expect(cart).toEqual([expect.objectContaining({ id: "make-sky", custom: { t: "sky", v: 1, p: { c: TEL_AVIV, d: "1991-03-14", w: "The night we met" } } })]);
});
