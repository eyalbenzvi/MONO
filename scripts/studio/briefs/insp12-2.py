"""insp12 helper 2: technical elevations after the sailboat tee (black ink on a white tee)."""
PROMPTS = {
    1: {
        "main": (
            "One hot air balloon, side elevation, technical drawing. One round balloon envelope with vertical gore seams, "
            "one small wicker basket hanging below on straight thin rigging ropes, a burner frame between them. "
            "Fine even black ink line, like an engineer's elevation drawing, thin construction lines. "
            "Flat even light, no shadows. A thin straight ground line below the basket, small faint tick marks in narrow columns at both sides. "
            "Centred, the whole subject with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
    },
    2: {
        "main": (
            "One tall lighthouse, side elevation, architectural drawing. One tapering round stone tower, one glass lantern room and domed cap at the top, "
            "a railed gallery under the lantern, a spiral staircase shown inside a cut-away section of the wall. "
            "Fine even black ink line, like an architect's elevation, thin construction lines. "
            "Flat even light. A thin straight ground line at the base, small faint tick marks in narrow columns at both sides. "
            "Centred, the whole subject with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
    },
    3: {
        "main": (
            "One vintage biplane, side elevation, technical drawing. One fuselage seen exactly from the side, two stacked wings joined by vertical struts and crossed bracing wires, "
            "one wooden propeller at the nose, two wheels under it, a tail fin at the back. "
            "Fine even black ink line, like an engineer's elevation drawing, thin construction lines. "
            "Flat even light. A thin straight ground line under the wheels, small faint tick marks in narrow columns at both sides. "
            "Centred, the whole aircraft with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
        "backup": (
            "One vintage seaplane on floats, side view, technical drawing. One small propeller aeroplane with one long straight wing on top, "
            "one propeller at the nose, a tail fin at the back, resting on two long boat-shaped floats on thin struts. "
            "Fine even black ink line, like an engineer's elevation drawing, thin construction lines. "
            "Flat even light. A thin straight water line under the floats, small faint tick marks in narrow columns at both sides. "
            "Centred, the whole aircraft with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
        # A third try (all four main and all four backup images were sheets of repeated hulls,
        # with no wings): no "technical drawing", one aeroplane named large, the biplane main.
        "retry": (
            "One single vintage biplane, side view, large in the middle of the page. One aeroplane only, "
            "two long wings stacked one above the other with struts between them, one propeller at the front, "
            "two wheels below, one tail at the back. Fine black pen and ink line illustration with light hatching. "
            "Soft even daylight. A thin straight ground line under the wheels, empty white sky above. "
            "Centred, the whole aircraft with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
        # A fourth try: the model draws a symmetrical front view far better than a long body side on.
        "front": (
            "One vintage biplane, front view, symmetrical. One aeroplane only, two long straight wings stacked one above "
            "the other, joined by vertical struts and crossed bracing wires, one round propeller at the centre, "
            "two wheels below on a V-shaped undercarriage, the tail fin just showing behind. "
            "Fine black pen and ink line, like an engineer's front elevation, thin construction lines. "
            "Flat even light. A thin straight ground line under the wheels. "
            "Centred, the whole aircraft with wide white margins, plain white paper. "
            "No text, no frame, no border, no ornaments, no colour, no grey wash."
        ),
    },
}
