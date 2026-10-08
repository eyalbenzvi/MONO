# Calibrated design panel and the 76 fixes (October 2026)

What happened, in order, so the next round can start from here.

## 1. A new panel brief

The old six-judge panel never gave a design more than 8.5. Part of the reason was its brief: judges scored "a $50 tee",
so price and shop pulled every score towards the middle. The brief was rewritten (v3, [panel-brief.md](panel-brief.md)):

- judge the design only: a one-ink back print (black on white, white on black), its craft, idea, attractiveness,
  whether people would buy it, and its flaws; no price, shop, licensing, size or placement;
- an absolute 1–10 scale with anchors (10 = Unknown Pleasures; 6 = stock souvenir-shop engraving), halves allowed;
- one verdict per design: KEEP, IMPROVE (with concrete fixes) or DELETE;
- the same three anchor designs in every batch (20201 *No.*, 20167 *Grapevine*, 5230 *Danish Church*) to measure each
  judge's drift; scores are corrected by it (it stayed within ±0.3).

Aggregation: DELETE when at least 3 of 6 judges say so, KEEP when at least 4 of 6 do, else IMPROVE.

## 2. The panel on all 181 shop designs

Scores spread from 3 to 9 (mean 6.1). 26 KEEP, 122 IMPROVE, 33 DELETE.

## 3. The 33 DELETE designs were retired

Through the repo's own path: `data/curation/retired.json` (reason "calibrated panel, Oct 2026: delete, average X"),
removed from `data/curation/live.json` and `scripts/gen/shopCategories.json`. The Pattern & Ornament category was left
with 3 designs, so it was closed (old `pattern` designs file under Architecture). Commit a330936.

## 4. The fixes

Of the 122 IMPROVE designs, 76 had notes that could be carried out without outside help (no new drawing, no image
model): retouching, cropping, removing frames and captions, re-toning, cleaning, re-spacing type, and code changes for
drawn-in-code designs. The other 46 need new drawing and were left alone.

- **55 archive / photo masters**: each master (`assets/masters/print_<n>.webp`) edited and screened again with
  `scripts/photos/halftone.py` (same recipe 2; `data/curation/halftone.json` updated).
- **12 studio prints**: the one-ink `data/studio/<run>/<folder>/<slug>.png` edited and published again with
  `scripts/studio/publish.ts` (`public/prints`, `assets/prints-hd`, `data/studio/catalogue.json`).
- **9 code designs** (7006 7008 7015 7016 7024 7026 7078 7085 7100): their generators changed in
  `scripts/gen/set7/{sky,architecture,terminal,systems}.ts` and `lib/custom/templates/{moon,sky}.ts`; every other
  design's print stays byte-identical.

The rule was "do no harm": each fix was compared before/after on the tee and kept only when the retoucher judged it
better. All 76 came back as fixed.

## 5. The re-panel was stopped early

The plan was to run the same panel again on all fixed designs and keep only fixes whose score did not drop. Only two
of the twelve judge runs finished (judges 1 and 3, on the first batch of 34 fixed designs), and the owner then stopped
it to save tokens and asked for all 76 fixes to go into the catalogue. What the two judges showed (old → new score of
the same judge; anchors moved ±0.5 at most):

| Judge | Up | Same | Down | Mean change |
|---|---|---|---|---|
| 1 | 24 | 9 | 1 | +0.76 |
| 3 | 21 | 10 | 3 | +0.47 |

Designs that went down with at least one of the two: 5072 *The Lotos*, 8066 *Thalamophora, Plate 81*, 20023 *Fern
Frond*, 20188 *San Juan del Sur*. They are in the catalogue as fixed; they are the first to look at again. The 42
designs of the second batch (including the 9 code designs) were not re-judged.

## 6. One side effect in the generator

