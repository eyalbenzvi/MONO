import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";
import { TEL_AVIV, TLV_1991, make } from "./fixtures/custom";

const cards = (page: Page) => page.locator("[data-two] [data-card]");
const card = (page: Page, slug: string) => page.locator(`[data-two] [data-card="${slug}"]`);

test("For two: before a date, every print drawn with our example; never blank", async ({ page }) => {
  await page.goto("make/two/");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "For two" })).toBeVisible();
  await expect(page.getByText("Shown with our example")).toBeVisible();
  await expect(page.locator('[data-two="example"]')).toBeVisible();
  for (const slug of ["sky", "moon", "planets", "julia", "monogram", "place", "year", "weeks", "snowflake"]) await expect(card(page, slug)).toBeVisible();
  // Each card is drawn (the print on its tee).
  await expect(card(page, "moon").locator("canvas[data-custom]")).toBeVisible();
  // The example isn't written into the address.
  expect(new URL(page.url()).search).toBe("");
});

test("For two: a date, what it was and two names; the address keeps them; a card opens its product with everything filled in", async ({ page }) => {
  await page.goto("make/two/");
  await hydrated(page);
  await page.getByLabel("The date").fill("2012-06-06");
  await page.getByLabel("What it was").fill("Our wedding");
  await page.getByLabel("One of you").fill("Noa");
  await page.getByLabel("The other").fill("David");
  await expect(page.locator('[data-two="yours"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "From 6 June 2012" })).toBeVisible();
  await expect(page).toHaveURL(/[?&]d=2012-06-06/);
  await expect(page).toHaveURL(/[?&]w=Our\+wedding/);
  await expect(page).toHaveURL(/[?&]a=Noa&b=David/);
  const planets = make({ t: "planets", v: 1, p: { d: "2012-06-06", w: "Our wedding" } });
  await expect(card(page, "planets").getByRole("link")).toHaveAttribute("href", new RegExp(`/make/planets/\\?make=${planets}$`));
  await expect(card(page, "monogram").getByText("N and D, woven")).toBeVisible();
  await expect(card(page, "monogram").getByRole("link")).toHaveAttribute("href", new RegExp(`make=${make({ t: "monogram", v: 1, p: { x: "ND", s: "lace", y: 2012 } })}$`));
  await card(page, "planets").getByRole("link").tap();
  await page.waitForURL(/\/make\/planets\/\?make=/);
  await hydrated(page);
  await expect(page.getByLabel("Your words")).toHaveValue("Our wedding");
  await expect(page.getByLabel("Day")).toHaveValue("2012-06-06");
});

test("For two: only the prints the inputs allow", async ({ page }) => {
  await page.goto("make/two/?d=2060-06-01&c=293397");
  await hydrated(page);
  await expect(card(page, "sky")).toBeVisible();
  // The planets hold to 2050; a date to come has no weeks yet; no names, no monogram.
  await expect(card(page, "moon")).toBeVisible();
  for (const slug of ["planets", "weeks", "monogram", "snowflake"]) await expect(card(page, slug)).toHaveCount(0);
  await expect(cards(page)).toHaveCount(5);
  // One name isn't a monogram.
  await page.getByLabel("One of you").fill("Noa");
  await page.getByLabel("The date").fill("2016-08-12");
  await expect(card(page, "weeks")).toBeVisible();
  await expect(card(page, "monogram")).toHaveCount(0);
});

test("For two: a shared link opens as it was; the place can change or be left out", async ({ page }) => {
  await page.goto(`make/two/?d=1991-03-14&w=The+night+we+met&c=${TEL_AVIV}`);
  await hydrated(page);
  await expect(page.getByLabel("The date")).toHaveValue("1991-03-14");
  await expect(page.getByLabel("What it was")).toHaveValue("The night we met");
  await expect(card(page, "sky").getByText("The sky over Tel Aviv that night")).toBeVisible();
  await expect(card(page, "sky").getByRole("link")).toHaveAttribute("href", new RegExp(`make=${TLV_1991}$`));
  await page.getByRole("button", { name: "Change" }).tap();
  await page.getByRole("button", { name: "Leave the place out" }).tap();
  await expect(page.getByText("No place: no sky, no globe")).toBeVisible();
  await expect(card(page, "sky")).toHaveCount(0);
  await expect(card(page, "place")).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]c=none/);
  await page.getByRole("button", { name: "Add one" }).tap();
  await page.getByRole("combobox", { name: "Place" }).fill("Tel Aviv");
  await page.getByRole("option", { name: /Tel Aviv/ }).first().tap();
  await expect(card(page, "sky")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]c=${TEL_AVIV}`));
});

test("For two: the lexicon refuses a brand as a name, and the rest stays", async ({ page }) => {
  await page.goto("make/two/?d=2016-08-12");
  await hydrated(page);
  await page.getByLabel("One of you").fill("N1KE");
  await page.getByLabel("The other").fill("David");
  await expect(page.getByText("Those words name a brand.")).toBeVisible();
  await expect(card(page, "moon")).toBeVisible();
  await expect(card(page, "monogram")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]a=/);
});
