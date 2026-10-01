"""
The trial run's briefs: ten designs and a stand-in for each helper, split over
five helper sessions (two designs and one stand-in each). One full prompt per
design, 200 to 300 words, front-loaded: what the subject is, how many of each
part, its pose and what it is made of come first (the model weighs the first
words most); then each part, the line, the light and the composition; what must
not be in the picture comes last. Writes the --jobs file for generate.py, with
what oneink.py needs alongside (title, sub, mode, fade, tees):

  python scripts/studio/briefs/trial10.py <helper 1-5> <out-dir> > jobs.json

The stand-in (backup) is the last job and takes the number (nn) of the design it
replaces (the one given here is a default). generate.py runs whatever jobs file it is
given, so a helper hands it the first two first and the stand-in only if needed.
"""
import json, sys

TAIL = """No text, no letters, no numbers, no labels, no caption. No frame, no border, no ornaments, no decorative
corners, no panels. No colour, no grey wash, only black ink lines on white paper."""
NO_PEOPLE = "No people."

NEGATIVE = """text, letters, words, numbers, labels, caption, title, signature, watermark, logo, frame, border,
ornament, decorative corners, panels, colour, color, grey wash, gradient, blurry, soft focus, photograph,
3d render, cartoon, low contrast, cropped, cut off at the edge, extra limbs, missing limbs, fused limbs,
extra fins, extra legs, deformed, distorted anatomy, duplicate, two subjects"""

# (nn, slug, title, sub, mode, fade, size, tees, seed, prompt)
D = {}

D["blue-whale"] = ("01", "BLUE WHALE", "Marine life · Anatomical study", "line", False, "960x1088", "both", 101, """
A single blue whale, one animal only, seen in full side view from its left side, lying perfectly horizontal
across the picture, drawn as a precise scientific anatomical study in black ink on plain white paper. Exactly
one long streamlined body, one broad flat head, one small dorsal fin set far back near the tail, exactly two
slender flippers of which only the near one is fully visible, and one wide horizontal tail fluke split into
two lobes. The body is made of smooth skin over a long tapering torso. The head is broad and U-shaped with
a straight mouth line running back to a small eye just above the corner of the mouth, and the blowhole is a
small double slit on top of the head. From the chin to the navel run many long parallel throat grooves,
drawn as fine evenly spaced lines that follow the curve of the belly. The near flipper is long, narrow and
pointed, angled backwards from just behind the head. The small dorsal fin is a low curved triangle. The tail
stock narrows smoothly before the wide flukes, which are seen edge-on as a thin horizontal shape. The line is
a fine engraving: clean contour lines, light parallel hatching along the back for the darker upper body,
open white skin on the pale underside, a few tiny stipple dots for mottling. Soft light from above. The whole
whale is in the picture, centred, with large white margins above, below and at both ends, isolated on plain
white paper, like a museum diagram. No water, no waves, no other animals.""")

D["sea-turtle"] = ("02", "SEA TURTLE", "Marine life · Natural history plate", "line", False, "960x1088", "both", 102, """
A single green sea turtle, one animal only, seen from directly above, swimming with its flippers spread,
drawn as a nineteenth-century natural history plate in black ink on plain white paper. Exactly four
flippers: two long front flippers spread wide like wings to the upper left and upper right, and two short
rounded rear flippers at the lower left and lower right. Exactly one head pointing straight up, and one short
pointed tail at the bottom. The body is made of a hard oval shell covered in large plates. The shell, or
carapace, is a smooth heart-shaped oval, made of five large central plates in a row down the middle, four
large side plates on each side, and a ring of small edge plates around the rim; every plate is outlined
clearly and filled with fine growth lines that run parallel to its edges. The head is small and rounded with
a short blunt beak and large scales on top. The front flippers are long, flat and tapered, each covered in a
mosaic of small polygonal scales with one or two claws on the leading edge. The rear flippers are short and
paddle-shaped. The line is crisp engraving with fine hatching for shade and open white for highlights, light
from the upper left. The whole turtle is in the picture, symmetrical, centred, with generous white margins on
every side, isolated on plain white paper. No water, no sand, no seaweed, no other animals.""")

