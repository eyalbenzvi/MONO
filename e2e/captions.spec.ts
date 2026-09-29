import { expect, test } from "@playwright/test";
import { captionLine, hydrated } from "./helpers";

// The text under the print, on three products of different kinds: a line edited
// shows in the link, a fresh visitor opening it sees the same line, and Reset
// brings ours back (and takes it out of the link).
for (const slug of ["snowflake", "maze", "place"]) {
  test(`Your caption on ${slug}: edit a line, reopen the link elsewhere, reset it`, async ({ page, browser }) => {
    await page.goto(`make/${slug}/`);
    await hydrated(page);
    await expect(page.locator("canvas[data-custom]").first()).toBeVisible();
    const line = await captionLine(page, 1);
    const ours = await line.inputValue();
    await expect(page).toHaveURL(/[?&]make=/);
    const before = page.url();
    await line.fill("Kept in the kitchen drawer");
    await expect(page).not.toHaveURL(before);
    const link = page.url();

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(link);
    await hydrated(p2);
    const again = await captionLine(p2, 1);
    await expect(again).toHaveValue("Kept in the kitchen drawer");
    await expect(p2.getByText(/^Yours\. Reset to follow/)).toBeVisible();
    await p2.locator('[data-cap-reset="1"]').click();
    await expect(again).toHaveValue(ours);
    await expect(p2.getByText(/^Yours\. Reset to follow/)).toHaveCount(0);
    await expect(p2).not.toHaveURL(link);
    expect(p2.url().split("make=")[1]).toBe(before.split("make=")[1]);
    await other.close();
  });
}
