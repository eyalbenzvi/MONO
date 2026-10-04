/**
 * The short tag a shared link carries after its # instead of UTM parameters (the link itself is a short
 * TinyURL, data/share/short.json): one letter for the channel, then "-b" or "-w" when the tee was shared
 * in a colour other than the design's own ("#w", "#t-w"). The fragment survives the short link's
 * redirect, never reaches a server or a chat app's link preview, and is read on landing (the product
 * page's colour and "Shared with you" line, analytics' landing source).
 */
export type TagChannel = "native" | "whatsapp" | "instagram" | "facebook" | "tiktok" | "telegram" | "x" | "email" | "sms" | "copy" | "download";

const CODE: Record<TagChannel, string> = { native: "n", whatsapp: "w", instagram: "i", facebook: "f", tiktok: "k", telegram: "t", x: "x", email: "e", sms: "s", copy: "c", download: "d" };
const BY_CODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])) as Record<string, TagChannel>;

export function encodeShareTag(channel: TagChannel, color?: "black" | "white") {
  return `#${CODE[channel]}${color ? `-${color[0]}` : ""}`;
}

export function decodeShareTag(hash: string): { ref: TagChannel | null; color: "black" | "white" | null } {
  const m = /^#?([a-z])(?:-([bw]))?$/.exec(hash);
  if (!m || !BY_CODE[m[1]]) return { ref: null, color: null };
  return { ref: BY_CODE[m[1]], color: m[2] === "b" ? "black" : m[2] === "w" ? "white" : null };
}