D["jellyfish"] = ("02", "JELLYFISH", "Marine life · Natural history plate", "line", False, "832x1216", "both", 103, """
A single jellyfish, one animal only, seen from the side, hanging upright with its tentacles trailing straight
down, drawn as a nineteenth-century natural history plate in black ink on plain white paper. Exactly one
rounded bell at the top, four frilled oral arms hanging from the centre beneath it, and many long thin
tentacles falling from the rim of the bell. The animal is made of soft translucent tissue. The bell is a smooth
dome, slightly wider than tall, with fine radiating lines running from the top down to a scalloped edge, and a
faint four-leaved pattern of gonads seen through the dome. Below the bell the four oral arms are long ruffled
ribbons that twist gently downwards, each edged with delicate folds. Around the rim, thin tentacles hang in
long smooth curves, some straight, some gently waving, ending in fine points well below the oral arms, so the
whole animal is tall and narrow. The line is fine engraving: thin flowing contours, delicate parallel lines on
the bell for its curve, tiny stipple on the oral arms, lots of open white so the animal looks light and
translucent. Soft light from above. The whole jellyfish is in the picture, centred, from the top of the bell
to the tip of the longest tentacle, with white margins on every side, isolated on plain white paper. No water,
no bubbles, no other animals.""")

D["emperor-penguins"] = ("03", "EMPEROR PENGUINS", "Nature · Antarctica", "line", False, "832x1216", "both", 201, """
Exactly two adult emperor penguins standing upright side by side with one fluffy chick standing between them,
three birds in total and no more, drawn as a scientific natural history illustration in black ink on plain
white paper. Each adult has exactly one head, one long beak, two flippers held close to its sides and two
feet; the chick has one head and two small feet. The adults are made of sleek dense feathers, the chick of
soft down. The adults are tall and upright, the left one facing slightly right and the right one facing
slightly left, their heads turned towards the chick, so the group is balanced. Each adult has a black head and
back, a long slightly curved beak with a pale stripe along the lower mandible, a bright patch behind the ear
that fades into the white chest, a smooth white belly and black flippers. The chick stands at about knee
height, round and fluffy, with a dark cap and a pale face mask and soft down drawn as short broken strokes.
The line is fine engraving: dense parallel hatching for the black plumage, following the curve of each body,
open white for the chests, a few fine lines for feather texture, short marks for the feet on a thin line of
snow. Light from the upper left. All three birds are fully in the picture, centred, with white margins on
every side, isolated on plain white paper. No ice landscape, no other birds.""")

D["barn-owl"] = ("04", "BARN OWL", "Nature · Portrait of a hunter", "line", False, "832x1216", "both", 202, """
A single barn owl, one bird only, perched upright on a short bare branch, facing straight towards the viewer,
drawn as a scientific natural history illustration in black ink on plain white paper. Exactly one head, one
heart-shaped face, two dark eyes, one small hooked beak, two folded wings and two feet gripping the branch,
each foot with four toes and curved talons. The owl is made of soft layered feathers. The face is a pale heart
shape outlined by a thin rim of darker feathers, with two dark almond-shaped eyes set close together and a
small pale beak between them, partly hidden by feathers. The breast is pale with a few tiny dark speckles. The
wings fold neatly over the sides of the body, their upper feathers finely patterned with small dots and wavy
bars, their long flight feathers lying in clean overlapping rows that reach down past the tail. The legs are
covered in short pale feathers down to the toes. The branch is a short, simple, slightly gnarled piece of wood
running horizontally under the feet, ending cleanly at both sides within the picture. The line is fine
engraving: delicate strokes following each feather, light hatching on the wings, open white on the face and
breast. Soft light from the upper left. The whole owl and branch are in the picture, centred, with white
margins on every side, isolated on plain white paper. No leaves, no moon, no other birds.""")

D["seahorse"] = ("04", "SEAHORSE", "Marine life · Natural history plate", "line", False, "832x1216", "both", 203, """
A single seahorse, one animal only, seen in full side view facing right, upright with its tail curled into a
spiral beneath it, drawn as a nineteenth-century natural history plate in black ink on plain white paper.
Exactly one head with one long tube-shaped snout, one eye, one small crown on top of the head, one curved
belly, one small dorsal fin on the back and one tail curling forward into a tight spiral. The body is made of
bony rings and plates. The head is held at a right angle to the body, the long snout pointing right, with a
round eye behind it and a small knobbly crown above. The neck curves gracefully into a rounded chest and belly.
The whole body is wrapped in a row of bony rings, each ring drawn as a clear band with small raised knobs at
its edges, so the body looks segmented. A small fan-shaped dorsal fin sits on the back, with fine straight rays.
The tail narrows steadily and curls forward and inwards into a neat spiral of two turns. The line is crisp
engraving: firm contours, fine parallel hatching on the shaded side of each ring, open white on the lit side,
tiny stipple for texture, light from the upper left. The whole seahorse is in the picture, centred, from the
crown to the tip of the tail, with white margins on every side, isolated on plain white paper. No seaweed, no
water, no other animals.""")

