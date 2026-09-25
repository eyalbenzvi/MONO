# MONO — monochrome tee discovery

"Tinder for T-shirts": swipe black or white tees with rectangular monochrome prints. A vector recommendation engine learns your taste in real time, then opens a shop ranked for you.

## Catalog: 2,800 generated shirts in 14 categories

The catalog is fully offline and procedural. `scripts/generateCatalog.ts` (seeded, deterministic) writes:

- `public/prints/print_1.svg` … `print_2800.svg`: 3:4 single-ink SVG prints (~7 KB each)
- `data/shirts.json`: the catalog the app imports (`lib/catalog.ts`)

```bash
npm run generate       # rebuilds both, byte-identical on every run
npm run audit:prints   # renders every print in Chromium and flags text that
                       # overflows, overlaps, crosses a rule or is squeezed
```

Generator modules: `scripts/gen/core.ts` (randomness, geometry, contracts) · `legacy.ts` (ids 1–1000, unchanged) · `expansion.ts` (ids 1001–2000) · `set3/` (ids 2001–2800: `ascii.ts`, `caricature.ts`, `famousart.ts`, `iconic.ts`, `landmarks.ts`) · `art.ts` (objects, icons, pixel sprites, 5×7 pixel font, halftone and hatch tones, text fitting) · `metrics.ts` (measured glyph widths: all text is sized from real per-character advances of the widest fallback font, so it fits on every device) · `copy.ts` / `copy3.ts` (all captions: original, no brands or real people).

| Category | Algorithms |
| --- | --- |
| Architectural | facade grid · perspective corridor · skyline · cantilevered slabs |
| Geometric | primary forms · scattered primitives · concentric polygons · Truchet tiling |
| Typography | heavy word · survey coordinates · repeated word · manifesto columns |
| Halftone | radial burst · ordered gradient · dot-matrix shapes · stippled grain |
| Line & Wave | pulsar ridges · sine moiré · topographic contours · gestural line |
| **Scenes** | halftone mountains · moon, planet and eclipse · striped-sun seascape · pine forest and desert dunes |
| **Slogans** | Swiss poster · faux warning sign · joke receipt · serif quote with a questionable attribution |
| **Pixel & Retro** | 8-bit sprites · arcade screen in a hand-built pixel font · pixel sunset · terminal session and ASCII-shaded sphere |
| **Badges** | round club badge (text on a circle) · heraldic crest with a Latin-ish motto · perforated stamp · ticket and product label |
| **Objects** | line icon plus caption · linocut woodcut · "find the odd one out" grid · technical diagram with honest labels |
| **ASCII Art** | giant banners typed from characters · ray-marched 3D solids shaded with a character ramp · hand-typed ASCII pieces · ASCII landscapes |
| **Caricatures** | a procedural face engine with exaggerated features, as portrait · WANTED poster · mugshot · bobblehead. Original archetypes only ("The Barista", "The Overthinker"), never real people |
| **Famous Art** | homages to public-domain works, drawn from scratch: Hokusai's wave · Van Gogh's starry night · Mondrian, Malevich, Kandinsky, Klimt · Munch, Leonardo, Vermeer. Each hangs with a museum label |
| **Iconic Images** | world landmarks drawn from scratch · vintage travel posters · space age (astronaut, footprint, earthrise, launch) · universal motifs with captions. No photos, logos or trademarks |

Pictures are drawn as illustrations with halftone and hatch patterns, never grey fills, so every print stays strictly two-colour. That is what makes the black/white colourway swap an exact inversion.

Feature vectors have 16 dimensions. The second set added **pictorial, wit, retro and nature**; the third added **figurative and classic**. Older designs get deterministic values for new dimensions, and stored user profiles are extended with neutral 0.5 rather than reset. The taste test picks one design from each of ten different categories. Tees are 70% black / 30% white in each set. About 12% of the abstract, slogan, pixel, object and ASCII prints are knocked out of a solid ink block.

