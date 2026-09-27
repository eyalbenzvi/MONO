# Content waves

Each wave takes one world of existing public-domain works from the source to the live site, with four stops for the owner: counts, selection, preview, live. The brand book (`docs/brand-book.md`) is the top criterion.

## How a wave runs

1. **Counts.** Each source's adapter (`scripts/sources/<source>.ts`) searches by metadata only. `_license.ts` judges the licence and `_metaFilter.ts` the text. The report goes to `data/review/wave-<n>/counts.json`.
2. **Selection.** `_pipeline.ts prep` downloads, cuts out objects on a backdrop (and only those), makes the master, screens the halftone and measures it. `scripts/review/reviewPage.ts source` builds the selection pages. The owner's `decisions.json` goes through `scripts/review/applyDecisions.ts`.
3. **Preview.** Integration on `waves/work`, then `scripts/review/previewPage.ts <n>`.
4. **Live.** Merge into the deployed branch: one merge commit per wave.

No picture is looked at by Claude: the owner judges on the pages; scripts only print numbers. Id blocks: `scripts/sources/ranges.ts`. A wave's designs: `/shop/?wave=<n>`.

## Decisions (wave 0)

| Question | Decision | Why |
| --- | --- | --- |
| Figures in historical prints (Diderot plates, sailors on deck) | Allowed when not the subject; portraits, figure studies and nudes are refused. None in photographs. | The brand book forbids real people and people in photographs; an anonymous craftsman in an 18th-century plate is neither. |
| Copernicus / Sentinel-2 | Not used | Its licence requires attribution (CC BY-like), which needs the owner's explicit approval; NASA Earth Observatory and Landsat cover the same need. |
| Free API keys (Flickr, Rijksmuseum) | Skipped | No secrets in the repo; Wikimedia, the Met, AIC, Cleveland and the LoC need none. Revisit if a wave falls short. |
| A "Drawings & Patents" category | Not now: SYS / ARC | The category scheme changes only with the owner; the brand book's 13 categories are a separate, larger decision. |
| Masters | Committed (`assets/masters`), downloads never | As today: the master is the prepared picture the screen is made from. |

## Wave 0: infrastructure and catalogue review

- Date: 2026-09-27. Status: at stop 2 (catalogue review pages out).
