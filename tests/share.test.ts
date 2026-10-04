import { describe, expect, it } from "vitest";
import { getShirtById } from "@/lib/catalog";
import catalog from "@/data/shirts.json";
import shortLinks from "@/data/share/short.json";
import { getDetails } from "@/lib/catalogServer";
import { channelLink, parseShareParams, productShareUrl, shareFileName, shareMessage } from "@/lib/share";
import { decodeShareTag, encodeShareTag } from "@/lib/shareTag";
import { B10 } from "./fixtures";

const ORIGIN = "https://example.github.io";
const shirt = getShirtById(B10)!; // a black tee
const shortLink = (id: string) => (shortLinks as Record<string, string>)[id];
const S = shortLink(B10);

describe("share links", () => {
  it("a catalogue design shares its short link, the channel in a # tag; the long link only without one", () => {
    const short = shortLink(B10)!;
    expect(short).toMatch(/^https:\/\/tinyurl\.com\/[A-Za-z0-9]+$/);
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN, undefined, S)).toBe(`${short}#w`);
    // Every design in the shop has one.
    for (const s of catalog as { id: string }[]) expect(shortLink(s.id), s.id).toMatch(/^https:\/\/tinyurl\.com\//);
    // A made-for-you print keeps its own long link (its spec rides in the query); so does a design without a short link.
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN, "spec", S)).toContain("make=spec");
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN)).toBe(`${ORIGIN}/shop/${B10}/?utm_source=whatsapp&utm_medium=share&utm_campaign=tee_share`);
    // The short link reaches the share sheet through the design's details (not the scripts).
    expect(getDetails(B10)?.short).toBe(S);
  });

  it("carries the colourway only when it differs from the original, and reads it back on landing", () => {
    const url = productShareUrl(shirt, "white", "copy", ORIGIN, undefined, S);
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
    const wa = channelLink("whatsapp", shirt, "black", ORIGIN, undefined, S)!;
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1])).toBe(`${shortLink(B10)}#w`);
    expect(decodeURIComponent(channelLink("facebook", shirt, "black", ORIGIN, undefined, S)!.split("u=")[1])).toBe(`${shortLink(B10)}#f`);
    expect(channelLink("telegram", shirt, "black", ORIGIN, undefined, S)).toBe(`https://t.me/share/url?url=${encodeURIComponent(`${shortLink(B10)}#t`)}`);
    expect(channelLink("x", shirt, "black", ORIGIN, undefined, S)).toBe(`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${shortLink(B10)}#x`)}`);
    const sms = decodeURIComponent(channelLink("sms", shirt, "black", ORIGIN, undefined, S)!.split("body=")[1]);
    expect(sms).toBe(`“${shirt.title}”, a one-ink tee from MONO.\n${shortLink(B10)}#s`);
    expect(channelLink("email", shirt, "black", ORIGIN, undefined, S)!.startsWith("mailto:?subject=")).toBe(true);
  });

  it("has no web intent for Instagram / TikTok (they go through the share sheet with an image)", () => {
    expect(channelLink("instagram", shirt, "black", ORIGIN, undefined, S)).toBeNull();
    expect(channelLink("tiktok", shirt, "black", ORIGIN, undefined, S)).toBeNull();
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
