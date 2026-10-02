/**
 * The Discover card a visit opens on, on screen before any script runs.
 *
 * Discover's deck lives on the device, so the card used to wait for the
 * scripts, the catalogue index, the saved taste and the deck before its
 * picture was even asked for: seconds of an empty frame on a phone, and every
 * catalogue change (new scripts, a new index, new pictures) brought it back.
 * Now:
 * - a first visit's deck opens on the taste test's first design
 *   (CALIBRATION_IDS[0], fixed by the build): its card is in the served HTML,
 *   picture and all (DiscoverPage's CardSkeleton);
 * - a returning visit opens on the card its deck had on top: the app keeps
 *   that card's picture under NEXT_CARD_KEY, a small script in the page
 *   (firstCardScript) asks for it with the HTML and hides the first-visit
 *   card so a different design never flashes first, and another right after
 *   the card (swapCardScript) puts the kept picture in it (its name stays
 *   hidden until the deck is read: React keeps attributes it didn't write, but
 *   a changed text would make it redraw the page).
 */
import { mockupImage, SIZES } from "@/lib/images";
import { teeColor, type ShirtProduct } from "@/types/shirt";

export const NEXT_CARD_KEY = "mono-next-card";
/** Set on <html> when this visit opens on another card than the served one. */
export const OTHER_CARD_ATTR = "data-card-other";
/** Set on the served card once it shows the returning visit's own picture. */
export const SWAPPED_ATTR = "data-swapped";

interface NextCard {
  id: string;
  srcset: string;
}

/** Kept whenever the deck's top card changes (and removed when the deck is empty). */
export function rememberTopCard(shirt: ShirtProduct | null) {
  try {
    if (!shirt) return localStorage.removeItem(NEXT_CARD_KEY);
    const card: NextCard = { id: shirt.id, srcset: mockupImage(shirt, teeColor(shirt)).srcSet };
    const json = JSON.stringify(card);
    if (localStorage.getItem(NEXT_CARD_KEY) !== json) localStorage.setItem(NEXT_CARD_KEY, json);
  } catch {
    /* storage unavailable: the card loads as it used to */
  }
}

/**
 * Runs in the page as it's parsed, before the card's markup (app/page): a
 * returning visit preloads its own top card and hides the served one. Saved
 * state with no card kept yet (from before this) hides it too, without a preload.
 */
export function firstCardScript(servedId: string): string {
  const served = JSON.stringify(servedId);
  const sizes = JSON.stringify(SIZES.card);
  return `(function(){try{var d=document.documentElement,h=JSON.parse(localStorage.getItem(${JSON.stringify(NEXT_CARD_KEY)})||"null");if(h?h.id===${served}:!localStorage.getItem("mono-taste"))return;d.setAttribute(${JSON.stringify(OTHER_CARD_ATTR)},"");if(!h||!h.srcset)return;var l=document.createElement("link");l.setAttribute("rel","preload");l.setAttribute("as","image");l.setAttribute("imagesrcset",h.srcset);l.setAttribute("imagesizes",${sizes});l.setAttribute("fetchpriority","high");document.head.appendChild(l)}catch(e){}})();`;
}

/** Runs right after the served card's markup (DiscoverPage's CardSkeleton): it shows the kept card's picture. */
export function swapCardScript(): string {
  return `(function(){try{if(!document.documentElement.hasAttribute(${JSON.stringify(OTHER_CARD_ATTR)}))return;var h=JSON.parse(localStorage.getItem(${JSON.stringify(NEXT_CARD_KEY)})||"null"),c=document.querySelector("[data-first-card]"),i=c&&c.querySelector("img[data-mockup]");if(!h||!h.srcset||!i)return;i.setAttribute("srcset",h.srcset);i.setAttribute("src",h.srcset.split(" ")[0]);c.setAttribute(${JSON.stringify(SWAPPED_ATTR)},"")}catch(e){}})();`;
}