The fixes raised the quality measure of many prints, so the taste test's bar (the top quarter for quality) went from
85 to 88 and no photograph reached it. `calibrationIds` in `scripts/generateCatalog.ts` now lets the strongest
photograph in when none reaches the top quarter (the taste test always rates one); `tests/families.test.ts` mirrors it.

## 7. Checks

Unit tests (1081), TypeScript and lint pass after `npm run generate`, `publishCustom`, `search:index` and
`uploadPriors`. As asked, no further panel round, build or end-to-end run was made for this change.

## Every fixed design

| n | Design | Kind | Panel score (Oct 2026) | What was changed | Re-panel (judges 1, 3: old → new) |
|---|---|---|---|---|---|
| 2803 | Diesel Radial Engine | master | 6.5 | Local-contrast pass (two-scale high-pass, overall tone kept) so the hub, crankcase, pushrods and fin ribs separate instead of going grey; Cleaned the cut-out edge (hard alpha, specks removed); Re-laid out on the full can | not re-judged |
| 3863 | The Outskirts | master | 5.7 | Cropped the ragged scan boundary to a clean rectangle and closed it with a thin solid keyline frame (deliberate edge); Removed small scan specks and faint grey haze in the sky; Recentred the scene on the canvas (it sat i | 6 → 7, 5.5 → 6.5 |
| 4128 | California Poppy (Eschscholtzia californica) | master | 5.8 | Erased the plate-edge rules at top, left and right; Removed the handwritten signature/caption block and stray specks; Lifted the light tones so the feathery foliage holds up in the screen; Compressed the darkest tones an | 6 → 6.5, 6 → 6.5 |
| 4141 | Proof of Design for a Printed Textile | master | 5.5 | Removed the speckled background stipple everywhere outside the motifs (and with it the rectangular swatch edge), so the vignette ends in its own organic foliage silhouette; Removed stray marks: faint cut-off grass blades | not re-judged |
| 4155 | Highbush Blackberry (Rubus argutus) | master | 5.5 | Removed the scan dashes along the top edge; Erased the faint pencil initials/date signature at bottom right; Dropped tiny isolated scan specks | not re-judged |
| 4170 | The Two Ships | master | 6.4 | removed plate border lines and corner marks; removed the black lifebuoy blot at lower left; re-separated as clean solid line (thin rigging lifted, grey grit dropped) instead of dotted tone; faded the bottom water out irr | not re-judged |
| 4198 | The Town | master | 7.0 | evened out the blotchy grey patch on the big left gable wall to the wall's own solid ink; removed the hard rectangular frame rule (with its ragged bottom edge) so the rooftops and masts open to the sky at the top; remove | not re-judged |
| 4236 | Lily | master | 6.4 | removed the pencil signature/date scribble beside the stem base; faded the ragged cut stem base into a soft taper; cleared faint scan haze and specks around the petals (levels cut + speck removal); S-curve contrast so th | 6 → 7.5, 6.5 → 7 |
| 4321 | Designs for a Gate | master | 5.3 | Cropped to the arched gate alone: dropped the side railing, pilaster, wall, escutcheon row, captions and dotted plate border; Masked the gate to its own arch-and-rectangle silhouette (no stone-arch line or impost stubs); | 5 → 6.5, 5 → 7 |
| 4564 | Flower Branch, from Fleures Persannes | master | 5.8 | Re-rendered the engraving as solid line (2x upsample + steep curve on the master) so leaves and stems print as crisp ink, not grey dot grain; Darker, stronger strokes overall; pale top-right sprays given a lower threshol | 5.5 → 6.5, 6 → 6.5 |
| 4579 | Velocipede Patent Model | master | 6.1 | Erased the half-legible stamped name on the fork plate (inpainted from the plate); Opened up the hub: local contrast and shadow lift around the mechanism so gears, cranks and spring read; light sharpening overall; Scaled | 5.5 → 7.5, 6 → 7.5 |
| 4638 | Winterberry (Ilex verticillata) | master | 5.6 | removed plate-border marks and stray dots (kept only the sprig); removed handwritten 'M.Y.W. 1.15.1920'; set a small typeset caption: WINTERBERRY / Ilex verticillata (Libre Caslon); reframed: sprig enlarged to fill the c | 6 → 7.5, 5.5 → 6.5 |
| 4700 | Chickadee | master | 5.3 | Removed the plate border lines, bottom rule, pencil notes and signature; Took off plate tone and despeckled stray specks; Tapered the cut-off branch (left) and needle ends (right) so they finish inside the composition in | not re-judged |
| 4713 | Modern Art | master | 6.1 | Landscape panel re-cut from the master into three flat screen tones (paper / 40% / full) instead of grainy halftone; Title, credits, stems and flowers pushed to solid strokes; flower highlights as one flat tint; Removed  | 6 → 6, 6 → 6 |
| 4780 | Pentstemon (Pentstemon barbatus) | master | 5.1 | Removed the handwritten 'M.V.W. Grand Canyon 7.15.1934' note; Cleaned faint grey wash, ghost fragments and isolated specks around the stems; Re-toned the master: local contrast plus an S-curve with a floor so each coroll | not re-judged |
| 4826 | California Pitcherplant | master | 5.9 | Removed the signature/date at bottom left, the vertical rule at the left edge and stray specks (kept only the plant); Re-toned the master: edge-preserving denoise, local contrast and an S-curve so the hoods and leaves re | not re-judged |
| 4970 | Blueflag Iris (Iris versicolor) | master | 5.8 | Tapered the three top-cropped leaf blades to natural pointed tips (mask only); Faded the flat-cut stem bases and the left-edge cut of the long leaf; Removed the handwritten signature and date (AVW / Washington / 1919); L | 6 → 7, 5.5 → 6 |
| 5072 | The Lotos | master | 7.1 | Cut the scan to clean two-level line art at full print size: leaves now carry one even ink from the scan (no white grain), so they screen as a regular mesh instead of speckle; Smoothed the ragged edges of all lettering ( | 7 → 7, 7.5 → 7 |
| 5104 | Bird and Berry | master | 6.4 | Removed the pencil signature and plate number; Removed the faint plate-mark rules (bottom baseline, left and right verticals, top corner ticks); Re-toned the engraving: paper haze dropped, strokes pushed to full ink so h | not re-judged |
| 5116 | Firehouse | master | 5.2 | Cleared the speckle and top-left scraps from the sky, keeping the weathervane and finials; Removed both pencil signatures/captions; Faded the cropped neighbouring buildings and the pavement out instead of hard rectangula | not re-judged |
| 5201 | Bottle Gentian (Gentiana saponaria) | master | 5.7 | Removed the pencil signature at bottom left and stray scan marks; Raised contrast (local contrast plus tone curve) so petals and leaves read instead of sinking into grey; Faded the stem ends out over the bottom instead o | 5.5 → 6, 5 → 5.5 |
| 5233 | Moccasin Flower (Cypripedium acaule) | master | 5.4 | Erased the pencil monogram/date at bottom left; Faded the flat-cut stem base into a soft dot-fade instead of a hard horizontal line; Boosted contrast (mid-tone darkening plus local contrast) so the flowers read further;  | not re-judged |
| 5261 | Ipswich Prints: Poppy | master | 6.6 | Removed the stray dotted scan line below the frame and the specks outside it; Filled the grainy block-print ink solid (smooth + threshold + pinhole fill, speck removal); leaves and bud now print as even ink/mesh, keeping | 7 → 7, 7 → 7 |
| 5311 | Parrot Pitcherplant (Sarracenia psittacina) | master | 5.9 | faded the flat-cut base of the plant over its last few mm instead of a hard horizontal crop; removed the 'M.V.W. 5.14.1925' signature/date and the stray specks and edge marks; gentle local-contrast (unsharp) pass so the  | 5 → 7.5, 6 → 7 |
| 5322 | Old House on 29th St., East of 3rd Ave., N.Y. | master | 5.1 | cut the buildings out along the roofline: sky hatching and scan noise erased; removed the plate-mark rectangle, blank pavement, pencil inscription and signature; softly vignetted the cut left/right/bottom edges so it flo | not re-judged |
| 5337 | Maypop (Passiflora incarnata) | master | 5.3 | erased the faint ghost leaf and stray tendril at top right and the grey wash above the top leaf, plus specks; replaced the straight plate cut-offs (left, right, bottom) with an irregular feathered edge so leaf tips disso | not re-judged |
| 5406 | Engelmann Spruce (Picea engelmanni) | master | 5.4 | erased the pencil monogram/date/number notes at lower left and stray specks; local contrast (CLAHE) plus a light gamma inside the drawing so cones separate and the needle haze clears; turned the branch 180 degrees so the | 5 → 5.5, 5.5 → 5.5 |
| 5521 | One Hundred Famous Views of Edo | master | 5.2 | cut the carp out (GrabCut from a traced outline, edge smoothed) and masked away the landscape, plate rectangle, panel divider and both cartouches so the fish floats alone; faded the tail out where the plate bottom and di | not re-judged |
| 5551 | The Third Knot | master | 6.7 | removed the rectangular frame and the empty band below; recentred and enlarged the art with an even margin; turned the dithered disc inside out so the knot prints as clean solid line on open ground (no halftone fill), wi | 7 → 7.5, 7 → 8 |
| 5552 | The First Knot | master | 6.0 | Removed the hairline rectangular frame so the roundel and corner ornaments float; Cleaned the speckled halftone grit in the dark disc to an even solid ground (it screens as one even dark mesh) with crisp, smooth-edged wh | not re-judged |
| 7006 | Night Sky over Baikonur, 5 October 1957 | code | 7.3 | Sputnik cue: the plane of PS-1's first orbit as seen from the pad (launch azimuth about 37°, from the 65.1° inclination) drawn as a dashed track across the sky on a knock-out band, with a small Sputnik glyph and 'PS-1' h | not re-judged |
| 7008 | Moon Phases of 1969 | code | 7.6 | 20 July marked: a pointer above the day and a one-line label '20 JULY · APOLLO 11' under it (drawn in the moon template's catalogue path for 1969, so the template test still holds); Crescent/gibbous glyphs: the hairline  | not re-judged |
| 7015 | Analemma at Greenwich | code | 7.9 | Month markers: path dots knocked out under each ring; every ring now holds one centred dot (SEP, MAR, FEB, OCT, JAN fixed); 15°/62° labels attached to a thin altitude axis at the right with 10° ticks; Checked the dates:  | not re-judged |
| 7016 | Hours of Daylight in Tromsø | code | 7.2 | 365 hairline bars replaced by 52 solid weekly bars (3 units wide) that print as ink, not moiré; Y axis reduced to 0 / 12 / 24 and set larger, month initials larger; Midnight sun bracketed and labelled over the plateau; p | not re-judged |
| 7024 | Lancet Arch | code | 6.2 | Apex resolved: the extrados arcs run on until they meet in a point, and the keystone is a pointed wedge between the last joints of the two arcs (no flat cap); Construction made the decoration: dashed radii from each cent | not re-judged |
| 7026 | Horseshoe Arch | code | 6.9 | Springing redrawn: intrados returns to the springing points with the inner jamb faces rising straight into it; last voussoirs sit on level beds; the extrados is carried down to the springing line and the outer jamb rises | not re-judged |
| 7078 | Bridge Rectifier | code | 6.8 | Circuit redrawn planar and symmetric: + at the top and − at the bottom of the diamond, load RL inside between them, AC source centred below feeding the side corners. No wire crosses another, diode orientations are correc | not re-judged |
| 7085 | Aneroid Barometer Dial | code | 6.0 | Point of view: the needle has dropped to 28.2 (Stormy) while the set hand is still at 30.45 (set fair); subtitle 'It was fair this morning' replaces '28 to 31 inches of mercury'; Needle redrawn tapered, with a counterwei | not re-judged |
| 7100 | 5 × 7 Dot-Matrix Alphabet | code | 6.8 | Grid rebalanced to 7 columns: A–Z fill four full rows, ending with a blank cell and a lit block cursor (the hook: the alphabet as just typed on a character LCD); Ghost dots slightly more visible (r 0.5 to 0.65), rows tig | not re-judged |
| 8002 | Radiolaria (Challenger) Plate 010 | master | 6.4 | Removed the running head, figure numbers, faint plate border and the species caption so the specimens float free; Cleaned the crunchy halftone into crisp solid line work (2x upsample, unsharp, near-binary tone curve, str | 7 → 7.5, 6.5 → 7 |
| 8003 | Die Radiolarien | master | 7.0 | Removed the plate number and all figure numbers (1-9) plus stray specks; Rebuilt the master at print size and pushed every thin stroke (spines, halo filaments, lattice edges) to solid ink with a top-hat line boost, so th | not re-judged |
| 8007 | Medusae Plate 01 | master | 5.4 | Removed the plate header, border rules, figure numbers, letter labels and the delineator/lithographer credits; kept the legible species name THAMNOSTYLUS DINEMA; Strengthened ink: lifted faint stipple and line with a gam | 5.5 → 7, 6 → 7 |
| 8014 | Octopus verrucosus | master | 6.8 | Removed the plate header, figure numbers, the four small detail figures, the species caption and the lithographer's credit so the octopus stands alone; Cut the grey lithographic raster into crisp one-ink stipple from the | 6 → 8.5, 6.5 → 8.5 |
| 8016 | Radiolaria (Challenger) Plate 011 | master | 5.6 | removed plate header text, footer credits, old caption, plate frame and figure numbers 1-5; cropped to the plate interior and reframed larger on the canvas with margin; set a clean, enlarged LYCHNOSPHAERA caption in Cinz | not re-judged |
| 8020 | Radiolaria (Challenger) Plate 018 | master | 6.4 | Isolated four specimens (figs 8, 3, 5, 1) from the crowded plate and set them in a staggered two-column layout with breathing room; Dropped the overlapping middle tangle (figs 2, 4, 6, 7, 9, incl. the long thin stalks),  | 6.5 → 6.5, 6.5 → 7 |
| 8021 | Radiolaria (Challenger) Plate 021 | master | 6.9 | Removed the plate border (hairlines only; spine tips crossing it kept); Removed the illegible header lines, all figure numbers and the engraver/lithographer credit lines; Reset the title HEXASTYLUS in clean letterspaced  | not re-judged |
| 8027 | Radiolaria (Challenger) Plate 027 | master | 6.5 | Removed the plate header, figure numbers, frame rules, credits and CLADOCOCCUS caption so the creatures float free; Central specimen: stipple corona pulled back to a light tint and local contrast on the lattice shell, so | not re-judged |
| 8034 | Radiolaria (Challenger) Plate 036 | master | 5.7 | Removed the plate frame rules, the header line, the genus caption, the engraver credits and the eight figure numbers so the specimens float on the shirt; Lifted the pale lithograph line toward full ink so strokes print s | 5 → 6.5, 6 → 6 |
| 8035 | Radiolaria (Challenger) Plate 055 | master | 6.7 | Re-thresholded the master at 2x (global + local threshold, speck removal) so the lattices print as clean solid line instead of grey halftone speckle; Removed the tiny plate header ('The Voyage of H.M.S. Challenger' / 'Ra | 6.5 → 7, 7 → 7 |
| 8047 | Radiolaria (Challenger) Plate 109 | master | 7.2 | Cleaned the blotchy central capsule: denoised it and re-toned it into a light, even capsule with a defined edge and the lattice crossing it as line; Removed the illegible plate header, all figure numbers, the engraver cr | 6.5 → 8, 7 → 7.5 |
| 8048 | Radiolaria (Challenger) Plate 110 | master | 6.5 | Isolated the central sphere (fig. 1); dropped the margin specimens, the plate header, figure numbers and scale brackets; Re-thresholded the sphere at print size (global + local threshold, speck removal) so the lattice an | not re-judged |
| 8049 | Radiolaria (Challenger) Plate 111 | master | 7.2 | Removed the illegible plate header ('The Voyage of H.M.S. Challenger' / 'Radiolaria Pl. 111'), the faint frame rules and the lithographers' tiny credit lines; Re-toned the master at 2x: each pixel scaled to its local lin | not re-judged |
| 8054 | Radiolaria (Challenger) Plate 118 | master | 5.9 | Removed the plate header line and the figure numbers 1/2/3; Isolated the main organism: erased side figures 2 and 3 and their stray fragments; Recut the dithered branching as solid, slightly heavier strokes (2x master, s | not re-judged |
| 8066 | Thalamophora, Plate 81 | master | 6.7 | gave the plate a clean even margin so nothing runs to the print edge; removed scan speckle around the small specimens; re-toned for crisp line and solid: local contrast plus an S-curve that drops pale wash to paper and f | 6.5 → 7, 7 → 6 |
| 8067 | Discomedusae, Plate 98 | master | 6.8 | Re-toned the master: light denoise, then a gamma lift on the light greys so tentacles and oral arms screen as continuous line instead of dust, plus a mild unsharp mask; Stronger lift on the faded top-left and top-right m | 7 → 7.5, 7 → 7.5 |
| 8112 | Cordouan Lighthouse Elevation | master | 5.7 | Removed the broken plate frame lines, the sea strip and the scale bar under the rocks, and the scan dust in the sky; Reset the split title as one closed-up, centred line above the spire tip (original lettering, 1.3x, cri | 5 → 5.5, 6 → 6.5 |
| 9039 | The Fish–monger | master | 6.5 | Re-thresholded the master at print size (global + local threshold) so the keylines in faces, robes and baskets print as continuous solid strokes instead of dotted halftone; Removed the dust, speckle and dotted margins ar | not re-judged |
| 9053 | An American Sailing Ship off Arai | master | 6.8 | removed the floating seals above the top-right corner, paper edge line and stray specks; tightened the reframe around the print's frame with an even margin; firmed thin strokes (calligraphy, seals, rigging, wave lines) t | 6.5 → 7.5, 7 → 7.5 |
| 9059 | The Celestial Map- Northern Hemisphere | master | 5.2 | cropped to the round star chart (zodiac circle plus the figures on it), dropping the rectangular box rules, corner astronomers and their captions; removed cut-off cloud/astronomer slivers at the rim; rebuilt the woodcut  | not re-judged |
| 10044 | Three-Masted Ship Steering to the Right | master | 5.7 | Recut the grey hatching as solid strokes with a density-adaptive cut (2x master): no dither grit, fine rigging holds, dense hatching doesn't clog; Ended the scattered wave marks at the base in a soft oval round the hull  | 5.5 → 6.5, 6 → 7 |
| 10062 | Chinese Ship (To Sen) | master | 5.9 | Removed the plate rectangle: cleared paper edges, border lines and corner mark; the sea now fades out in a soft oval and eases in at the horizon; Lightened the flat sea tone so it is less muddy (especially white-on-black | not re-judged |
| 10081 | The Fifth Knot | master | 6.7 | removed the rectangular frame; removed the faint, broken marginal flourishes; kept the roundel, stems and four corner leaves; cleaned the scan to crisp two-tone: uniform ground, clean knot lines, speckle removed; recentr | not re-judged |
| 10082 | The Sixth Knot | master | 6.0 | Removed the broken rectangular frame; Removed the faint, broken flourishes around the roundel; kept the roundel, its stems and the four corner leaves; Cleaned the worn scan to crisp two-tone: the mottled, blotchy ground  | not re-judged |
| 11004 | Rousseau Dinner Service: Fish | master | 6.2 | Cleaned the dithered scan into crisp line work: strokes, fins and scales now print solid (2x upsample, unsharp, steep tone curve); Removed the sheet's faint rectangle edge, the scan speckle around the border and the ille | not re-judged |
| 20023 | Fern Frond | studio | 6.6 | Dropped the generic 'Botanical · Natural history plate' subtitle; title FERN FROND now set larger with the heading rule (more presence); Re-cut the frond from the model's source in engrave mode (line and solid only), so  | 7 → 7, 6.5 → 6 |
| 20052 | Sea Urchin | studio | 7.2 | Found the grey halftone patches (screen dots and pinhole screens) and replaced them by carrying the spines and the gaps between them straight out from the centre through each patch, so the spines are solid ink; Smoothed  | not re-judged |
| 20111 | Antique Telescope | studio | 6.0 | Removed the grey halftone shadow blob, the shadow streaks and the ruled floor marks under the tripod; each foot is cut cleanly round its sole so the legs and feet stay intact; Removed the filler 'Objects · Elevation' sub | 6 → 7, 6 → 6 |
| 20152 | Nobody Had Looked | studio | 7.5 | Replaced the hard straight crop on the left and top of the flea's body with a rounded oval vignette: the hatching lines now end one by one across a narrow band, like an engraver's fade, so there is no straight edge or sq | not re-judged |
| 20162 | Eiger | studio | 7.6 | Cut the ragged right ends of the flank's scan lines to one smooth oval curve fitted to where the lines end, with rounded tips; Removed the frayed hairs at the end of the skyline; Removed about 140 tiny broken flecks from | 8.5 → 8.5, 7 → 8 |
| 20168 | Fermentation | studio | 6.7 | removed the stray tick mark left of the yeast inset; enlarged all twelve labels by about 20% (titles 15%), each scaled about the side its leader meets so leaders still land | not re-judged |
| 20169 | Oak Barrel | studio | 6.2 | Reframed the sheet around the barrel elevation and exploded stave view as the hero, set 9% larger across the full width; Dropped the three hoop panels (top/middle/bottom, with their inconsistent 570/690 mm hoop diameters | 5.5 → 5.5, 6 → 6 |
| 20173 | Summit Ridge | studio | 7.0 | Re-cut the model's picture with its own build at a lighter binarize (170 vs 140): the distant ranges keep their hatching as continuous line instead of broken dashes, so the far ranges read as one solid range; Scaled the  | not re-judged |
| 20182 | El Calafate | studio | 6.4 | Removed the stray dots and baseline dashes between every place name and its distance (8 boards); Filled the screened mesh patches in the apexes of the three A's in EL CALAFATE as solid letterform ink | 6 → 6, 6 → 6 |
| 20184 | Belize | studio | 5.8 | Pulled the BELIZE heading and the coordinates tight to the scene so the three read as one unit; heading 45% larger, coordinates reset larger in the heading's face (Space Grotesk); Gave the scene a defined shape with the  | not re-judged |
| 20188 | San Juan del Sur | studio | 6.1 | Re-set the top arc 'SAN JUAN DEL SUR' from its own letters: 86% size, even letter and word spacing, centred on the top, with a clear gap to the inner ring instead of jamming against it; Removed the 'SURF COMMUNITY' sloga | 6 → 5.5, 5.5 → 5.5 |
| 20197 | Probably Fine | studio | 8.0 | Re-ran the design's own code build with 'PROBABLY FINE.' moved 16 mm lower, so the punchline has clear space below the grid; Rebuilt the coolant icon in the standard ISO thermometer-in-waves form: a solid bulb sitting in | 8 → 8, 8 → 8 |
