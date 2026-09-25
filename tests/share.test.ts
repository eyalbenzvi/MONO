import { describe, expect, it } from "vitest";
import { getShirtById } from "@/lib/catalog";
import { channelLink, parseShareParams, productShareUrl, shareFileName, shareMessage } from "@/lib/share";

const ORIGIN = "https://example.github.io";
const shirt = getShirtById("mono-2002")!; // a black tee

describe("share links", () => {
  it("links to the product page, tagged with the channel", () => {
    expect(productShareUrl(shirt, shirt.baseColor, "whatsapp", ORIGIN)).toBe(`${ORIGIN}/shop/mono-2002/?ref=whatsapp`);
  });

  it("carries the colourway only when it differs from the original", () => {
    const url = productShareUrl(shirt, "white", "copy", ORIGIN);
    expect(url).toContain("c=white");
    expect(parseShareParams(new URL(url).search)).toEqual({ color: "white", ref: "copy" });
  });

  it("ignores unknown or malformed params on landing", () => {
    expect(parseShareParams("?c=purple&ref=spam")).toEqual({ color: null, ref: null });
    expect(parseShareParams("")).toEqual({ color: null, ref: null });
  });

  it("builds platform intents with the encoded message and link", () => {
    const wa = channelLink("whatsapp", shirt, "black", ORIGIN)!;
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(wa.split("text=")[1]);
    expect(text).toContain(shirt.title);
    expect(text).toContain(`${ORIGIN}/shop/mono-2002/?ref=whatsapp`);

    const fb = channelLink("facebook", shirt, "black", ORIGIN)!;
    expect(decodeURIComponent(fb.split("u=")[1])).toBe(`${ORIGIN}/shop/mono-2002/?ref=facebook`);

    expect(channelLink("email", shirt, "black", ORIGIN)!.startsWith("mailto:?subject=")).toBe(true);
    expect(channelLink("sms", shirt, "black", ORIGIN)!.startsWith("sms:")).toBe(true);
    expect(channelLink("telegram", shirt, "black", ORIGIN)).toContain("t.me/share/url?url=");
    expect(channelLink("x", shirt, "black", ORIGIN)).toContain("twitter.com/intent/tweet");
  });

  it("has no web intent for Instagram / TikTok (they go through the share sheet with an image)", () => {
    expect(channelLink("instagram", shirt, "black", ORIGIN)).toBeNull();
    expect(channelLink("tiktok", shirt, "black", ORIGIN)).toBeNull();
  });

  it("describes the tee in the chosen colour", () => {
    expect(shareMessage(shirt, "white")).toContain("white tee");
    expect(shareMessage(shirt, "white")).toContain(`$${shirt.price}`);
  });

  it("gives downloads a clean file name", () => {
    expect(shareFileName(shirt, "white", "story")).toMatch(/^mono-[a-z0-9-]+-white-story\.png$/);
  });
});
