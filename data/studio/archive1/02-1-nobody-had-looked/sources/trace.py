import sys; sys.path.insert(0,'../wt-shop/scripts/studio')
from PIL import Image, ImageDraw, ImageFont
import numpy as np, cv2, oneink, json
from oneink import disc, PX_MM
from skimage.morphology import skeletonize
W,H=3307,4370; PX=W/280
TH=float(sys.argv[1]) if len(sys.argv)>1 else 0.55
OUT=sys.argv[2] if len(sys.argv)>2 else 'crop'
CAP=sys.argv[3] if len(sys.argv)>3 else 'Nobody had looked this closely before.'
FONT=sys.argv[4] if len(sys.argv)>4 else 'libre-caslon-text-bold.ttf'
SEAM=json.loads(sys.argv[5]) if len(sys.argv)>5 else [[3390,600],[3350,900],[3300,1300],[3262,1700],[3250,2050],[3020,2300],[3000,3300],[2990,4300]]
RAD=2.6
g=np.asarray(Image.open('flea-full.jpg').convert('L')).astype(np.float32)
g[260:430,5020:5660]=255
Y0,Y1,X1=600,4300,5760
keep=np.zeros_like(g,np.uint8)
poly=[(x,y) for x,y in SEAM]+[(X1,4300),(X1,600)]
cv2.fillPoly(keep,[np.array(poly,np.int32)],1)
g=np.where(keep>0,g,255)
XL=min(x for x,y in SEAM)-20
g=g[Y0:Y1,XL:X1]
bgd=cv2.GaussianBlur(cv2.dilate(g,np.ones((31,31),np.uint8)),(0,0),18)
n=np.clip(g/np.maximum(bgd,1),0,1)
avail_h=int((370-14-12-18-8)*PX)
s=min((272*PX)/n.shape[1],avail_h/n.shape[0])
up=cv2.resize(n,None,fx=s,fy=s,interpolation=cv2.INTER_LANCZOS4)
up=cv2.GaussianBlur(up,(0,0),0.6)
a=(up<TH).astype(np.uint8)
nn,lab,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(nn,bool); kp[1:]=st[1:,cv2.CC_STAT_AREA]>12; a=kp[lab].astype(np.uint8)
a=np.maximum(a,cv2.dilate(skeletonize(a>0).astype(np.uint8),disc(RAD)))
a=cv2.morphologyEx(a,cv2.MORPH_OPEN,disc(0.2*PX_MM-0.01))
nn,lab,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(nn,bool); kp[1:]=st[1:,cv2.CC_STAT_AREA]>(0.5*PX_MM)**2*2; a=kp[lab].astype(np.uint8)
ys,xs=np.nonzero(a); a=a[ys.min():ys.max()+1, xs.min():xs.max()+1]; ah,aw=a.shape
c=np.zeros((H,W),np.uint8); top=int(14*PX); x0=(W-aw)//2; c[top:top+ah,x0:x0+aw]=a
F='../wt-shop/assets/fonts/'+FONT; target=min(235*PX, aw*1.0); lo,hi=20,900
while hi-lo>1:
    m=(lo+hi)//2; b=ImageFont.truetype(F,m).getbbox(CAP); lo,hi=(m,hi) if b[2]-b[0]<=target else (lo,m)
f=ImageFont.truetype(F,lo); b=f.getbbox(CAP)
m2=Image.new('L',(W,H),0); d=ImageDraw.Draw(m2); d.text(((W-(b[2]-b[0]))//2-b[0],top+ah+int(12*PX)-b[1]),CAP,font=f,fill=255)
c=np.maximum(c,(np.array(m2)>127).astype(np.uint8))
r=oneink.check(c,{'mode':'line'})
print({k:r[k] for k in ['coverage','thin','topMm','solid','fails']},'scale',round(s,2),'art mm',round(aw/PX),round(ah/PX),'cap mm',round((b[3]-b[1])/PX,1))
rgba=np.zeros((H,W,4),np.uint8); rgba[...,3]=c*255
Image.fromarray(rgba,'RGBA').save(f'{OUT}-white.png',dpi=(300,300))
tt=np.where(c[...,None]>0,np.array([22,22,22]),np.array([244,243,240])).astype(np.uint8)
Image.fromarray(tt).resize((700,925),Image.LANCZOS).save(f'{OUT}-s.png'); Image.fromarray(tt).save(f'{OUT}-tee.png')
Image.fromarray(tt[top:top+ah, x0:x0+700]).resize((350,ah//2)).save(f'{OUT}-seam.png')
cy,cx=top+int(ah*0.35),x0+int(aw*0.55); Image.fromarray(tt[cy:cy+600,cx:cx+600]).save(f'{OUT}-zoom.png')
