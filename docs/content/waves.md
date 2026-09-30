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

- Date: 2026-09-27. The catalogue review pages were published; the owner chose not to review now, so nothing was retired.
- Built: `scripts/sources` (id blocks, licences, metadata filter, pipeline, adapters), `scripts/review` (selection page, hub, before/after page, decisions, automatic decisions), the `wave` field and `/shop/?wave=<n>`.
- Found on the way: the 404 page's redirect assumed four-digit ids and that every number up to the last was live; it now lists exactly the designs without a page (five-digit ids included).

## Selection without an eye (from wave 1)

The owner delegated the selection ("do what you think; don't ask"). No picture is looked at, so `scripts/review/autoDecide.ts` keeps only what every number clears: quality at least 60 (the catalogue's weak line is 53), no sliver, vignette or flat flag, no solid block, no duplicate scan, no repeated title. Titles are the record's, tidied (file-name debris and plate running numbers out, 60 characters at most). General art museums must name the world in the title itself; scenes (sacred, mythological, fables, cigarette cards, long story titles) are refused by the metadata filter.

## Wave 1: Ocean

- Date: 2026-09-28. Drop: 2026-09-28 (12 new this week, four per category; the rest dated a week earlier).
- Sources: Wikimedia Commons (Haeckel's Kunstformen der Natur, the Challenger reports, fish plates), the Met, the Art Institute of Chicago, the Cleveland Museum of Art. Skipped: Smithsonian (a sample showed specimen-drawer photographs, not plates), Internet Archive (no single images; books only), NOAA Photo Library (moved; the new address refuses the request), BHL (blocked here, 403).
- Candidates → downloaded → kept → in the catalogue: 665 (Wikimedia capped at 400) → 405 → 197 → 184 (the catalogue's own rules retired the rest).
- In: Botanical & Nature (SPC) 117 → 215, Engravings (ETC) 337 → 389, Brush & Woodblock (BRU) 118 → 152. Median quality of the wave 76, the catalogue's unchanged at 76. Two in Our pick's first 24, one in the taste test. public/prints 132 MB, .git 304 MB.
- What worked: scientific plates (Haeckel, the Challenger) print clean as line work and pass the checks at a high rate. What didn't: general museum searches bring scenes whose tags mention a fish; the title rule and the scene filter were needed. AIC images need the `AIC-User-Agent` header its API asks for; Wikimedia rate-limits hard (one download at a time).
- Next: wave 2, seafaring and navigation (LoC HABS/HAER measured drawings of lighthouses and ships, af Chapman's ship plans on Commons, nautical charts).


## Make artwork (the Make prints' wave 4)

Retired. The two Make prints that drew traced pictures (Your Dinosaur's plates from Marsh, Osborn, Gilmore, Hatcher and Eaton; Your Landmarks from public-domain Commons photographs, screened) looked poor on a tee: speckle from the scans, fragments of printed captions, photographs that read as noise at 3 cm. Both now draw their pictures in code (`lib/custom/draw/dinosaurs.ts`, `lib/custom/draw/landmarks.ts`; README, Make artwork), so the tracing pipeline (`makeArt.ts`, `artSets.ts`, `vectorise.py`, `dots.py`, the review page and `data/art/`) was removed with the pictures it made. Landmarks that are modern buildings are drawn as generic line illustrations, not copied from any photograph.

## Wave 2: Seafaring and navigation

- Date: 2026-09-30. Drop: 2026-09-30 (12 new this week, at most four per category; the rest dated a week earlier, 2026-09-23). A wave's drop is the day it goes live, so the Monday rule now holds for everything but the waves.
- Sources: the Met, the Art Institute of Chicago, the Cleveland Museum of Art, Wikimedia Commons (af Chapman's drawings and *Architectura Navalis Mercatoria*, sail and lines plans, 18th-century French charts, the *Atlas nautique* of 1783, Cordouan lighthouse), the Library of Congress (HABS/HAER measured drawings of lighthouses, wharves and vessels).
- Candidates → downloaded → kept → in the catalogue: 935 → 904 (the rest: 18 failed downloads, 13 without a print) → 255 → 244.
  - The Met 94 → 93 → 56 → 55; AIC 252 → 247 → 102 → 94; Cleveland 81 → 80 → 48 → 46; Wikimedia 218 → 210 → 27 → 27; LoC 290 → 274 → 22 → 22. The catalogue's own rules retired 11.
- In: Engravings (ETC) 389 → 565, Brush & Woodblock (BRU) 152 → 177, Architecture (ARC) 111 → 129, Systems (SYS) 80 → 94, Botanical & Nature (SPC) 215 → 225, Landscapes & Sky 84 → 85. Median quality of the wave 73, the catalogue's unchanged at 76. None in Our pick's first 24 or the taste test. public/prints 172 MB (+12 MB), masters +16 MB; the repository's git directory 339 MB before the commit.
- What worked: the LoC's measured drawings, once the adapter read them at all; the art museums' ship and harbour prints (clippers, woodblock ships) pass the checks at a high rate.
- What didn't: the LoC first found no sheets (the drawings' TIFFs moved from `storage-services/service` to `storage-services/master`; the IIIF `master:` id serves only full size, and its long transfers are cut mid-way, so downloads now resume with a Range request). Most HABS sheets are weak prints at a T-shirt's scale (thin lines, lettering): 22 of 274 cleared the checks. A Commons category search drifts ("Sail plans" found "SAIL Amsterdam": press photographs classed as plates), so from wave 2 on Commons categories must name line work, photograph and museum-object categories are out, and HABS copies on Commons are left to the LoC. Library titles needed more tidying: a HABS call number, a book's figure label, a museum's inventory line, a statement of responsibility after " / ", French and Swedish words left dangling by the 60-character cut; a title the catalogue already has is refused (the generator refuses two designs with one title). Metadata still lets through a few story prints whose hero isn't on the narrative list (Hercules, Theuerdanck) and a Swedish stern drawing with a carved portrait (the people words are English).
- Next: wave 3. Candidates: nautical charts and coast surveys at scale (NOAA's historical charts, if reachable), signal flags and knots (the `signalFlags` switch exists), and the narrative list in more languages before any Swedish or Dutch source grows.
