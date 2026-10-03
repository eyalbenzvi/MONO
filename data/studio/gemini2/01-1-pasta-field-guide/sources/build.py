import sys; sys.path.insert(0,'../wt-shop/scripts/studio')
from PIL import Image, ImageDraw, ImageFont
import numpy as np, cv2, oneink, json
from oneink import disc, PX_MM
from skimage.morphology import skeletonize
W,H=3307,4370; PX=PX_MM; F='../wt-shop/assets/fonts/'
SRC=sys.argv[1] if len(sys.argv)>1 else 'g1.jpg'; OUT=sys.argv[2] if len(sys.argv)>2 else 'p1'
TH=0.55
ROWS0=[(40,240),(290,470),(522,710),(762,950)]
NAMES=["Spaghetti","Penne Rigate","Farfalle","Fusilli","Rigatoni","Conchiglie","Orecchiette","Rotelle",
       "Cavatappi","Tortellini","Ravioli","Gemelli","Radiatori","Ditalini","Campanelle","Lasagne"]
g=np.asarray(Image.open(SRC).convert('L')).astype(np.float32)
for y0,y1 in [(236,282),(476,518),(716,756),(950,998)]: g[y0:y1,:]=255     # Gemini's labels
bgd=cv2.GaussianBlur(cv2.dilate(g,np.ones((15,15),np.uint8)),(0,0),10)
n=np.clip(g/np.maximum(bgd,1),0,1)
ink0=(n<0.75)
ys,xs=np.nonzero(ink0[:, :]); X0,X1=xs.min()-6,xs.max()+6; Y0,Y1=ys.min()-6,ys.max()+6
n=n[Y0:Y1,X0:X1]
ART_W=float(sys.argv[3])*PX if len(sys.argv)>3 else 258*PX; s=ART_W/n.shape[1]
up=cv2.resize(n,None,fx=s,fy=s,interpolation=cv2.INTER_LANCZOS4); up=cv2.GaussianBlur(up,(0,0),1.0)
a=(up<TH).astype(np.uint8)
k,lab,st,_=cv2.connectedComponentsWithStats(a); kp=np.zeros(k,bool); kp[1:]=st[1:,cv2.CC_STAT_AREA]>30; a=kp[lab].astype(np.uint8)
raw=a.copy(); sk=skeletonize(raw>0).astype(np.uint8)
dens=cv2.GaussianBlur(raw.astype(np.float32),(0,0),1.6*PX)
thick=np.maximum(raw,cv2.dilate(sk,disc(float(sys.argv[6]) if len(sys.argv)>6 else 2.6)))
strict=(up<TH-0.10).astype(np.uint8); sk2=skeletonize(strict>0).astype(np.uint8)
thin=np.maximum(strict,cv2.dilate(sk2,disc(2.5)))
DT=float(sys.argv[7]) if len(sys.argv)>7 else 0.42
a=np.where(dens>DT,thin,thick).astype(np.uint8)
# stronger opening inside chosen cells (row,col): fainter hatching dropped, strands kept at 0.42 mm
HARD=[(0,0),(3,0),(3,2)]
st3=(up<TH-0.20).astype(np.uint8); k3,l3,s3,_=cv2.connectedComponentsWithStats(st3); kp3=np.zeros(k3,bool); kp3[1:]=s3[1:,cv2.CC_STAT_AREA]>60; st3=kp3[l3].astype(np.uint8)
hard=np.maximum(st3,cv2.dilate(skeletonize(st3>0).astype(np.uint8),disc(2.6)))
for (rr,cc) in HARD:
    y0_=max(0,int((ROWS0[rr][0]-Y0)*s)); y1_=int((ROWS0[rr][1]-Y0)*s); x0_=max(0,int((cc*256-X0)*s)); x1_=int(((cc+1)*256-X0)*s)
    a[y0_:y1_,x0_:x1_]=hard[y0_:y1_,x0_:x1_]
print('dense share',round(float((dens>DT).mean()),3))
a=cv2.morphologyEx(a,cv2.MORPH_OPEN,disc(0.2*PX-0.01))
ah,aw=a.shape
# heading
m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
top=int(14*PX)
def fit(font,text,width):
    lo,hi=10,1500
    while hi-lo>1:
        mid=(lo+hi)//2; b=ImageFont.truetype(font,mid).getbbox(text); lo,hi=(mid,hi) if b[2]-b[0]<=width else (lo,mid)
    return ImageFont.truetype(font,lo)