**Design families (variations).** Many generated prints are near-identical: same algorithm, close parameters. The generator gives every design a *visual signature* built from the parameters the eye actually notices: algorithm, word, shape, polarity and knockout as categories, plus normalised continuous values such as vanishing point, grid size or fill. It then groups designs with deterministic leader clustering (`FAMILY_THRESHOLD`) into 1,101 families. For caption designs the text itself is part of the signature. Each shirt carries `family` and `variant` in `data/shirts.json`. At runtime (`lib/catalog.ts`, `lib/deck.ts`):
- **Discover never shows two designs of one family in a run.** Seeing one (swipe, save or dealt card) excludes its siblings. It also avoids repeating an algorithm within 5 cards. The taste test uses 10 different families, and its progress counts families.
- **Shop:** one card per family (the best-ranked one) with a "+N variations" badge. In "For you" order, neighbours never share an algorithm. This is display-only pacing; scores are unchanged.
- **Product page:** a *Variations* strip with the whole family (switching keeps your tee colour, and "back" still returns to the shop). *Similar prints* shows related but different designs, one per algorithm.

**Every design comes in both colourways.** `baseColor` is the original the print was drawn for; the buyer can pick the other tee colour on the product page, the Discover card's details face, the Saved drawer or in the bag. Because prints are strictly two-colour, the reverse colourway is an exact CSS inversion of the same SVG (no extra files); the SKU's colour letter flips (`MN-GEO-B-0001` ↔ `MN-GEO-W-0001`). Bag lines are keyed by design + size + colour. In the shop, the colour switch shows the whole catalog in black or white tees.

Feature vectors are computed from each design's real parameters (line/cell counts, fill ratio, stroke weight, dot coverage, framing, knockout) rather than assigned. Tees are exactly 70% black / 30% white. Every print is single-ink: white ink on black tees, black ink on white. The mockup blends the print's ground into the fabric (`screen` / `multiply`) so only the ink shows. About 12% of prints are knocked out of a solid ink block.

## Flow

1. **Discover / calibration** (`/`): the first 10 cards are the most mutually different prints. Finishing them shows the "taste profile ready" screen with your top traits and top picks.
2. **Shop** (`/shop`): the full catalog ranked by match, with category chips (10), tee-colour view and sort, rendered 24 at a time as you scroll. ♥ saves a tee *and* trains the vector.
3. **Product** (`/shop/[id]`): on-tee and flat print views, why it matches you, size guide, add to bag, similar prints. All 2,800 pages are statically generated.
4. **Bag & checkout** (`/cart`): change size/quantity, shipping (free over the `FREE_SHIPPING_THRESHOLD` in `lib/cart.ts`), a delivery form and an order confirmation. It is a demo: no payment details are collected and nothing ships.

Discover keeps training after calibration (80% best match / 20% explore).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run og         # link-preview images (optional locally; built in CI)
npm run typecheck && npm run lint && npm run build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds a static export (`out/`) and publishes it on every push. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The site is served at `https://<user>.github.io/<repo>/`.

## Sharing

Every tee can be shared from the product page, the Discover card (front and details), and the Saved list. The **share sheet** (`components/ShareSheet.tsx`) works like this:

