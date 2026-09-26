"""The model photos to generate: 13 categories × 2 tee colours × 3 scenes (see generate.py)."""
import json
SCENES = {
 "ink": ["a Japanese zen rock garden beside a wooden temple", "a tall green bamboo forest path", "a quiet Kyoto street with wooden houses"],
 "engraved": ["an old European cobblestone street", "a grand old library with wooden bookshelves", "a narrow alley in an old stone town"],
 "masterworks": ["a classical art museum gallery hall with paintings on the walls", "a marble museum staircase", "a museum courtyard with stone columns"],
 "botanical": ["a Victorian glass greenhouse full of plants", "a lush botanical garden path", "an outdoor flower market"],
 "wildlife": ["a forest trail among tall trees", "the edge of a savanna at dusk", "a misty lakeshore with reeds"],
 "archive": ["an old railway station platform", "a weathered wooden harbour pier", "a vintage flea market street"],
 "machines": ["a large aircraft hangar with a vintage propeller plane", "a motorcycle workshop garage", "an empty airfield runway"],
 "architecture": ["an underground concrete parking garage", "a brutalist concrete building plaza", "a city crosswalk between tall buildings"],
 "landscapes": ["a mountain summit at sunset", "an empty beach at dusk", "desert sand dunes"],
 "ornament": ["a Moroccan riad courtyard with patterned tiles", "a wall of blue Portuguese azulejo tiles", "a courtyard with carved stone arches"],
 "abstract": ["a minimalist white concrete gallery", "an empty subway platform", "a modern glass and steel atrium"],
 "type": ["an urban street with a brick wall", "a concrete skatepark", "a record store aisle"],
 "retro": ["a neon-lit video arcade", "a rainy city street at night with neon signs", "a retro 1950s diner"],
}
MEN = ["a young man with short brown hair", "a bearded man in his thirties with long dark hair", "a man in his fifties with short grey hair", "a young Black man with short curly hair", "an East Asian man with short black hair", "a South Asian man with short dark hair", "a broad-shouldered man with a buzz cut", "a slim young man with messy blond hair"]
jobs = []; k = 0
for cat, scenes in SCENES.items():
    for color in ["white", "black"]:
        for i, scene in enumerate(scenes):
            man = MEN[k % len(MEN)]; k += 1
            pants = "light blue jeans" if color == "black" else "dark jeans"
            jobs.append({"id": f"{cat}-{color}-{i}", "color": color, "seed": 1000 + k * 7,
              "prompt": f"RAW photo, rear view of {man} standing in {scene}, photographed from behind, back to the camera, wearing a plain blank {color} short-sleeved crew-neck cotton t-shirt, {color} t-shirt, the whole back of the {color} t-shirt clearly visible and flat, {pants}, natural light, sharp focus"})
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
