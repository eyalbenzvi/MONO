# Studio: new illustrations for MONO

The catalogue is to be replaced, mostly, by new illustrations made for MONO: detailed engraving-style plates (a lunar map, a tree's anatomy, a volcano in section, a person at work) rather than code-drawn diagrams or archive scans. Nothing is taken from other sites: each picture is generated from MONO's own brief, then made into a one-ink print here.

## The pipeline

1. **Brief.** One prompt per design, from the house style below plus the subject. No text in the picture: titles and labels are set afterwards in licensed fonts (generated lettering misspells, e.g. "Composite Velcano", and invents brand names).
2. **Generate.** An image model at 2048 px or more on the long side (1024 px loses the fine engraving at 26 × 35 cm). The tool's name goes into the design's details (guidelines, section 07); its terms must allow commercial use.
3. **One ink.** `python scripts/studio/oneink.py <image> <out> <slug> [--mode line|tone] [--crop x0,y0,x1,y1]` (pip install pillow numpy opencv-python-headless scipy):
   - trims the paper, fits the picture into 26 × 35 cm, centred and 1 cm from the top, at 300 DPI (3307 × 4370 px);
   - `line` (engravings, pen, woodcut): a threshold, strokes under 0.4 mm thickened, flat grey screened; one file prints on both tees;
   - `tone` (the moon, anything tonal): a 45° clustered-dot screen, 1.1 mm cell, and two positives: `-white.png` (the dark parts are ink) and `-black.png` (the subject's light parts are ink, the background left out);
   - holds any dark mass wider than 4 mm to an open mesh, bends the tone until coverage is 4–32%, and writes `-check.json` with the guidelines' measures (coverage, size, top, lines under 0.4 mm) and `-preview.png` on both tees.
   - a scene drawn to its edges gets an ending, `--edge` (guidelines, section 04, "Scenes: how a picture ends"), chosen per design before the prompt is written: `horizon` (the default: a straight ground cut with a thin rule under it, the sides and sky falling away), `rect`/`plate` (a rectangle with a 0.7 mm keyline), `circle` (a ring), `arch` (a round-topped window), `oval`/`vignette` (a soft fade, at most one design in ten). On the black tee only the light parts that carry drawing print, never a plain sky.
4. **Look.** Every preview is looked at, on both tees, at full size and in detail. A figure in `line` mode reads as a negative on a black tee: use `tone`, or offer it on white only.
5. **Details and delivery.** Title, category, description, keywords (guidelines, section 08), the folder of section 09.
6. **Into the shop.** `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/publish.ts` makes every delivered folder (`data/studio/<NN>-<slug>`, `data/studio/run50/<KK>-<slot>-<slug>`, `data/studio/run50b/<KK>-<slot>-<slug>`) a print the shop serves (`public/prints/print_<n>.webp`, 1500 × 2000, ink or no ink; the model's picture kept in `assets/masters`, recorded in `data/curation/halftone.json`) and writes `data/studio/catalogue.json`; `scripts/generateCatalog.ts` (`studioSet`) files them as content wave 4 (numbers from 20001, `scripts/sources/ranges.ts`), credited "MONO Studio" with a link to the design's brief. Line work is offered on both tees; tonal work on the black tee (the shop holds one print a design, and its -black positive is what the previews show), or on the white tee alone when its maker delivered only a -white positive (a scene whose ending reads as a bright patch on black). The shop category is the publish script's (`CATEGORY`), by what the design shows. Then the usual: `publishIndex`, `publishCustom`, `search:index`, `uploadPriors`.

## House style (the start of every prompt)

> Detailed black-and-white engraving illustration, 19th-century scientific plate style, bold confident line work with cross-hatching and stippling, strong contrast, crisp lines thick enough to print, isolated subject on plain white paper, no background scene beyond the subject, no border, no frame, no text, no letters, no labels, no signature, vertical composition.

Add for line work: "pen and ink, woodcut weight, no grey wash". For tonal subjects: "fine stipple shading". Never: brands, logos, real people, famous artworks or a named artist's style.

## Briefs for the pilot (24)

| # | Subject | Category | Mode |
|---|---|---|---|
| 1 | The near side of the Moon, maria and rays | Maps & Sky | tone |
| 2 | An oak: crown, trunk and the roots below the ground line | Botanical & Nature | line |
| 3 | A stratovolcano in section: conduit, magma chamber, strata | Engravings | line |
| 4 | A kneeling farmer lifting a beet, rows behind | Engravings | tone |
| 5 | A road crew laying asphalt behind a roller | Engravings | tone |
| 6 | A lighthouse keeper's lamp: the Fresnel lens, exploded | Engravings | line |
| 7 | A honeybee, wings spread, from above | Botanical & Nature | line |
| 8 | A fern frond unrolling, with its spores | Botanical & Nature | line |
| 9 | A mushroom in section with its mycelium below | Botanical & Nature | line |
| 10 | A raven on a branch | Botanical & Nature | line |
| 11 | A mountain range with glacier, cartographer's hachures | Maps & Sky | line |
| 12 | Saturn with its rings, and its moons in a row | Maps & Sky | tone |
| 13 | A river delta from above, as a survey plate | Maps & Sky | line |
| 14 | A Gothic cathedral's flying buttresses, in section | Architecture | line |
| 15 | A spiral staircase seen from below | Architecture | line |
| 16 | A stone bridge's arch under construction, its timber centring | Architecture | line |
| 17 | A great wave breaking, foam and spray | Brush & Woodblock | line |
| 18 | Pine on a cliff in mist | Brush & Woodblock | tone |
| 19 | A moka pot, exploded view | Geometric | line |
| 20 | A mechanical watch movement | Geometric | line |
| 21 | A diver's helmet | Engravings | line |
| 22 | A blacksmith at the anvil, sparks | Engravings | tone |
| 23 | A fisherman mending nets | Engravings | tone |
| 24 | A heart in anatomical section | Botanical & Nature | line |
