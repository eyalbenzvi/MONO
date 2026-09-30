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

- Date: 2026-09-30. Drop: 2026-09-30 (12 new this week, at most four per category: Geometric 3, Engravings 4, Brush & Woodblock 4, Maps & Sky 1; the rest dated a week earlier, 2026-09-23). A wave's drop is the day it goes live, so the Monday rule now holds for everything but the waves.
- Sources: the Met, the Art Institute of Chicago, the Cleveland Museum of Art, Wikimedia Commons (af Chapman's drawings and *Architectura Navalis Mercatoria*, sail and lines plans, 18th-century French charts, the *Atlas nautique* of 1783, Cordouan lighthouse), the Library of Congress (HABS/HAER measured drawings of lighthouses, wharves and vessels). Skipped, as in wave 1: Smithsonian, Internet Archive, NOAA Photo Library, BHL (same reasons); NOAA's historical charts not tried; no source that needs an API key.
- Candidates → downloaded → kept → in the catalogue: 937 → 906 (18 failed downloads, 13 without a print) → 103 → 100.
  - The Met 117 → 116 → 18 → 16; AIC 234 → 229 → 32 → 31; Cleveland 78 → 77 → 14 → 14; Wikimedia 218 → 210 → 17 → 17; LoC 290 → 274 → 22 → 22.
  - The automatic selection kept 106. A review of the titles took out 3 that numbers can't see (a nude, Zorn's *My Model and my Boat*; real people, *A History of the Amistad Captives*; a novel's scene with its figures the subject, Rowlandson's *Don Michele*); the catalogue's own rules retired 3 more (two Whistler Thames wharves and a gale). Refused on the way: 142 by the category ceiling (Engravings would have passed 29% of the catalogue; the catalogue test's line is 30%), 123 repeated titles, 61 solid blocks or slabs, 23 without a name, the rest quality or flags.
- In: Engravings (ETC) 389 → 432, Brush & Woodblock (BRU) 152 → 171, Architecture (ARC) 111 → 130, Geometric (SYS) 80 → 95, Maps & Sky (MAP) 84 → 88; Botanical & Nature (SPC) unchanged at 215. Catalogue 1,377 → 1,477. Median quality of the wave 77 (the Met 81, Cleveland 79, AIC 78, Commons 70, the LoC 65), the catalogue's unchanged at 76. None in Our pick's first 24 or the taste test. public/prints 148 → 153 MB committed (du 165 MB), masters 164 → 170 MB; the repository's git directory 353 MB before the wave's final commits.
- What worked: the art museums' ship and harbour prints (Hiroshige and Yoshimori ships, Bresdin, Daubigny, Homer's Gloucester shipbuilding) clear the checks at a high rate and have the best quality of the wave. The LoC's measured drawings, once the adapter read them at all: lighthouses, wharves and the *Balclutha* file cleanly as Architecture and Geometric.
- What didn't:
  - The WIP left `data/shirts.json` generated from an earlier selection: 57 designs showed another record's print, 12 had no print or master. Check after every re-selection that each wave design's print is its record's (the review now does it byte for byte against the pipeline cache), and regenerate last.
  - The LoC first found no sheets (the drawings' TIFFs moved from `storage-services/service` to `storage-services/master`; the IIIF `master:` id serves only full size, and its long transfers are cut mid-way, so downloads now resume with a Range request). Most HABS sheets are weak prints at a T-shirt's scale (thin lines, lettering): 22 of 274 cleared the checks.
  - Filing: the wave-1 rules put French charts ("Carte …", Commons' "nautical charts"), a lighthouse elevation, a steamship's cross section, lithographs of fishing boats ("lithograph … fish") and drypoints titled "(Large plate)" in Botanical & Nature. From wave 2 on (wave 1 untouched): plural and French chart words go to Maps & Sky, architectural elevations to Architecture, ships' cross sections to Geometric, "Chinese (culture or style)" to Brush, and natural history only by name.
  - A Commons category search drifts ("Sail plans" found "SAIL Amsterdam": press photographs classed as plates), so Commons categories must name line work, photograph and museum-object categories are out, and HABS copies on Commons are left to the LoC. Library titles needed more tidying (a HABS call number, a book's figure label, a museum's inventory line, a statement of responsibility after " / ", French and Swedish words left dangling by the 60-character cut), and seven still needed a hand (a file name, all capitals, a typo, a cut French title). A Commons maker can be a web address; the generator now drops it.
  - Metadata lets through figure scenes whose words aren't on the people or narrative lists (a nude titled "My Model", "captives", a novel's hero's name). With no eye on the pictures, a title read by a person before the preview stays part of the process.
  - The typo test's sample moved with the catalogue and found two real misses ("loots" read as "looks", not "lotos"; "shipipng" not read): a swap of neighbours now ranks first among one-edit corrections.
- Next: wave 3. Candidates: nautical charts and coast surveys at scale (NOAA's historical charts, if reachable; Maps & Sky gained only 4 here), signal flags and knots (the `signalFlags` switch exists), and the people and narrative lists in more languages before any Swedish or Dutch source grows. Engravings sits at 29% of the catalogue, so a wave of mostly etchings will be capped: aim at Maps & Sky, Architecture and Type.
