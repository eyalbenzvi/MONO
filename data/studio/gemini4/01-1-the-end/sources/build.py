"""'the end' on a Gemini linocut sunset: boat moved right of the sun, type and its reflection added in code."""
import sys, json; sys.path.insert(0,'../../wt-shop/scripts/studio')
import numpy as np, cv2, oneink
from PIL import Image, ImageDraw, ImageFont
from oneink import disc, PX_MM as PX
from skimage.morphology import skeletonize
W,H=3307,4370; F='../../wt-shop/assets/fonts/'
P=json.load(open(sys.argv[1])) if len(sys.argv)>1 else {}
g=lambda k,d:P.get(k,d)
OUT=g('out','g1')
src=np.asarray(Image.open('g1.jpg').convert('L')).astype(np.float32)
s0=src.copy()
# --- edits at source resolution ---
HZ=470                                     # horizon top (source px)
bx0,bx1,by0,by1=g('boat',[330,440,368,662])
patch=s0[by0:by1,bx0:bx1].copy()
dx=g('fillfrom',-110)                      # refill the old boat area with the ripples just to its left
src[HZ:by1,bx0:bx1]=s0[HZ:by1,bx0+dx:bx1+dx]; src[by0:HZ,bx0:bx1]=255
nx=g('boatx',744)                          # boat (with its reflection and local ripples) goes right of the sun
src[by0:by1,nx:nx+(bx1-bx0)]=patch
# birds: move up out of the sail's way
bd=g('birds',[725,340,805,395]); bird=s0[bd[1]:bd[3],bd[0]:bd[2]].copy(); src[bd[1]:bd[3],bd[0]:bd[2]]=np.maximum(src[bd[1]:bd[3],bd[0]:bd[2]],255)
oy=g('birdsup',-90); ox=g('birdsdx',-30)
bs=g('birdscale',1.8); bird=cv2.resize(bird,None,fx=bs,fy=bs,interpolation=cv2.INTER_CUBIC); bh,bw=bird.shape
by_,bx_=bd[1]+oy,bd[0]+ox
src[by_:by_+bh,bx_:bx_+bw]=np.minimum(src[by_:by_+bh,bx_:bx_+bw],bird)
# stretch the sea below the horizon (more space between ripples, deeper water)
SY=g('seastretch',1.0)
if SY!=1.0:
    sea=src[HZ+6:,:]; sea=cv2.resize(sea,(sea.shape[1],int(sea.shape[0]*SY)),interpolation=cv2.INTER_CUBIC)
    src=np.vstack([src[:HZ+6,:],sea]); by0,by1=by0,HZ+6+int((by1-HZ-6)*SY)
# --- trace to print resolution ---
ink0=src<128; ys,xs=np.nonzero(ink0); X0,X1=xs.min(),xs.max()
s=g('artw',262)*PX/(X1-X0)
up=cv2.resize(src/255.0,None,fx=s,fy=s,interpolation=cv2.INTER_LANCZOS4); up=cv2.GaussianBlur(up,(0,0),1.0)
a=(up<0.5).astype(np.uint8)
a=np.maximum(a,cv2.dilate(skeletonize(a>0).astype(np.uint8),disc(2.6)))
hz=int(HZ*s); sunL=int(g('sunl',480)*s)   # horizon y and the sun's left edge, print px
# --- type: "the" / "end", end's baseline on the horizon, the d just before the sun ---
FN=F+g('font','space-grotesk-bold.ttf'); GAPD=g('gapd',3.5)*PX; LX=int(X0*s)+int(g('lxmm',2)*PX)
endw=sunL-GAPD-LX
def fitw(txt,w):
    lo,hi=10,3000
    while hi-lo>1:
        mid=(lo+hi)//2; b=ImageFont.truetype(FN,mid).getbbox(txt); lo,hi=(mid,hi) if b[2]-b[0]<=w else (lo,mid)
    return lo
size=fitw('end',endw); fo=ImageFont.truetype(FN,size)
m=Image.new('L',a.shape[::-1],0); d=ImageDraw.Draw(m)
be=fo.getbbox('end'); d.text((LX-be[0],hz-be[3]),'end',font=fo,fill=255)     # bottom of 'end' on the horizon
bt=fo.getbbox('the'); lead=g('lead',0.16)*(be[3]-be[1])
d.text((LX-bt[0],hz-(be[3]-be[1])-lead-(bt[3]-bt[1])-bt[1]+0),'the',font=fo,fill=255)
txt=(np.array(m)>127).astype(np.uint8)
endmask=np.zeros_like(txt); endmask[hz-(be[3]-be[1])-2:hz+1,:]=txt[hz-(be[3]-be[1])-2:hz+1,:]
# --- reflection of 'end': the ripple lines thicken inside the mirrored letters, fading with depth ---
eh=be[3]-be[1]; rh=int(eh*g('rlen',1.0))
refl=np.zeros_like(txt); seg=endmask[hz-eh:hz,:][::-1,:]; gap=int(g('rgap',4)*PX)
refl[hz+gap:hz+gap+eh,:]=seg[:max(0,min(eh,refl.shape[0]-hz-gap)),:]
# waver: shift each row of the mirrored letters sideways, more with depth
refl[:]=refl*(1 if g('reflect',1) else 0)
A=g('wav',1.4)*PX; lam=g('wavl',7)*PX
for y in range(hz+gap,min(refl.shape[0],hz+gap+eh)):
    dpt=(y-hz-gap)/eh; sh=int(round(A*(0.3+dpt)*np.sin(2*np.pi*(y-hz)/lam)))
    refl[y]=np.roll(refl[y],sh)
