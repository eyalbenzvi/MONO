import { describe, expect, it } from "vitest";
import { wideTexts } from "./fuzz";

const t = (s: string, size = 10) => `<text font-size="${size}">${s}</text>`;

describe("wideTexts: the fuzz's text-width check", () => {
  it("measures a text at its size (0.602 em a character)", () => {
    expect(wideTexts(t("x".repeat(48)))).toEqual([]);
    expect(wideTexts(t("x".repeat(49)))).toEqual(["x".repeat(49)]);
  });
  it("counts a group's scale written after a translate (it was read as 1)", () => {
    expect(wideTexts(`<g transform="translate(10 20) scale(2)">${t("x".repeat(30))}</g>`)).toEqual(["x".repeat(30)]);
    expect(wideTexts(`<g transform="scale(2)">${t("x".repeat(30))}</g>`)).toEqual(["x".repeat(30)]);
    expect(wideTexts(`<g transform="translate(10 20)">${t("x".repeat(30))}</g>`)).toEqual([]);
  });
  it("nested groups multiply; a closed group's scale no longer applies", () => {
    expect(wideTexts(`<g transform="scale(2)"><g transform="translate(1 1) scale(1.5)">${t("x".repeat(20))}</g></g>`)).toEqual(["x".repeat(20)]);
    expect(wideTexts(`<g transform="scale(3)"></g>${t("x".repeat(30))}`)).toEqual([]);
  });
});
