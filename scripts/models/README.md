# Model photos

```
python scripts/models/poses.py                     # pose skeletons (poses/)
python scripts/models/jobs.py && python scripts/models/generate.py jobs.json <out>
python scripts/models/analyze.py <out> jobs.json   # framing, print box, black twins → public/models, models.json
```

## What was learnt from thrown-away photos

Enforced in code, so a run never wastes time on them:

| Lesson | Where it's enforced |
| --- | --- |
| Drawn hand keypoints turn into dark blobs at the hips | `poses.py`: no hand keypoints |
| One stiff mirror-symmetric pose looks cloned | `poses.py`: several upright stances |
| A slim skeleton gives slim, narrow-hipped men | `poses.py`: wider shoulders and hips |
| CLIP reads 77 tokens; the rest of a prompt is dropped silently | `generate.py` refuses a prompt or negative over the limit |
| Loose long hair falls over the back (the print would sit on it) | `jobs.py` rule: long hair tied; `checks.py` tee tone |
| Sunset, dusk, golden or back light tints a white tee beige or darkens it | `jobs.py` rule: no such light; `checks.py` tone and tint |
| Without "short-sleeved" some come out in tank tops (the shop sells tees) | `jobs.py` rule; `checks.py` sleeves |
| Arms down on every photo (the lookbook stances) looks like standing at attention | `poses.py`: relaxed poses g–l, each arm doing something; `jobs.py`: the sixth set on takes only those, its arms in the prompt, no pose twice before all are used |
| Hands behind the back came out twisted; folded arms read as reaching forward; a phone and a hand raised to the neck looked put on | `poses.py`: those poses removed (hand on the hip instead of at the neck) |
| Light trousers merge with a white tee (a white band or dark patches at the black twin's hem) | `analyze.py`: over light trousers the hem is a line, found by brightness and warmth (beige and stone are warmer than the tee); `checks.py`: white trousers still out (a tee folded over a white waistband can't be told from it) |
| The clothing model's mask had holes and stray bits (white specks in the black tee, dark ones on the trousers); a rolled hem stayed white | `analyze.py`: one piece, holes filled, the white cloth joined to it taken in; `tests/colors.test.tsx` checks every black twin for holes |
| A broad man framed like a slim one needs more than the picture (mirror-filled: a second head) | `analyze.py`: the shoulders take more of the width, the print box follows |
| The clothing model stops short of a loose tee's hem (a white band on the black twin) | `analyze.py`: the white cloth below it counts as tee |

`generate.py` runs `checks.py` on every try and retries with the next seed at
once; a job that fails all its tries is saved as `<id>.failed.png`, never
under its own name. `analyze.py` runs the same checks again.

Taste, which no check can catch, is reviewed by eye before anything goes on
the site: photos that sell — upright and at ease, groomed, a smooth heavy
cotton tee, soft light, a real and varied place (never a bare wall or the
same grey passage).
