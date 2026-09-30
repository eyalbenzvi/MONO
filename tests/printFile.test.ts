import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { INK, inkOnCloth } from "@/lib/custom/inkOnCloth";
import { encodeMake } from "@/lib/custom/spec";
import { madeBySlug } from "@/lib/custom/products";
import { PRINT_PX, codeOf, embedFonts, inkPng } from "../scripts/tools/printFile";
import { drawSpec } from "./make/render";

describe("the production file", () => {
  it("reads a Make link or its bare code", () => {
    const code = encodeMake(madeBySlug("telegram")!.example);
    expect(codeOf(`https://example.com/make/telegram/?make=${code}`)).toBe(code);
    expect(codeOf(code)).toBe(code);
  });

  it("embeds the faces the print names, and only those", async () => {
    const svg = embedFonts(await drawSpec(madeBySlug("telegram")!.example, "black"));
    expect(svg).toMatch(/@font-face\{font-family:"IBM Plex Mono"/);
    expect(svg).not.toMatch(/font-family:"UnifrakturMaguntia"/);
  });

  it("is one ink on a transparent ground at 300 DPI over the print area", { timeout: 60_000 }, async () => {
    const png = await inkPng(await drawSpec(madeBySlug("telegram")!.example, "white"), "white");
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height, meta.channels, Math.round(meta.density ?? 0)]).toEqual([PRINT_PX.width, PRINT_PX.height, 4, 300]);
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let [inked, coloured] = [0, 0];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0) coloured++; // black ink for a white tee, whatever the coverage
      if (data[i + 3] > 128) inked++;
    }
    expect(coloured).toBe(0);
    const share = inked / (PRINT_PX.width * PRINT_PX.height);
    expect(share).toBeGreaterThan(0.01);
    expect(share).toBeLessThan(0.5);
  });
});

describe("ink on cloth (the mockups' blend)", () => {
  it("leaves the cloth where there's no ink, and gives ink its density, moving with the folds", () => {
    // Four pixels of a black tee: two flat, one in a crease, one lifted; ink on all but the first.
    const photo = [20, 20, 20, 20, 20, 20, 5, 5, 5, 35, 35, 35];
    const print = [0, 255, 255, 255];
    inkOnCloth(photo, 3, print, 1, "black");
    expect(photo.slice(0, 3)).toEqual([20, 20, 20]);
    expect(photo[3]).toBe(Math.round(INK.black * 255));
    expect(photo[6]).toBeLessThan(photo[3]);
    expect(photo[9]).toBeGreaterThan(photo[3]);
  });
  it("on a white tee, black ink is dense but not a hole, and half coverage sits between", () => {
    const photo = [240, 240, 240, 240, 240, 240];
    inkOnCloth(photo, 3, [0, 128], 1, "white");
    expect(photo[0]).toBe(Math.round(INK.white * 255));
    expect(photo[3]).toBeGreaterThan(photo[0]);
    expect(photo[3]).toBeLessThan(240);
  });
});
