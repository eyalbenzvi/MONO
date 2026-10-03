import sys, cv2, numpy as np
from PIL import Image
d, tag = sys.argv[1], sys.argv[2]
ink = np.load(f"{d}/ink.npy").astype(np.float32)
for name, bg, fg in (("black", (22, 22, 22), (240, 239, 235)), ("white", (244, 243, 240), (22, 22, 22))):
    bg, fg = np.array(bg, np.float32), np.array(fg, np.float32)
    Image.fromarray((bg + (fg - bg) * ink[..., None]).astype(np.uint8)).save(f"{d}/{tag}-{name}-tee.png")
    s = cv2.resize(ink, (800, round(800 * ink.shape[0] / ink.shape[1])), interpolation=cv2.INTER_AREA)
    Image.fromarray((bg + (fg - bg) * s[..., None]).astype(np.uint8)).save(f"{d}/{tag}-{name}-s.png")
