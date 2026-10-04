---
name: ready-images
description: The ready-images track. The owner hands over one or more finished images, and each one is prepared as a one-ink print with its details, reviewed by the six-judge panel for up to three rounds, and added to the catalogue. Use it whenever the owner uploads or attaches images to add to the shop ("מסלול תמונות מוכנות", "add these to the catalogue", "here's a design").
---

# Ready images: from the owner's image to the catalogue

The owner brings the picture, so there's no idea competition and no image prompt. Everything else is the
studio's gated pipeline (`docs/content/design-loop.md`, `scripts/studio/briefs/review-designers.md`,
`scripts/studio/publish.ts`). Work on the shop branch's worktree. A batch is one run,
`data/studio/ready<N>/` (the next free N), with one folder for each image.

**Batching.** Several images go through as one run, and only the work that is really per-image is done per
image (step 2 and the fixes). The intake question, the review sheets, each panel round, the decision, the
catalogue step, the checks, the commit and the report are each done **once for the whole batch**.

## 1. Intake (once a batch)

- Collect every image the owner sent (the paths in the message). Copy each original, untouched, to
  `data/studio/ready<N>/<NN>-1-<slug>/sources/original.<ext>` (`NN` follows the order the owner sent them).
- For the details you need each image's **source and rights**: the owner's own work, made with a generative
  tool (which one), a photo they took, or something else. If the owner didn't say, ask **one** question
  that covers the whole batch, and don't guess. Anything the owner can't license stays out of the run.
- Check each image against the shop before you work on it: a near-duplicate of a design already in the shop
  (`data/shirts.json`, search by subject) is reported to the owner and not built.

## 2. Prepare (per image)

1. **Look.** Open the whole image, then crop into details at full size. Note the defects: AI artefacts
   (melted or extra parts, wrong counts of legs, wheels or fingers), fake lettering, logos or brands,
   recognisable people, paper edges and frames, JPEG noise, a low resolution for 28 × 37 cm (under ~2000 px on
   the long side: say so; upscale only if it holds up at full size).
2. **Fix.** Retouch in code what the print needs (remove the artefact, fade a cut edge, crop, lift a
   crushed area, cut out a studio backdrop with `scripts/photos/cutout.py`). Keep the steps in
   `sources/build.py` so a rebuild gives the same print to the pixel. Never repaint the subject into
   something else. A fix that changes what the picture shows is asked of the owner first.
