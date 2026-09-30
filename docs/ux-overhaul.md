# UX overhaul: one thumb, one edit

A short log of the overhaul: the decisions given, the ones made along the way, and what each screen was before and after.

## Decisions given (applied, not reopened)

- Navigation is a quiet text tab bar at the bottom: **Discover · Shop · Make · Bag · You**. Only the wordmark sits at the top.
  - The bar is hidden during the taste test, on product pages, on the Make editors that have their own buy bar, and on the bag and checkout.
- Make stays a main tab. Its sub-tabs are **Personalise** and **Upload** (same URLs).
- "Your taste" is the profile; "Your edit" is the personalised shop and the shop's heading after the test.
- The archetype names stay as the reveal heading, without "You’re", plus one sentence.
- No Buy button during the taste test.
- Daily 5, streaks, taste levels and "% alike" are removed, with nothing in their place.
- Save replaces Like everywhere. The text stamps are replaced by a tint.
- The background stays black.
- Prices appear only at the moment of buying: the buy buttons, the Buy sheet and the bag, plus "Both · $90" on the colour picker. Make: $75 / $130.
- One demo disclosure, in checkout, under the order button: "Preview store. No payment is taken and nothing ships."

## Decisions made along the way

**Commits**
- The first seven phases share one commit. Discover, the reveal, navigation, the sheet component, the shop, the product page, the bag and the visual system all touch the same files (ui.tsx, ProductView, the stores), so splitting them left commits that didn't compile. Phases 8 and 9 have commits of their own.

**Controls and layout**
- One corner radius: **2px** for every control (buttons, sizes, fields, chips), 0 for images, 16px for sheet tops. This was picked over the full pill because it is closer to the benchmarks (COS, SSENSE, Acne Studios).
  - Icon-only round controls stay circles: Discover's Pass / Save / Buy, the zoom's ± and dots.
- The tab bar sits in the layout's flow, at the foot of the 100dvh column, not over the page. It never covers content, so no page needs bottom padding.
  - A shared `--dock` variable (lib/dock, hooks/useDock) tells the toast and the mini bag the height of whatever is at the bottom: the tab bar, a sticky buy bar, or the shop's control row.
  - The mini bag sits over a page's own buy bar rather than above it (`--dock-bag`). Above it, it covered the sizes the shopper had just chosen, and the bar under it already reads "In your bag · Checkout", so for its 5 s it stands in for the bar.
- The screens whose one action was mid-page moved it into a bottom bar: You before the test ("Start the taste test"), the empty bag, and the 404 and error pages (content aligned to the foot of the screen).
- Icons and text controls: the shop's control row, the Make index row and the tab bar are words only ("Black · White | Search | Filter"), so there is one icon style by having no icons there.
- The Buy sheet, taste sheet, filters, search, share, reveal and zoom all go through `components/Sheet.tsx` and `hooks/useHistorySheet.ts`.
  - An overlay that navigates away replaces its own history entry (router.replace), so Back never lands on a stale `#sheet`.
  - While the search sheet is open, a search replaces its `#search` step with the search's own address rather than stacking a new entry.

**Removals**
- The Saved drawer (3.5/3.6) had no opener left once You showed the whole list inline (6.4). It is removed rather than kept as dead code, and the list lives on You with "+" and × per row, Undo in the toast, and "Share list".
- The ⋯ menu (MoreMenu) was removed: the product page's Print view and Share moved out of it, and the taste sheet's reset moved to You, which left it empty.
- The empty bag's "Picked for you" row is removed (Your edit is one tap away on the CTA).
- The quiet desktop "How it works" column on Discover is removed: the strip above the card now says it on every screen size.

**Discover**
- "Reset taste" stays in two places: You (6.4) and the end of the deck when the drop is exhausted (8.2 renames "Start over" to it). 8.2 asks for it there explicitly, and it is the only way forward at that point.
- Shared tee → Discover: the saved tee can't honestly count as card 1 of 10 (the ten test cards are fixed and all still come), so the line reads "Saved <Title>. Ten more and your edit is ready." rather than "Nine more", which would contradict the counter below it.
- The stylist note shows once, on card 6 (after five answers), only when one trait leans past 0.62 (`noteOf` in lib/taste).

**Copy**
- "Select your size." is announced when a buy button is tapped without a size (5.2 says "Choose your size"). The glossary (8.1) rules out "Choose size", and one name per concept wins.
- About reads "Every print, in your order." rather than "design": the glossary uses print in UI copy.

**Prices and policy**
- Prices are removed from the share image and the shop's meta description. Product pages keep the price in their meta description and structured data (shopping results).
- The checkout country is never guessed as a silent default:
  - First the time zone's biggest city, then the browser language's region.
  - If neither is offered, "Select a country".
  - A typed city known in exactly one offered country selects that country, until the shopper picks one themselves.
  - A postcode or city that contradicts the chosen country shows "Check your country".
- Free shipping applies from $80 (goods ≥ $80). No combination of the four prices totals exactly $80, so "free over $80" is true as worded.

**Visuals**
- No tight back-crop exists in the bake pipeline for catalogue designs, so grid and Discover keep the model photo, square and without a frame. The Make cards already use their crop.
- `npm run measure:fonts` measures the print faces (the tees' own lettering), not the UI font, so the new UI face doesn't change it.
- The brand face is Geist (OFL), self-hosted through next/font/local from `public/fonts/geist*.woff2`, at weights 400 and 500 only. The CSP already allows `font-src 'self'`.

## Screens, before → after

| Screen | Before | After |
| --- | --- | --- |
| Discover, first card | A goal line that faded after one swipe, ten pulsing segments, Like / Buy / Pass | One line that never leaves: "Ten tees. Keep or pass. We’ll edit the shop to your taste.", a 2px progress line, Pass / Save only |
| Discover, mid-test | Segments only; LIKE / PASS stamps | "Learning your taste · N/10", one "Noted: …" if it's clear, "Saved · Undo" for 4 s after a swipe, a tint instead of stamps |
| Reveal | "Taste test complete", "You’re The X", trait chips, sparkles, % alike | Eyebrow "Your taste", "The X", one sentence, three tees, "Your shop is now edited around this.", See your edit / Keep swiping |
| Shop after the test | Sticky top row (dots, ringed search, filter icon), prices hidden but counts disagreeing | Quiet "Your edit" heading, Top pick on the first card, a bottom row "Black · White  Search  Filter", counts in one unit |
| Product | ← Shop row, ⋯ menu, framed square picture, "Top pick for you" toggle, lock icon, size under 400 px dropped | Full-bleed 4:5 gallery (tee → print), Share by the title, one Why line, Black · White · Both · $90, sizes 44 px, one trust line, "Add to bag · M · $50" |
| Buy sheet | "Choose size" / lock icon, pills, Details link | "Buy now · M · $50", Both · $90, Add to bag, "View tee" row, Back closes it |
| Bag | Rounded cards, 36 px controls, "Free 30-day returns", bare "Shipping $6" | Hairline rows, 44 px size and Remove, "Shipping $6 · free over $80", the delivery window and returns line, sticky "Checkout · $X" |
| Checkout | "Delivery details", five alerts, US from UTC, "Place demo order" | "Checkout", one summary line, email first, one alert, "Check your country", sticky "Place order · $X", the one preview line |
| You | Huge inverted archetype, Checkout CTA, Picked for you, Saved drawer, tracked caps | "You": Your taste (sentence, traits, Share, Reset), Saved in full, Orders & settings |
| Make | Pill switch and filter icon at the top | "Our prints, made yours. Or print your own." at the top, and "Personalise · Upload  Filter" in a bottom row |