D["patagonia"] = ("05", "PATAGONIA", "Places · Torres del Paine", "tone", True, "832x1216", "both", 301, """
Exactly three tall sharp granite towers standing side by side above a calm lake, a mountain landscape drawn in
black ink as a detailed realistic landscape engraving on white paper. The three towers rise from one rocky
ridge in the middle of the picture: the left tower slim and slightly leaning, the middle tower the tallest with
a pointed top, the right tower broad and blunt. They are made of sheer pale granite with vertical cracks and
ledges. Below them a dark band of steep scree slopes and rocky moraine falls to a small calm lake in the lower
third of the picture. The towers are drawn with long vertical strokes that follow their cracks, dark hatching
on the shaded faces and open white on the lit faces, with a little snow lodged on their ledges. The scree is
drawn with short diagonal strokes and stipple. The lake is smooth, with a faint reflection of the towers drawn
as broken horizontal lines. A few low wind-bent shrubs sit on the near shore. The light comes from the left,
early morning, so each tower has one bright side and one dark side, strong contrast. The sky is plain white
paper. The composition is vertical, the towers centred in the upper half, and every edge of the scene fades
softly away into the white paper. No people, no buildings, no animals, no clouds drawn as solid shapes.""")

D["alpine-village"] = ("06", "ALPINE VILLAGE", "Villages · Under the peaks", "tone", True, "832x1216", "both", 302, """
One small alpine village of about eight wooden houses and exactly one church with one tall pointed bell tower,
in a green valley under snowy mountains, drawn in black ink as a detailed realistic landscape engraving on
white paper. The houses are made of dark timber on white stone bases, with wide low roofs, small square
windows and wooden balconies. They sit together in a loose cluster in the lower middle of the picture, on a
gentle slope, with the church among them; its slim tower rises above every roof, topped by a sharp spire. A
narrow path winds between the houses, and a few dark fir trees stand at the edges of the village. Behind the
village a meadow rises to a forest of firs, and above it two or three steep snow-covered peaks fill the upper
half of the picture, their rocky ridges drawn with firm lines and their snowfields left as open white with
fine shading in the hollows. The houses are drawn with careful straight lines for timber boards and roof
shingles, hatching for the shaded walls under the eaves. The light comes from the upper right, a clear
morning, crisp shadows. The sky is plain white paper. The composition is vertical and centred, and every edge
of the scene fades softly away into the white paper. No people, no cars, no animals, no clouds drawn as solid
shapes.""")

D["pine-on-the-cliff"] = ("06", "PINE ON THE CLIFF", "Places · Coast", "tone", True, "832x1216", "both", 303, """
Exactly one old twisted pine tree growing alone on the edge of a rocky cliff above the sea, drawn in black
ink as a detailed realistic landscape engraving on white paper. The tree is made of a thick crooked trunk,
a few long bent branches and flat clouds of needles. The trunk grows out of a crack in the rock, leans out
over the edge towards the right and twists upward, its bark drawn as deep vertical furrows. Three or four
branches reach sideways, each ending in a flat layered pad of needles drawn as fine short strokes, darker
underneath and lighter on top. The roots grip the rock and are partly visible. The cliff fills the lower left
of the picture, made of layered rock with cracks and ledges, drawn with firm hatching on its shaded face. Far
below on the right, the calm sea is drawn with a few long horizontal lines and a little white foam where it
meets the foot of the cliff. On the horizon, a faint distant headland. The light comes from the left, late
afternoon, so the tree casts a long shadow over the rock and its trunk has one bright side. The sky is plain
white paper. The composition is vertical, the tree in the upper middle, and every edge of the scene fades
softly away into the white paper. No people, no boats, no birds, no buildings.""")

