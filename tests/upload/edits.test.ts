import { describe, expect, it } from "vitest";
import { convert } from "@/lib/upload/convert";
import { DEFAULTS, edited, fixesFor, settingsKey, tone, type PreviewFail } from "@/lib/upload/client";
import { photo, scan } from "./fixtures";

describe("uploads: Edit photo's light and contrast", () => {
  const px = (v: number) => {
    const d = new Uint8ClampedArray([v, v, v, 255]);
    return d;
  };
  it("light scales each channel; contrast spreads it about the middle grey (as CSS brightness() then contrast())", () => {
    const a = px(100);
    tone(a, 20, 0);
    expect(a[0]).toBe(120);
    const b = px(200);
    tone(b, 0, 50);
    expect(b[0]).toBe(Math.round(((200 / 255 - 0.5) * 1.5 + 0.5) * 255));
    const c = px(128);
    tone(c, 0, -50);
    expect(Math.abs(c[0] - 128)).toBeLessThanOrEqual(1);
    // Alpha is left alone.
    expect(b[3]).toBe(255);
  });
  it("the ends clip rather than wrap", () => {
    const w = px(250);
    tone(w, 50, 50);
    expect(w[0]).toBe(255);
    const k = px(5);
    tone(k, -50, 50);
    expect(k[0]).toBe(0);
  });
});

describe("uploads: the settings a picture's edits add", () => {
  it("an unedited picture keys as it did before the edits existed (its cached results and drafts stay valid)", () => {
    expect(settingsKey(DEFAULTS)).toBe(JSON.stringify([null, 0, false, false, "dots", "full"]));
    expect(settingsKey({ ...DEFAULTS, flip: true })).not.toBe(settingsKey(DEFAULTS));
    expect(settingsKey({ ...DEFAULTS, light: 10 })).not.toBe(settingsKey({ ...DEFAULTS, contrast: 10 }));
    expect(edited(DEFAULTS)).toBe(false);
    for (const p of [{ flip: true }, { light: -5 }, { contrast: 12 }, { rot: 90 as const }, { stronger: true }]) expect(edited({ ...DEFAULTS, ...p }), JSON.stringify(p)).toBe(true);
  });
});

describe("uploads: Drawing, a photographed sketch read as line work", () => {
  it("asked of a photograph, it is converted as line work (clean strokes, no screen)", () => {
    const p = photo();
    expect(convert({ pixels: p }, { mode: "dots", size: "full" })).toMatchObject({ cls: "photo", mode: "dots" });
    const d = convert({ pixels: p }, { mode: "drawing", size: "full" });
    expect(d).toMatchObject({ cls: "line", mode: "line", tone: null });
  });
  it("line work stays line work whatever is asked", () => {
    expect(convert({ pixels: scan() }, { mode: "drawing", size: "full" })).toMatchObject({ cls: "line", mode: "line" });
  });
  it("a Drawing that fails for too much ink offers Dots back; one too fine offers Bolder", () => {
    const f = (code: string): PreviewFail => ({ ok: false, reason: "", code, cls: "line", mode: "line", size: "full", canvas: () => null });
    const s = { ...DEFAULTS, mode: "drawing" as const };
    expect(fixesFor(f("dense"), s, { kind: "file" }).map((x) => x.id)).toContain("dots");
    expect(fixesFor(f("stroke"), s, { kind: "file" }).map((x) => x.id)).toContain("bolder");
  });
});
