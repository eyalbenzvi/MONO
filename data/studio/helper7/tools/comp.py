"""Idea competition helper: merge generator files into ids, write ten shuffled lists, average ranker scores.
  python3 comp.py lists <compdir>     -> <compdir>/ideas.json, <compdir>/rank/list-01.txt .. list-10.txt
  python3 comp.py score <compdir>     -> <compdir>/ranking.json (ideas sorted by mean score)"""
import json, glob, os, random, sys
mode, d = sys.argv[1], sys.argv[2]
if mode == "lists":
    ideas = []
    for f in sorted(glob.glob(f"{d}/gen/gen-*.json")):
        for it in json.load(open(f)):
            ideas.append({"id": f"I{len(ideas)+1:03d}", "idea": it["idea"].replace("\n", " ").replace("|", "/"), "mode": it.get("mode", "")})
    json.dump(ideas, open(f"{d}/ideas.json", "w"), indent=1, ensure_ascii=False)
    for k in range(1, 11):
        r = random.Random(k * 7919); order = ideas[:]; r.shuffle(order)
        open(f"{d}/rank/list-{k:02d}.txt", "w").write("".join(f"{i['id']}|{i['idea']}\n" for i in order))
    print(len(ideas), "ideas")
else:
    ideas = {i["id"]: i for i in json.load(open(f"{d}/ideas.json"))}
    sc = {k: [] for k in ideas}
    for f in sorted(glob.glob(f"{d}/rank/ranker-*.json")):
        for k, v in json.load(open(f))["scores"].items():
            if k in sc: sc[k].append(float(v))
    out = sorted(({**ideas[k], "mean": round(sum(v) / len(v), 2), "n": len(v)} for k, v in sc.items() if v), key=lambda x: -x["mean"])
    json.dump(out, open(f"{d}/ranking.json", "w"), indent=1, ensure_ascii=False)
    for i, x in enumerate(out[:25], 1): print(i, x["id"], x["mean"], x["n"], x["mode"], x["idea"][:200])
