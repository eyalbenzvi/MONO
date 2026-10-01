"""
The pilot's briefs: one full prompt per design, written out in detail (200
words or more), front-loaded with what matters most, since the model weighs
the first words most. Writes the --jobs file for generate.py:

  python scripts/studio/briefs/pilot.py <out-dir> > jobs.json
"""
import json, sys

OCTOPUS = """A single common octopus, Octopus vulgaris, drawn as a nineteenth-century natural history engraving
in black ink on plain white paper. The octopus has exactly eight arms, no more and no fewer, and
the whole animal is visible with generous white space on every side. It is seen from directly above,
symmetrical, centred in the picture: the rounded mantle sits in the upper middle, smooth and egg-shaped,
pointing upwards, with two large eyes on raised bumps where the mantle meets the arms. From the head the
eight arms radiate outwards and downwards like a loose star, four to the left and four to the right, each
arm thick at the base and tapering steadily to a fine, delicately curled tip. Each arm curls in a different
graceful spiral so the silhouette is lively but balanced. Along the underside of every arm runs a double row
of round suckers, large near the body and shrinking to tiny dots at the tip, each sucker drawn as a small
ring with a dark centre. The skin is rendered with fine parallel engraved lines and cross-hatching that follow
the form of each arm, dark on the shaded side and open on the lit side, with tiny stipple dots for the skin
texture on the mantle. Strong contrast, crisp confident line work thick enough to print, a museum plate
quality of drawing, scientifically accurate anatomy, nothing else in the picture: no frame, no border,
no ornaments, no plants, no water, no text, no letters, no labels."""

SAILBOAT = """A naval architect's technical drawing of a classic wooden sailing yacht, a sloop with one tall mast,
drawn in precise black ink lines on plain white paper, shown in exact side elevation from the starboard side.
The whole boat is visible, centred, with white space all around it. A single tall mast rises vertically from
the middle of the deck. Behind the mast a large triangular mainsail is set on a long horizontal boom, its
cloth divided by thin, evenly spaced horizontal seams and three short battens; in front of the mast a smaller
triangular jib runs from the masthead down to the bow. The standing rigging is drawn as thin straight
lines: a forestay from the masthead to the bow, a backstay from the masthead to the stern, and shrouds
from the spreaders down to the deck. The hull is long, low and elegant, with a gently curved sheer line,
a raked bow, a short overhanging stern and a fin keel and rudder below the waterline. The waterline is a
single straight horizontal line across the hull. Below the hull, faint parallel hull section lines and
water lines describe its shape, like a lines plan. Fine hatching shades the lower hull and the inside curve
of each sail. The drawing is clean, elegant and architectural, with thin hairlines for construction lines
and bolder lines for the outline. No sea, no waves, no sky, no people, no flags, no frame, no border, no
text, no numbers, no letters, no labels, no dimension figures."""

NEGATIVE = """text, letters, words, numbers, labels, caption, title, signature, watermark, logo, frame, border,
ornament, decorative corners, panels, colour, color, grey wash, gradient, blurry, soft focus, photograph,
3d render, cartoon, low contrast, cropped, cut off at the edge, extra limbs, too many arms, missing arms,
fused arms, deformed, asymmetrical anatomy, duplicate, two animals, two boats"""

out = sys.argv[1]
jobs = []
for name, prompt, size, seeds in [("octopus", OCTOPUS, "960x1088", (61, 62)), ("sailboat", SAILBOAT, "832x1216", (71, 72))]:
    for i, seed in enumerate(seeds, 1):
        jobs.append({"out": f"{out}/{name}-long-{i}.png", "seed": seed, "prompt": " ".join(prompt.split()), "negative": " ".join(NEGATIVE.split()), "size": size})
print(json.dumps(jobs, indent=1))
