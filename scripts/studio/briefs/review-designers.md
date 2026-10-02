# The designers' review: the gate a studio run passes before the shop

A run's designs reach the catalogue only when five designers approve them. The designers are agents with five different professional eyes, run by the session that merges the run. No human signs off. The steps:

1. **Sheets.** `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/reviewSheets.ts <run> <out-dir>` (on the shop branch) renders each delivered design three ways: the flat print, on its tee, and on the opposite tee (marked as not offered when it isn't). It writes contact sheets of five rows (`sheet-NN.png`) and `designs.json` (no → folder, title).
2. **Five reviews.** Run the five agents below in parallel. Each gets the persona, the founder's taste and the sheets, and writes `designer-K.json` into `data/studio/<run>/review/`.
3. **Decision.** `npx tsx --tsconfig tsconfig.scripts.json scripts/studio/approve.ts <run>` reads the five reviews and writes `data/studio/<run>/review/approved.json`. A design is approved when:
   - its average score is at least 7;
   - fewer than three designers said DELETE;
   - it is among the two best of its family in the run (the `Family:` line).
4. **Shop.** `scripts/studio/publish.ts` publishes only the approved designs of a gated run. Their quality score is the average review score × 10.

## The shared context (give it to every designer)

MONO is a shop of one-ink t-shirt designs. The founder's taste comes from four reference tees:
1. a whale natural-history study sheet;
2. a sailboat technical elevation;
3. a dense pen-and-ink colonial building with palms;
4. a bicycle patent sheet in white chalk line on a black tee.

The designs were made by an AI image generator and converted to one ink. Be honest and critical; don't be polite for its own sake. Look at every sheet.

Deliver, in English:
- for every design: a score from 1 to 10, a verdict that is exactly one of PASS / NEEDS CHANGE / DELETE, and one short sentence saying why;
- five suggestions for the next designs;
- written as JSON with the shape `{"designer":"...","persona":"...","designs":[{"no":1,"title":"...","score":7,"verdict":"PASS","why":"..."}],"suggestions":["..."],"overall":"..."}`.

## The five designers

1. **Screen-print production designer** (25 years preparing art for one-colour screen printing on tees). Line weight at print size, lines that fill in or break, dot screen and mesh noise, muddy dark masses, hairlines lost in white ink on black, how the print really looks on cloth.
2. **Apparel art director** for independent graphic-tee and streetwear labels. Would someone wear it on their back, brand piece or stock graphic, placement and scale on the body, whether the tee colour suits it, whether it feels like a $50 tee, how it fits the collection.
3. **Natural-history and technical illustrator** (specimen plates and engineering elevations by hand). Anatomy and mechanics that make sense (count legs, wheels and joints), AI artefacts (melted parts, duplicated limbs, nonsense machinery, fake lettering), whether a "study" really is one, whether the title is true.
4. **Graphic designer for composition and typography** (editorial and poster). Composition in the print area, balance and empty space, hierarchy, the heading's relation to the picture, margins, awkward crops, hard rectangular edges, whether the sheet reads as a deliberate layout.
5. **Merchandiser and buyer** for a curated online shop (formerly a museum store), the sceptic. Would someone pay $50, does it stand out from generic AI "vintage engraving" tees, does it look AI-made, is the subject appealing, does it repeat others in the run, would it photograph well.
