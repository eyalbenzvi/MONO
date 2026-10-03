# The design loop: one designer-approved print, no paid image model

How MONO's archive designs (Dürer's rhinoceros, Hooke's flea) were made, written so a session can run it
alone. One run of the loop yields one design. Nothing here publishes: the catalogue step (approve.ts,
publish.ts, generate) is the owner's, after review.

## Hard rules

- No paid or external generators: no Gemini, no image APIs. Sources are public-domain or openly licensed
  works fetched from museum and library APIs (the Met, Cleveland Museum of Art, Art Institute of Chicago,
  Wellcome Collection IIIF, Library of Congress, Internet Archive), or drawings and type made in code here.
  Wikimedia's API rate-limits scripts (429): fetch from the holding institution instead.
- Never edit `data/studio/catalogue.json`, `data/shirts*.json`, `public/`, or run publish/generate.
- Every agent you start gets its exact output file path (agents told "designer-K.json" overwrite each other).
- Facts in captions and details are checked, or left out.

## The steps

1. **Idea competition, 200 ideas.** Ten generator agents write 20 ideas each, two per mode: type, diagram,
   code, photo, hybrid (a real object or artwork with words or a drawn twist). Template: below. Then ten
   persona agents score all 200, 0–10, each reading the list in its own shuffled order. Average the scores.
2. **Pick.** The highest-ranked idea that (a) you can build alone with the rules above, (b) is not on the
   excluded list, and (c) passes the printability check: the composition the idea describes can print in one
   ink. For a traced source, measure its hatch spacing (autocorrelation of a row of the scan, in px) and the
   print scale the idea needs: spacing × scale must be ≥ 9 px (0.75 mm at 300 DPI), or the lines merge into
   black under the shop's 0.4 mm minimum line. (Hooke's whole flea at 27 cm: 0.43 mm, can't print; the idea
   lost a point to that.) Get the largest scan there is.
3. **Build.** Line sources: `scripts/studio/archive/trace.py` (crop, seam or circle; upscale before the
   threshold; skeleton at 0.42 mm). Photographs and tone: `scripts/studio/oneink.py` (55 lpi halftone).
   Type: the shop's fonts in `assets/fonts`. `oneink.check` must report no fails. Zoom-check at full size for
   artefacts before every panel (stray marks, frame remnants, clipped rings, broken lines).
   **Tees.** Decide the tees before the panel, and look at the print in white ink on black as well as in black on
   white. The aim for the shop: most designs on both tees, leading with white and black about equally; small
   white-only and black-only groups of similar size. `scripts/studio/teeBalance.ts` prints the current counts, the
   tee the next both-tee design should lead with, and the one-tee group that is behind.
   - **Both** when the print still reads in white ink on black: type, silhouettes, line drawings, where ink is a
     shape and not a shadow. Lead with the tee teeBalance names, unless the design plainly reads better on the
     other (a night scene on black).
   - **White only** when ink is shadow and inverting it makes a negative (engraving hatching, halftone tone).
   - **Black only** when the design is made for a dark tee (a night sky, neon, a chalkboard) and not for white.
   When teeBalance says a black-only design is wanted, give part of the next idea competition's seeds a "made for
   white ink on a black tee" attribute, and brief the image model for a dark garment.
4. **Panel.** Five reviewer agents score the print on its own (template below). They are not calibrated:
   each is defined only by its persona, with no reference tees, no example scores, no anchor design and no
   word about the shop's taste or best sellers (an earlier panel told those drifted towards archive engraving
   and kept marking a photographic design down). On a white tee: ink where alpha > 127, colour (22,22,22),
   paper (244,243,240).
5. **Repeat 3–4.** Apply the fixes most designers agree on (two or more). Stop when the average is **above
   8** (done), or when the fixes stop helping: they contradict each other, ask for something the source can't
   give, or the score hasn't risen for two rounds; at most five rounds.
6. **Keep or go on.** Reached above 8: deliver. Stopped for another reason: deliver the best-scoring version
   if its average is **7.5 or more**; otherwise go back to step 2 for the next idea in line (at most three ideas
   for one design, then report what happened).

## Delivery (one folder per design, nothing published)

`data/studio/<run>/<NN>-1-<slug>/`, the shape publish.ts reads:

- `<slug>.png`: line art, RGBA 3307 × 4370, ink in alpha (a tonal print: `<slug>-white.png`).
- `<slug>-preview.png`: 1500 px wide, black on white.
- `print.json`: `oneink.check`'s output with `mode`, `edge`, `views`, `outline`, `ground`; `fails` empty; and the
  tees decided above: `tees` (`both`, `white` or `black`) and, with `both`, `teeDefault` (`white` or `black`).
  publish.ts follows them; a delivery without them falls back to the earlier rule (an outline drawing with under
  10% solid ink on both, anything else on white only), so designs already in the shop are unchanged. And
  `features`: what the design is, for the recommender (0..1 on the shop's feature keys: `typography`, `wit`,
  `retro`, `classic`, `nature`, …; `photographic` is for the Photographs category alone), only the keys that differ from the studio's defaults, which describe an
  archive plate (classic 0.6, pictorial 0.85, no type, no wit). A joke set in type needs at least `typography` and `wit`.
- `<slug>.txt`: Title, Category (a shop label: Engravings, Brush & Woodblock, Botanical & Nature, Maps & Sky,
  Architecture, Pattern, Geometric, Type, Photographs, ASCII & Code), Family, Subject, Style, Medium,
  Description (two sentences, checked facts), Tee colours (as decided under Tees), Print size, Keywords, Model (`Archive` or
  `Code`), Credit and source (work, maker, date, institution, object id, URL, licence), Licence.
- `sources/`: `brief.txt` (source URL and licence, the idea's competition rank and score, every panel round's
  average, why the loop stopped), the trace script or command with its parameters, the source image (PNG,
  ≤ 2400 px).
- `<run>/review/designs.json` (`[{no, folder, title, family}]`) and `designer-1.json` … `designer-5.json`
  from the panel round of the delivered version, with the design renumbered to its `no`.

## Templates

**Generator** (each agent: its mode and file): "A small online shop sells $50 t-shirts printed in ONE ink
(black on a white tee or white on a black tee). Write 20 t-shirt ideas excellent in your mode that people would
want to buy and wear, each with its own subject and angle, in any style (contemporary, graphic, illustrated,
photographic, typographic, technical...; no style is preferred, and no more than a few of your 20 may lean on
old archive engravings). Avoid: flat-pack instructions, 'how to hug', ensō circles, introvert/coffee/Monday
jokes, job slogans, 404 jokes, periodic-table puns, Great Wave parodies, 'I survived', wolves howling, bingo
cards, meme formats, and everything on the excluded list. For each idea, one or two sentences: what exactly is
on the shirt (exact words, if any) and why someone would want it. Write a JSON array
[{"idea":"...","mode":"..."}] to <file>."

**Ranker** (ten personas: screen-print production designer; apparel art director; natural-history
illustrator; editorial and poster typographer; sceptical museum-shop buyer; 28-year-old engineer who buys
few, smart, understated tees; science teacher who likes conversation-starting shirts; a gift buyer for a
curious, design-literate friend; streetwear and vintage-tee collector; art-history graduate working in a
gallery): "Each line of <list file> is 'id|idea'. Score each 0–10: how much people would want to buy and wear
it. Write {"scores":{"id":score,...},"top5":[{"id":..,"why":".."}]} to <file>."

**Panel** (five reviewers, each defined only by its persona: screen-print production designer; apparel art
director for independent labels; graphic designer for composition and typography; a buyer for an online
t-shirt shop; and one everyday customer chosen to fit the design's likely buyer): "This is a design for a $50
t-shirt printed in one ink: <one neutral sentence of what it shows>. Open the print whole (scaled down, as from
3 m) and crop into details at full size. From your own point of view, give ONE score 1–10 (halves allowed),
a verdict PASS / NEEDS CHANGE / DELETE, a short why, and the one fix that would raise it most. JSON to <file>:
{"reviewer","persona","score","verdict","why","fix"}." No reference designs, example scores or shop taste.

## What we learned (keep)

These come from rounds judged by a calibrated panel (reference tees and example scores that favoured
archive engraving); treat them as production notes, not as what sells.


- The panel is not consistent round to round: judge by averages, and stop when fixes contradict.
- A cut edge at the print boundary reads as a mistake; a cut along a natural seam (an armour plate) or a
  framing device (a microscope circle with a keyline) reads as deliberate. A dissolve on line art looks like
  the subject falling apart.
- Code-drawn imitations of woodcut read as vector clip art; a real source wins.
- Thin, small captions hurt; a caption set as part of the design (bold serif, about the art's width) helps.
- Black subjects in black ink (a raven) become a grey slab in halftone; small props vanish at 55 lpi.
- Type alone in a default face scores about 6.
- Archive work + a reframing caption scored best so far, but that is two designs, not a rule.
