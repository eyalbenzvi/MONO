import sys; sys.path.insert(0,'../wt-shop/scripts/studio')
from PIL import Image, ImageDraw, ImageFont
import numpy as np, cv2, oneink
from oneink import disc, PX_MM
from skimage.morphology import skeletonize
W,H=3307,4370; PX=W/280
TH=0.55; RAD=2.6
DX=int(sys.argv[1]) if len(sys.argv)>1 else -18   # boundary offset (px, source)
g=np.asarray(Image.open('cma-rhino.png')).astype(np.float32)[516:3876,120:4852]
bgd=cv2.GaussianBlur(cv2.dilate(g,np.ones((31,31),np.uint8)),(0,0),18)
n=np.clip(g/np.maximum(bgd,1),0,1)
h0,w0=n.shape
seam=[(2530,0),(2530,100),(2484,232),(2453,350),(2444,525),(2440,700),(2440,875),(2170,1240),(2114,1515),(2139,1886),(2190,2140),(2290,2190),(2307,2860),(2256,3232),(2256,h0)]
keep=np.zeros((h0,w0),np.uint8)
poly=[(x+DX,y) for x,y in seam]+[(w0,h0),(w0,0)]
cv2.fillPoly(keep,[np.array(poly,np.int32)],1)
n=np.where(keep>0,n,1.0)
xl=min(x for x,y in poly[:len(seam)])-20
sub=n[:,xl:]
avail=int((370-14-10-15-6)*PX)
s=min((272*PX)/sub.shape[1],avail/sub.shape[0])
up=cv2.resize(sub,None,fx=s,fy=s,interpolation=cv2.INTER_LANCZOS4)
up=cv2.GaussianBlur(up,(0,0),0.6)
a=(up<TH).astype(np.uint8)
nn,lab,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(nn,bool)
kp[1:]=st[1:,cv2.CC_STAT_AREA]>12; a=kp[lab].astype(np.uint8)
sk=skeletonize(a>0).astype(np.uint8)
a=np.maximum(a,cv2.dilate(sk,disc(RAD)))
a=cv2.morphologyEx(a,cv2.MORPH_OPEN,disc(0.2*PX_MM-0.01))
nn,lab,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(nn,bool)
kp[1:]=st[1:,cv2.CC_STAT_AREA]>(0.5*PX_MM)**2*2; a=kp[lab].astype(np.uint8)
ah,aw=a.shape
c=np.zeros((H,W),np.uint8); top=int(14*PX); x0=(W-aw)//2; c[top:top+ah,x0:x0+aw]=a
# caption: Cinzel Bold, tracked
txt='DRAWN FROM A RUMOR.'; F='../wt-shop/assets/fonts/cinzel-bold.ttf'; target=225*PX; TRK=0.16
def width(sz):
    f=ImageFont.truetype(F,sz); return sum(f.getlength(ch) for ch in txt)+TRK*sz*(len(txt)-1), f
lo,hi=20,800
while hi-lo>1:
    m=(lo+hi)//2; lo,hi=(m,hi) if width(m)[0]<=target else (lo,m)
tw,f=width(lo); capb=f.getbbox('D')
m2=Image.new('L',(W,H),0); d=ImageDraw.Draw(m2)
x=(W-tw)/2; y=top+ah+int(10*PX)-capb[1]
for ch in txt:
    d.text((x,y),ch,font=f,fill=255); x+=f.getlength(ch)+TRK*lo
c=np.maximum(c,(np.array(m2)>127).astype(np.uint8))
r=oneink.check(c,{'mode':'line'}); print({k:r[k] for k in ['coverage','thin','sizeCm','topMm','solid','fails']},'cap mm',(capb[3]-capb[1])/PX,'art mm',aw/PX,ah/PX)
rgba=np.zeros((H,W,4),np.uint8); rgba[...,3]=c*255
Image.fromarray(rgba,'RGBA').save('v4/rhino-white.png',dpi=(300,300))
t=np.where(c[...,None]>0,np.array([22,22,22]),np.array([244,243,240])).astype(np.uint8)
Image.fromarray(t).resize((700,925),Image.LANCZOS).save('v4/rhino-tee-s.png')
Image.fromarray(t[top:top+3900, x0:x0+700]).resize((350,1950)).save('v4/seam-zoom.png')
