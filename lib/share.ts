/**
 * Sharing a tee: the product link (in the chosen colourway, tagged with the
 * channel it went out on), the message that goes with it, and the direct
 * share links for platforms that have a web intent.
 *
 * Instagram and TikTok have no web share intent: they're reached through the
 * device share sheet with an image file (see lib/shareImage), or by saving the
 * image and posting it from the app.
 */
import type { BaseColor, ShirtProduct } from "@/types/shirt";
import { productHref } from "@/lib/catalog";
import { decodeShareTag, encodeShareTag } from "@/lib/shareTag";

export type ShareChannel = "native" | "whatsapp" | "instagram" | "facebook" | "tiktok" | "telegram" | "x" | "email" | "sms" | "copy" | "download";

/** Channels a shared link can say it came from (?ref=). */
export const REF_CHANNELS: readonly ShareChannel[] = ["native", "whatsapp", "instagram", "facebook", "tiktok", "telegram", "x", "email", "sms", "copy", "download"];

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Public site root (origin + base path), e.g. https://eyalbenzvi.github.io/MONO */
export function siteRoot(origin?: string) {
  const o = origin ?? (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "");
  return `${o.replace(/\/$/, "")}${BASE_PATH}`;
}

/** Query parameters a shared link carries (removed from the address bar on landing). */
export const SHARE_PARAMS = ["c", "ref", "utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * The link a share sends. A catalogue design: its short link (TinyURL, a plain 301 to the product page,
 * so the chat app's preview is the page's own) with the channel, and the colour when it isn't the
 * design's own, in a short # tag (lib/shareTag): "tinyurl.com/28uhvx3z#w". A made-for-you print, or a
 * design without a short link yet: the product page itself, tagged with standard UTM parameters
 * (utm_source = channel, utm_medium = share, utm_campaign = tee_share).
 */
/**
 * `make` is a made-for-you print's spec (lib/custom encodeMake): the link opens that print. `short`: the
 * design's short link, from its details (data/share/short.json rides in the details shards, not the scripts).
 */
export function productShareUrl(shirt: ShirtProduct, color: BaseColor, ref: ShareChannel, origin?: string, make?: string, short?: string) {
  if (short && !make) return `${short}${encodeShareTag(ref, color !== shirt.baseColor ? color : undefined)}`;
  const q = new URLSearchParams();
  if (make) q.set("make", make);
  if (color !== shirt.baseColor) q.set("c", color);
  q.set("utm_source", ref);
  q.set("utm_medium", "share");
  q.set("utm_campaign", "tee_share");
  const href = productHref(shirt.id);
  return `${siteRoot(origin)}${href}${href.includes("?") ? "&" : "?"}${q.toString()}`;
}
export function shareTitle(shirt: ShirtProduct) {
  return `${shirt.title} · MONO`;
}
/**
 * The words sent with the link, only where no link preview shows reliably (SMS, email): the chat apps
 * (WhatsApp, Telegram, X, the device share sheet) send the link alone, because their preview card
 * already shows the picture, the name, the category, the price and the way in, and the sharer's own
 * words beat ours. A made-for-you print says so.
 */
export function shareMessage(shirt: ShirtProduct, _color: BaseColor, make?: string) {
  if (make) return `Made on MONO: “${shirt.title}”, a one-ink tee.`;
  return `“${shirt.title}”, a one-ink tee from MONO.`;
}
/** Web share intents. Each opens in a new tab / the app when installed. */
export function channelLink(channel: ShareChannel, shirt: ShirtProduct, color: BaseColor, origin?: string, make?: string, short?: string): string | null {
  const url = productShareUrl(shirt, color, channel, origin, make, short);
  const msg = shareMessage(shirt, color, make);
  const enc = encodeURIComponent;
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${enc(url)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case "telegram":
      return `https://t.me/share/url?url=${enc(url)}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${enc(url)}`;
    case "email":
      return `mailto:?subject=${enc(shareTitle(shirt))}&body=${enc(`${msg}\n\n${url}`)}`;
    case "sms":
      return `sms:?&body=${enc(`${msg}\n${url}`)}`;
    default:
      return null;
  }
}

/** Reads ?c= and the channel (utm_source, or ?ref= on older links, or a short link's # tag) from a product page URL. */
export function parseShareParams(search: string, hash = ""): { color: BaseColor | null; ref: ShareChannel | null; tagged: boolean } {
  const q = new URLSearchParams(search);
  const c = q.get("c");
  const r = (q.get("utm_source") ?? q.get("ref")) as ShareChannel | null;
  // A short link's # tag (lib/shareTag), when the query says nothing.
  const tag = decodeShareTag(hash);
  return {
    color: c === "black" || c === "white" ? c : tag.color,
    ref: r && REF_CHANNELS.includes(r) ? r : tag.ref,
    tagged: !!tag.ref,
  };
}

/** Safe file name for a downloaded share image. */
export const shareFileName = (shirt: ShirtProduct, color: BaseColor, format: "story" | "square") =>
  `mono-${shirt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${color}-${format}.png`;
