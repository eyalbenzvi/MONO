"""Average the ten ranker files of a competition and write ranking.json (all ideas, best first).

  python3 tally.py c1
"""
import glob
import json
import os
import sys

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), sys.argv[1])
ideas = {it["id"]: it for it in json.load(open(os.path.join(d, "ideas.json")))}
scores = {i: [] for i in ideas}
files = sorted(glob.glob(os.path.join(d, "rank-*.json")))
for f in files:
    s = json.load(open(f))["scores"]
    for i, v in s.items():
        i = f"{int(i):03d}"
        if i in scores:
            scores[i].append(float(v))
rows = []
for i, v in scores.items():
    rows.append({**ideas[i], "avg": round(sum(v) / len(v), 2) if v else 0, "n": len(v)})
rows.sort(key=lambda r: -r["avg"])
for r, row in enumerate(rows, 1):
    row["rank"] = r
json.dump(rows, open(os.path.join(d, "ranking.json"), "w"), indent=1, ensure_ascii=False)
print(len(files), "rankers")
for row in rows[:25]:
    print(row["rank"], row["id"], row["avg"], row["n"], row["mode"], "|", row["idea"][:230])
