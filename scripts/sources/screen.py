"""
The content waves' halftone step: scripts/photos/halftone.py's own screen
(process()), run on a source's cached masters instead of assets/masters, so
a candidate can be reviewed as it will print before it has a number.

  python scripts/sources/screen.py <cache-dir> <list-file>

<list-file>: one "<key> <line|tonal|photo>" per line. Reads
<cache>/prep/print_<key>.webp, writes <cache>/screen/print_<key>.webp and
<cache>/screen.json (halftone.py's manifest entry per key). Keys already
screened from the same master are skipped.
"""
import json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "photos"))
import halftone  # noqa: E402

cache, listing = sys.argv[1], sys.argv[2]
halftone.MASTERS = os.path.join(cache, "prep")
halftone.PRINTS = os.path.join(cache, "screen")
os.makedirs(halftone.PRINTS, exist_ok=True)
manifest_path = os.path.join(cache, "screen.json")
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
done = 0
for line in open(listing):
    if not line.strip():
        continue
    key, medium = line.split()
    src = os.path.join(halftone.MASTERS, f"print_{key}.webp")
    out = os.path.join(halftone.PRINTS, f"print_{key}.webp")
    if not os.path.exists(src):
        continue
    old = manifest.get(key, {})
    if os.path.exists(out) and old.get("src") == halftone.sha(src) and old.get("recipe") == halftone.RECIPE:
        continue
    manifest[key] = halftone.process(key, medium)
    done += 1
    if done % 25 == 0:
        json.dump(manifest, open(manifest_path, "w"), indent=0, sort_keys=True)
        print(done, flush=True)
json.dump(manifest, open(manifest_path, "w"), indent=0, sort_keys=True)
print(f"screened {done}")
