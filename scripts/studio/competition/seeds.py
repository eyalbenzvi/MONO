"""The idea competition's seeds (docs/content/design-loop.md, step 1): 100 seeds as far apart as possible.

Each seed is a random format, subject, visual reference and person, seven attributes in [0, 1] and a tee.
3000 candidates are drawn; farthest-point sampling keeps the 100 most different. Five writer files of 20.

  python seeds.py <out-dir> [--seed N] [--black 0.3] [--subject "a sailing yacht"]

--black: the share of seeds marked "made for white ink on a BLACK tee" (when teeBalance.ts says a
black-only design is wanted; 0 otherwise). --subject: the owner's subject for every seed (the
diversity then comes from the format, the reference, the person and the attributes). Writes seeds.json and seeds-1.txt … seeds-5.txt."""
import argparse, json, os, random, numpy as np
ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--seed", type=int, default=303); ap.add_argument("--black", type=float, default=0.0); ap.add_argument("--subject")
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)
random.seed(A.seed); rng=np.random.default_rng(A.seed)
TYPES=["typographic slogan","single bold illustration","diagram or infographic","data chart","map","repeating all-over pattern",
 "badge or emblem","technical drawing / blueprint","photograph in halftone","collage","step-by-step instructions",
 "specimen or catalogue plate","comic panel or strip","poster layout","minimal line icon","ASCII or code art",
 "geometric abstraction","hand-lettered quote","document or ticket (receipt, ticket, form, label)","road or public sign",
 "postage stamp or seal","playing card or game piece","portrait","scene with a horizon"]
SUBJECTS=["sea creatures","birds","insects","a city","trains and transit","outer space","weather","cooking","musical instruments",
 "cycling","climbing and mountains","surfing","mathematics","chemistry","plants and botany","mushrooms","dogs","cats",
 "buildings and architecture","cars and motorcycles","flight and aviation","sailing and knots","gardening","books and reading",
 "words and etymology","a historical event","mythology","dance","cinema","video games","tools and hardware","sleep and dreams",
 "emotions","time and clocks","money","rivers","deserts","the human body","fonts and letters","board games","bread and baking",
 "tea","the internet","childhood","the weekend","family"]
REFS=["Swiss International Style","Bauhaus","Japanese woodblock prints","1950s American advertising","Soviet constructivism",
 "punk zines","1970s NASA graphics","Victorian engraving","Art Nouveau","1960s psychedelic posters","Memphis design",
 "8-bit pixel art","ligne claire comics","Mexican loteria cards","Persian miniatures","Islamic geometric tiling",
 "transit maps (Vignelli)","WPA national park posters","old sea charts","1960s school textbooks","sumi-e brush painting",
 "Keith Haring","traditional tattoo flash","risograph zines","Scandinavian minimalism","Ancient Egyptian art",
 "medieval manuscripts","Japanese packaging","contemporary flat vector illustration","Saul Bass film titles",
 "brutalist web design","newspaper front pages","scientific journal figures","street graffiti"]
PERSONAS=["teenage gamer","retired engineer","marathon runner","new parent","art student","nurse","home cook","software developer",
 "rock climber","gardener","musician","schoolteacher","frequent traveller","bookworm","skateboarder","lab scientist",
 "dog owner","architect","grandparent buying a gift","office worker"]
ATTR=[("humour","earnest","very funny"),("text","no words","words only"),("density","minimal, lots of empty space","intricate, dense detail"),
 ("abstraction","literal","abstract"),("era","historical","futuristic"),("niche","anyone gets it","an in-joke for a small group"),
 ("size","small chest mark","big full-front print")]
def word(v,lo,hi): return lo if v<0.2 else (f"leaning {lo}" if v<0.4 else ("balanced" if v<0.6 else (f"leaning {hi}" if v<0.8 else hi)))
N=3000
if A.subject: SUBJECTS=[A.subject]
C=[dict(type=random.choice(TYPES),subject=random.choice(SUBJECTS),ref=random.choice(REFS),persona=random.choice(PERSONAS),
        vec=rng.random(len(ATTR)).round(2).tolist()) for _ in range(N)]
def feat(c):
    f=[]
    for L,k,w in ((TYPES,'type',1.0),(SUBJECTS,'subject',1.0),(REFS,'ref',0.8),(PERSONAS,'persona',0.6)):
        o=np.zeros(len(L)); o[L.index(c[k])]=w; f.extend(o)
    f.extend(np.array(c['vec'])*1.0); return np.array(f)
X=np.stack([feat(c) for c in C]); pick=[0]; d=np.linalg.norm(X-X[0],axis=1)
while len(pick)<100:
    i=int(d.argmax()); pick.append(i); d=np.minimum(d,np.linalg.norm(X-X[i],axis=1))
S=[]
for n,i in enumerate(pick,1):
    c=C[i]; c['id']=n
    c['attrs']={a:f"{v:.2f} ({word(v,lo,hi)})" for (a,lo,hi),v in zip(ATTR,c['vec'])}
    c['tee']='made for white ink on a BLACK tee' if random.random()<A.black else 'either tee'
    S.append(c)
json.dump(S,open(os.path.join(A.out,'seeds.json'),'w'),indent=1)
from collections import Counter
for k in ('type','subject','ref','persona'): print(k,len(set(s[k] for s in S)),'distinct, max repeat',Counter(s[k] for s in S).most_common(1)[0][1])
V=np.array([s['vec'] for s in S]); print('vec mean',V.mean(0).round(2),'std',V.std(0).round(2))
for g in range(5):  # 20 seeds per writer
    lines=[]
    for s in S[g*20:(g+1)*20]:
        lines.append(f"Seed {s['id']}: format: {s['type']}; subject: {s['subject']}; visual reference: {s['ref']}; made for: a {s['persona']}; "+"; ".join(f"{a} {v}" for a,v in s['attrs'].items())+f"; tee: {s['tee']}")
    open(os.path.join(A.out,f'seeds-{g+1}.txt'),'w').write("\n".join(lines)+"\n")