f1=fit(F+'playfair-display-bold.ttf','PASTA',150*PX); b1=f1.getbbox('PASTA')
d.text(((W-(b1[2]-b1[0]))//2-b1[0],top-b1[1]),'PASTA',font=f1,fill=255)
y=top+(b1[3]-b1[1])+int(5*PX)
sub='A  FIELD  GUIDE'; f2=fit(F+'libre-caslon-text.ttf',sub,110*PX); b2=f2.getbbox(sub)
d.text(((W-(b2[2]-b2[0]))//2-b2[0],y-b2[1]),sub,font=f2,fill=255)
y+= (b2[3]-b2[1])+int(5*PX)
d.line([(W//2-int(60*PX),y),(W//2+int(60*PX),y)],fill=255,width=int(0.6*PX))
gy=y+int(9*PX)
c=(np.array(m)>127).astype(np.uint8)
x0=(W-aw)//2



cells=[]
for r in range(4):
    for col in range(4):
        cx0=max(0,int((col*256-X0)*s)); cx1=min(aw,int(((col+1)*256-X0)*s))
        ry0=max(0,int((ROWS0[r][0]-Y0)*s)); ry1=min(ah,int((ROWS0[r][1]-Y0)*s))
        sub=a[ry0:ry1,cx0:cx1].copy()
        k_,lab_,st_,_=cv2.connectedComponentsWithStats(sub); big_=st_[1:,cv2.CC_STAT_AREA].max()
        for j in range(1,k_):
            x_,y_,w_,h_,ar_=st_[j]
            if (x_==0 or x_+w_>=sub.shape[1] or y_==0 or y_+h_>=sub.shape[0]) and ar_<0.05*big_: sub[lab_==j]=0
        ys,xs=np.nonzero(sub); cells.append(sub[ys.min():ys.max()+1,xs.min():xs.max()+1])
LBL=float(sys.argv[4]) if len(sys.argv)>4 else 6.5
fl=ImageFont.truetype(F+'libre-caslon-text-bold.ttf',int(LBL*PX))
rowh=[max(cells[r*4+k].shape[0] for k in range(4)) for r in range(4)]
gap_l=int(4.5*PX); cap=int(LBL*PX*0.75); gap_r=int(float(sys.argv[5])*PX) if len(sys.argv)>5 else int(9*PX)
cw=aw//4; m2=Image.new('L',(W,H),0); d2=ImageDraw.Draw(m2); y=gy
for r in range(4):
    base=y+rowh[r]+gap_l+cap
    for col in range(4):
        e=cells[r*4+col]; px=x0+col*cw+(cw-e.shape[1])//2; py=y+(rowh[r]-e.shape[0])//2
        c[py:py+e.shape[0],px:px+e.shape[1]]=np.maximum(c[py:py+e.shape[0],px:px+e.shape[1]],e)
        d2.text((x0+col*cw+cw/2,base),NAMES[r*4+col],font=fl,fill=255,anchor='ms')
    y=base+gap_r
ah=y-gap_r-gy+int(2*PX)
c=cv2.morphologyEx(c,cv2.MORPH_OPEN,disc(0.2*PX-0.01))
k,lab,st,_=cv2.connectedComponentsWithStats(c); kp=np.zeros(k,bool); kp[1:]=st[1:,cv2.CC_STAT_AREA]>(0.5*PX)**2*1.5; c=kp[lab].astype(np.uint8)
lbl=(np.array(m2)>110).astype(np.uint8); lbl=cv2.dilate(lbl,disc(1.6))
c=np.maximum(c,lbl)
r=oneink.check(c,{'mode':'line'}); print({k:r[k] for k in ['coverage','thin','sizeCm','topMm','solid','fails']},'scale',round(s,2),'bottom mm',round((gy+ah)/PX))
rgba=np.zeros((H,W,4),np.uint8); rgba[...,3]=c*255
Image.fromarray(rgba,'RGBA').save(f'{OUT}-white.png',dpi=(300,300))
t=np.where(c[...,None]>0,np.array([22,22,22]),np.array([244,243,240])).astype(np.uint8)
Image.fromarray(t).save(f'{OUT}-tee.png'); Image.fromarray(t).resize((700,925),Image.LANCZOS).save(f'{OUT}-s.png')
Image.fromarray(t[gy:gy+900, x0:x0+900]).save(f'{OUT}-zoom.png')
