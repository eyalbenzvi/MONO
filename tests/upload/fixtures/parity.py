"""
The reference for the halftone port's parity test (tests/upload/convert.test.ts):
screens each tone written by tests/upload/parity.ts with scripts/photos/halftone.py's
own functions (upsample, cap_masses, screen) and writes the ink coverage of every
32 x 32 block to tests/upload/fixtures/halftone-parity.json.

  npx tsx tests/upload/parity.ts /tmp/parity && python3 tests/upload/fixtures/parity.py /tmp/parity

The one step halftone.py doesn't have is the brief's dot floor (dots 8-80%), applied
here exactly as lib/upload/convert.ts screenTone does, so the parity covers the rest.
"""
import glob, json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "scripts", "photos"))
import halftone as H  # noqa: E402

MIN_DOT = 0.08
BLOCK = 32


def main(src):
    out = {}
    for f in sorted(glob.glob(os.path.join(src, "*.u8"))):
        name, size, _ = os.path.basename(f).split(".")
        w, h = map(int, size.split("x"))
        u8 = np.fromfile(f, np.uint8).reshape(h, w)
        # +0.5: upsample's astype(uint8) truncates, so the bytes go back in exactly.
        d = (u8.astype(np.float64) + 0.5) / 255
        D = H.upsample(d)
        D = np.clip((D - 0.04) / 0.92, 0, 1)
        D = np.where(D < MIN_DOT / 2, 0, np.maximum(D, MIN_DOT))
        D = H.cap_masses(D)
        mask = D > H.screen()
        bh, bw = H.OUT_H // BLOCK, H.OUT_W // BLOCK
        cov = mask[: bh * BLOCK, : bw * BLOCK].reshape(bh, BLOCK, bw, BLOCK).mean(axis=(1, 3))
        out[name] = {"w": w, "h": h, "ink": round(float(mask.mean()), 5), "blocks": [round(float(v), 4) for v in cov.ravel()]}
    json.dump(out, open(os.path.join(HERE, "halftone-parity.json"), "w"), separators=(",", ":"))
    print("wrote", ", ".join(out))


if __name__ == "__main__":
    main(sys.argv[1])
