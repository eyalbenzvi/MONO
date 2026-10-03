"""The terrain: swissALTI3D (swisstopo, open government data), 2 m grid, the 63 one-kilometre tiles LV95
E 2640–2646 km × N 1155–1163 km (the Eiger and its foot), each in its latest year, mosaicked to dem.npy
(rows north to south from N 1164 km, columns west to east from E 2640 km). python fetch.py"""
import io, json, urllib.request
import numpy as np
from PIL import Image

best = {}
url = ("https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items"
       "?bbox=7.96,46.55,8.06,46.64&limit=100")
while url:
    d = json.load(urllib.request.urlopen(url, timeout=60))
    for f in d["features"]:
        yr, tile = f["id"].split("_")[1:3]
        href = [a["href"] for k, a in f["assets"].items() if k.endswith("_2_2056_5728.tif")]
        if href and (tile not in best or yr > best[tile][0]):
            best[tile] = (yr, href[0])
    url = next((l["href"] for l in d.get("links", []) if l["rel"] == "next"), None)
M = np.zeros((4500, 3500), np.float32)
for e in range(2640, 2647):
    for n in range(1155, 1164):
        a = np.array(Image.open(io.BytesIO(urllib.request.urlopen(best[f"{e}-{n}"][1], timeout=120).read())), np.float32)
        r, c = (1163 - n) * 500, (e - 2640) * 500
        M[r:r + 500, c:c + 500] = a
np.save("dem.npy", M)
print("dem.npy", M.shape, float(M.max()))
