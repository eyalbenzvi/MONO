"""
Cut-outs for photographs that were printed with their backdrop on (a
rectangle on the tee): the subject is cut
out of the committed print with rembg (isnet-general-use), laid on the
print area like the studio cut-outs, and kept only if the cut is clean.
Run by hand (pip install rembg onnxruntime pillow numpy):

  python scripts/photos/recut.py wildlife        # data/photos (National Zoo)

Writes the cut prints to node_modules/.cache/mono-photos/recut/print_<n>.webp
and recut.json (per design: accepted or why not, and the new measures) for
review; `--apply` copies the accepted ones into assets/masters and marks
them cut out (mode "object") in data/photos/photos.json.
"""
import json, os, sys
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
CACHE = os.path.join(ROOT, "node_modules", ".cache", "mono-photos", "recut")
W, H = 750, 1000
os.makedirs(CACHE, exist_ok=True)

def photo_order():
    """n → photo, as scripts/photos/source photoOrder (data order already committed there)."""
    out = json.load(open(os.path.join(ROOT, "data", "shirts.json")))
    return out

def components(mask):
    """Share of the mask in its largest 8-connected region (scipy-free flood fill on a small grid)."""
    small = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((mask.shape[1] // 4, mask.shape[0] // 4))) > 127
    lab = np.zeros(small.shape, np.int32); n = 0; sizes = []
    h, w = small.shape
    for y0 in range(h):
        for x0 in range(w):
            if small[y0, x0] and not lab[y0, x0]:
                n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; c = 0
                while stack:
                    y, x = stack.pop(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and small[yy, xx] and not lab[yy, xx]:
                                lab[yy, xx] = n; stack.append((yy, xx))
                sizes.append(c)
    return (max(sizes) / sum(sizes)) if sizes else 0

def main():
    which = sys.argv[1]
    apply = "--apply" in sys.argv
    photos = json.load(open(os.path.join(ROOT, "data", "photos", "photos.json")))
    by_key = {p["key"]: p for p in photos}
    # Every design that came from a framed photograph of this source, whether or not it is in the catalogue now.
    from subprocess import check_output
    order = json.loads(check_output(["npx", "tsx", "-e", "import {photoOrder} from './scripts/photos/source'; import p from './data/photos/photos.json'; console.log(JSON.stringify(photoOrder(p as any, 200).map(x=>({n:x.n,key:x.photo.key}))))"], cwd=ROOT))
    report_file = os.path.join(CACHE, "recut.json")
    report = json.load(open(report_file)) if os.path.exists(report_file) else {}
    if apply:
        for n, r in report.items():
            if not r.get("ok"):
                continue
            src = os.path.join(CACHE, f"print_{n}.webp")
            dst = os.path.join(ROOT, "assets", "masters", f"print_{n}.webp")
            Image.open(src).save(dst, "WEBP", lossless=True, quality=100, method=6)
            p = by_key[r["key"]]
            p.update(mode="object", tone=r["tone"], contrast=r["contrast"], coverage=r["coverage"], box=r["box"])
        open(os.path.join(ROOT, "data", "photos", "photos.json"), "w").write("[\n" + ",\n".join(json.dumps(p, separators=(",", ":"), ensure_ascii=False) for p in photos) + "\n]\n")
        print("applied", sum(1 for r in report.values() if r.get("ok")))
        return
    session = new_session("isnet-general-use")
    for item in order:
        p = by_key[item["key"]]
        if p["category"] != which or p["mode"] != "frame":
            continue
        n = str(item["n"])
        if n in report:
            continue
        src = os.path.join(ROOT, "assets", "masters", f"print_{n}.webp")
        im = Image.open(src).convert("RGBA")
        x0, y0, x1, y1 = p["box"]
        crop = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))).convert("RGB")
        cut = remove(crop, session=session)
        a = np.asarray(cut)[..., 3].astype(np.float32) / 255
        cov = float((a > 0.5).mean())
        border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        touch = float((border > 0.5).mean())
        main_share = components(a > 0.5)
        ok = 0.06 < cov < 0.7 and touch < 0.12 and main_share > 0.85
        why = None if ok else ("tiny" if cov <= 0.06 else "fills the frame" if cov >= 0.7 else "cut off at the edge" if touch >= 0.12 else "in pieces")
        # Lay the subject on the print area: its box scaled to fit 92% of the width or 80% of the height, top-aligned.
        ys, xs = np.nonzero(a > 0.5)
        entry = {"key": p["key"], "ok": ok, "why": why, "coverage_in_frame": round(cov, 3), "touch": round(touch, 3)}
        if len(xs):
            sub = cut.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            s = min(W * 0.92 / sub.width, H * 0.8 / sub.height)
            sub = sub.resize((max(1, round(sub.width * s)), max(1, round(sub.height * s))), Image.LANCZOS)
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            left, top = (W - sub.width) // 2, round(H * 0.03)
            canvas.alpha_composite(sub, (left, top))
            canvas.save(os.path.join(CACHE, f"print_{n}.webp"), "WEBP", lossless=True, quality=100, method=6)
            arr = np.asarray(canvas).astype(np.float32) / 255
            alpha = arr[..., 3]; lum = arr[..., 0] * 0.2126 + arr[..., 1] * 0.7152 + arr[..., 2] * 0.0722
            on = alpha > 0.5
            entry.update(tone=round(float(lum[on].mean()), 3), contrast=round(float(lum[on].std()), 3), coverage=round(float(on.mean()), 3),
                         box=[round(left / W, 3), round(top / H, 3), round((left + sub.width) / W, 3), round((top + sub.height) / H, 3)])
        report[n] = entry
        json.dump(report, open(report_file, "w"), indent=1)
        print(n, entry["ok"], entry.get("why"), flush=True)

if __name__ == "__main__":
    main()
