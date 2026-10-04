import { describe, expect, it } from "vitest";
import { getShirtById } from "@/lib/catalog";
import catalog from "@/data/shirts.json";
import { channelLink, parseShareParams, productShareUrl, shareFileName, shareMessage } from "@/lib/share";
import { decodeShareTag, encodeShareTag } from "@/lib/shareTag";
import { B10 } from "./fixtures";

const ORIGIN = "https://example.github.io";
const shirt = getShirtById(B10)!; // a black tee
const S = `${ORIGIN}/s/${B10.slice(5)}/`; // its short page on the site

describe("share links", () => {
  it("a catalogue design shares its short page on the site (/s/<n>/), the channel in a # tag; a made print its long link", () => {
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN)).toBe(`${S}#w`);
    // Every design in the shop has one: mono-<n> → /s/<n>/.
    for (const s of catalog as { id: string }[]) {
      const p = getShirtById(s.id)!;
      expect(productShareUrl(p, p.baseColor, "copy", ORIGIN), s.id).toBe(`${ORIGIN}/s/${s.id.replace(/^mono-/, "")}/#c`);
    }
    // A made-for-you print keeps its own long link (its spec rides in the query).
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN, "spec")).toBe(`${ORIGIN}/shop/${B10}/?make=spec&utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share`);
  });

  it("carries the colourway only when it differs from the original, and reads it back on landing", () => {
    const url = productShareUrl(shirt, "white", "copy", ORIGIN);
    expect(url.endsWith("#c-w")).toBe(true);
    expect(parseShareParams("", "#c-w")).toEqual({ color: "white", ref: "copy", tagged: true });
    expect(decodeShareTag(encodeShareTag("telegram", "black"))).toEqual({ ref: "telegram", color: "black" });
  });

  it("ignores unknown or malformed params on landing", () => {
    expect(parseShareParams("?c=purple&ref=spam")).toEqual({ color: null, ref: null, tagged: false });
    expect(parseShareParams("", "#zz")).toEqual({ color: null, ref: null, tagged: false });
    // links shared before the short links (UTM tags, or ?ref=) still land as shared
    expect(parseShareParams("?c=white&ref=whatsapp")).toEqual({ color: "white", ref: "whatsapp", tagged: false });
    expect(parseShareParams("?utm_source=whatsapp&utm_medium=share")).toEqual({ color: null, ref: "whatsapp", tagged: false });
    expect(parseShareParams("")).toEqual({ color: null, ref: null, tagged: false });
  });

  it("chat apps get the link alone (their preview card says the rest); SMS and email a line with it", () => {
    const wa = channelLink("whatsapp", shirt, "black", ORIGIN)!;
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1])).toBe(`${S}#w`);
    expect(decodeURIComponent(channelLink("facebook", shirt, "black", ORIGIN)!.split("u=")[1])).toBe(`${S}#f`);
    expect(channelLink("telegram", shirt, "black", ORIGIN)).toBe(`https://t.me/share/url?url=${encodeURIComponent(`${S}#t`)}`);
    expect(channelLink("x", shirt, "black", ORIGIN)).toBe(`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${S}#x`)}`);
    const sms = decodeURIComponent(channelLink("sms", shirt, "black", ORIGIN)!.split("body=")[1]);
    expect(sms).toBe(`“${shirt.title}”, a one-ink tee from MONO.\n${S}#s`);
    expect(channelLink("email", shirt, "black", ORIGIN)!.startsWith("mailto:?subject=")).toBe(true);
  });

  it("has no web intent for Instagram / TikTok (they go through the share sheet with an image)", () => {
    expect(channelLink("instagram", shirt, "black", ORIGIN)).toBeNull();
    expect(channelLink("tiktok", shirt, "black", ORIGIN)).toBeNull();
  });

  it("the SMS / email line, in the brand's voice: no price, no emoji", () => {
    expect(shareMessage(shirt, "white")).toBe(`“${shirt.title}”, a one-ink tee from MONO.`);
    expect(shareMessage(shirt, "white", "x")).toBe(`Made on MONO: “${shirt.title}”, a one-ink tee.`);
    expect(shareMessage(shirt, "black")).not.toMatch(/\$|\p{Extended_Pictographic}/u);
  });

  it("gives downloads a clean file name", () => {
    expect(shareFileName(shirt, "white", "story")).toMatch(/^mono-[a-z0-9-]+-white-story\.png$/);
  });
});
