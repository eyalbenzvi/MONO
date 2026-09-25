# MONO — monochrome tee discovery

"Tinder for T-shirts": swipe black or white tees with rectangular monochrome prints. A vector recommendation engine learns your taste in real time, then opens a shop ranked for you.

## Catalog: 1,000 generated shirts

The catalog is fully offline and procedural. `scripts/generate1000Shirts.ts` (seeded, deterministic) writes:

- `public/prints/print_1.svg` … `print_1000.svg`: 3:4 monochrome SVG prints (~8 KB each)
- `data/shirts.json`: the catalog the app imports (`lib/catalog.ts`)

```bash
npm run generate   # rebuilds both, byte-identical on every run
```

Five generative families, 200 shirts each, four algorithms per family:

| Family | Algorithms |
| --- | --- |
| Architectural | facade grid · one-point perspective corridor · skyline with window grids · cantilevered slabs |
| Geometric | primary forms · scattered primitives · twisted concentric polygons · Truchet tiling |
| Typography | heavy single word · survey coordinates · repeated word stack · manifesto columns |
| Halftone | radial burst · ordered gradient · dot-matrix shapes · stippled grain |
| Line & Wave | pulsar ridge lines · sine-wave moiré · topographic contours · gestural line |

Feature vectors are computed from each design's real parameters (line/cell counts, fill ratio, stroke weight, dot coverage, framing, knockout) rather than assigned. Tees are exactly 70% black / 30% white. Every print is single-ink: white ink on black tees, black ink on white. The mockup blends the print's ground into the fabric (`screen` / `multiply`) so only the ink shows. About 12% of prints are knocked out of a solid ink block.

## Flow

1. **Discover / calibration** (`/`): the first 10 cards are the most mutually different prints. Finishing them shows the "taste profile ready" screen with your top traits and top picks.
2. **Shop** (`/shop`): the full catalog ranked by match, with tee colour, style and sort filters, rendered 24 at a time as you scroll. ♥ saves a tee *and* trains the vector.
3. **Product** (`/shop/[id]`): on-tee and flat print views, why it matches you, size guide, add to bag, similar prints. All 1,000 pages are statically generated.
4. **Bag & checkout** (`/cart`): change size/quantity, shipping (free over $80), a delivery form and an order confirmation. It is a demo: no payment details are collected and nothing ships.

Discover keeps training after calibration (80% best match / 20% explore).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vector-math unit tests (Vitest)
npm run typecheck && npm run lint && npm run build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds a static export (`out/`) and publishes it on every push. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The site is served at `https://<user>.github.io/<repo>/`.

## Controls

| Gesture | Button | Key | Action |
| --- | --- | --- | --- |
| Swipe right | ♥ | → | Like |
| Swipe left | ✕ | ← | Dislike |
| Swipe up / tap / long-press | ⓘ | ↑ / Space | Flip to details: specs, sizes, add to bag, print DNA |

The pulse button (bottom-right) opens the **Algo debug** panel: live user vector with per-swipe deltas, the current card's cosine / centered cosine / match score, per-feature dot-product share, recent swipes, and a reset.

## How the engine works (`lib/recommendation.ts`)

- **Vectors:** each shirt has 10 features in `[0, 1]` (`types/shirt.ts`). The user vector starts at `0.5` on every axis.
- **Learning:** like → `v + 0.15·(f − v)`, dislike → `v − 0.08·(f − v)`, clamped to `[0, 1]`.
- **Cold start:** the first 10 cards come from `getCalibrationQueue`, which uses greedy farthest-point sampling on centered cosine to pick the most mutually orthogonal prints.
- **After calibration:** `getNextCard` rolls 80% greedy (highest match) / 20% explore (the print most orthogonal to the current profile).
- **Match score:** `cosineSimilarity` returns plain cosine as 0–100%. Plain cosine between positive vectors bunches up in the 75–95% band, so the badge uses `matchScore`, which blends in the cosine of the vectors centered on 0.5 as the profile moves away from neutral. Both numbers are shown in the debug panel.
- **Real-time deck:** after every swipe, the card already showing underneath stays put and everything behind it is re-ranked with the new vector.

State (likes, dislikes, vector, history, deck, chosen sizes, bag, last order) is persisted to `localStorage` through Zustand (`store/useShirtStore.ts`).

## Brand

`components/MonoLogo.tsx` is the brand mark (black square, white "MONO", sizes `sm` / `md` / `lg`); `app/icon.svg` is the favicon.
