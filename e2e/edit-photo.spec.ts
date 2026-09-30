import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { hydrated } from "./helpers";
import { pencilSketch, photo } from "./fixtures/uploads";

// Each state converts the print and, when idle, its other styles and size: slow when the suite runs four at once.
test.describe.configure({ timeout: 120_000 });
const settled = (page: Page) => expect(page.locator('[data-upload-preview="ready"], [data-upload-preview="failed"]')).toBeVisible({ timeout: 45_000 });
async function open(page: Page, name: string, buffer: Buffer) {
  await page.goto("make/yours/");
  await hydrated(page);
  await page.locator("#upload-file").setInputFiles({ name, mimeType: "image/png", buffer });
  await settled(page);
}
const sheet = (page: Page) => page.getByRole("dialog", { name: "Edit photo" });

test("Edit photo: on a short phone the picture is drawn and Save is in view, bright, and keeps every edit", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await open(page, "harbour.png", await photo());
  await page.getByRole("button", { name: "Edit photo" }).tap();
  await expect(sheet(page)).toBeVisible();
  // The picture is drawn on the first open (not a black frame).
  await expect
    .poll(() =>
      page.locator("[data-edit-canvas]").evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4 * 97) s += d[i];
        return s / (d.length / (4 * 97));
      }),
    )
    .toBeGreaterThan(60);
  // Save is in view and not under the crop's shade: its middle is white on screen.
  const save = page.locator("[data-edit-save]");
  await expect(save).toBeInViewport({ ratio: 1 });
  const box = (await save.boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + 30, y: box.y + box.height / 2 - 1, width: 2, height: 2 } });
  const { data } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  expect(data[0]).toBeGreaterThan(240);

  // A square crop is square in the picture's pixels (1600 × 1200: three quarters of the width, all the height).
  await page.locator('[data-aspect="square"]').tap();
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^75% by 100%/);
  await page.getByRole("button", { name: "Mirror" }).tap();
  await expect(page.getByRole("button", { name: "Mirror" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Light" }).tap();
  await page.locator('[data-tone="contrast"]').fill("30");
  await page.locator('[data-tone="light"]').fill("-10");
  await save.tap();
  await expect(sheet(page)).toHaveCount(0);
  await settled(page);

  // Opened again, it shows what was saved.
  await page.getByRole("button", { name: "Edit photo" }).tap();
  await expect(page.getByRole("button", { name: "Mirror" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^75% by 100%/);
  await page.getByRole("tab", { name: "Light" }).tap();
  await expect(page.locator('[data-tone="contrast"]')).toHaveValue("30");
  await expect(page.locator('[data-tone="light"]')).toHaveValue("-10");
  // Closing without saving keeps what was saved.
  await page.locator('[data-tone="light"]').fill("40");
  await page.getByRole("button", { name: "Close without saving" }).tap();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Edit photo" }).tap();
  await page.getByRole("tab", { name: "Light" }).tap();
  await expect(page.locator('[data-tone="light"]')).toHaveValue("-10");
  // Reset puts everything back as taken.
  await page.locator("[data-edit-reset]").tap();
  await expect(page.locator('[data-tone="light"]')).toHaveValue("0");
  await page.getByRole("tab", { name: "Crop" }).tap();
  await expect(page.getByRole("button", { name: "Mirror" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^100% by 100%/);
});

test("Edit photo: a quarter turn turns the crop with the picture", async ({ page }) => {
  await open(page, "harbour.png", await photo());
  await page.getByRole("button", { name: "Edit photo" }).tap();
  await page.locator('[data-aspect="4:3"]').tap();
  // 4:3 on a 4:3 picture is the whole of it; turned, the picture is 3:4 and the shape follows.
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^100% by 100%/);
  await page.getByRole("button", { name: "Rotate" }).tap();
  await expect(page.locator('[data-aspect="3:4"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^100% by 100%/);
});

test("Edit photo: dragging a corner crops, and Save prints the crop", async ({ page }) => {
  await open(page, "harbour.png", await photo());
  await page.getByRole("button", { name: "Edit photo" }).tap();
  const corner = (await page.locator('[data-corner="br"]').boundingBox())!;
  const frame = (await page.locator("[data-crop]").boundingBox())!;
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x - frame.width * 0.2, corner.y - frame.height * 0.2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^(7\d|8\d)% by (7\d|8\d)%, at 0%, 0%$/);
  await page.locator("[data-edit-save]").tap();
  await expect(sheet(page)).toHaveCount(0);
  await settled(page);
  // The crop reached the print: the next open starts from it.
  await page.getByRole("button", { name: "Edit photo" }).tap();
  await expect(page.locator("[data-crop]")).toHaveAttribute("aria-valuetext", /^(7\d|8\d)% by (7\d|8\d)%/);
});

test("one tile for a photo or a drawing; a pencil sketch read as a photograph can be printed as a Drawing", async ({ page }) => {
  await page.goto("make/yours/");
  await hydrated(page);
  await expect(page.locator("[data-tile]")).toHaveCount(0);
  await expect(page.locator("[data-primary]")).toHaveText("Choose a picture");
  await open(page, "sketch.png", await pencilSketch());
  const style = page.getByRole("radiogroup", { name: "Style" });
  await expect(style.getByRole("radio")).toHaveText([/^Dots/, /^Lines/, /^Drawing/]);
  await style.getByRole("radio", { name: /^Drawing/ }).tap();
  await expect(style.getByRole("radio", { name: /^Drawing/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-upload-preview="ready"]')).toBeVisible({ timeout: 45_000 });
  // It stays a choice once taken (the print is line work now, but the picture was a photograph).
  await expect(style.getByRole("radio")).toHaveCount(3);
  await page.locator("[data-primary]").tap();
  await expect(page.locator("[data-summary]")).toContainText(/^Drawing · /);
});
