# sdxl50 helper 2 prompts (slot 1 = A, 2 = B, 3 = C, 4 = D). Lightning has no negative prompt:
# the exclusions sit in the first sentence.
PROMPTS = {
    1: {
        "main": "One lobster seen from directly above, a natural-history study sheet in black ink on plain white "
                "paper, no text, no lettering, no frame, no border, no colour. Exactly one whole lobster, two "
                "big claws, eight walking legs, long antennae, segmented tail fan, every shell plate finely "
                "engraved with fine crosshatching. Around it a few small sketches of a claw, a leg joint and a "
                "tail segment, thin scale lines. Centred, the whole lobster inside the page with wide white "
                "margins. No ornaments, no grey wash.",
    },
    2: {
        "main": "One zeppelin airship in strict side view, a technical elevation drawing in black ink on plain "
                "white paper, no text, no lettering, no frame, no border, no colour. Exactly one long cigar-shaped "
                "airship with its ribbed frame showing, tail fins, a small gondola underneath, thin rigging lines "
                "down to a thin ground line. Fine clean pen lines, lots of empty white space around, centred "
                "with wide margins. Only one airship. No ornaments, no grey wash.",
    },
    3: {
        "main": "A dense old city skyline with domes and minarets, pen-and-ink drawing on plain white paper, no "
                "text, no lettering, no frame, no border, no colour. A great mosque with a central dome and "
                "slender minarets rising over crowded old houses with wooden balconies, shutters, tiled roofs, "
                "trees and plants, drawn edge to edge in fine hatching. The ground ends in a clean straight "
                "line, empty white sky above. No ornaments, no grey wash.",
    },
    4: {
        "main": "One vintage record player turntable, three-quarter view, white chalk line drawing on a plain "
                "black background, no text, no lettering, no frame, no border, no colour. One whole turntable "
                "with a record on the platter and a tonearm, large in the centre; around it small separate "
                "drawings of the tonearm, the stylus cartridge and the platter, and small circular detail "
                "roundels. Fine white lines, a patent drawing study sheet. Wide black margins. No ornaments.",
        "backup": "One antique gramophone with a big flared horn, side view, white chalk line drawing on a plain "
                  "black background, no text, no lettering, no frame, no border, no panels, no colour. Exactly one "
                  "gramophone: a wooden box with a crank handle, a turntable with a record, a tone arm and one large "
                  "fluted brass horn, every part drawn in fine white lines with delicate hatching. Two small "
                  "circles beside it show the needle and the crank. Centred, the whole gramophone with wide black "
                  "margins. No ornaments.",
    },
}