D["volcano"] = ("07", "VOLCANO", "Science · Stratovolcano", "line", False, "832x1216", "both", 401, """
Exactly one cone-shaped stratovolcano standing alone, with one column of ash rising and twisting above its
crater, drawn as a precise scientific illustration in black ink on plain white paper. The volcano is a single
symmetrical cone with steep straight slopes and one small crater at the summit; it sits in the lower half of
the picture, its base a short straight ground line. It is made of layered rock and ash. Its slopes are drawn
with long fine lines running from the summit down to the base, closer together on the shaded right side and
wider apart on the lit left side, with a few gullies cut into the flanks and small ridges of old lava flows.
The crater rim is a short jagged line at the top. From the crater one thick column of ash rises straight up,
then billows and twists into rounded cloudy masses that spread a little at the top, filling the upper half of
the picture; the ash is drawn with curling contour lines and soft stipple, each rounded mass outlined
clearly, never a solid grey shape. The line is clean, like a geology textbook plate. Light from the upper
left. The whole volcano and the whole ash column are in the picture, centred, with white margins on every
side, isolated on plain white paper. No landscape around it, no trees, no houses, no sea, no lava drawn as
solid black.""")

D["lighthouse"] = ("08", "LIGHTHOUSE", "Maritime · Atlantic coast", "tone", True, "832x1216", "both", 402, """
Exactly one tall round stone lighthouse standing on a rocky cliff above the sea, with waves breaking into foam
below, drawn in black ink as a detailed realistic landscape engraving on white paper. The lighthouse is made
of large grey stone blocks, a slim tapering round tower with one small door at its foot, a few small windows
in a line up its side, a railed gallery near the top and one glass lantern room under a domed metal cap. Beside
it stands one small keeper's cottage with a pitched roof. The tower stands in the upper middle of the picture
on the top of a dark rocky headland that falls steeply to the right. The stone blocks are drawn in neat
courses, hatched on the shaded side of the tower and open white on the lit side. The cliff is made of rough
layered rock drawn with firm strokes and deep shadows in its cracks. Below, the sea fills the lower part of
the picture: two or three big waves roll in and break against the rocks, drawn with curving lines and bright
white foam and spray left as open paper. The light comes from the left, a clear windy day. The sky is plain
white paper. The composition is vertical and centred, and every edge of the scene fades softly away into the
white paper. No people, no ships, no birds, no clouds drawn as solid shapes.""")

D["stone-bridge"] = ("08", "STONE BRIDGE", "Architecture · Old arch bridge", "line", False, "960x1088", "both", 403, """
One old stone bridge with exactly three round arches crossing a quiet river, seen straight from the side,
drawn as a precise architectural illustration in black ink on plain white paper. The bridge is made of cut
stone blocks: a long level roadway on top with a low parapet wall, resting on three semicircular arches of
equal size, which stand on two thick piers in the water and two banks at the ends. Each arch is outlined by a
ring of wedge-shaped voussoir stones drawn one by one, with a slightly larger keystone at the top. The walls
between the arches are laid in neat horizontal courses of rectangular blocks. Each pier has a pointed
cutwater facing upstream. Under each arch the dark opening is drawn with dense parallel hatching, never a
solid black shape. The river below is calm, drawn with a few long horizontal lines, and the arches are
reflected in it as faint broken lines, so each arch and its reflection make a near circle. Small tufts of
grass grow on the banks at both ends, which end cleanly within the picture. The line is clean and
architectural, with fine hatching for shade. Light from the left. The whole bridge is in the picture, centred,
with white margins on every side, isolated on plain white paper. No buildings, no trees, no boats, no people.""")

D["kitesurf"] = ("09", "KITESURF", "Sport · Wind and water", "pen", False, "832x1216", "white", 501, """
One large curved kitesurfing kite high in the top of the picture, and one small kitesurfer riding a small wave
at the bottom, joined by four long thin straight lines, with a lot of empty white air in between, drawn in
black ink as a clean pen drawing on plain white paper. Exactly one kite and exactly one rider. The kite is a
wide curved crescent-shaped wing made of fabric panels, seen from below, arching across the upper part of the
picture; its leading edge is a thick tube along the front, and thin seams divide the canopy into even panels,
drawn with fine parallel lines for shade. From the two tips of the kite, four thin lines run straight down
and come together at a bar held by the rider. The rider is small, in the lower part of the picture, one person
seen from the side at a distance, leaning back against the pull of the kite, knees bent, standing on one small
board, simple and in silhouette without a face. Beneath the board a small wave curls to the right, drawn with
a few flowing lines and a white crest of spray. The middle of the picture is open white sky. The line is
clean, confident and graphic. Light from the left. The kite, lines, rider and wave are all fully in the
picture, centred, with white margins on every side, isolated on plain white paper. No other people, no boats,
no birds, no beach, no sun.""")

