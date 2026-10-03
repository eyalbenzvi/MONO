"""HORSEPOWER VS. POOR DECISIONS: Gemini vehicle drawings (g1, g2) set on a chart drawn in code."""
import sys, json; sys.path.insert(0,'../wt-shop/scripts/studio')
import numpy as np, cv2, oneink
from PIL import Image, ImageDraw, ImageFont
from oneink import disc, PX_MM as PX
from skimage.morphology import skeletonize
from scipy.ndimage import binary_fill_holes
from scipy.interpolate import PchipInterpolator
W,H=3307,4370; F='../wt-shop/assets/fonts/'
P=json.load(open(sys.argv[1])) if len(sys.argv)>1 else {}
g=lambda k,d:P.get(k,d)
OUT=g('out','h'); SK=g('sk',2.6); TH=g('th',0.55); LWW=g('lww',0.6); GAP=g('gap',2.5); TW=g('tw',1.8)
def norm(fn):
    src=np.asarray(Image.open(fn).convert('L')).astype(np.float32)
    bgd=cv2.GaussianBlur(cv2.dilate(src,np.ones((15,15),np.uint8)),(0,0),10); return np.clip(src/np.maximum(bgd,1),0,1)
SRC={'g1':norm('g1.jpg'),'g2':norm('g2.jpg')}
FROM={'dragster':'g2','minivan':'g2'}
BOX={'dragster':(129,18,1160,352),'minivan':(418,410,942,354),'bicycle':(107,17,437,271),'scooter':(846,25,415,263),
     'hatch':(27,306,583,248),'moto':(927,305,448,249),'sports':(402,529,703,228)}
# wheels: (cx, cy, tyre radius) in source px, then erase<, rim, hub as fractions of it, and spokes
WHEELS=g('wheels',{})
HARD=g('hard',{})
V=g('veh',{})   # name: [width mm, dot x mm, dot y mm, outlier?]
def vehicle(name,wmm):
    x,y,w,h=BOX[name]; c=SRC[FROM.get(name,'g1')][y:y+h,x:x+w].copy()
    ink=(c<0.6).astype(np.uint8); k,l,st,_=cv2.connectedComponentsWithStats(cv2.dilate(ink,np.ones((15,15),np.uint8)))
    big=st[1:,cv2.CC_STAT_AREA].max(); keep=np.r_[False,st[1:,cv2.CC_STAT_AREA]>0.05*big]; c[~keep[l]]=1.0   # drop bits of neighbours
    s=wmm*PX/c.shape[1]; up=cv2.GaussianBlur(cv2.resize(c,None,fx=s,fy=s,interpolation=cv2.INTER_LANCZOS4),(0,0),1.0)
    a=(up<TH).astype(np.uint8)
    for (bx0,by0,bx1,by1,dth) in HARD.get(name,[]):   # busy areas: keep only the strong lines
        Y0_,Y1_,X0_,X1_=int(by0*s),int(by1*s),int(bx0*s),int(bx1*s); a[Y0_:Y1_,X0_:X1_]=(up[Y0_:Y1_,X0_:X1_]<TH-dth)
    k,l,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(k,bool); kp[1:]=st[1:,cv2.CC_STAT_AREA]>40; a=kp[l].astype(np.uint8)
    a=np.maximum(a,cv2.dilate(skeletonize(a>0).astype(np.uint8),disc(SK)))
    ys,xs=np.nonzero(a); oy,ox=ys.min(),xs.min(); a=a[oy:ys.max()+1,ox:xs.max()+1].copy()
    for (wx,wy,wr,er,rim,hub,sp) in WHEELS.get(name,[]):   # simpler wheels
        cx_,cy_,R=wx*s-ox,wy*s-oy,wr*s; yy,xx=np.ogrid[:a.shape[0],:a.shape[1]]; a[(xx-cx_)**2+(yy-cy_)**2<(er*R)**2]=0
        lw=max(1,int(round(LWW*PX))); C=(int(cx_),int(cy_))
        cv2.circle(a,C,int(rim*R),1,lw,cv2.LINE_AA); cv2.circle(a,C,int(hub*R),1,lw,cv2.LINE_AA)
        for kk in range(sp):
            t=2*np.pi*kk/sp+0.2
            cv2.line(a,(int(cx_+np.cos(t)*hub*R),int(cy_+np.sin(t)*hub*R)),(int(cx_+np.cos(t)*rim*R),int(cy_+np.sin(t)*rim*R)),1,max(1,int(round(0.45*PX))),cv2.LINE_AA)
    return a
