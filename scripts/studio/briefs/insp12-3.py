"""Helper 3 (dense pen-and-ink street scenes, after the colonial building with palms): prompts for insp12.py."""

PEN = (
    "Black ink pen drawing on white paper, very fine lines and dense delicate cross-hatching, like an old architectural sketchbook. "
    "Soft daylight from one side. The ground ends in a clean straight line, empty white sky above. "
    "No text, no signs, no frame, no border, no ornaments, no colour, no grey wash."
)

PROMPTS = {
    1: {
        "main": "Old Venetian canal houses, front view, across water. "
                "Tall palazzo fronts with arched windows, small balconies, shutters and flower pots, "
                "a calm canal along the foot with soft reflections, one wooden boat moored at a post. " + PEN,
    },
    2: {
        "main": "Old medina rooftops, seen from above, a minaret behind. "
                "Flat stacked roofs, round arches, small domes, wooden shutters, potted plants and a few palm trees, "
                "one tall square minaret rising at the back, drawn edge to edge. " + PEN,
    },
    3: {
        "main": "Old Kyoto street, front view, a pagoda behind. "
                "Two-storey wooden machiya houses with lattice fronts, sloping tiled roofs, paper lanterns without writing, "
                "potted plants by the doors, a five-tier pagoda rising behind the roofs, a stone-paved street at the foot. " + PEN,
        "backup": "Old Hanoi shophouses, front view, a row of narrow houses. "
                  "Tall thin townhouses side by side, each with small balconies, louvred shutters, potted plants and hanging vines, "
                  "a tangle of thin wires overhead, a small tree and a bicycle on the pavement, no shop signs. " + PEN,
    },
}
