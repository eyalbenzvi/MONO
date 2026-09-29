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

test("Your Name in Code: a name in a code, redrawn as it changes; a character the code lacks is refused as typed; into the bag; the link reopens it", async ({ page, browser }) => {
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
  await page.getByText("Hide the letters").tap();
  await expect(page.getByRole("switch", { name: "Hide the letters" })).toBeChecked();
  // The address carries exactly this print once it's drawn.
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "code", v: 1, p: { x: "RENE", k: "tape", h: 1 } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your Name in Code · RENE")).toBeVisible();
  // The link opens that very print in a fresh visit.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.getByLabel("Your name", { exact: true })).toHaveValue("RENE");
  await expect(p2.getByRole("radio", { name: "Paper tape" })).toHaveAttribute("aria-checked", "true");
  await expect(p2.getByRole("switch", { name: "Hide the letters" })).toBeChecked();
  await other.close();
});

test("Your Name in Code: the lexicon refuses a brand as a name", async ({ page }) => {
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
    ["harmonograph", "voice"],
    ["ascii-shade", "ascii"],
    ["daylight", "place"],
    ["lissajous", "voice"],
  ] as const) {
    const s = shirts.find((x) => x.variant === variant)!;
    await page.goto(`shop/${s.id}/`);
    await hydrated(page);
    // A design several products are drawn like names each of them (up to three); the one expected is among them.
    await page.locator(`[data-make-your-own][href$="/make/${slug}/"], [data-make-your-own-list] a[href$="/make/${slug}/"]`).first().tap();
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

test("Your Taste Plant: before the taste test, the example and a way to Discover (no bag); after it, your plant, into the bag", async ({ page, browser }) => {
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
  // The taste is known: no nudge to swipe first.
  await expect(p2.getByRole("link", { name: "Ten swipes first →" })).toHaveCount(0);
  await drawn(p2);
  await addAndOpenBag(p2);
  await expect(p2.getByText("Your Taste Plant", { exact: true })).toBeVisible();
  await ctx.close();
});

test("Your Taste Plant: a friend's taste that came with the visit can be grown instead (the gift)", async ({ page }) => {
  await seed(page);
  await page.goto("make/taste/?taste=2i1e1e2n1e1e1e1e1e1e1e281e1e1e1e1e");
  await hydrated(page);
  await drawn(page);
  const mine = new URL(page.url()).searchParams.get("make");
  await page.getByRole("button", { name: "Grow your friend’s instead" }).tap();
  await expect(page.getByText("Grown from your friend’s taste.")).toBeVisible();
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

/** A microphone that hums: 220 Hz with its octave, from an oscillator, in place of the real one. */
const HUM = `
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const out = ctx.createMediaStreamDestination();
    for (const [f, g] of [[220, 0.5], [440, 0.3]]) {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.frequency.value = f;
      gain.gain.value = g;
      o.connect(gain).connect(out);
      o.start();
    }
    return out.stream;
  };
`;

test("Your Voice: hold to record (by keyboard), the hum's pitch reaches the print and the bag; the link rebuilds it without any sound", async ({ page, browser }) => {
  await page.addInitScript(HUM);
  await page.goto("make/voice/");
  await hydrated(page);
  await drawn(page);
  await expect(page.getByText("Only the pitch and the fade are kept.")).toBeVisible();
  const before = page.url();
  await page.locator("[data-record]").focus();
  await page.keyboard.down(" ");
  await expect(page.locator("[data-record]")).toHaveText("Listening…");
  await page.waitForTimeout(1600);
  await page.keyboard.up(" ");
  await expect(page.locator("[data-record]")).toHaveText("Hold and hum");
  await expect.poll(() => page.url()).not.toBe(before);
  const spec = JSON.parse(Buffer.from(new URL(page.url()).searchParams.get("make")!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  expect(spec.p.f).toBeGreaterThan(210);
  expect(spec.p.f).toBeLessThan(230);
  expect(Object.keys(spec.p).sort()).toEqual(["a", "b", "d", "f", "ph"]);
  expect(await page.evaluate(() => (window.dataLayer ?? []).filter((e) => e.event === "voice_record").map((e) => e.ok))).toEqual([true]);
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText(new RegExp(`^Your Voice · ${spec.p.f} Hz$`))).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await drawn(p2);
  await expect(p2).toHaveURL(link);
  await other.close();
});

test("Your Voice: the microphone refused leaves the example and a way to Your Line; silence says it didn't catch a note", async ({ page, browser }) => {
  await page.addInitScript(`navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); };`);
  await page.goto("make/voice/");
  await hydrated(page);
  await drawn(page);
  const example = page.url();
  await page.locator("[data-record]").focus();
  await page.keyboard.down(" ");
  await page.keyboard.up(" ");
  await expect(page.getByText("The microphone is off. Allow it, or try Your Line.")).toBeVisible();
  await expect(page.getByRole("status").getByRole("link", { name: "Your Line" })).toHaveAttribute("href", /\/make\/line\/$/);
  expect(page.url()).toBe(example);
  await expect(page.getByRole("button", { name: /^Add to bag|Choose size/ }).first()).toBeVisible();

  // A silent microphone: nothing voiced.
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.addInitScript(`navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream;`);
  await p2.goto("make/voice/");
  await hydrated(p2);
  await p2.locator("[data-record]").focus();
  await p2.keyboard.down(" ");
  await p2.waitForTimeout(1200);
  await p2.keyboard.up(" ");
  await expect(p2.getByText("Didn’t catch a note. Hum for three seconds.")).toBeVisible();
  await ctx.close();
});

test("Your ASCII: big letters on two lines, typed in a phrase, no shadow; a letter the pixel font lacks is refused; bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/ascii/");
  await hydrated(page);
  await drawn(page);
  await page.locator("#make-big").fill("Noé");
  await expect(page.getByText('The pixel font has no "é". Try "E".')).toBeVisible();
  await page.locator("#make-big").fill("happy birthday");
  await page.getByRole("radio", { name: "A phrase" }).tap();
  await page.locator("#make-phrase").fill("from tel aviv");
  await page.getByText("Drop shadow", { exact: true }).tap();
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "ascii", v: 1, p: { x: ["HAPPY", "BIRTHDAY"], f: "phrase", p: "from tel aviv" } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your ASCII · HAPPY BIRTHDAY")).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.locator("#make-phrase")).toHaveValue("from tel aviv");
  await expect(p2.getByRole("switch", { name: "Drop shadow" })).not.toBeChecked();
  await other.close();
});

test("Your Place: exact coordinates with their hemispheres, a day, words; bag; the link reopens it", async ({ page, browser }) => {
  await page.goto("make/place/");
  await hydrated(page);
  await drawn(page);
  await page.getByRole("radio", { name: "Exact place" }).tap();
  await page.locator("#make-lat").fill("40.7128 N");
  await page.locator("#make-lon").fill("74.0060 W");
  await expect(page.getByText("40°43′N 74°01′W")).toBeVisible();
  await page.locator("#make-date").fill("2001-09-11");
  await page.locator("#make-words").fill("Where I was");
  await expect(page).toHaveURL(new RegExp(`make=${make({ t: "place", v: 1, p: { la: 40.71, lo: -74.01, d: "2001-09-11", w: "Where I was" } })}$`));
  const link = page.url();
  await addAndOpenBag(page);
  await expect(page.getByText("Your Place · Where I was")).toBeVisible();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await hydrated(p2);
  await expect(p2.getByRole("radio", { name: "Exact place" })).toHaveAttribute("aria-checked", "true");
  await expect(p2.locator("#make-lat")).toHaveValue("40.71");
  await other.close();
});

test("Your Place: 'Where I am now' fills the place from this device, rounded to about a kilometre", async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 51.507351, longitude: -0.127758 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await page.goto("make/place/");
  await hydrated(page);
  await page.getByRole("radio", { name: "Exact place" }).tap();
  await page.locator("[data-locate]").tap();
  await expect(page.locator("#make-lat")).toHaveValue("51.51");
  await expect(page.locator("#make-lon")).toHaveValue("-0.13");
  await ctx.close();
});

test("A product page leads to the rest of its group on the index (More from a name →); Back returns to the index", async ({ page }) => {
  await page.goto("make/");
  await hydrated(page);
  await page.locator('[data-made="code"]').tap();
  await expect(page).toHaveURL(/\/make\/code\/$/);
  const more = page.locator("[data-siblings]");
  await expect(more).toHaveText("More from a name →");
  await expect(more).toHaveAttribute("href", /\/make\/#name$/);
  await page.getByRole("link", { name: "Make", exact: true }).first().tap();
  await expect(page).toHaveURL(/\/make\/(#name)?$/);
});