# data points and the trend curve (through the non-outlier dots, out past the top edge)
items=[(n,v[0],v[1],v[2],len(v)>3 and v[3]) for n,v in V.items()]
cent=sorted((cx*PX,by*PX) for n,w,cx,by,o in items if not o); OUTL=[(cx*PX,by*PX) for n,w,cx,by,o in items if o]
pts=cent+[(g('exitx',214)*PX,g('exit',-6)*PX)]
f=PchipInterpolator([p[0] for p in pts],[p[1] for p in pts]); X=np.linspace(pts[0][0],pts[-1][0],4000); Y=f(X)
core=np.full((H,W),255,np.uint8); cv2.polylines(core,[np.round(np.stack([X,Y],1)*8).astype(np.int32)],False,0,1,cv2.LINE_8,shift=3)
dcurve=cv2.distanceTransform(core,cv2.DIST_L2,5)
curve=(dcurve<=TW*PX/2).astype(np.uint8); yy,xx=np.ogrid[:H,:W]
for (px_,py_) in (cent+OUTL if g("dot",1.9)>0 else []): curve[(xx-px_)**2+(yy-py_)**2<=(g('dot',1.9)*PX)**2]=1
# vehicles: each slides along the diagonal towards its dot until GAP from the dot, curve and the others
c=np.zeros((H,W),np.uint8)
for (name,wmm,cx,by,o) in items:
    a=vehicle(name,wmm); h,w=a.shape; ys0,xs0=np.nonzero(a); occ=cv2.dilate(c,disc(GAP*PX)); best=None
    for t in np.arange(g("tmin",-12),15,0.5):
        x0=int((cx+t)*PX); y0=int((by+t)*PX)
        if x0<0 or y0<0 or x0+w>W or y0+h>H: continue
        X_=xs0+x0; Y_=ys0+y0
        if np.sqrt((X_-cx*PX)**2+(Y_-by*PX)**2).min()<GAP*PX: continue
        if dcurve[Y_,X_].min()<(TW/2+GAP)*PX: continue
        if occ[Y_,X_].any(): continue
        best=(x0,y0); break
    if best is None: sys.exit(f'no place for {name}')
    x0,y0=best; c[y0:y0+h,x0:x0+w]|=a
c=np.maximum(c,curve)
# axes, labels, title
O=(g('ox',16)*PX,g('oy',336)*PX); XE=g('xe',272)*PX; YE=g('ye',18)*PX
m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
d.line([(O[0],YE),(O[0],O[1]),(XE,O[1])],fill=255,width=int(g('aw',0.9)*PX),joint='curve')
for t in range(1,6):
    xt=O[0]+(XE-O[0])*t/6; d.line([(xt,O[1]),(xt,O[1]+2.2*PX)],fill=255,width=int(0.6*PX))
    yt=O[1]-(O[1]-YE)*t/6; d.line([(O[0]-2.2*PX,yt),(O[0],yt)],fill=255,width=int(0.6*PX))
def arrow(tip,u,L=4.5*PX,Wd=2.2*PX):
    b=(tip[0]-u[0]*L,tip[1]-u[1]*L); d.polygon([tip,(b[0]-u[1]*Wd,b[1]+u[0]*Wd),(b[0]+u[1]*Wd,b[1]-u[0]*Wd)],fill=255)
arrow((XE+3*PX,O[1]),(1,0)); arrow((O[0],YE-3*PX),(0,-1))
fa=ImageFont.truetype(F+g('afont','oswald-bold.ttf'),int(g('axis',7.5)*PX))
t_='HORSEPOWER'; b=fa.getbbox(t_); d.text((XE-(b[2]-b[0])-b[0],O[1]+5*PX-b[1]),t_,font=fa,fill=255)
lab=Image.new('L',(int(120*PX),int(14*PX)),0); dl=ImageDraw.Draw(lab); t_='POOR DECISIONS'; b=fa.getbbox(t_); dl.text((-b[0],-b[1]),t_,font=fa,fill=255)
lab=lab.rotate(90,expand=True); ys,xs=np.nonzero(np.array(lab)); lab=lab.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
m.paste(255,(int(O[0]-5*PX-lab.width),int(YE)),lab)
ft=ImageFont.truetype(F+g('tfont','oswald-bold.ttf'),int(g('tsize',26)*PX)); fs=ImageFont.truetype(F+g('tfont','oswald-bold.ttf'),int(g('vsize',13)*PX))
ty=g('ty',40)*PX; tx=g('tx',30)*PX
for line,fnt in [('HORSEPOWER',ft),('VS.',fs),('POOR',ft),('DECISIONS',ft)]:
    b=fnt.getbbox(line); d.text((tx-b[0],ty-b[1]),line,font=fnt,fill=255); ty+=(b[3]-b[1])+g('lead',5)*PX
c=np.maximum(c,(np.array(m)>127).astype(np.uint8))
c=cv2.morphologyEx(c,cv2.MORPH_OPEN,disc(0.2*PX-0.01))
r=oneink.check(c,{'mode':'line'}); print({k:r[k] for k in ['coverage','thin','sizeCm','topMm','solid','fails']})
rgba=np.zeros((H,W,4),np.uint8); rgba[...,3]=c*255; Image.fromarray(rgba,'RGBA').save(f'{OUT}-white.png',dpi=(300,300))
t=np.where(c[...,None]>0,np.array([22,22,22]),np.array([244,243,240])).astype(np.uint8)
Image.fromarray(t).save(f'{OUT}-tee.png'); Image.fromarray(t).resize((700,925),Image.LANCZOS).save(f'{OUT}-s.png')