- **Share image, drawn in the browser** (`lib/shareImage.ts`): the tee in the chosen colour with its print, name, price and site, as a *Story* (1080×1920) or *Post* (1080×1080) PNG. The print SVG is recoloured by swapping its two inks, so it works in every browser. The image is rendered when the sheet opens, so the file is ready inside the tap's user activation.
- **Share…**: the device share sheet (Web Share API) with the image, message and link. On phones this reaches WhatsApp, Instagram (story, feed or DM), TikTok, Facebook, Messages and anything else installed.
- **Instagram / TikTok**: they have no web share intent. Where file sharing is available they open the share sheet with the image. Otherwise the image is saved, the link copied, and short how-to steps are shown.
- **WhatsApp, Facebook, Telegram, X, Email, SMS**: direct share intents (`lib/share.ts`), plus Copy link and Save image.
- **Links** open the product page in the shared colour and are tagged with the channel: `/shop/mono-2002/?c=white&ref=whatsapp`. The recipient gets a "A friend shared this tee with you" banner inviting them to the taste test, and the tags are then removed from the address bar.
- **Link previews**: every product page has Open Graph / Twitter tags pointing at a 1200×630 PNG (`npm run og`, `scripts/generateOgImages.ts`, rendered with resvg and palette-compressed to about 28 KB). The Pages workflow renders them before the build, in batches of short-lived workers (resvg's native memory isn't reclaimed by the JS garbage collector). They aren't committed (`public/og` is git-ignored).

## Controls

| Gesture | Button | Key | Action |
| --- | --- | --- | --- |
| Swipe right | ♥ | → | Like |
| Swipe left | ✕ | ← | Dislike |
| Swipe up / tap | ⓘ | ↑ / Space | Flip to details (Esc / Back to return) |
| — | ↺ | Z / Backspace | Undo the last swipe |

First run: a one-line goal, a hint wiggle and a gesture legend; 10 progress pips with "Halfway there" / "Last one!"; after every swipe a chip shows what the engine just learned (`+ Geometric`, `− Typography`). Match % stays hidden until the taste test is done. Rapid taps queue (nothing is dropped), likes fly a heart to Saved, and one-level undo rewinds the vector exactly.

The **Algo debug** panel is hidden for normal users: open the site with `?debug=1` (or tap the logo 5 times). It shows: live user vector with per-swipe deltas, the current card's cosine / centered cosine / match score, per-feature dot-product share, recent swipes, and a reset.

## How the engine works (`lib/recommendation.ts`)

- **Vectors:** each shirt has 10 features in `[0, 1]` (`types/shirt.ts`). The user vector starts at `0.5` on every axis.
- **Learning:** like → `v + 0.15·(f − v)`, dislike → `v − 0.08·(f − v)`, clamped to `[0, 1]`.
- **Cold start:** the first 10 cards come from `getCalibrationQueue`, which uses greedy farthest-point sampling on centered cosine to pick the most mutually orthogonal prints.
- **After calibration:** `getNextCard` rolls 80% greedy (highest match) / 20% explore (the print most orthogonal to the current profile).
- **Match score:** `cosineSimilarity` returns plain cosine as 0–100%. Plain cosine between positive vectors bunches up in the 75–95% band, so the badge uses `matchScore`, which blends in the cosine of the vectors centered on 0.5 as the profile moves away from neutral. Both numbers are shown in the debug panel.
- **Real-time deck:** after every swipe, the card already showing underneath stays put and everything behind it is re-ranked with the new vector.

State lives in three Zustand stores:

- `store/tasteStore.ts` (persisted as `mono-taste`): saved and passed designs, the taste vector, the last 500 swipe events, every design seen (so the deck never repeats a family), the deck, undo info and onboarding flags.
- `store/cartStore.ts` (persisted as `mono-cart`): the bag, the last order, and size / colour picks.
- `store/useUiStore.ts` (memory only): card flip, queued swipes, undo animation, toast, zoom, shop filters, header, debug.

State read back from `localStorage` goes through a guard (`sanitizeTaste` / `sanitizeCart`): malformed or unknown entries fall back to defaults. Sessions from the old single store (`mono-session-v1`, v3–v6) are migrated once into the split stores (`store/legacySession.ts`). Other tabs' writes are picked up through the `storage` event. Product events go to `window.dataLayer` via `lib/analytics.ts` (no third-party script; a tag manager can forward them).

## Brand

`components/MonoLogo.tsx` is the brand mark (black square, white "MONO", sizes `sm` / `md` / `lg`); `app/icon.svg` is the favicon.
