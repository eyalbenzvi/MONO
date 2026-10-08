# The design loop: one designer-approved print, no paid image model

How MONO's archive designs (Dürer's rhinoceros, Hooke's flea) were made, written so a session can run it
alone. One run of the loop yields one design. Nothing here publishes: the catalogue step (approve.ts,
publish.ts, generate) is the owner's, after review.

## Hard rules

- Sources: public-domain or openly licensed works fetched from museum and library APIs (the Met, Cleveland
  Museum of Art, Art Institute of Chicago, Wellcome Collection IIIF, Library of Congress, Internet Archive,
  NASA), or drawings and type made in code here. Wikimedia's API rate-limits scripts (429): fetch from the
  holding institution instead.
- An image model (Google Gemini) draws a subject only when the owner asks for one: write the owner a prompt
  (one subject, black line drawing on white, even line weight, no shading, no text, nothing else in the
  picture), the owner runs it and hands back the picture, and code does everything else (trace, type, layout,
  edits). The details file says so (Model: Gemini; Credit: "made with a generative tool"). No paid image API is
  called from here.
- Never edit `data/studio/catalogue.json`, `data/shirts*.json`, `public/`, or run publish/generate.
- Every agent you start gets its exact output file path (agents told "designer-K.json" overwrite each other).
- Facts in captions and details are checked, or left out.

## The steps

1. **Idea competition, 50 ideas from 100 seeds.** Diversity comes from the seeds, not from asking writers to
   differ. `python scripts/studio/competition/seeds.py <dir> --seed <new number> --black <share>` draws 3000
   candidate seeds (a format, a subject, a visual reference, a person, seven attributes in [0, 1]: humour, amount
   of text, density, abstraction, era, how niche, how much of the back the print takes; and a tee) and keeps the
   100 farthest apart, in
   five files of 20. `--black 0.3` when teeBalance says a black-only design is wanted, else 0. When the owner
   sets the subject, `--subject "<it>"` fixes it on every seed. Every shirt carries one print, on the back (at
   least 20 cm wide or 30 cm tall, at most 28 × 37 cm): both templates say so, and a ranker scores a chest mark or a
   front print 0. (The size attribute once ran from "small chest mark" to "big full-front print", and the writers
   followed it.)
   - **Write.** Five writer agents, one seed file each, template `scripts/studio/competition/GEN.md`: each picks the
     10 seeds that give the best shirts and writes one idea per seed: `printed` (exactly what is on the shirt: the
     image, the layout, the exact words; no explanation of the joke, no audience), `why`, and `tee`. List the
     designs already in the shop as excluded.
   - **Rank on the print alone.** Six persona rankers (template `scripts/studio/competition/RANK.md`; the panel's
     six personas, the customer chosen to fit the shop) each score all 50, 0–10, from a list of `id|printed`
     only, each in its own shuffled order: the `why` stays out, so an idea can't sell itself with an
     explanation the shirt won't carry. Average the scores.
   - **The owner looks.** Show the owner the top 20 (the printed text, the score, which are black-tee ideas) and
     recommend three to five. A ranker can like a joke the owner doesn't get or wouldn't wear: the owner reads
     the top ideas and chooses; explain any joke that needs it (the owner is the shop's first customer).
2. **Check the pick.** The chosen idea must (a) be buildable under the rules above (code, the shop's fonts, a public-domain source, or a subject the owner
   has an image model draw), (b) not repeat a
   design in the shop, and (c) pass the printability check: the composition the idea describes can print in one
   ink. For a traced source, measure its hatch spacing (autocorrelation of a row of the scan, in px) and the
   print scale the idea needs: spacing × scale must be ≥ 9 px (0.75 mm at 300 DPI), or the lines merge into
   black under the shop's 0.4 mm minimum line. (Hooke's whole flea at 27 cm: 0.43 mm, can't print; the idea
   lost a point to that.) Get the largest scan there is. Check the idea's facts (a probe that never went there,
   a date) and fix them before building.
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
4. **Panel.** Six reviewer agents score the print on its own (template below). They are not calibrated:
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
  `retro`, `classic`, `nature`, …; `photographic` is for photographs alone), only the keys that differ from the studio's defaults, which describe an
  archive plate (classic 0.6, pictorial 0.85, no type, no wit). A joke set in type needs at least `typography` and `wit`.
- `<slug>.txt`: Title, Category (a shop label, by what the design shows: Plants & Gardens, Animals, Under the
  Microscope, Ships & Sea, Travel & Landscapes, Architecture & Towns, Sky & Science, Workshop & Kitchen, Type & Wit;
  a delivery from before carries an old label, Engravings and the rest, and keeps it), Family, Subject, Style, Medium,
  Description (two sentences, checked facts), Tee colours (as decided under Tees), Print size, Keywords, Model (`Archive` or
  `Code`), Credit and source (work, maker, date, institution, object id, URL, licence), Licence.
- `sources/`: `brief.txt` (source URL and licence, the idea's competition rank and score, every panel round's
  average, why the loop stopped), the trace script or command with its parameters, the source image (PNG,
  ≤ 2400 px).
- `<run>/review/designs.json` (`[{no, folder, title, family}]`) and `designer-1.json` … `designer-5.json`
  from the panel round of the delivered version, with the design renumbered to its `no`.

## Templates

**Writer** and **Ranker**: `scripts/studio/competition/GEN.md` and `RANK.md` (each agent gets the template, its
seed or list file and its output file).

**Panel** (six reviewers, each defined only by its persona: screen-print production designer; apparel art
director for independent labels; graphic designer for composition and typography; a buyer for an online
t-shirt shop; a head designer at RVCA (the owner's choice, on every panel and every ranking from October 2026);
and one everyday customer chosen to fit the design's likely buyer): "This is a design for a $50
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
