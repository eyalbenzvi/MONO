"""
Pose skeletons for the model photos (ControlNet OpenPose, generate.py): a
man from directly behind, drawn in OpenPose's colours. No hand keypoints —
drawn hands came out as dark blobs at the hips — so the hands follow the
prompt (in pockets, hanging loose). Wider shoulders and hips than the first
pose (pose-a, taken from a slim model), and a few natural stances instead of
one stiff, mirror-symmetric one.

  python scripts/models/poses.py        # writes poses/pose-b.png … pose-l.png
"""
import os
from PIL import Image, ImageDraw

W, H = 640, 880
# OpenPose body keypoints (18): 0 nose, 1 neck, 2 r-shoulder, 3 r-elbow, 4 r-wrist, 5 l-shoulder, 6 l-elbow,
# 7 l-wrist, 8 r-hip, 9 r-knee, 10 r-ankle, 11 l-hip, 12 l-knee, 13 l-ankle, 14 r-eye, 15 l-eye, 16 r-ear, 17 l-ear.
# Seen from behind, the man's right is on the image's right.
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
          (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]

def base(over):
    """A fuller man standing easy: shoulders ~300 px apart, hips ~200, ears only (from behind, as in pose-a)."""
    return {1: (320, 300), 2: (470, 306), 5: (170, 306), 8: (420, 712), 11: (220, 712), 16: (386, 136), 17: (254, 136)} | over

POSES = {
    # Arms hanging loose, a little away from the body (forearms show: tattoos).
    "pose-b": base({3: (512, 530), 4: (500, 735), 6: (128, 530), 7: (140, 735)}),
    # Hands in the front pockets: elbows out, wrists at the hips.
    "pose-c": base({3: (522, 510), 4: (430, 680), 6: (118, 510), 7: (210, 680)}),
    # One hand in a pocket, the other arm loose.
    "pose-d": base({3: (522, 510), 4: (430, 680), 6: (128, 530), 7: (142, 738)}),
    # Weight on one leg: shoulders and hips tilted opposite ways, head a touch to the side.
    "pose-e": base({2: (470, 314), 5: (170, 298), 8: (420, 700), 11: (220, 722), 16: (392, 138), 17: (260, 134), 3: (514, 540), 4: (498, 742), 6: (126, 520), 7: (150, 728)}),
    # Upright, arms loose with a slight bend at the elbows, hands by the thighs (a third stance for the lookbook sets).
    "pose-f": base({3: (506, 525), 4: (478, 728), 6: (134, 525), 7: (162, 728)}),
    # Relaxed and varied (from the sixth set on): the upright stances above, both arms down, read as standing
    # at attention. Each arm does something different; a hand in front of the body is left out (hidden from behind).
    # Right hand in the front pocket, the left forearm forward (holding a coffee).
    "pose-g": base({3: (522, 510), 4: (430, 680), 6: (140, 525)}),
    # Thumbs hooked in the back pockets, elbows out (the hands sit below the print).
    "pose-h": base({3: (532, 540), 4: (404, 722), 6: (108, 540), 7: (236, 722)}),
    # Right hand at the back of the neck, elbow up; the left arm loose, a little out.
    "pose-i": base({3: (520, 196), 4: (372, 226), 6: (140, 535), 7: (178, 738)}),
    # Arms folded in front: only the elbows show, out to the sides.
    "pose-j": base({2: (470, 312), 5: (170, 300), 8: (420, 704), 11: (220, 720), 3: (505, 560), 6: (135, 560)}),
    # Mid-stride: the right arm swung back and out, the left forward (hand hidden).
    "pose-k": base({2: (470, 300), 5: (170, 312), 3: (516, 520), 4: (548, 700), 6: (146, 520), 7: (196, 680)}),
    # Left thumb in the front pocket; the right forearm raised forward (checking a phone).
    "pose-l": base({3: (508, 545), 6: (118, 510), 7: (210, 680)}),
}
# What each relaxed pose's arms are doing, said in the prompt (no hand keypoints: the words place the hands).
ARMS = {
    "pose-g": "right hand in front pocket, holding a coffee cup in his left hand in front of him",
    "pose-h": "thumbs hooked in his back pockets, elbows out, relaxed",
    "pose-i": "right hand resting on the back of his neck, left arm loose",
    "pose-j": "arms casually folded in front of his chest, elbows showing",
    "pose-k": "walking away mid-stride, arms swinging naturally",
    "pose-l": "looking down at a phone in his right hand, left thumb in front pocket",
}

def draw(k):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for i, (a, b) in enumerate(LIMBS):
        if a in k and b in k:
            c = tuple(int(v * 0.6) for v in COLORS[i])
            d.line([k[a], k[b]], fill=c, width=8)
    for i, p in k.items():
        d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], fill=COLORS[i])
    return img

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "poses")
    for name, k in POSES.items():
        draw(k).save(os.path.join(out, name + ".png"))
    print("poses:", ", ".join(POSES))
