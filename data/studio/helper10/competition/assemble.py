"""Merge the ten generator files of a competition into ideas.json and write ten shuffled ranker lists.

  python3 assemble.py c1
"""
import glob
import json
import os
import random
import sys

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), sys.argv[1])
ideas = []
for f in sorted(glob.glob(os.path.join(d, "gen-*.json"))):
    src = os.path.basename(f)[4:-5]
    for it in json.load(open(f)):
        ideas.append({"id": f"{len(ideas) + 1:03d}", "src": src, "mode": it.get("mode", src.split("-")[0]), "idea": it["idea"].replace("\n", " ").replace("|", "/")})
json.dump(ideas, open(os.path.join(d, "ideas.json"), "w"), indent=1, ensure_ascii=False)
for k in range(1, 11):
    order = ideas[:]
    random.Random(1000 + k).shuffle(order)
    with open(os.path.join(d, f"list-{k}.txt"), "w") as fh:
        for it in order:
            fh.write(f"{it['id']}|{it['idea']}\n")
print(len(ideas), "ideas")
