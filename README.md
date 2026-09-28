# MONO — monochrome tee discovery

"Tinder for T-shirts": swipe black or white tees with rectangular monochrome prints. A vector recommendation engine learns your taste in real time, then opens a shop ranked for you.

## Catalogue: 1,293 tees in 10 categories

The catalogue is offline and deterministic. `scripts/generateCatalog.ts` (seeded; two runs are byte-identical) builds every design it has ever made — so ids never move — then takes out what the reviews retired (with the reason, logged per run) and writes:

- `public/prints/print_<n>.svg`: the drawn prints, 3:4 single-ink SVG (minified; `scripts/gen/minify.ts`); `print_<n>.webp`: the photographs and archive works, each a true one-ink halftone (see "Photographs")
- `data/shirts.index.json`: the lean index the app bundles (`lib/catalog.ts`): id-derivable fields left out, stored by column, feature values one symbol each (~90 KB). Its head carries the feature keys (checked against `FEATURE_KEYS` on load — a stale index stops the app instead of decoding nonsense), the taste-test ids, the drop epoch, the shard size and every shard's content hash.
- `public/data/details-<k>.<hash>.json`: descriptions, subjects, real print sizes and precomputed "similar prints" (`shardSize` designs per shard), fetched on demand (`lib/details.ts`); the hash in the name makes each file cacheable forever.
- `data/shirts.json`: the full catalogue, read at build time only (product page metadata and props via `lib/catalogServer.ts`, link-preview images)

```bash
npm run generate       # rebuilds all of it (and the published index), byte-identical on every run
npm run audit:prints   # renders every print in Chromium and flags text that overflows, overlaps,
                       # crosses a rule or is squeezed; then refuses any print that lands as a solid block
```

**The content overhaul (the brand book).** No print may land on the tee as a solid block of ink (`scripts/gen/quality.ts` `solidBlock`: a filled slab, a panel with shapes cut out of it, a frame of ink; refused at generation and by `audit:prints`). Parody homages, souvenir landmarks, clip art, pixel sunsets, scribbles, random words, dated stamps, 5- and 6-fold star rosettes, slivers and paper edges are gone; near-duplicates are cut to two per family and one per subject; photographs with people, brands, lettering or insignia were taken out or retitled generically (`data/curation/retired.json`, `titles.json`). Every raster print is a one-ink halftone. Titles name what the print shows. The shop's first 24 are a fixed, hand-pinned window (`data/curation/window.json`).

Generator modules: `scripts/gen/core.ts` (randomness, geometry, contracts) · `legacy.ts`, `expansion.ts`, `set3/` (the first sets, ids 1–2800, mostly retired) · `set5/` (ids 3401–3830: star charts, curves, plants by rule, ornament) · `set7/` (ids from 7001: designs made from real data) · `quality.ts` (the solid-block check and the quality score) · `retire.ts` (the reviews' removals) · `titles.ts` (titles that name what you see) · `categories.ts` (the shop's categories) · `describe.ts` (closing lines, each used at most 20 times).

| Category (SKU) | What's in it |
| --- | --- |
| **Photographs** (PHO) | animals, aircraft, engines and instruments (Smithsonian National Zoo, Air and Space Museum) and patent models, cut out and screened as one-ink halftones |
| **Botanical & Nature** (SPC) | botanical studies and Audubon plates from the archive; seed heads and plants grown by rule |
| **Maps & Sky** (MAP) | constellations on their real stars; the night sky over real places on real dates; moon phases, planets on a date, the analemma, daylight, Halley's orbit, Jupiter's moons |
| **Architecture** (ARC) | etched views of buildings and cities; arch constructions, brick bonds, trusses, Vignola's orders, the Modulor; façade and skyline drawings |
| **Engravings** (ETC) | etchings, engravings and woodcuts from the archive (Dürer, Piranesi, Whistler, Hollar, Haden, Meryon, Rembrandt among them) |
| **Brush & Woodblock** (BRU) | East Asian ink painting; Hokusai and Hiroshige woodblock prints |
| **Pattern** (PAT) | lace, ornament prints and katagami stencils; guilloche, star rosettes, khatam tiles, Truchet tiles |
| **Geometric** (SYS) | halftone and moiré studies, Lissajous and harmonograph curves, attractors; standard circuits, logic gates, instrument dials, slide-rule scales, the Smith chart, Platonic solids, the golden spiral |
| **Type** (TYP) | real data set in type: the Beaufort scale, the shipping forecast, spelling and Greek alphabets, Morse, the periodic table, computed digits of π, e, √2 and φ, SI units, and more |
| **ASCII & Code** (TRM) | ASCII art and the ASCII table, punched cards in IBM 029 code, ITA2 paper tape, seven segments, a dot-matrix alphabet, escape codes, signals, HTTP status codes |

