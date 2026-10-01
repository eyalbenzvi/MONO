# crop and fade the crop's edges into white paper: fade.py in out x0 y0 x1 y1 band [l t r b flags]
import sys, numpy as np
from PIL import Image
a=sys.argv; x0,y0,x1,y1,band=map(int,a[3:8]); sides=a[8] if len(a)>8 else "ltrb"
im=np.asarray(Image.open(a[1]).convert("L").crop((x0,y0,x1,y1))).astype(float)
h,w=im.shape; yy,xx=np.mgrid[0:h,0:w]
d=np.full((h,w),1e9)
if "l" in sides: d=np.minimum(d,xx)
if "r" in sides: d=np.minimum(d,w-1-xx)
if "t" in sides: d=np.minimum(d,yy)
if "b" in sides: d=np.minimum(d,h-1-yy)
t=np.clip(d/band,0,1); t=t*t*(3-2*t)
out=255-(255-im)*t
Image.fromarray(out.clip(0,255).astype(np.uint8)).save(a[2])
