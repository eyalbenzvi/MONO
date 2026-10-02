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
6. **Into the shop.** `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/publish.ts` makes every delivered folder (`data/studio/<NN>-<slug>`, `data/studio/run50/<KK>-<slot>-<slug>`, `data/studio/run50b/<KK>-<slot>-<slug>`, `data/studio/sdxl50/<KK>-<slot>-<slug>`) a print the shop serves (`public/prints/print_<n>.webp`, 1500 × 2000, ink or no ink; the model's picture kept in `assets/masters`, recorded in `data/curation/halftone.json`) and writes `data/studio/catalogue.json`; `scripts/generateCatalog.ts` (`studioSet`) files them as content wave 4 (numbers from 20001, `scripts/sources/ranges.ts`), credited "MONO Studio" with a link to the design's brief. Line work is offered on both tees; tonal work on the black tee (the shop holds one print a design, and its -black positive is what the previews show), or on the white tee alone when its maker delivered only a -white positive (a scene whose ending reads as a bright patch on black). The shop category is the publish script's (`CATEGORY`), by what the design shows. SDXL's fifty (drawn with SDXL base 1.0 and SDXL-Lightning, CreativeML Open RAIL++-M, and credited so) go by their family, the folder's slot: study sheets Botanical & Nature, streets Architecture, elevations Architecture or Engravings, patent sheets on black Engravings; a line design whose maker offered the white tee only is offered on the white tee alone. Of the 51 delivered, Hillside Houses is held back (its patches of black read as blots). Then the usual: `publishIndex`, `publishCustom`, `search:index`, `uploadPriors`.

7. **The designers' gate (runs after sdxl50).** Five designer reviews of the SDXL fifty (average 5.5 of 10; 14 of 51 passed as they were) found the same faults again and again: screen-dot greys, shaded drawings printed white as negatives, hard rectangles, side elevations floating as strips at the top, invented "study" details, wrong anatomy and fused machines, small hairline headings, near-duplicate subjects. From the next run on:
   - **The studio** follows `scripts/studio/briefs/rules.md`. The conversion is `oneink.py --mode engrave` (line and solid only, no screen; specks under 0.5 mm go). `--edge dissolve` replaces the rectangle, which now fails the check; a drawing may reach the print's edge. The picture sits at the optical centre; a wide subject gets a ground line and a dimension line. The heading is 8.5 mm with a rule, a plate number (`--plate`) and a view (`--view`). "Study" needs `--views 2`. Only `--outline` drawings with under 10% solid fill may print white on black. The check also fails a screen over 3% of the ink, a drawing filling neither 75% of the width nor of the height, a strip under 30% of the height, a heading within 3 mm of the picture, a "study" of one view, and a print under 20 cm wide and 30 cm tall. Each design ships with its `print.json`, and helpers answer a truth check (anatomy or mechanics, one object, title) in DONE.
   - **The shop** publishes a gated run's designs only when five designer agents approve them (`scripts/studio/briefs/review-designers.md`): `scripts/studio/reviewSheets.ts <run> <out>` renders each design flat and on both tees, the five reviews go to `data/studio/<run>/review/designer-K.json`, and `scripts/studio/approve.ts <run>` writes `approved.json`. A design is approved at an average of 7 or more, with fewer than three DELETE votes, as one of the two best of its family. `publish.ts` then takes the approved designs:
     - quality: the reviews' average × 10 (the catalogue ranks by it);
     - tee colours from `print.json`: an outline drawing on both tees (over 15% ink leads with white), anything shaded on white alone;
     - the 300 DPI print kept in `assets/prints-hd/print_<n>.png` for production;
     - a print under 20 cm wide and 30 cm tall, or a third design of one family, stops the run.

     The runs before (the trial, run50, run50b, sdxl50) are published exactly as they were. The mockups already show each print at its true size on the back, so a small drawing looks small there too, which is why the size and strip checks apply.

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