D["grapevine"] = ("10", "GRAPEVINE", "Production · From vine to wine", "line", False, "832x1216", "both", 502, """
One cut branch of a grapevine with exactly one heavy bunch of grapes hanging below it, exactly three leaves and
a few curling tendrils, drawn as a nineteenth-century botanical plate in black ink on plain white paper. The
branch is made of a short woody stem with rough bark, running across the top of the picture from left to right
and cut cleanly at both ends. From the middle of the stem hangs one large cone-shaped bunch of round grapes,
broad at the top and narrowing to a point at the bottom, filling the middle and lower part of the picture.
Each grape is a separate smooth round berry with a small bright highlight, drawn with fine curved hatching on
its shaded side, the berries packed closely but every one clearly outlined. Three large leaves grow from the
stem, one to the left, one to the right and one behind the bunch, each with five pointed lobes, toothed edges
and a clear pattern of veins running from the base. Two or three thin tendrils curl from the stem in tight
spirals. The line is fine engraving: crisp contours, delicate hatching for shade, open white for highlights.
Light from the upper left. The whole branch, bunch and leaves are in the picture, centred, with white margins
on every side, isolated on plain white paper. No vineyard, no barrels, no bottles, no insects.""")

D["cep-mushroom"] = ("10", "CEP MUSHROOM", "Nature · Boletus edulis", "line", False, "832x1216", "both", 503, """
Exactly two cep mushrooms, porcini, standing on a small patch of forest floor: one whole mushroom on the left
and one mushroom cut in half lengthways on the right, drawn as a nineteenth-century botanical plate in black
ink on plain white paper. Each mushroom has exactly one cap and one stem. The mushrooms are made of firm
flesh. The whole mushroom has a broad rounded brown cap like a bun, smooth and slightly shiny, drawn with fine
curved hatching that is darker towards the rim, sitting on a thick swollen stem that is wider at the bottom,
its surface covered in a fine raised net pattern near the top. Under the cap, a spongy layer of tiny pores is
seen from the side as a thin band. The cut mushroom on the right shows its inside in clean section: the cap
and stem as one smooth pale shape outlined by the skin, the white flesh left open, the layer of pores drawn as
fine vertical lines under the cap. The two mushrooms stand on a small mound of earth with a few fallen pine
needles and one small leaf, which ends cleanly within the picture. The line is fine engraving with crisp
contours and delicate hatching. Light from the upper left. Both mushrooms are fully in the picture, centred,
with white margins on every side, isolated on plain white paper. No insects, no trees, no basket.""")

# Each helper's two designs and its stand-in, in that order.
HELPERS = {
    1: ["blue-whale", "sea-turtle", "jellyfish"],
    2: ["emperor-penguins", "barn-owl", "seahorse"],
    3: ["patagonia", "alpine-village", "pine-on-the-cliff"],
    4: ["volcano", "lighthouse", "stone-bridge"],
    5: ["kitesurf", "grapevine", "cep-mushroom"],
}
# Only the kitesurfer is a person; every other brief keeps people out.
WITH_PEOPLE = {"kitesurf"}


def job(slug, out, backup):
    nn, title, sub, mode, fade, size, tees, seed, body = D[slug]
    tail = TAIL if slug in WITH_PEOPLE else f"{TAIL} {NO_PEOPLE}"
    prompt = " ".join(f"{body} {tail}".split())
    n = len(prompt.split())
    assert 200 <= n <= 300, f"{slug}: {n} words"
    return {
        "out": f"{out}/{nn}-{slug}-1.png", "seed": seed, "prompt": prompt, "negative": " ".join(NEGATIVE.split()), "size": size,
        "nn": nn, "slug": slug, "title": title, "sub": sub, "mode": mode, "fade": fade, "tees": tees, "backup": backup, "words": n,
    }


if __name__ == "__main__":
    k, out = int(sys.argv[1]), sys.argv[2]
    slugs = HELPERS[k]
    print(json.dumps([job(s, out, i == 2) for i, s in enumerate(slugs)], indent=1, ensure_ascii=False))
