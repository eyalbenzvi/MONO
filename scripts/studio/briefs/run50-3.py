"""Helper 3 (wings, seen from above, symmetrical): prompts for run50.py."""

TAIL = (
    "Black ink line drawing on white paper, fine even pen lines with light hatching, like a natural history engraving. "
    "Flat even light, no shadows. Centred, the whole subject with wide white margins, plain white paper. "
    "No text, no frame, no border, no ornaments, no colour, no grey wash."
)

PROMPTS = {
    1: {
        "main": "One swallowtail butterfly, wings open, seen from directly above. "
                "Four wings, two tails, symmetrical left and right, one slender body, two antennae, "
                "bold black wing veins and spotted wing edges. " + TAIL,
    },
    2: {
        "main": "One luna moth, wings open, seen from directly above. "
                "Four broad wings with long trailing tails, symmetrical left and right, one eyespot on each wing, "
                "one furry body, two feathery antennae. " + TAIL,
    },
    3: {
        "main": "One dragonfly, wings spread flat, seen from directly above. "
                "Exactly four long clear wings, symmetrical left and right, one long thin segmented body, "
                "a round head with two large eyes, fine lace veins in the wings. " + TAIL,
    },
    4: {
        "main": "One honeybee, wings spread, seen from directly above. "
                "Four wings, symmetrical left and right, six legs, striped abdomen, furry thorax, "
                "two antennae, two compound eyes, veined transparent wings. " + TAIL,
    },
    5: {
        "main": "One bat, front view, wings spread wide open. "
                "Symmetrical left and right, one small furry head with two pointed ears and two eyes, "
                "two membrane wings stretched between long finger bones, small feet below. " + TAIL,
    },
}
