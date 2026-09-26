"""
The model photos to generate (see generate.py). The tee is the subject:
plain, quiet urban backgrounds only — a wall, an underpass, an out-of-focus
street — muted and blurred, framed from the waist up from behind. White
tees stand against darker walls, black tees against lighter ones.
"""
import json
SCENES = {
 "white": ["a plain dark grey concrete wall", "a dark grey metal roller shutter", "an empty concrete underpass in shadow, background out of focus",
           "a plain charcoal stucco wall", "a quiet city street at dusk, background heavily blurred", "a dark painted brick wall"],
 "black": ["a plain light grey concrete wall", "a pale painted brick wall", "a light stone building facade, background out of focus",
           "a plain off-white plaster wall", "a quiet city sidewalk on an overcast day, background heavily blurred", "a light grey concrete underpass"],
}
MEN = ["a young man with short brown hair", "a man in his thirties with a short dark beard and short hair", "a man in his fifties with short grey hair",
       "a young Black man with short curly hair", "an East Asian man with short black hair", "a South Asian man with short dark hair",
       "a broad-shouldered man with a buzz cut", "a slim young man with short blond hair"]
jobs = []; k = 0
for color, scenes in SCENES.items():
    for i, scene in enumerate(scenes):
        for v in range(3):
            man = MEN[k % len(MEN)]; k += 1
            jobs.append({"id": f"urban-{color}-{i}{v}", "color": color, "seed": 5000 + k * 13,
              "prompt": f"RAW photo, rear view, waist-up shot of {man} standing in front of {scene}, back to the camera, wearing a plain blank {color} short-sleeved crew-neck cotton t-shirt, the {color} t-shirt fills the frame, shallow depth of field, muted colors, soft overcast light, sharp focus on the shirt"})
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
