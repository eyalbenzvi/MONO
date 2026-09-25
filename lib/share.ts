/**
 * Sharing a tee: the product link (in the chosen colourway, tagged with the
 * channel it went out on), the message that goes with it, and the direct
 * share links for platforms that have a web intent.
 *
 * Instagram and TikTok have no web share intent: they're reached through the
 * device share sheet with an image file (see lib/shareImage), or by saving the
 * image and posting it from the app.
 */
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

export type ShareChannel = "native" | "whatsapp" | "instagram" | "facebook" | "tiktok" | "telegram" | "x" | "email" | "sms" | "copy" | "download";

/** Channels a shared link can say it came from (?ref=). */
export const REF_CHANNELS: readonly ShareChannel[] = ["native", "whatsapp", "instagram", "facebook", "tiktok", "telegram", "x", "email", "sms", "copy", "download"];

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Public site root (origin + base path), e.g. https://eyalbenzvi.github.io/MONO */
export function siteRoot(origin?: string) {
  const o = origin ?? (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "");
  return `${o.replace(/\/$/, "")}${BASE_PATH}`;
}

/** Link to the product page, opening in `color`, tagged with the channel. */
export function productShareUrl(shirt: ShirtProduct, color: BaseColor, ref: ShareChannel, origin?: string) {
  const q = new URLSearchParams();
  if (color !== shirt.baseColor) q.set("c", color);
  q.set("ref", ref);
  return `${siteRoot(origin)}/shop/${shirt.id}/?${q.toString()}`;
}

export function shareTitle(shirt: ShirtProduct) {
  return `${shirt.title} — MONO`;
}

/** The message sent with the link (WhatsApp, SMS, X, Telegram, native share). */
export function shareMessage(shirt: ShirtProduct, color: BaseColor) {
  return `Found this tee on MONO 👀 “${shirt.title}” — ${CATEGORY_LABELS[shirt.category]}, ${COLOR_LABELS[color].toLowerCase()} tee, ${formatPrice(shirt.price)}.`;
}

/** Web share intents. Each opens in a new tab / the app when installed. */
export function channelLink(channel: ShareChannel, shirt: ShirtProduct, color: BaseColor, origin?: string): string | null {
  const url = productShareUrl(shirt, color, channel, origin);
  const msg = shareMessage(shirt, color);
  const enc = encodeURIComponent;
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${enc(`${msg}\n${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case "telegram":
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(msg)}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${enc(msg)}&url=${enc(url)}`;
    case "email":
      return `mailto:?subject=${enc(shareTitle(shirt))}&body=${enc(`${msg}\n\n${url}`)}`;
    case "sms":
      return `sms:?&body=${enc(`${msg} ${url}`)}`;
    default:
      return null;
  }
}

/** Reads ?c= and ?ref= from a product page URL (for the recipient's landing). */
export function parseShareParams(search: string): { color: BaseColor | null; ref: ShareChannel | null } {
  const q = new URLSearchParams(search);
  const c = q.get("c");
  const r = q.get("ref") as ShareChannel | null;
  return {
    color: c === "black" || c === "white" ? c : null,
    ref: r && REF_CHANNELS.includes(r) ? r : null,
  };
}

/** Safe file name for a downloaded share image. */
export const shareFileName = (shirt: ShirtProduct, color: BaseColor, format: "story" | "square") =>
  `mono-${shirt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${color}-${format}.png`;
