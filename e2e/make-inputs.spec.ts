import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./helpers";
import { MADE } from "../lib/custom/products";

/**
 * Every Make product answers its fields at once: on a fresh page (the example
 * on the stage, the fields empty or as they open), one change a visitor makes
 * redraws the print. Before, a product with a required field still empty kept
 * drawing its example whatever else was typed or picked (a style, a skeleton,
 * a name in one of three fields): the design stayed ours, not theirs. Now the
 * stage draws the fields so far over the example (tests/make-inputs.test.ts
 * checks every input changes the print itself).
 */
type Change = { fill: string; value: string; option?: true } | { tap: string } | { select: string; value: string } | { button: string };

const CHANGES: Record<string, Change> = {
  sky: { fill: "#make-date", value: "2015-05-20" },
  moon: { fill: "#make-date", value: "2015-05-20" },
  planets: { fill: "#make-date", value: "2015-05-20" },
  year: { fill: "#make-year", value: "1987" },
  julia: { fill: "#make-julia-date", value: "2015-05-20" },
  weeks: { fill: "#make-weeks-to", value: "2015-05-20" },
  rings: { fill: "#make-rings-from", value: "1990" },
  code: { tap: "Paper tape" },
  ascii: { fill: "#make-big", value: "MAYA" },
  elements: { fill: "#make-elements-name", value: "Nico" },
  automaton: { fill: "#make-automaton-word", value: "Tamar" },
  maze: { fill: "#make-maze-initials", value: "ZK" },
  tartan: { fill: "#make-tartan-name", value: "Levi" },
  snowflake: { fill: "#make-snowflake-name", value: "Tamar" },
  monogram: { fill: "#make-monogram-initials", value: "ZK" },
  sampler: { fill: "#make-sampler-year", value: "1987" },
  dinosaur: { select: "#make-dinosaur-plate", value: "tyrannosaurus" },
  place: { fill: "#custom-place", value: "Paris", option: true },
  house: { tap: "Flat" },
  journey: { fill: "#custom-place", value: "Paris", option: true },
  route: { fill: "#make-route-km", value: "16" },
  signpost: { tap: "Two places, since" },
  tour: { fill: "#make-tour-name", value: "Tamar" },
  countries: { fill: "#make-countries-name", value: "Tamar" },
  flights: { tap: "Boarding pass" },
  passport: { fill: "#make-passport-name", value: "Tamar Katz" },
  landmarks: { fill: "#make-landmarks-name", value: "Tamar" },
  telegram: { fill: "#make-telegram-to", value: "Tamar" },
  label: { fill: "#make-label-born", value: "1987" },
  card: { tap: "Modern" },
  sign: { tap: "Street sign" },
  frontpage: { fill: "#make-frontpage-name", value: "Tamar" },
  family: { fill: "#make-family-n1", value: "Dan Katz" },
  metro: { fill: "#make-metro-line0", value: "Tamar" },
  crossword: { fill: "#make-crossword-names", value: "Anna, Boris, Clara, David" },
  orbits: { fill: "#make-orbits-name-0", value: "Tamar" },
  island: { fill: "#make-island-place-0", value: "Tamar" },
  editions: { fill: "#make-editions-n0", value: "Tamar" },
  sayings: { tap: "First words" },
  credits: { fill: "#make-credits-family", value: "Katz" },
  receipt: { tap: "Terms" },
  message: { fill: "#make-message-with", value: "Tamar" },
  birth: { tap: "It’s a boy" },
  lineup: { select: "#make-lineup-formation", value: "433" },
  patch: { fill: "#make-patch-mission", value: "Operation Snow" },
  line: { button: "Example lines" },
  number: { fill: "#make-number", value: "5.4" },
  qr: { fill: "#make-qr-link", value: "example.com/tamar" },
  chess: { fill: "#make-chess-pgn", value: "1. d4 d5 2. c4 e6 3. Nc3 Nf6" },
  musicbox: { button: "C4" },
};
/** No field to change here: the plant grows from the taste test’s swipes, the voice from the microphone (e2e/make-ours covers both). */
const NONE = ["taste", "voice"];

/** The print on the stage, as a hash of its canvas's pixels. */
const picture = (page: Page) =>
  page.evaluate(() => {
    const c = [...document.querySelectorAll<HTMLCanvasElement>("canvas[data-custom]")].find((x) => x.width > 0);
    if (!c) return "";
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i] + 3 * d[i + 1]), 16777619);
    return `${c.width}x${c.height}:${h >>> 0}`;
  });
/** The stage once it has settled (the same picture twice, a moment apart). */
async function settled(page: Page) {
  let last = "";
  await expect
    .poll(async () => {
      const now = await picture(page);
      const same = !!now && now === last;
      last = now;
      return same;
    }, { intervals: [400], timeout: 15_000 })
    .toBe(true);
  return last;
}

test("every product has its change here", () => {
  expect(MADE.map((m) => m.slug).filter((s) => !(s in CHANGES) && !NONE.includes(s))).toEqual([]);
});

for (const m of MADE.filter((x) => !NONE.includes(x.slug)))
  test(`${m.name}: one change redraws the print`, async ({ page }) => {
    await page.goto(`make/${m.slug}/`);
    await hydrated(page);
    await page.locator("main form").waitFor();
    const before = await settled(page);
    const c = CHANGES[m.slug];
    if ("fill" in c) {
      await page.locator(c.fill).fill(c.value);
      if (c.option) await page.getByRole("option").first().tap();
    } else if ("tap" in c) await page.locator("main form").getByRole("radio", { name: c.tap, exact: true }).tap();
    else if ("select" in c) await page.locator(c.select).selectOption(c.value);
    else await page.locator("main form").getByRole("button", { name: c.button, exact: true }).first().tap();
    await expect.poll(() => picture(page), { timeout: 10_000 }).not.toBe(before);
  });

/** The caption too: its title line typed before any field shows on the example (and on the fields so far after). */
for (const slug of ["card", "snowflake"])
  test(`${slug}: the caption's title, typed first, is on the print at once`, async ({ page }) => {
    await page.goto(`make/${slug}/`);
    await hydrated(page);
    await page.locator("main form").waitFor();
    const before = await settled(page);
    await page.getByRole("button", { name: /Edit the text under the print/ }).tap();
    await page.locator('[data-cap-line="0"]').fill("For Tamar");
    await expect.poll(() => picture(page), { timeout: 10_000 }).not.toBe(before);
    // Nothing of the visitor's to buy yet: the address still carries no print.
    await expect(page).not.toHaveURL(/[?&]make=/);
  });
