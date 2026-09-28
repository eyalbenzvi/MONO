/**
 * An upload's first title (brief 6.6): for words, the words; for a file,
 * its name cleaned of the extension, digits and what cameras, phones and
 * apps put there (IMG_, DSC, PXL_, "Screenshot … at …", "WhatsApp Image"),
 * separators to spaces, each word capitalised. Nothing left, or under three
 * characters: Your Photograph or Your Drawing. At most 40 characters, cut
 * at a word. The page lets the customer edit it (and checks it against the
 * lexicon there).
 */
import type { UploadClass } from "./convert";

export const TITLE_MIN = 3;
export const TITLE_MAX = 40;

/**
 * Leading names that only say which device or app made the file: camera
 * prefixes wherever they are followed by a separator or number, plain words
 * ("Photo", "Scan") only when a number follows them ("Photo 2024-01-01",
 * not "Photo Booth").
 */
const PREFIX = /^(?:(?:img|dsc[nf]?|dcim|pxl|mvimg|fb_img|dji|gopr)(?=[\s_\-.\d]|$)|(?:screen\s*shot|screenshot|screen\s*recording|whatsapp\s*image|signal|telegram|image|photo|pic|scan|untitled|capture)(?=[\s_\-.]*(?:\d|$)))/i;
/** Words a phone or an editor adds at the end ("IMG-20230101-WA0001", "PXL_….PORTRAIT", "drawing copy"). */
const SUFFIX = /(?:^|\s)(?:wa|mp|portrait|burst|cover|hdr|edited|edit|copy|export|scaled)$/i;

const cap = (w: string) => w.charAt(0).toLocaleUpperCase("en-GB") + w.slice(1);

/** Cut at the last word that fits. */
function clip(s: string): string {
  if (s.length <= TITLE_MAX) return s;
  const cut = s.slice(0, TITLE_MAX + 1);
  const at = cut.lastIndexOf(" ");
  return (at >= TITLE_MIN ? cut.slice(0, at) : s.slice(0, TITLE_MAX)).trim();
}

export function cleanTitle(name: string, cls: UploadClass): string {
  if (cls === "words") return clip(name.replace(/\s+/g, " ").trim());
  let s = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const screen = /^(?:screen\s*shot|screenshot|whatsapp\s*image)/i.test(s);
  // Strip any run of device prefixes ("IMG_PXL_…").
  for (let i = 0; i < 3; i++) s = s.replace(PREFIX, "").replace(/^[\s_\-.]+/, "");
  // "Screenshot 2024-05-01 at 10.22.33 AM": the date and the time go, and the words round them.
  if (screen) s = s.replace(/\bat\b/gi, " ").replace(/\b[ap]\.?m\.?\b/gi, " ");
  // camelCase and ALLCAPS read as words; a version mark ("V2") goes with the digits.
  s = s
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/\bv\d+\b/gi, " ")
    .replace(/[\d]+/g, " ")
    .replace(/[_\-.+~()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  while (SUFFIX.test(s)) s = s.replace(SUFFIX, "").trim();
  const words = s.split(" ").filter((w) => /\p{L}/u.test(w));
  const title = clip(words.map((w) => cap(w === w.toUpperCase() && w.length > 1 ? w.toLowerCase() : w)).join(" "));
  return title.length >= TITLE_MIN ? title : cls === "photo" ? "Your Photograph" : "Your Drawing";
}