### Photographs

The photographs (ids 2801–3400; patent models from the archive join them) are real photographs from **Smithsonian Open Access**, all released as **CC0**. Each design keeps where it came from: the photographer or museum credit and a link to its collection record, shown under the description on the product page ("Photo: … · Smithsonian Open Access, CC0 · Source record") and in `data/shirts.json` (`photo`).

- `scripts/photos/fetchPhotos.ts` (needs the network, run by hand; downloads cached in `node_modules/.cache/mono-photos`): `candidates` reads the museum metadata from the public bucket (`s3://smithsonian-open-access`) and keeps CC0 images of animals (National Zoo) and of aircraft, engines and instruments (Air and Space); `prep` makes each print from the full-resolution original — **the whole photograph, never cropped**, greyscale, levels stretched, fitted into the 28 × 37 cm print area (a wide aircraft stays whole and simply prints as a wide picture); an object shot against a plain studio backdrop is **cut out** (`scripts/photos/cutout.py`, the rembg `isnet-general-use` model) so it sits on the tee like the drawn prints; `sheet` writes numbered contact sheets; `select` takes the best 200 per category and writes `data/photos/photos.json` (credit, record, measures) and the originals `assets/masters/print_<n>.webp` (kept in git: the tone every halftone is made from). Then `scripts/photos/halftone.py` screens each original — photographs, patent models and archive scans — into a true one-ink halftone in `public/prints/print_<n>.webp` (AM round dot, 30 lpi at 45°, 1500 × 2000, alpha only 0 or 255), never touching the original: a photograph's dots are baked in the ink of its tee; strokes print solid, and only a dark mass wider than ~3.5 mm is capped at 80% dot coverage (no solid slab); `data/curation/halftone.json` records each print's mode, tee, the original's and the output's hashes and the recipe.
- `scripts/photos/curation.ts` is the hand review of those contact sheets: what was left out (people in the picture — a keeper's hand holding a frog counts —, busy museum halls, near-duplicates, text-heavy plates) and subject clean-up (the species rather than the zoo name of the animal, record typos, no personal names in titles).
- **Invert.** A drawn print is strictly two-tone, so the other tee colour swaps its two inks. A photograph inverted is a *negative* — so photographs are **never inverted**. Their halftone is baked in the ink of their one tee: white dots lay down the picture's lights on black, black dots its darks on white (`needsInvert()` in `lib/catalog.ts`, applied when the pictures are baked). The original colour is the tee that shows more of the picture (a light picture on black, a dark one on white).

**Pictures are baked at build time** (`scripts/images/bake.ts` → `public/img`, git-ignored; `npm run images`, run by `prebuild` and by `npm run og`; only designs whose print, photo or recipe changed are baked again). For every design in every colour it's sold in: the design on its model photo (`img/m/<n>-<colour>-<w>.webp` at 360/720/1080 px — the print shrunk once with a Lanczos filter, so a halftone averages into tone instead of aliasing into blocks, and laid on the fabric as it prints: black ink multiplied onto white, white ink screened onto black); the flat print (`img/p/…` at 480 px and the exact 1500 px halftone, or the vector file in that colourway); and a close-up of the print's area for zooming (`img/d/…`, 900 px). The page shows each as one plain `<img srcset sizes>` (`lib/images.ts`, `TeeMockup`, `PrintImage`): the browser picks the file, a pinch-zoomed page asks for a bigger one (`usePageZoom`), and a zoomed card lays the close-up over the print's area. Nothing is blended, inverted or resized on the page. The export ships only these (`postbuild` drops `prints/` and `models/`, their inputs). The share image and the link previews are drawn from the same pictures.
- Names are the subject ("Douglas DC-3", "Red Panda"); a second photograph of the same subject is its "Take 2" and joins the first as one design family (variations). All 600 dropped together, the week they were added.

**What each print shows.** `scripts/gen/subject.ts` reads a short subject ("Solar Eclipse", "Potted Cactus", "Great Wave Homage") from each design's own description. Page titles use it — `Northern Pines — Solar Eclipse Line-Art Tee | MONO` — and meta descriptions are the name, the subject, the design's own sentence, the tee and the price (unique for every design; tested). Objects, caricatures and iconic images take the subject as their name's noun ("Everyday Potted Cactus", "Local CEO") instead of filler nouns like "Relic" or "Thing".

**Print quality** (`scripts/gen/quality.ts`): every print is rendered small with resvg and scored 0–100 from its ink coverage, how much of the print it spans and how much detail it has. Prints under 35 (a lone small shape) are *weak*: never in the taste test, the default link preview or the top 96 of any shop order, nor in "picked for you" rows. The ink's bounding box gives each print's real size on the tee (Details on the product page, and the zoom's scale bar).

**Drops.** Every design carries an explicit drop date (weekly Mondays, 40 a drop). "New this week" is judged on the viewer's clock for seven days after it, and `.github/workflows/weekly-rebuild.yml` re-runs the Pages deploy every Monday.

Pictures are drawn as illustrations with halftone and hatch patterns, never grey fills, so every print stays strictly two-colour. That is what makes the black/white colourway swap an exact inversion.

Feature vectors have 17 dimensions. The second set added **pictorial, wit, retro and nature**; the third added **figurative and classic**; the photographs added **photographic** (0.95 on every photograph, 0 on every drawing — a photo lover and a halftone lover are different people). A photograph's other features come from the picture and its category: density and contrast from the picture itself (how much of the print it fills and its tonal range), nature for animals, industrial for engines, retro for the aircraft collection, minimal for an object on a bare tee. The taste test always includes at least one photograph (`getCalibrationQueue(…, mustInclude)`), so the new dimension is measured, not guessed. Stored profiles from before get "photographic" at neutral 0.5 (taste store v4 migration); a profile whose taste test was already finished stays finished, and the photographs in the new taste test are simply dealt next. Old `?taste=` links (32 characters) still open, the photo lean at neutral. Older designs get deterministic values for new dimensions, and stored user profiles are extended with neutral 0.5 rather than reset. The taste test picks one design from each of the ten categories, only prints in the top quarter for quality, a graphic first; taste store v5 keeps anyone who had already answered a whole test finished when its prints changed.

**Design families (variations).** Many generated prints are near-identical: same algorithm, close parameters. The generator gives every design a *visual signature* built from the parameters the eye actually notices: algorithm, word, shape and polarity as categories, plus normalised continuous values such as vanishing point, grid size or fill. It then groups designs with deterministic leader clustering (`FAMILY_THRESHOLD`) into families (the content overhaul left at most two designs in any). For caption designs the text itself is part of the signature. Each shirt carries `family` and `variant` in `data/shirts.json`. At runtime (`lib/catalog.ts`, `lib/deck.ts`):
- **Discover never shows two designs of one family in a run.** Seeing one (swipe, save or dealt card) excludes its siblings. It also avoids repeating an algorithm within 5 cards. The taste test uses 10 different families, and its progress counts families.
- **Shop:** one card per family (the best-ranked one) with a "+N variations" badge. In "For you" order, neighbours never share an algorithm. This is display-only pacing; scores are unchanged.
- **Product page:** a *Variations* strip with the whole family (switching keeps your tee colour, and "back" still returns to the shop). *Similar prints* shows related but different designs, one per algorithm.

**Every design comes in both colourways.** `baseColor` is the original the print was drawn for; the buyer can pick the other tee colour on the product page, the Discover card's details face, the Saved drawer or in the bag. Because prints are strictly two-colour, the reverse colourway is an exact CSS inversion of the same SVG (no extra files); the SKU's colour letter flips (`MN-GEO-B-0001` ↔ `MN-GEO-W-0001`). Bag lines are keyed by design + size + colour. In the shop, the colour switch shows the whole catalog in black or white tees.

Feature vectors are computed from each design's real parameters (line/cell counts, fill ratio, stroke weight, dot coverage, framing) rather than assigned. Tees are exactly 70% black / 30% white. Every print is single-ink: white ink on black tees, black ink on white. The mockup blends the print's ground into the fabric (`screen` / `multiply`) so only the ink shows.

## Flow

1. **Discover / calibration** (`/`): the first 10 cards are the most mutually different prints. Finishing them shows the "taste profile ready" screen with your top traits and top picks.
2. **Shop** (`/shop`): one sticky row of controls (the tee colour as the product page's two dots, search, and a filter icon for the categories), rendered 24 at a time as you scroll. There is no sort to choose. Before the taste test the default is "Our pick" (the generator's fixed editorial rank — print quality, archive credit, distinctiveness — not usage data; its first 24 are the shop window, the same for everyone). The top of the grid is diversified (`diversify` in `lib/catalog.ts`): never three of one category or tee colour in a row, no repeated algorithm, and a wildcard every 8th card (a taste probe, not labelled). Cards stay quiet: at most one tag — "Top pick" on the first card of your ranking, otherwise "New this week" — and no match badges (how well a tee matches, in words by percentile within the catalog, is on its product page: `lib/match.ts`, Top pick / Strong match / Good match). Quick add is a small "+" on touch screens and appears on hover with a mouse. ♥ saves a tee *and* trains the vector (once per design).
3. **Search** (in the shop's row; `/` opens it on a desktop): it searches each design's title, subject, description, artist, museum, scientific name and style, forgives typos ("lihgthouse" reads as lighthouse, and says so, with the words as typed one tap away) and finishes a word as you type; an id, SKU or catalogue number goes straight to its design. The grid is the result — one card per family, the best match standing for it — and a search never ends empty ("No exact match … Closest:"). Words can suggest a facet (an artist, an era, a look, how it's made), a chip you accept; the empty field offers prepared parameters (Look, Subject, Made, Era, Source, Tee; For me only once the taste is known; your last five searches, kept on this device). "More like this" on a product page orders the shop by closeness (features and the print's look). It runs offline on a static index built at build time (`scripts/tools/searchIndex.ts` → `public/data/search.<hash>.json`, ~73 KB gzipped; each print's visual measures cached in `data/search/visual.json`), loaded only when the shop is idle or search opens; nothing typed is sent anywhere. Facets, tables and look tags come from the data (catalogue percentiles, never fixed names), so the catalogue can change under it; `npm run search:index` prints soft warnings (unlabelled variants, unknown museum credits, lexicon words the catalogue lacks). The address carries it: `/shop/?q=…&f=kind:value&like=<id>`.
4. **Product** (`/shop/[id]`): on-tee and flat print views (always in that order, and the zoom opens in the one you were on, with a 10 cm scale bar), why it matches you, size guide, add to bag, similar prints. One tee picker, on the picture: black, white or **Both** — the pair ($90, `PAIR_PRICE`, shown against $96). With one colour already in the bag, Both only adds the other ("Complete the pair · +$42"); with both there it reads "In your bag ✓". Details (closed by default) give the print's real size. All 1,293 pages are statically generated. Size is remembered once chosen anywhere ("Add to bag · M" in one tap, and quick add on grid cards, the Discover details face after the taste test, Saved and the bag). After adding, the button reads "✓ Added", then "View bag". Every add confirms the same way: one row under the header (`components/shop/MiniBag.tsx`) — "Added · M", Undo, View bag — that leaves by itself.
5. **Liked tees** (`/liked/`, the heart in the header, with how many): every tee liked in Discover or hearted in the shop, as a gallery to buy from. Tap a picture to see it full size; "Select" picks a tee, and each pick gets its colour (black / white, where the design has both) and size. "ADD SELECTED TO BAG · X" puts them all in the bag and opens it (a pick without a size is pointed out first). The heart on each card takes a tee out of the likes (with Undo); "Remove from selection" just unpicks it. The picks live in memory; the likes are the taste store's.
6. **Bag & checkout** (`/cart`): each line with its picture, name, colour, size, quantity and price (all but the name changeable, or remove it), a free-shipping progress bar (free over `FREE_SHIPPING_THRESHOLD` in `lib/cart.ts`), the pair discount, "One more from your taste" (an empty bag shows "From your Saved" first), then Checkout: a delivery form, a payment step (where it goes, with Edit, and the total) and an order confirmation. It is a demo: no payment details are collected and nothing ships. The form validates each field when you leave it and takes you to the first problem on submit; it asks for country and postcode, and shows an "Arrives …" window from the delivery policy (`lib/delivery.ts`). An express-pay button appears only when `NEXT_PUBLIC_EXPRESS_PAY` names a provider. What was typed survives going back to the bag (kept in memory, never saved). After ordering: shipping in the summary, your next matches (never a family already bought or in the bag: `topPicks` in `lib/match.ts`, used by every "picked for you" row) and sharing what you bought. There are no promo codes and no email capture: this is a mockup with no backend.
7. **Coming back**: the taste-test screen names your taste (an archetype from your strongest traits, `lib/taste.ts`) and makes a 9:16 "My taste" card to share with a `/?taste=…` link; a friend who opens it takes the test and ends with "Compared with your friend: N% alike". "Your taste" in the strip is the one place for the rest — nothing else on screen but the heart, the bag and the strip: your trait bars, Share my taste, the Daily 5 (five new tees swiped a day after the taste test — the test itself and cards brought back by Undo don't count; a streak shows from its second day) and Reset. The profile's level is one word from how far it has moved from neutral (`tasteLevel` in `lib/taste.ts`: Sharpening → Focused → Dialled in), the same in the strip and in Your taste; a new level shows quietly as the word changing in the strip (reached levels are remembered, so an undo can't announce one again). Saved has quiet rows with one "+", a main "Add your top 3 · M · $144" (best matches, else the newest), "Add all" as a text link, and a share icon by the title ("Share my list": `/shop/?list=…`, shown on the recipient's shop). Weekly drops: "New this week" only for the seven days after a design's drop date (no invented urgency). "Most swiped right this week" renders only with real data from the API — without one, it isn't there.
8. **Privacy**: the saved "last order" keeps only its number, items and totals — never name, email or address (cart store v3 removes them from older saves). A Content-Security-Policy meta tag limits scripts, images and requests to the site itself (plus the API when configured).
9. **Backend hooks** (`lib/api.ts`): nothing is sent anywhere unless `NEXT_PUBLIC_API_URL` is set. Without it no UI that needs one is shown: no email capture (nothing is stored on the device either; an address older builds kept as `mono-email` is deleted on load), no referrals, no "most swiped". Store promises (exchanges, shipping time, fabric, returns, fit advice) live in `lib/store-policy.ts`, pending approval.

Discover keeps training after calibration (80% best match / 20% explore).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run og         # link-preview images (optional locally; built in CI)
npm run typecheck && npm run lint && npm run build   # prebuild publishes the index, postbuild writes JSON-LD + CSP
npm run smoke      # end-to-end smoke run against out/
npm run e2e        # Playwright suite (e2e/) against out/: phone + desktop projects
npm run sprites    # regenerate public/icons.svg (tests check it matches)
npm run images     # bake the pictures into public/img (before every build; unchanged ones skipped)
npm run search:index  # the search index (before every build; prints only new prints' measures)
```

## Deploy (GitHub Pages)

**Product pages and scale.** Every product page is pre-rendered by default (1,293 pages; see the numbers below). To keep the export small as the catalog grows, build with `NEXT_PUBLIC_PRERENDER_LIMIT=<N>`: only the top N designs of the editorial rank get a static page at `/shop/<id>/` and a link-preview image (`npm run og` follows the same rule); every other design opens through the client route `/shop/p/?id=<id>`, and an old link to its `/shop/<id>/` lands on the 404, whose one script sends it there (query and hash kept, `lib/notFound.ts`). All in-app links and share links go through `productHref()` in `lib/catalog.ts`. Beyond that, the next step is a server (or edge function) rendering product pages on demand.

**What a page carries.** The catalog index isn't in the JavaScript: `npm run build` first publishes it as `public/data/index.<hash>.json` (`scripts/tools/publishIndex.ts`); every page preloads it and `lib/catalog` fills in when it arrives, while React keeps the server HTML and hydrates once it has (`<CatalogGate>` in AppShell). First Load JS went from ~238 KB to ~182 KB on Discover (the index is ~54 KB gzipped, cached forever under its hash, and code changes no longer re-download it; there's no build timestamp in the bundle either). Icons come from one sprite (`public/icons.svg`, `<Icon name>` + `<use>`), each tee is one baked picture (see "Pictures are baked at build time"), and structured data is written after the build rather than rendered by React (so it isn't repeated in the page's React payload).

**Security.** Each page's Content-Security-Policy meta tag is written after the build, first in `<head>`, with the sha256 of that page's own inline scripts — no `'unsafe-inline'` for scripts (`lib/csp.ts`, `scripts/tools/postbuild.ts`; `e2e/r2-stage6.desktop.spec.ts` checks the main pages run without a violation).

**CI.** `.github/workflows/test.yml` runs the unit tests, types, lint, the build, the smoke run and the Playwright suite on every push to the deployed branches (the Pages workflow itself is unchanged). Tests take their numbers from `scripts/gen/constants.ts` rather than copying them.

**SEO under `/MONO`.** Every page states its canonical URL and Open Graph URL (`pageMeta` in `lib/seo.ts`); the home page carries Organization and WebSite JSON-LD, product pages a ProductGroup (colour × size variants with offers, shipping and return policy) and a breadcrumb; `og:type=product` and `product:price:*` are written after the build (`scripts/tools/postbuild.cjs`, which also fails the build if a pre-rendered product has no link-preview image). Pre-rendered HTML carries an H1 on the home page and the shop, a real "Show more" link (`/shop/?page=2`) and links to variations and similar prints on every product page. The robots.txt paths include the base path, but crawlers only read robots.txt at a host's root — under `github.io/MONO/` it has no effect until the site has its own domain; the sitemap is linked from every page instead. A CI build without `NEXT_PUBLIC_SITE_ORIGIN` fails (it would publish localhost URLs); locally it falls back to `http://localhost:3000`.

`.github/workflows/deploy-pages.yml` builds a static export (`out/`) and publishes it on every push. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The site is served at `https://<user>.github.io/<repo>/`.

## Sharing

Every tee can be shared from the product page, the Discover card (front and details), and the Saved list. The **share sheet** (`components/ShareSheet.tsx`) works like this:

- **Share image, drawn in the browser** (`lib/shareImage.ts`): the tee in the chosen colour with its print, name, price and site, as a *Story* (1080×1920) or *Post* (1080×1080) PNG. The print SVG is recoloured by swapping its two inks, so it works in every browser. The image is rendered when the sheet opens, so the file is ready inside the tap's user activation.
- **Share…**: the device share sheet (Web Share API) with the image, message and link. On phones this reaches WhatsApp, Instagram (story, feed or DM), TikTok, Facebook, Messages and anything else installed.
- **Instagram / TikTok**: they have no web share intent. Where file sharing is available they open the share sheet with the image. Otherwise the image is saved, the link copied, and short how-to steps are shown.
- **WhatsApp, Facebook, Telegram, X, Email, SMS**: direct share intents (`lib/share.ts`), plus Copy link and Save image.
- **Links** open the product page in the shared colour and are tagged with the channel: `/shop/mono-2002/?c=white&ref=whatsapp`. The recipient stays on the product with a "A friend shared this tee with you" banner; its one button, "Save & find more like it", saves the tee (so the taste starts from it) and then opens the taste test (or, after it, the shop). The tags are removed from the address bar. A friend's taste link (`/?taste=…`) opens Discover with "Your friend is The … — swipe 10 to see how alike you are".
- **Link previews**: every product page has Open Graph / Twitter tags pointing at a 1200×630 PNG (`npm run og`, `scripts/generateOgImages.ts`, rendered with resvg and palette-compressed to about 28 KB). The Pages workflow renders them before the build, in batches of short-lived workers (resvg's native memory isn't reclaimed by the JS garbage collector). They aren't committed (`public/og` is git-ignored).

## Controls

| Gesture | Button | Key | Action |
| --- | --- | --- | --- |
| Swipe right | ♥ | → | Like |
| Swipe left | ✕ | ← | Dislike |
| Swipe up / tap | ⓘ | ↑ / Space | Flip to details (Esc / ✕ to return) |
| Pinch | ⊕ on the card | — | Zoom into the print |
| — | ↺ | Z / Backspace | Undo the last swipe |

First run: a one-line goal (it fades after the first swipe; the strip keeps its height, so the card never moves), a hint wiggle (skipped with reduced motion) and a gesture legend that stays until the first swipe; swipe-up and pinch are named on its second line on touch screens (both are real gestures, so they're taught rather than removed). One progress counter, in the strip above the card ("3/10", the card on screen). Dragging past the commit point pops the LIKE / NOPE stamp and ticks the phone once. For the first 20 swipes a chip inside the card shows what the engine just learned ("More geometric", "Less minimal"). Match % stays hidden until the taste test is done. Rapid taps queue (nothing is dropped), likes fly a heart to Saved, and one-level undo rewinds the vector exactly. Phones held sideways get the buttons in a column beside the card. Keyboard users can tab to the card itself.

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

## Personalised prints ("Made for you", `/make/`)

Four tees of their own, each drawn in the browser from the customer's own inputs with the catalogue's code (`lib/custom`, shared with the generator: the computed designs come out of it byte for byte). A **Make** tab in the header, the shop's first card and a "Make your own →" link on the designs they're drawn like lead to them.

| Product | Page | Inputs | Drawn like |
| --- | --- | --- | --- |
| Your Night Sky | `/make/sky/` | a night, optional time, the place | the Night Sky designs |
| Your Moon | `/make/moon/` | a night, north or south | a new template: that night's moon in a hexagonal dot screen, phase and % lit |
| Your Planets | `/make/planets/` | a day (to 2050, the orbital elements' range) | the Planets designs, heavier, with each planet's last 30 days drawn bold |
| Your Year of Moons | `/make/year/` | a year, north or south | the Moon Phases designs |

- **Your words** (optional, up to 28 Latin-script characters) are the print's first line; the date drops to the line under them. The place starts from the visitor's time zone (its biggest city in the list; London when there's none), with a small "Change"; north or south follows it.
- **The page is the editor**: the picture is redrawn as you type (a canvas renderer of the templates' SVG subset, 55–64 ms at 4× CPU throttling), and a print that would fail the catalogue's own checks (solid-ink block, quality under 53) can't be bought. Every template is fuzzed over its whole range in `tests/custom.fuzz.test.ts`.
- **A spec** (`lib/custom/spec.ts`) is small, strict and versioned: `{ t, v: 1, p }`, validated field by field, dates real and in range. It travels only in the address (`?make=`, base64url of its canonical JSON) and in the bag line.
- **Price and policy** (`lib/store-policy.ts`, pending approval): the design's price plus `customPremium` ($10: $58), the pair $90 + 2 × $10. "Made for you: size exchanges only."
- **The bag** (cart store v5): a made-for-you line is keyed by design, size, colour and the spec's hash, priced by `unitPrice`, pictured with its own print, titled "Your Moon · 19 November 2021" with an Edit link back to it. The pair discount counts per print.
- **Places**: GeoNames cities of 200,000+ people plus capitals (3,185, ~71 KB gzipped) and the star data, published under content hashes and loaded only on a sky page (`scripts/tools/buildCities.ts`, `publishCustom.ts`). Places: GeoNames (CC BY 4.0); print font: DejaVu Sans Mono (subset WOFF2).
- **Sharing**: the share sheet's link carries the print and says so ("This link includes the date and place"); its image is the personalised tee.
- **Privacy**: the date, time, place, year and words never leave the device except in a link the customer shares on purpose. Analytics get the template only (`customize_open`, `customize_apply`; an item's variant reads `<colour>-custom`, its name the product's); the saved last order keeps only which template; nothing else is stored. `e2e/custom.spec.ts` checks `dataLayer` and storage for them.
- **Taste**: buying one counts as a small like (0.05, once) of the design it's drawn like, never its inputs.

## Analytics (`lib/analytics.ts`)

- **Attribution:** `landing` (utm_source / medium / campaign, ref, has_taste, has_list, landing_path, referrer) is recorded once per page load, before any page strips those tags from the address bar; the session's first touch is kept in sessionStorage and attached to `purchase`. `page_view` fires on every page, client-side navigations included.
- **Commerce, GA4 shape** (`trackEcommerce`: currency, value, items with item_id, item_name, item_category, item_variant = tee colour, size, price, quantity, discount): `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `purchase`. The pair counts as $90, its saving as the items' discount. Every add names its `source`: product, grid, minibag, cart_xsell, empty_bag, saved, confirm, discover_card, shared_list, liked.
- **Product:** `swipe`, `undo`, `calibration_complete`, `taste_sheet_open`, `shop_view` (with the order actually shown), `shop_filter`, `search` (once per settled search — Enter, a chip or 1.5 s without typing: the words, up to 64 characters, how many results, whether it was corrected or relaxed, the facet kinds; its grid as the `shop_search` list), `select_size`, `save`, `share` and `share_taste` — shares only when they went through or the link was copied, never for a dismissed sheet.
- Nothing personal is sent (no name, email or address); `e2e/r2-stage3.spec.ts` walks a whole funnel and checks each event fires once.

## Brand

`components/MonoLogo.tsx` is the brand mark (black square, white "MONO", sizes `sm` / `md` / `lg`); `app/icon.svg` is the favicon.
