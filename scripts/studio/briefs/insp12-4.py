"""insp12 helper 4: patent-style study sheets in white chalk line on black (after the bicycle sheet)."""
PROMPTS = {
    1: {
        "main": """One surfboard study sheet, side and top views. A large longboard drawn in plan view in the centre, the
        same board in profile below it, three separate fins and a small rail cross-section beside it, a row of
        small round detail circles along the bottom. White chalk line drawing on a black background, like a vintage
        patent drawing, clean outlines, fine hatching. Even flat light, crisp contrast. Centred, the whole sheet
        with wide black margins. No text, no frame, no border, no ornaments, no colour, no grey wash.""",
        "backup": """One skateboard study sheet, exploded view from above. A skateboard deck seen from below in the
        centre, two trucks and four wheels drawn apart around it, bolts, bearings and a side profile of the
        deck, a row of small round detail circles along the bottom. Thin white chalk outlines only on a black
        background, every shape hollow and black inside, like a vintage patent drawing, fine hatching. Even flat
        light, crisp contrast. Centred, the whole sheet with wide black margins. No text, no frame, no border,
        no ornaments, no colour, no grey wash.""",
    },
    2: {
        "main": """One pocket watch study sheet, front view. A large round pocket watch with crown and ring in the
        centre, a plain dial with only tick marks, no numerals; around it the open movement, separate gears, cogs
        and a balance wheel, a row of small round detail circles along the bottom. White chalk line drawing on a
        black background, like a vintage patent drawing, clean outlines, fine hatching. Even flat light, crisp
        contrast. Centred, the whole sheet with wide black margins. No text, no frame, no border, no ornaments, no
        colour, no grey wash.""",
        "backup": """One brass compass, top view, with parts around. A round compass in the middle of the page, a
        clear compass rose with a long needle, only small tick marks, no letters; around it on the black page a
        separate needle, a gimbal ring and a lid drawn small, a row of small round detail circles along the
        bottom. Thin white chalk outlines on a black background, like a vintage patent drawing, fine hatching.
        Flat light. The compass small and centred, lots of empty black around it. No text,
        no frame, no border, no ornaments, no colour, no grey wash.""",
    },
    # Second backup for slot 2 (seeds 24254-24256, jobs written directly; the first backup's compass faces
    # stretched into ovals touching the sides of the portrait page).
    "2b": """One small round compass, top view, a perfect circle. The compass drawn small in the upper half of the
        page, a clear four-point compass rose and a needle, tick marks only, no letters; below it a neat row of
        separate parts drawn apart: a needle, a pivot, a glass ring and a hinged lid. Thin white chalk outlines on
        a black background, like a vintage patent drawing, fine hatching. Flat light. Wide empty black margins
        on every side. No text, no frame, no border, no ornaments, no colour, no grey wash.""",
    3: {
        "main": """One vintage roller skate study sheet, side view. A large old leather lace-up roller skate boot
        on a metal plate with four wheels in the centre; around it separate wheels, a toe stop, the plate and
        axle parts drawn apart, a row of small round detail circles along the bottom. White chalk line drawing on a
        black background, like a vintage patent drawing, clean outlines, fine hatching. Even flat light, crisp
        contrast. Centred, the whole sheet with wide black margins. No text, no frame, no border, no ornaments, no
        colour, no grey wash.""",
    },
}