water=np.zeros_like(a); water[hz+gap:,:]=a[hz+gap:,:]
out=a.copy()
# vertical distance from every pixel to the ripple line above and below (per column)
y0r,y1r=hz+gap,min(a.shape[0],hz+gap+rh)
reg=water[y0r:y1r,:].astype(bool); n=reg.shape[0]; BIG=10**6
up=np.full(reg.shape,BIG,np.int32); dn=np.full(reg.shape,BIG,np.int32)
last=np.full(reg.shape[1],-BIG,np.int64)
for i in range(n):
    last=np.where(reg[i],i,last); up[i]=i-last
last=np.full(reg.shape[1],BIG,np.int64)
for i in range(n-1,-1,-1):
    last=np.where(reg[i],i,last); dn[i]=last-i
MING=g('mingap',0.85)*PX
for i in range(n):
    f=1-i/max(1,n); k=g('thick',1.1)*PX*max(f,0)
    row=refl[y0r+i]>0
    if k<=0 or not row.any(): continue
    du=up[i]; dd=dn[i]; gapw=du+dd-1                      # gap this pixel sits in
    room=np.maximum(0,(gapw-MING)/2)                      # how far each line may grow into it
    grow=np.minimum(k,room)  # fixed, modest thickening
    hit=row&(((du<=grow)&(du<BIG))|((dd<=grow)&(dd<BIG)))
    out[y0r+i,hit]=1
# thin every long ripple line in the water to one weight; short marks (glitter, boat) stay; letters of the reflection stay full
wat=np.zeros_like(a); wat[hz+gap:,:]=a[hz+gap:,:]
k_,l_,st_,_=cv2.connectedComponentsWithStats(wat)
longc=np.zeros(k_,bool); longc[1:]=st_[1:,cv2.CC_STAT_WIDTH]>g('longmm',22)*PX
longm=longc[l_]
inside=cv2.dilate(refl,disc(1))>0
thin=cv2.dilate(skeletonize(a>0).astype(np.uint8),disc(g('thinr',3.0)))
tall=np.zeros(k_,bool); tall[1:]=st_[1:,cv2.CC_STAT_HEIGHT]>g('tallmm',8)*PX   # sail and hull: keep as drawn
boatz=cv2.dilate(tall[l_].astype(np.uint8)*0,disc(1))>0
# ripples touching the hull are part of the tall component; keep only its pixels near the boat's own shape
hull=np.zeros_like(longm); hull[int(by0*s):int(by1*s),int(nx*s):]=True
solid=cv2.morphologyEx((a>0).astype(np.uint8),cv2.MORPH_OPEN,disc(g('solidr',6)))>0      # thick parts = boat body
boatz=hull&cv2.dilate(solid.astype(np.uint8),disc(g('boatpad',5)))>0
sel=(longm|hull)&~inside&~boatz
out=np.where(sel,thin if g('minline',1) else thin&a,out).astype(np.uint8)
a=out
sx0,sx1,sy0=int(g('sunl',480)*s),int(g('sunr',732)*s),int(g('suntop',343)*s)
for k in range(g('gouges',4)):
    t=(g('g0',2.0)-k*g('gstep',0.35))*PX; yb=hz-int((g('gfirst',3.0)+k*g('gpitch',4.2))*PX)
    if t<0.8*PX: break
    a[int(yb-t):yb,sx0:sx1]=0
# hand-cut letters: slightly irregular edges
if g('rough',1):
    rng=np.random.default_rng(5); nz=cv2.GaussianBlur(rng.standard_normal(txt.shape).astype(np.float32),(0,0),g('roughs',2.2)*PX/3)
    nz=nz/np.abs(nz).max(); tf=cv2.GaussianBlur(txt.astype(np.float32),(0,0),g('roughb',0.35)*PX)
    txt=((tf+g('rougha',0.18)*nz)>0.5).astype(np.uint8)
a=np.maximum(a,txt)
# --- place on the print ---
ys,xs=np.nonzero(a); a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]; ah,aw=a.shape
c=np.zeros((H,W),np.uint8); top=int(g('top',16)*PX); x0=(W-aw)//2
if top+ah>H: sys.exit(f'too tall {ah/PX:.0f} mm')
c[top:top+ah,x0:x0+aw]=a
c=cv2.morphologyEx(c,cv2.MORPH_OPEN,disc(0.2*PX-0.01))
k_,l_,st_,_=cv2.connectedComponentsWithStats(c); kp=np.zeros(k_,bool); kp[1:]=st_[1:,cv2.CC_STAT_AREA]>(0.5*PX)**2*2; c=kp[l_].astype(np.uint8)
r=oneink.check(c,{'mode':'line'}); print({k:r[k] for k in ['coverage','thin','sizeCm','topMm','solid','fails']})
rgba=np.zeros((H,W,4),np.uint8); rgba[...,3]=c*255; Image.fromarray(rgba,'RGBA').save(f'{OUT}-white.png',dpi=(300,300))
tt=np.where(c[...,None]>0,np.array([22,22,22]),np.array([244,243,240])).astype(np.uint8)
Image.fromarray(tt).save(f'{OUT}-tee.png'); Image.fromarray(tt).resize((700,925),Image.LANCZOS).save(f'{OUT}-s.png')
