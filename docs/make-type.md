# The Make type system

Every Make print (the 52 products in `lib/custom/templates`) is set in one
house system: a small set of faces with fixed roles, a stroke scale, a grid
and rules for text a visitor types. The kit carries it (`lib/custom/kit.ts`):
each template's `render` draws inside `house()`, where the default face is
IBM Plex Mono and the caption is the house lockup. Outside `house()` the kit
draws as it always did, so the catalogue's computed prints built on the same
templates (`scripts/gen/set7`) stay byte for byte.

## Faces and roles

| Family | Face | Role | Smallest size (units) |
| --- | --- | --- | --- |
| `plex` | IBM Plex Mono 400/700 | The house default: data, labels, coordinates, dates, the caption's lines | 4.5 |
| `grotesk` | Space Grotesk 400/700 | Titles and modern display: the caption title, a name set large, tech and science headers | 5 |
| `display` | Playfair Display 400/700 | The editorial serif, set large: sayings, messages, credits, a name as a headline | 14 (its hairlines) |
| `serif` | Libre Caslon Text 400/700 | Reading serif at small sizes: newspaper columns, a note, italics-free body | 5 |
| `roman` | Cinzel 400/700 | Inscriptional capitals: monuments, plates, museum labels | 6 |
| `condensed` | Oswald 400/700 | Signage and transport: boards, tickets, departures, lineups | 5 |
| `blackletter` | UnifrakturMaguntia | Mastheads only | 18 |
| `mono` | DejaVu Sans Mono | The catalogue's face; not used in a Make print | — |

A print uses two families, three at most (one of them the caption's pair).

## Type rules

- Capitals used as labels are tracked: about 0.12 em at 4.5–8 units, 0.06–0.1 em at 9–16, 0.02–0.05 em above. Lowercase is never tracked beyond 0.02 em.
- Tracking is given in print units and scales with the size (`spacing: size * em`), so a line that shrinks to fit keeps its colour.
- A line of capitals is centred optically on y with its baseline at `y + CAP[family] * size / 2` (`kit CAP`).
- Hierarchy is made by size and weight, a step of at least 1.25× between levels; never by more than two weights of one face.

## Text a visitor types

- Every user string is measured in its own face (`textWidth`, the fonts' advances) and fitted: `fitSize` sizes it into its box down to the face's smallest size, then `clip` cuts it with an ellipsis, or the editor refuses it (`fitText`, `TOO_LONG`). Nothing overflows and nothing is set under the smallest size.
- A name or a word set large is sized to its box, not to a fixed size: a four-letter name and a twenty-letter name both fill the same measure.
- Letters a face lacks print as their base letter (`printable`), never in a wider fallback.

## Stroke scale

`kit STROKE`: hairline 0.5 (rules, grids, graticules), fine 0.8 (secondary line work), regular 1.2 (the drawing), bold 1.8 (a frame, a key line). Nothing under 0.4. A drawing's line sits near its type's stem weight: 1.2 beside 9-unit bold capitals, 0.8 beside 7-unit text.

## Grid

The print is 300 × 400 units (1 unit ≈ 0.93 mm on the tee). The live area runs x 22–278 (256 wide), from y ≥ 28 at the top. The caption block (title at y, lines at y + 15 and y + 27) sits between y 310 and 372. Art is centred on x 150 optically: a drawing heavy to one side shifts to balance, not to its box.

## Ink

One ink, no solid slabs (the gate's solid-block check), no transforms except letters turned on their own (`arcText`, `turnedText`), no clip paths, masks, patterns, gradients or opacity: what the preview shows is what the screen prints.
