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
  {
    slug: "label",
    fill: async (page) => {
      await page.locator("#make-label-name").fill("Maya Cohen");
      await page.locator("#make-label-born").fill("1990");
      await page.locator("#make-label-medium").fill("Oil on nerves");
    },
    again: async (page) => expect(page.locator("#make-label-medium")).toHaveValue("Oil on nerves"),
  },
  {
    slug: "credits",
    fill: async (page) => {
      await page.locator("#make-credits-family").fill("Cohen");
      await page.locator("#make-credits-r0").fill("Directed by");
      await page.locator("#make-credits-n0").fill("Mum");
      await page.locator("#make-credits-r1").fill("Catering");
      await page.locator("#make-credits-n1").fill("Savta");
    },
    again: async (page) => expect(page.locator("#make-credits-n1")).toHaveValue("Savta"),
  },
  {
    slug: "card",
    fill: async (page) => {
      await page.getByRole("radio", { name: "Modern" }).tap();
      await page.locator("#make-card-name").fill("Maya Cohen");
      await page.locator("#make-card-title").fill("Head of Snacks");
      await page.locator("#make-card-company").fill("The Kitchen");
    },
    again: async (page) => {
      await expect(page.locator("#make-card-title")).toHaveValue("Head of Snacks");
      await expect(page.getByRole("radio", { name: "Modern" })).toHaveAttribute("aria-checked", "true");
    },
  },
  {
    slug: "receipt",
    fill: async (page) => {
      await page.locator("#make-receipt-head").fill("Noa & Dan");
      await page.locator("#make-receipt-date").fill("2016-08-14");
      await page.locator("#make-receipt-v0").fill("First date");
    },
    again: async (page) => {
      await expect(page.locator("#make-receipt-v0")).toHaveValue("First date");
      await expect(page.locator("#make-receipt-date")).toHaveValue("2016-08-14");
    },
  },
  {
    slug: "message",
    fill: async (page) => {
      await page.locator("#make-message-t0").fill("Was that you with the umbrella?");
      await page.locator("#make-message-h0").fill("21:02");
      await page.locator("#make-message-t1").fill("It was. Sorry about your shoes.");
      await page.locator("#make-message-h1").fill("21:04");
    },
    again: async (page) => expect(page.locator("#make-message-t1")).toHaveValue("It was. Sorry about your shoes."),
  },
  {
    slug: "birth",
    fill: async (page) => {
      await page.locator("#make-birth-name").fill("Noa");
      await page.locator("#make-birth-date").fill("2021-11-19");
      await page.locator("#make-birth-kg").fill("3.4");
    },
    again: async (page) => {
      await expect(page.locator("#make-birth-name")).toHaveValue("Noa");
      await expect(page.locator("#make-birth-kg")).toHaveValue("3.4");
    },
  },
  {
    slug: "sign",
    fill: async (page) => {
      await page.locator("#make-sign-pictogram").selectOption("dog");
      await page.locator("#make-sign-warning").fill("Dog is friendly, mostly");
    },
    again: async (page) => {
      await expect(page.locator("#make-sign-warning")).toHaveValue("Dog is friendly, mostly");
      await expect(page.locator("#make-sign-pictogram")).toHaveValue("dog");
    },
  },
  {
    slug: "signpost",
    fill: async (page) => {
      await page.getByRole("combobox", { name: "Home" }).fill("tel aviv");
      await page.getByRole("option").first().tap();
      await page.getByRole("combobox", { name: "Add a place" }).fill("london");
      await page.getByRole("option").first().tap();
    },
    again: async (page) => {
      await expect(page.getByRole("combobox", { name: "Home" })).toHaveValue(/Tel Aviv/);
      await expect(page.getByText(/London/).first()).toBeAttached();
    },
  },
  {
    slug: "tour",
    fill: async (page) => {
      await page.locator("#make-tour-name").fill("Noa");
      for (const city of ["london", "paris", "rome", "tokyo"]) {
        await page.getByRole("combobox", { name: "Add a place" }).fill(city);
        await page.getByRole("option").first().tap();
      }
    },
    again: async (page) => {
      await expect(page.locator("#make-tour-name")).toHaveValue("Noa");
      await expect(page.getByText(/Tokyo/).first()).toBeAttached();
    },
  },
  {
    slug: "lineup",
    fill: async (page) => {
      await page.locator("#make-lineup-team").fill("Sunday FC");
      await page.locator("#make-lineup-n0").fill("Dad");
      await page.locator("#make-lineup-k0").fill("1");
    },
    again: async (page) => expect(page.locator("#make-lineup-n0")).toHaveValue("Dad"),
  },
  {
    slug: "patch",
    fill: async (page) => {
      await page.locator("#make-patch-mission").fill("Operation Beach");
      await page.locator("#make-patch-n0").fill("Mum");
      await page.locator("#make-patch-n1").fill("Dad");
      await page.locator("#make-patch-emblem").selectOption("boat");
    },
    again: async (page) => expect(page.locator("#make-patch-emblem")).toHaveValue("boat"),
  },
  {
    slug: "sampler",
    fill: async (page) => {
      await page.locator("#make-sampler-name").fill("Maya");
      await page.locator("#make-sampler-year").fill("2019");
      await page.locator("#make-sampler-border").selectOption("zigzag");
    },
    again: async (page) => expect(page.locator("#make-sampler-border")).toHaveValue("zigzag"),
  },
  {
    slug: "countries",
    fill: async (page) => {
      await page.locator("#make-countries-name").fill("Noa");
      await page.locator("#make-countries-filter").fill("japan");
      await page.getByRole("checkbox", { name: "Japan" }).check();
      await page.locator("#make-countries-filter").fill("portugal");
      await page.getByRole("checkbox", { name: "Portugal" }).check();
    },
    again: async (page) => {
      await page.locator("#make-countries-filter").fill("japan");
      await expect(page.getByRole("checkbox", { name: "Japan" })).toBeChecked();
    },
  },
  {
    slug: "flights",
    fill: async (page) => {
      await page.getByRole("combobox", { name: "Add an airport" }).fill("nrt");
      await page.getByRole("option").first().tap();
      await page.locator("#make-flights-y0").fill("2019");
    },
    again: async (page) => expect(page.locator("#make-flights-y0")).toHaveValue("2019"),
  },
  {
    slug: "passport",
    fill: async (page) => {
      await page.locator("#make-passport-name").fill("Noa Cohen");
      await expect(page.locator("#make-passport-c0 option[value=JPN]")).toBeAttached();
      await page.locator("#make-passport-c0").selectOption("JPN");
      await page.locator("#make-passport-d0").fill("2019-04-12");
    },
    again: async (page) => expect(page.locator("#make-passport-c0")).toHaveValue("JPN"),
  },
  {
    slug: "frontpage",
    fill: async (page) => {
      await page.locator("#make-frontpage-name").fill("Noa");
      await page.locator("#make-frontpage-headline").fill("Local girl turns ten, takes it well");
    },
    again: async (page) => expect(page.locator("#make-frontpage-headline")).toHaveValue("Local girl turns ten, takes it well"),
  },
  {
    slug: "dinosaur",
    fill: async (page) => {
      await page.locator("#make-dinosaur-name").fill("Maya");
      await page.locator("#make-dinosaur-plate").selectOption("stegosaurus");
      await page.locator("#make-dinosaur-height").fill("112");
    },
    again: async (page) => {
      await expect(page.locator("#make-dinosaur-name")).toHaveValue("Maya");
      await expect(page.locator("#make-dinosaur-plate")).toHaveValue("stegosaurus");
    },
  },
  {
    slug: "landmarks",
    fill: async (page) => {
      await page.locator("#make-landmarks-name").fill("Noa");
      for (const name of ["Eiffel Tower", "Colosseum", "Taj Mahal"]) await page.getByRole("button", { name, exact: true }).tap();
      await page.locator("#make-landmarks-y0").fill("2009");
    },
    again: async (page) => {
      await expect(page.getByRole("button", { name: "Colosseum", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#make-landmarks-y0")).toHaveValue("2009");
    },
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
    // The address follows the fields a moment after each change: the link is taken once it holds the last one (steady for 600 ms).
    await expect(async () => {
      const before = page.url();
      await page.waitForTimeout(600);
      expect(page.url()).toBe(before);
    }).toPass({ timeout: 15_000 });
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

// Kids' sizes are sold (KID_SIZES): the two products made for children go into the bag in one.
for (const [slug, fill] of [
  ["dinosaur", async (page: Page) => page.locator("#make-dinosaur-name").fill("Maya")],
  ["birth", async (page: Page) => (await page.locator("#make-birth-name").fill("Noa"), page.locator("#make-birth-date").fill("2021-11-19"))],
] as const)
  test(`${slug}: made in a kids' size, labelled so in the bag`, async ({ page }) => {
    await page.goto(`make/${slug}/`);
    await hydrated(page);
    await fill(page);
    await expect(page).toHaveURL(/[?&]make=/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Kids' sizes" }).first().tap();
    await page.getByRole("radio", { name: "Kids 5–6" }).first().tap();
    await page.getByRole("button", { name: /^Add to bag · Kids 5–6/ }).tap();
    await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
    await page.goto("cart/");
    await hydrated(page);
    await expect(page.getByRole("combobox", { name: "Size" }).first()).toHaveValue("K6");
  });

test("lineup: for the whole team, three shirts go into the bag in one step, each its own line", async ({ page }) => {
  await page.goto("make/lineup/");
  await hydrated(page);
  await page.locator("#make-lineup-team").fill("Sunday FC");
  for (const [i, n] of ["Dad", "Ari", "Tom"].entries()) await page.locator(`#make-lineup-n${i}`).fill(n);
  await expect(page).toHaveURL(/[?&]make=/, { timeout: 15_000 });
  await page.getByText("For the whole team").tap();
  const steps = page.getByRole("spinbutton", { name: "How many tees" });
  await steps.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown");
  await expect(steps).toHaveAttribute("aria-valuenow", "3");
  await page.getByRole("radio", { name: /^M\b/ }).first().tap();
  await page.getByRole("button", { name: /^Add 3 to bag · M · \$225$/ }).tap();
  await expect(page.getByRole("region", { name: "Added to bag" })).toBeVisible();
  await page.goto("cart/");
  await hydrated(page);
  for (const n of ["Dad", "Ari", "Tom"]) await expect(page.getByText(`Sunday FC · ${n}`).first()).toBeVisible();
});