3. **One ink.** `python scripts/studio/oneink.py <fixed image> <folder> <slug> --mode <m> [--edge …]`:
   `engrave` for a generated engraving or drawing, `line`/`pen` for clean line work, `halftone` for a
   shaded picture or a photograph (as Wok Hei). A scene drawn to its edges gets an ending (`--edge`).
   `print.json` must have `fails: []`. Then zoom-check the result at full size for specks, frame remnants,
   broken lines and muddy masses.
   Lessons from ready1:
   - Keep the source as `sources/<model>-<slug>.png` (decode a JPEG losslessly), because `publish.ts` takes the
     first `.png` in `sources/`. Don't leave a stale `<slug>.png` beside a halftone's `<slug>-white.png`.
   - A 1024 px generated engraving breaks into speckle in `engrave` mode at print size, because its
     hatching is finer than its pixels. `--mode halftone` (55 lpi) keeps it faithful. That mode keeps only
     the subject, so set the picture's lettering again as real type (`set_captions` in
     `data/studio/ready1/02-1-gin-botanicals/sources/build.py`).
   - Never run a median at the original's scale (it erases i-dots and full stops). Grow lettering dots
     that would print under 0.5 mm, and despeck outside the lettering only.
   Lessons from ready2 (start from `data/studio/ready2/*/sources/build.py`, the same file in every folder):
   - The panel marks a halftone dither down on a drawing ("a thresholded photo"). Convert a drawing as line:
     `line` keeps small numerals and lettering crisp; `engrave` (no screen at all) thickens strokes under
     0.4 mm and closes small counters (a 6 reads as 8), so keep it for pictures without small type. Hold the
     greys back first (`lift`, 0.3) so engrave makes lines, not masses. A photographic picture with no line
     structure stays below the bar either way.
   - `"protect": "auto"` finds the lettering (`text_boxes`); check its boxes on an overlay. Add `protect_extra`
     for a number standing apart from its words ("1.  SIDE PANEL") and `protect_exclude` where a texture reads
     as type (a bubble field: the dot growth turns it into a black rectangle).
   - `despeck` at 100 (the check's own speck size at 3x), not 300: 300 eats 1s, 7s and fine hatching.
     `binarize` 120–175 to keep the screen share under 3% in line mode; `final_despeck` takes oneink's own
     crumbs out of the delivered print.
   - Correct lettering with the picture's own glyphs (`swap`, digits from another label in the same face)
     before setting type (`text`, `like` measures the cap height and baseline from the lettering it replaces).
     Check every figure against the drawing: Gemini's sheets carry wrong dimensions, wrong tool names,
     garbled figures, and makers' trademarks (removed: `disc` and `ring` clear a badge and keep its ring).
4. **Tees.** Decide them before the panel (design-loop.md, step 3, "Tees"; `scripts/studio/teeBalance.ts`),
   look at the print in white ink on black as well as in black on white, and write `tees` (and `teeDefault`
   with `both`) and `features` into `print.json`.
5. **Details.** Write `<slug>.txt` in the shape of design-loop.md's "Delivery": Title (what it shows),
   Category (a shop label, by subject: Plants & Gardens, Animals, Under the Microscope, Ships & Sea, Travel &
   Landscapes, Architecture & Towns, Sky & Science, Workshop & Kitchen, Type & Wit, Pattern & Ornament), Family, Subject, Style, Medium, Description (two sentences, facts checked or left
   out), Tee colours, Print size (from `print.json`), Keywords, Model, Credit and source (from the intake
   answer, plus every retouch you made, as Wok Hei's does), Licence. Read the subject from the picture, and
   don't make it up: an object you can't identify gets a plain title.

## 3. Panel (once a round, the whole batch together, at most three rounds)

- `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/reviewSheets.ts ready<N> <scratch>/sheets-r<R>`
  renders every design in the run (flat, on its tee, on the other tee) and writes `review/designs.json`.
  From round 2 on, give the judges only the designs still in review.
- Run the **six judges** of design-loop.md's panel template in parallel (the screen-print production designer,
  the apparel art director, the composition and typography designer, the t-shirt shop buyer, the RVCA head
  designer, and an everyday customer chosen to fit the batch). Each judge gets the sheets of **every** design
  in the round and gives each one its own score, verdict, why and fix. Each writes
  `{"designer","persona","designs":[{"no","title","score","verdict","why","fix"}]}` to its **exact**
  path, `data/studio/ready<N>/review/round-<R>/designer-<K>.json`. No reference designs, no example scores,
  no shop taste.
- **After each round, per design:** it **passes** at an average of 6.5 or more with fewer than three DELETE votes
  (approve.ts's bar), and it leaves the review. A design that doesn't pass gets the fixes that two or more
  judges agree on (back to step 2, in its `build.py`) and goes into the next round with the others still in
  review. After round 3, or when the fixes contradict each other or ask for what the image can't give, it
  stops.
- **Decision.** For each design, take its votes from the round it ended in, and write them into
  `review/designer-<K>.json` (one file a judge, every design in the run, renumbered as the final
  `designs.json`). Then run `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/approve.ts ready<N>`. A
  third design of one family in one run is dropped by approve.ts. If that happens, tell the owner and don't
  rename families to get around it.
- **Below the bar after three rounds:** the design stays out. In the report, show the owner its best version,
  its average and the judges' main objections. The owner may approve it anyway. Record that in
  `approved.json` as `ketch1` does (`"why": "approved by the owner below the bar (average …)"`), and only on
  the owner's word.

## 4. Catalogue (once a batch)

Run in this order, once, for all the approved designs:

```
npx tsx --tsconfig tsconfig.scripts.json scripts/studio/publish.ts
# file each new mono-<n> in scripts/gen/shopCategories.json (the shop's categories by subject)
npm run generate
npm run search:index
npx tsx --tsconfig tsconfig.scripts.json scripts/tools/uploadPriors.ts
npm run typecheck && npm test && npm run lint
npm run build && npm run smoke && npx playwright test
```

Every check must pass. Run **smoke as well as e2e**, because CI runs both. If a check breaks because the
catalogue changed (an order a test assumed, a count), fix the test's assumption, not the catalogue. Then
make **one commit** for the batch (one line per design: title, `mono-<n>`, its average), and don't push
until the owner says to.

## 5. Report (once a batch, in the owner's language)

For each design: its `mono-<n>`, its title, what was fixed, its average in each round, and whether it went
in, stayed out or is waiting on the owner. Below that, one contact sheet with every design of the batch on
its tee (`SendUserFile`), then the checks and the commit, which is not pushed.
