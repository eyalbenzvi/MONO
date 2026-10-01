"""Helper 3 (wings and small worlds, seen from above, symmetrical): prompts for run50b.py."""

LINE = (
    "Black ink line drawing on white paper, clean confident outlines with fine hatching inside, like a natural history engraving. "
    "Flat even light, no shadows. Centred, the whole subject with wide white margins, plain white paper. "
    "No text, no frame, no border, no ornaments, no colour, no grey wash."
)
PEN = (
    "Black ink pen drawing on white paper, very fine lines and delicate cross-hatching, like an old scientific engraving. "
    "Flat even light, no shadows. Centred, the whole subject with wide white margins, plain white paper. "
    "No text, no frame, no border, no ornaments, no colour, no grey wash."
)

PROMPTS = {
    1: {
        "main": "One emperor moth, wings open, seen from directly above. "
                "Four broad rounded wings, symmetrical left and right, one large ringed eyespot on each wing, "
                "wavy bands and fine scale texture, one furry body, two feathery antennae. " + LINE,
    },
    2: {
        "main": "One cicada, wings open, seen from directly above. "
                "Four long clear wings spread flat, symmetrical left and right, a net of fine black veins in every wing, "
                "a broad textured head with two round eyes, a ridged body, six small legs. " + PEN,
        "backup": "One green lacewing, wings open, seen from directly above. "
                  "Four long clear oval wings held flat, symmetrical left and right, a dense lace net of fine veins in every wing, "
                  "one slender segmented body, two round eyes, two long thin antennae, six thin legs. " + PEN,
    },
    3: {
        "main": "One morpho butterfly, wings open, seen from directly above. "
                "Four broad wings, symmetrical left and right, bold black veins, a scalloped dark border with a row of small spots, "
                "one slender body, two thin antennae. " + LINE,
    },
    4: {
        "main": "One ladybird beetle, seen from directly above, large. "
                "A round domed shell split down the middle, seven bold black spots, a small head with two eyes, "
                "two short antennae, six jointed legs, fine stippled shine on the shell. " + LINE,
    },
    5: {
        "main": "One round spider web, front view, with dew. "
                "No spider. Spokes radiating from the centre, a fine spiral thread, small round dew drops strung along the threads, "
                "symmetrical and complete, hanging from one thin twig at the top. " + PEN,
    },
}
