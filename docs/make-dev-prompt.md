# Make: הפרומפט לפיתוח

מעתיקים את כל הבלוק לסשן חדש של Claude Code על הריפו.

````text
You are working in the MONO repository (Next.js, static export). Build all of the
work below, end to end, without stopping between waves. Commit locally after
every product (and every infrastructure step) with a clear message, and keep the
branch green at every commit. Do NOT push anything to the remote while you work:
no git push of any kind until everything below is finished and checked.
Push once, at the very end (section 5). Only stop early for something
you truly cannot do (for example the network policy blocks a data source); then
say exactly what is blocked and carry on with everything else.

============================================================
0. READ FIRST
============================================================
Read README.md (especially "Make: from ours, from yours"), docs/brand-book.md
and docs/content/waves.md. Then study how an existing "later" Make product is
built end to end. Use Your Snowflake as the reference and read every file it
touches:

  lib/custom/specs/snowflake.ts        params, strict check, detail, PRODUCT meta
  lib/custom/specs/index.ts            EXTRA registry
  lib/custom/specs/types.ts            SpecModule / ProductMeta
  lib/custom/templates/snowflake.ts    render(spec, colour) -> SVG string
  lib/custom/renderers.ts              lazy template registry
  lib/custom/products.ts               SHIPPED list, MAKE_GROUPS, ORDER
  lib/custom/spec.ts, specKit.ts       validate, encodeMake, WORDS, cleanWords, label, wordsOf
  lib/custom/kit.ts                    text(), caption(), helpers
  lib/custom/svg.ts, canvasSvg.ts      wrap(), the live canvas renderer and its fonts
  lib/custom/printCheck.ts, quality.ts the gate
  lib/custom/lexicon.ts                refused words
  components/custom/MakeView.tsx       lazy editor registry, the product page
  components/custom/editors/*          SnowflakeEditor, Field.tsx, types.ts, CityField
  lib/custom/forTwo.ts, components/custom/ForTwo.tsx
  lib/custom/templates/family.ts       arcText (letters along a circle)
  lib/custom/draw/pixelFont.ts         the 5 x 7 pixel font
  tests/make/snowflake.test.ts, tests/make/fuzz.ts, tests/make/wideTexts.test.ts
  e2e/make-ours.spec.ts, e2e/helpers.ts
  scripts/tools/buildCities.ts, publishCustom.ts, scripts/sources/*

Also open every template in lib/custom/templates/ and note each call of
caption(y, title, sub?, sub2?) and where its lines come from (wordsOf `w`, a
date, a place, a computed fact).

============================================================
1. HARD RULES (already enforced by the codebase; never weaken them)
============================================================
- One ink. A print is a two-tone SVG in the allowed subset: no clipPath,
  pattern, mask, textPath, defs, use, opacity, gradient, ellipse, polygon,
  polyline, no transform attribute, no NaN (see FORBIDDEN in the tests).
  Hatching is drawn as lines. Text on a circle is placed glyph by glyph.
  Nothing may need a second colour: a design that only reads in colour is
  refused.
- Every print must pass the catalogue's gate in BOTH colourways (solidBlock
  refused, quality >= 53; tests/make/fuzz.ts `gate`). A failing print says why
  in one line and cannot be bought. Fix the template, never the fuzz or the
  thresholds.
- Every printed text field goes through the lexicon (useLexicon / wordsProblem)
  and the words rule (specKit WORDS: Latin script only). Do not add Hebrew or
  RTL.
- A spec is { t, v: 1, p }: small, strict, validated field by field, unknown keys
  dropped. It travels in ?make= and in the bag line. Every product's test asserts
  its longest ?make= is under 300 characters (a larger bound only if stated and
  justified in the test).
- Everything runs on the device. No runtime network calls, no new CSP entries,
  no backend. Data is built at build time and published under content hashes
  like data/cities, and loaded only on the pages that need it.
- Deterministic: the same spec renders byte-identical SVG.
- Existing links, bag lines and saved orders must keep working: every change to
  an existing spec is additive (a new optional key), never a rename or a new
  meaning for an old key.
- British English and the brand voice: short, factual, deadpan, no exclamation
  marks, no "premium" or "special". No brands, logos, real famous people, or
  imitations of official documents (IDs, currency, real passports' data pages).
- Match the surrounding code's naming, comment density and idiom. Each product
  is its own template chunk, spec module, editor and test file.
- Artwork and data: public domain or CC0 only, with the source and licence
  recorded (README, and per item like data/photos). Follow docs/content/waves.md:
  scripts measure, no picture is judged by you. Build a review page for the
  owner beside shipping.

============================================================
2. WAVE 0: INFRASTRUCTURE
============================================================
T1 Print fonts. Add three OFL fonts beside DejaVu Sans Mono: a text serif
   (Libre Caslon Text, regular and bold), a condensed sans (Oswald, regular and
   bold) and a blackletter for mastheads (UnifrakturMaguntia). Subset each to
   Latin, digits and the WORDS punctuation as WOFF2 in public/fonts, with their
   licence files. Register them in lib/custom/canvasSvg.ts (the live preview) and
   wherever the tests, scripts/gen/quality.ts and the audit load fonts for resvg,
   so the gate measures the same glyphs. Extend kit.text with an optional
   family: "mono" | "serif" | "condensed" | "blackletter", default mono. Add a
   test proving every existing product's example SVG is byte-identical. Generate
   each family's advance widths at build time into a small JSON so templates can
   measure text without a DOM.
T2 A shared "places and years" editor (components/custom/editors/PlacesField.tsx)
   on top of CityField: an ordered list of up to N rows { city id, year? } with
   add, remove and reorder. City names come from the list, not free text. A
   matching packed spec helper in specKit (like journey's stops) with its check
   and tests.
T3 Move arcText from templates/family.ts into kit.ts. Family's output must stay
   byte-identical.
T4 Build-time data: countries from Natural Earth admin-0 1:110m (public domain;
   ISO A2/A3, name, simplified outline projected in Equal Earth, rounded; tiny
   states as a point) and airports from OurAirports (public domain;
   large_airport, plus medium_airport with scheduled service, with IATA, name,
   city, country, lat, lon). Scripts go in scripts/tools, outputs are published
   under content hashes, and README records sources and licences.
T5 Two new Make groups in MAKE_GROUPS, after "place":
   { id: "travels", label: "From your travels" } and
   { id: "form", label: "In a form you know" }. The index filter, its counts,
   ?g= and the cards must handle them, with tests.
T6 A text-fitting helper in kit: wrap words to a width in a given family and
   size, shrinking a step at a time to a floor. It returns the lines, or null
   when they cannot fit; the editor then says "Too long for the print. Try
   shorter."

============================================================
3. WAVE 0.5: EDITABLE CAPTIONS ON EVERY "FROM OURS" DESIGN
============================================================
Goal: on every From ours product (the 31 existing ones and every new one
below), the visitor can change each line of text printed under the design
itself (the caption: the title line and the one or two lines under it), whether
that line is fixed ("Every day at 00:00 UTC"), computed (a date, a place, a
count) or already typed (the words `w`).

C1 The spec. Add one optional key to every product's params, the same
   everywhere: `cap`, an array of up to 3 entries, one per caption line in
   order (0 title, 1 sub, 2 sub2). Each entry is null (keep our line, the
   default) or a string (the visitor's line, the words rule, lexicon-checked,
   the line's own max length). A trailing run of nulls is dropped, and absent
   `cap` means all default, so every existing link, bag line and test stays
   valid and byte-identical. Validate it in one shared helper in specKit
   (capOf), used by lib/custom/spec.ts for the original products and by every
   spec module in lib/custom/specs. Where a product already has `w` for its
   first line, keep `w` working exactly as today. `cap[0]` is the same line:
   if both are present, `cap[0]` wins, and the editor writes only `cap`, while
   the validator still reads old `w`. Decide per product whether an empty line
   is allowed (hide it). Allow it only if the example with that line hidden
   still passes the gate in both colours, and test it.
C2 The render. Change kit.caption so each template passes its default lines and
   the spec's overrides through one helper (for example
   `captionLines(defaults, cap)`) and nothing else changes: same positions, same
   sizes, same fitting (title upper-cased as today). With no `cap`, every
   template's output must be byte-identical (test all examples). A line that is
   too long for its size falls back to the existing fit(), or to T6, and then
   the editor refuses it in one line.
C3 The editor. Add one shared component (components/custom/editors/CaptionField.tsx)
   under every product's own fields, collapsed by default as "Edit the text
   under the print". It shows each caption line in an input prefilled with the
   line we print now (updated live as the other fields change, as long as the
   visitor hasn't edited that line), a small "Reset" per edited line, and the
   same error style as Field (lexicon: "Those words name a brand." / "We don't
   print that."; length; words rule). Wire it into MakeView for every editor.
   For products whose caption is computed from other fields, an edited line
   stops following them until it is reset, and says so in its hint ("Yours. Reset
   to follow the date.").
C4 The bag and the page. The bag line's detail and the product page's title use
   the visitor's title line when set. Analytics record only that captions were
   edited (`customize_apply {caption_edited: 0-3}`), never the text.
C5 Tests. Per product: an example with all three lines edited passes the gate in
   both colours. The longest link with `cap` at its maxima stays under 300. `w`
   and `cap` interplay is covered. Old specs (without `cap`) round-trip
   unchanged. Extend the fuzz to include `cap`. One e2e test edits the caption on
   three different products, reloads the link in a fresh context and finds the
   same text, then resets a line.
C6 README: document `cap` in the spec paragraph and the editor paragraph.

============================================================
4. THE 21 NEW PRODUCTS
============================================================
For each product write the spec module, template, editor, registry entries,
PRODUCT meta with a real example that passes the gate in both colours, a test
file modelled on tests/make/snowflake.test.ts (spec accepts and refuses, longest
link, determinism, forbidden SVG, example gate in both colours, a fuzz over the
whole input range), `cap` support (section 3), the SHIPPED entry, a README row,
and an e2e case (open, fill, see the canvas and ?make=, add to bag in M at $75,
reopen the link in a fresh context). Give every template enough structure (a
frame, rules, a border) that a short input does not fail as "faint", and cap
repeats so a long one does not fail as "dense". Kids' sizes are sold
(KID_SIZES): Dinosaur and Birth Announcement should work on them.

Wave 1: text products
1. telegram, "Your Telegram" (group form). A vintage telegram form in mono:
   TELEGRAM header, TO, FROM and date fields, the message in capitals on pasted
   strips, full stops printed as STOP. Message up to 160 characters.
2. editions, "Limited Editions" (people). A collector's label: LIMITED EDITIONS,
   up to 8 rows "No. 1 · Maya · 2015", a guilloche border (reuse the
   monogram/rosette guilloche), a round seal with a role and year ("Grandpa ·
   est. 1952"). Serif.
3. sayings, "Things They Say" (people). "THINGS SAVTA SAYS", 3 to 7 sayings in
   large quotation marks, a signature line. A second mode, "First words", has
   one word in a speech balloon with the child's name and date. Serif. The
   attribution is a private person the visitor names.
4. label, "Your Museum Label" (form). A wall label: bold name, "(b. 1990, Tel
   Aviv)", a medium line, a credit line ("On loan from her mother"), and an
   accession number from the date. Serif, wide margins, a hairline frame. About
   40 suggested deadpan lines we write, selectable or replaced.
5. credits, "Your Credits" (people). End credits: "A COHEN FAMILY PRODUCTION",
   up to 12 role/name pairs in condensed, a copyright line and year.
6. card, "Your Business Card" (form). An 85:55 card centred with a hairline frame:
   name, title, company, optional contact line. Three styles: classic (serif,
   centred), modern (condensed, left) and bone (mono). The editor says in one
   line that the contact line prints on a shirt. No logo upload.
7. receipt, "Your Receipt" (people, and For two). Three modes: receipt (mono,
   narrow slip, zigzag edges, "1x FIRST DATE ..... 0.00", TOTAL, a Code 128
   barcode of the date from our own encoder), terms (serif, numbered clauses),
   and review (five stars, a quote, "Verified partner since 2016"). About 60
   suggested lines.
8. message, "Your First Message" (people, and For two). Generic chat bubbles
   (rounded rectangles as paths), two sides, up to 6 messages with times, a date
   divider and a read line. No app's colours, shapes or names.
9. birth, "Your Birth Announcement" (people). A 1950s card: IT'S A GIRL, IT'S A
   BOY or HELLO WORLD; the name large; a table of date, time, weight, length
   (metric or imperial, validated ranges) and city (CityField); a fine border;
   optionally that night's moon (moonShape, astro moonPhase).

Wave 2: geometry
10. sign, "Your Sign" (form). Three styles: street sign (rounded rectangle,
    double frame, the name in condensed capitals, a small line under it), round
    plaque (text along the top arc via arcText, three centred lines, a rule),
    warning sign (ISO triangle or panel, one of 12 pictograms drawn in code:
    mug, bed, phone, iron, grill, ball, book, wheel, headphones, pram, dog,
    keyboard; "CAUTION" and a line).
11. signpost, "Your Signpost" (travels, and For two). A post in line drawing with
    arrow boards, one per place: city and real great-circle distance from home,
    each arrow pointing at the place's true initial bearing, with a small N at the
    foot. Boards are laid out without collisions. A "since" mode shows two
    cities, the distance between them and a year. Uses PlacesField and data/cities.
12. tour, "Your World Tour" (travels). A band-tour front: "NOA · WORLD TOUR ·
    1990–2026" in condensed capitals, then cities and years in two columns, 4 to
    24 rows. The title is selectable (World Tour, Family Tour, Farewell Tour) or
    the visitor's own.
13. lineup, "Your Line-up" (people). A top-down pitch in line drawing
    (football 11 with 4-4-2, 4-3-3, 3-5-2; five-a-side; basketball), a circle and
    a name, with an optional number at each position. Team name and season at
    the top. The editor offers "For the whole team": choosing a quantity adds that
    many to the bag in one step (existing bag API, sizes chosen per line).
14. patch, "Your Mission Patch" (people). A round patch: the outer ring with the
    mission name and crew names along the arc (arcText), one of 10 emblems drawn
    in code at the centre (rocket, orbit, mountain, wave, tent, plane, house,
    star, compass, boat), the date below, and the stitched border as a hatch.
15. sampler, "Your Sampler" (name). A Victorian cross-stitch sampler: alphabet
    rows, the name and year in the middle, a line of words, a repeating border
    and corner motifs. Every pixel is an X of two short diagonal strokes (reuse
    pixelFont). 6 borders and 8 motifs (tree, house, geometric heart, star,
    bird, flower, crown, ship) as pixel grids in code.

Wave 3: data
16. countries, "Your Countries" (travels). An Equal Earth world map from T4,
    thin coastlines, the chosen countries filled with diagonal line hatching,
    microstates as dots, and "37 / 195 · NOA · since 1990". Keep coverage under
    "dense" when many are chosen: hatch spacing grows with the chosen area.
17. flights, "Your Flights" (travels). Two modes. Boarding pass: name, FROM and TO
    as large IATA codes, date, seat, gate and a barcode. Departures board:
    split-flap rows ("TOKYO NRT 2019 BOARDED"), each character in its own cell.
    Airport search by city or code from T4.
18. passport, "Your Passport" (travels). A passport page with a fine guilloche
    security grid (lines, never a solid ground) and entry stamps scattered
    without overlap, each slightly rotated (rotate the path coordinates, not with
    transform). Stamp shapes are procedural (circle, rectangle, octagon, hexagon,
    rounded, double ring) and each holds the country code, name, date and a small
    plane or train drawn in code. The layout is seeded by the list. The name
    goes in the header. No real passport's data page, emblem or layout.
19. frontpage, "Your Front Page" (form). A fictional masthead in blackletter
    ("The Daily Noa"), date and price line, a huge headline in condensed, a
    standfirst, and three columns of filler set in serif from about 30 deadpan
    paragraphs we write (never lorem ipsum), with rules between columns.

Wave 4: artwork
20. dinosaur, "Your Dinosaur" (name). A palaeontology plate: a skeleton, a
    scientific name built from the child's name with rules for endings
    (-saurus, -raptor, -don, -ceratops, never an existing genus name exactly),
    "Discovered 2019 · Height 112 cm · Diet: pasta" and a scale bar. Artwork:
    8 skeleton plates from O. C. Marsh, The Dinosaurs of North America (USGS,
    1896, public domain): T. rex, Triceratops, Stegosaurus, Brontosaurus,
    Allosaurus, Diplodocus, Iguanodon, and a pterosaur plate. Fetch the scans via
    scripts/sources (Wikimedia, Archive.org, Smithsonian adapters) and prepare
    them with the existing pipeline (_pipeline.ts: master, cut-out, one-ink
    line or halftone, measure). Record source and licence per plate, and build
    the owner's review page (scripts/review).
21. landmarks, "Your Landmarks" (travels). A grid of 3 to 9 landmarks, each a
    line or etched drawing in a small frame with its name and year, like a page
    of a travel journal, with "NOA · 2009–2026" under it. First set, 24: Eiffel
    Tower, Colosseum, Big Ben, Taj Mahal, Pyramids of Giza, Machu Picchu, Great
    Wall, Sydney Opera House, Golden Gate Bridge, Statue of Liberty, Western
    Wall, Petra, Acropolis, Sagrada Família, Tower Bridge, Leaning Tower of Pisa,
    Christ the Redeemer, Mount Fuji, Angkor Wat, Brandenburg Gate, Burj Khalifa,
    Empire State Building, Neuschwanstein, Santorini. Source public-domain or CC0
    engravings and photographs (the catalogue's archive first, then Wikimedia
    Commons PD, LoC, Smithsonian, the Met, AIC, Cleveland) through
    scripts/sources, and convert each to one-ink line art or halftone with the
    existing converters. Buildings only, by day (no Eiffel Tower night lighting),
    no people, no signage. Every drawing must pass the gate alone and in the grid.
    Build the owner's review page. The landmark picker shows thumbnails baked at
    build time.

For two: add cards for receipt, message and signpost ("since") to
lib/custom/forTwo.ts, only when the inputs allow them, each spec validated, with
tests in tests/forTwo.test.ts.

============================================================
5. CHECKS, DOCS, AND THE FINAL REPORT
============================================================
After every commit, run the project's checks: typecheck, lint, vitest (all of
tests/, especially tests/make and tests/forTwo), npm run generate staying
byte-identical, the Make e2e specs, and `npm run build` at the end of each wave.
Commits stay local.

At the very end, after the last product: run the full checks once more
(typecheck, lint, all of vitest, all e2e, npm run build), re-read the whole diff
against the starting point adversarially and fix what you find, and only then
push the branch, once (git push -u origin <branch>). Never push before this
point, not even to save work in progress.

Update README.md (the Make table with every new row, groups, fonts, data
sources and licences, `cap`), the product count everywhere it is stated
(README, brand book facts table, about page if it names one) and
docs/content/waves.md for the artwork waves. Do not change prices, policy or
the catalogue.

When everything is done and pushed, report:
- every product shipped and its longest ?make= length;
- what the gate refused on the way and how each template was changed;
- the caption change: which products had fixed or computed lines and now accept
  the visitor's own, and which allow hiding a line;
- the artwork: every plate and landmark with its source and licence, and the
  review page path;
- screenshots of every example in both colourways and of the caption editor
  (Playwright with the pre-installed Chromium at /opt/pw-browsers/chromium;
  never run "playwright install");
- anything blocked (for example a data host the network policy denied) and what
  was done instead.
````
