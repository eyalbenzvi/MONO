# MONO — monochrome tee discovery

"Tinder for T-shirts": swipe black or white tees with rectangular monochrome back prints. A vector recommendation engine learns your taste in real time.

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
| Swipe up / tap / long-press | ⓘ | ↑ / Space | Flip to front view, sizes, print DNA |

The pulse button (bottom-right) opens the **Algo debug** panel: live user vector with per-swipe deltas, the current card's cosine / centered cosine / match score, per-feature dot-product share, recent swipes, and a reset.

## How the engine works (`lib/recommendation.ts`)

- **Vectors:** each shirt has 10 features in `[0, 1]` (`types/shirt.ts`). The user vector starts at `0.5` on every axis.
- **Learning:** like → `v + 0.15·(f − v)`, dislike → `v − 0.08·(f − v)`, clamped to `[0, 1]`.
- **Cold start:** the first 10 cards come from `getCalibrationQueue`, which uses greedy farthest-point sampling on centered cosine to pick the most mutually orthogonal prints.
- **After calibration:** `getNextCard` rolls 80% greedy (highest match) / 20% explore (the print most orthogonal to the current profile).
- **Match score:** `cosineSimilarity` returns plain cosine as 0–100%. Plain cosine between positive vectors bunches up in the 75–95% band, so the badge uses `matchScore`, which blends in the cosine of the vectors centered on 0.5 as the profile moves away from neutral. Both numbers are shown in the debug panel.
- **Real-time deck:** after every swipe, the card already showing underneath stays put and everything behind it is re-ranked with the new vector.

State (likes, dislikes, vector, history, deck, chosen sizes) is persisted to `localStorage` through Zustand (`store/useShirtStore.ts`).

## Images

Back prints load from Unsplash and are forced to grayscale. If an image fails to load (offline, blocked network), `PrintImage` falls back to a generative SVG print built from the shirt's feature vector, so a card never shows a broken image.
