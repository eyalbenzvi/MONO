"""
The prompt fragments every run after the catalogue's second review starts from (rules.md, sections 0 and 2).
SDXL-Lightning runs without CFG, so there is no negative prompt: what must not be in the picture is said
first, in the prompt itself. A run's brief file imports these instead of writing its own.
"""
# The opening every prompt starts with: crisp line, no grey (the review's commonest fault was soft grey shading).
LINE_FIRST = ("bold black ink line drawing, clean confident contour lines, crisp hatching, pure white background, "
              "no grey wash, no pencil shading, no gradient, no cast shadow, no text, no frame")
# The page: one object, whole, on white.
PAGE = "one single object, whole and centred, filling the page, wide white margins, no lettering, no numbers, no border"
# How many seeds a design gets before choosing (the choice is what raises the score).
SEEDS = 6


def prompt(subject, view):
    """A prompt in the house order: the line rule, the subject and its view, the page."""
    return f"{LINE_FIRST}. {subject}, {view}. {PAGE}."
