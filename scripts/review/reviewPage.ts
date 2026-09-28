/**
 * The owner's selection page (docs/content/waves.md §3.1): one self-contained
 * HTML page per batch (thumbnails embedded, no server, no libraries). Each
 * item: its number, the print on its tee (a CSS tee), the original beside
 * it, title, maker and date, source, licence, record link, the print's
 * numbers and flags. Click (or 1 / 2 / 3) sets keep / reject / maybe; the
 * title and a reason can be edited; Export shows decisions.json to copy
 * ({id: "keep"|"reject"|"maybe", title_override?, reason?}). A draft stays in
 * the browser (localStorage, when allowed). Pages over the size limit split.
 *
 *   tsx scripts/review/reviewPage.ts catalogue [category…]   the live catalogue, per category, weakest first (wave 0)
 *   tsx scripts/review/reviewPage.ts source <source> <wave>  a wave's prepped candidates
 *
 * Pages go to node_modules/.cache/mono-review/ (never committed); the chat gets their paths and counts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { rasterInk, svgInk } from "../gen/quality";
import { LICENSE_LABEL } from "../sources/_license";
import { cacheDir, readPrepped } from "../sources/_pipeline";
import type { SourceId } from "../sources/ranges";

const ROOT = path.resolve(__dirname, "..", "..");
export const OUT = path.join(ROOT, "node_modules", ".cache", "mono-review");
/** A page's embedded weight past which it splits (the Artifact limit is 16 MB). */
const PAGE_BYTES = 12 * 1024 * 1024;

export interface ReviewItem {
  id: string;
  title: string;
  maker?: string | null;
  date?: string | null;
  source: string;
  license: string;
  recordUrl?: string | null;
  tee: "black" | "white";
  /** data: URIs: the print as it lands on the tee (ink only), and the original (if any). */
  print: string;
  original?: string | null;
  numbers: [string, string | number][];
  flags: string[];
  /** Shown in small type (category, variant). */
  note?: string;
}

const uri = (buf: Buffer) => `data:image/webp;base64,${buf.toString("base64")}`;

/** The print's ink at `w` px wide, in the ink colour of its tee (white on black, black on white), as WebP. */
export async function inkThumb(file: string, medium: "drawn" | "ink" | "photo", tee: "black" | "white", w = 400): Promise<string> {
  const raster = file.endsWith(".svg")
    ? svgInk(readFileSync(file, "utf8"), tee, w)
    : await (async () => {
        const { data, info } = await sharp(file).resize(w, Math.round((w * 4) / 3), { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return rasterInk(data, info.width, info.height, medium === "photo" ? "photo" : "ink", tee);
      })();
  const c = tee === "black" ? 255 : 0;
  const rgba = Buffer.alloc(raster.w * raster.h * 4);
  for (let i = 0; i < raster.ink.length; i++) (rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = c), (rgba[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, raster.ink[i])) * 255));
  return uri(await sharp(rgba, { raw: { width: raster.w, height: raster.h, channels: 4 } }).webp({ quality: 70, alphaQuality: 70, effort: 5 }).toBuffer());
}

/** The original (a master or a download) small, on white paper. */
export async function originalThumb(file: string, w = 240): Promise<string | null> {
  if (!existsSync(file)) return null;
  return uri(await sharp(file).resize(w, Math.round((w * 4) / 3), { fit: "inside" }).flatten({ background: "#ffffff" }).webp({ quality: 55 }).toBuffer());
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** One page's HTML (the Artifact skeleton adds doctype, head and body). */
export function renderPage(meta: { title: string; heading: string; storageKey: string; note: string }, items: ReviewItem[]): string {
  const data = JSON.stringify(items).replace(/</g, "\\u003c");
  return `<title>${esc(meta.title)}</title>
<style>
:root{color-scheme:dark;--ground:#050505;--surface:#111111;--raise:#171717;--line:#2a2a2a;--text:#f5f5f5;--muted:#9b9b9b;--keep:#f5f5f5;--reject:#ff6b5e;--maybe:#e2b84a;--tee-black:#0d0d0d;--tee-white:#f2f2f0}
body{background:var(--ground);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-inline:16px;padding-block:0 48px}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
header{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--ground);border-bottom:1px solid var(--line);padding-block:12px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
h1{font-size:15px;font-weight:800;letter-spacing:.02em;margin:0;text-wrap:balance}
.counts{display:flex;gap:12px;font-size:12px;color:var(--muted)}
.counts b{color:var(--text);font-weight:700}
.tools{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
select,button,input,textarea{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:6px}
select,button{height:32px;padding:0 10px}
button{cursor:pointer}button:hover{border-color:var(--muted)}
.primary{background:var(--text);color:var(--ground);border-color:var(--text);font-weight:700}
:focus-visible{outline:2px solid #fff;outline-offset:2px}
.help{color:var(--muted);font-size:12px;margin:10px 0 14px;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;position:relative}
.card[data-d=keep]{border-color:var(--keep)}
.card[data-d=reject]{border-color:var(--reject)}
.card[data-d=reject] .pics{opacity:.35}
.card[data-d=maybe]{border-color:var(--maybe);border-style:dashed}
.top{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted)}
.badge{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:4px;border:1px solid currentColor}
.card[data-d=keep] .badge{color:var(--keep)}.card[data-d=reject] .badge{color:var(--reject)}.card[data-d=maybe] .badge{color:var(--maybe)}.card:not([data-d]) .badge{display:none}
.pics{display:grid;grid-template-columns:3fr 2fr;gap:8px;align-items:start;cursor:pointer}
.tee{position:relative;aspect-ratio:1/1.08;max-width:100%;clip-path:polygon(30% 0,40% 5%,60% 5%,70% 0,100% 15%,91% 32%,81% 27%,81% 100%,19% 100%,19% 27%,9% 32%,0 15%)}
.tee[data-tee=black]{background:var(--tee-black);box-shadow:inset 0 0 0 1px #262626}
.tee[data-tee=white]{background:var(--tee-white)}
.tee img{position:absolute;left:31%;top:17%;width:38%;aspect-ratio:28/37;object-fit:contain}
.orig{background:#fff;border-radius:4px;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;overflow:hidden}
.orig img{width:100%;height:100%;object-fit:contain}
.orig.none{background:var(--raise);color:var(--muted);font-size:11px;text-align:center;padding:6px}
.t{font-weight:700;font-size:13px;line-height:1.3}
.sub{font-size:12px;color:var(--muted)}
.sub a{color:var(--text)}
.nums{font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:2px 10px}
.flags{display:flex;flex-wrap:wrap;gap:4px}
.flag{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:4px;background:var(--raise);color:var(--maybe)}
.acts{display:flex;gap:4px}
.acts button{flex:1;height:28px;font-size:12px;padding:0}
.acts button[aria-pressed=true]{background:var(--text);color:var(--ground)}
.edit{display:grid;gap:4px}
.edit input{height:28px;padding:0 8px;font-size:12px;width:100%;box-sizing:border-box}
dialog{background:var(--raise);color:var(--text);border:1px solid var(--line);border-radius:10px;max-width:min(720px,calc(100vw - 32px));width:100%}
dialog textarea{width:100%;box-sizing:border-box;height:50vh;font:12px ui-monospace,Menlo,monospace;padding:8px}
dialog .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.zoom{padding:0;max-width:min(560px,calc(100vw - 32px))}
.zoom .tee{width:100%}
@media (prefers-reduced-motion:no-preference){.card{transition:border-color .12s}}
</style>
<header>
  <h1>${esc(meta.heading)}</h1>
  <div class="counts mono" id="counts" aria-live="polite"></div>
  <div class="tools">
    <label class="sr" for="f-flag" hidden>Flag</label>
    <select id="f-flag" aria-label="Filter by flag"><option value="">All flags</option></select>
    <select id="f-source" aria-label="Filter by source"><option value="">All sources</option></select>
    <select id="f-dec" aria-label="Filter by decision"><option value="">All decisions</option><option value="none">Undecided</option><option value="keep">Keep</option><option value="reject">Reject</option><option value="maybe">Maybe</option></select>
    <button class="primary" id="export">Export decisions</button>
  </div>
</header>
<p class="help">${esc(meta.note)} Click the pictures to cycle keep, reject, maybe. With a card focused (Tab, or ← →): 1 keep, 2 reject, 3 maybe, Z enlarge. Your picks are kept in this browser as a draft.</p>
<main class="grid" id="grid"></main>
<dialog id="out"><p style="margin:0 0 8px">decisions.json. Copy it and send it back.</p><textarea id="json" readonly aria-label="decisions.json"></textarea><div class="row"><span id="copied" class="sub" aria-live="polite"></span><button id="copy" class="primary">Copy</button><button id="close">Close</button></div></dialog>
<dialog id="zoom" class="zoom"></dialog>
<script>
const ITEMS=${data};
const KEY=${JSON.stringify(meta.storageKey)};
let state={};
try{state=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){state={}}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const grid=document.getElementById("grid");
const ORDER=["keep","reject","maybe"];
const fFlag=document.getElementById("f-flag"),fSource=document.getElementById("f-source"),fDec=document.getElementById("f-dec");
for(const f of [...new Set(ITEMS.flatMap(i=>i.flags))].sort())fFlag.insertAdjacentHTML("beforeend",'<option value="'+esc(f)+'">'+esc(f)+'</option>');
for(const s of [...new Set(ITEMS.map(i=>i.source))].sort())fSource.insertAdjacentHTML("beforeend",'<option value="'+esc(s)+'">'+esc(s)+'</option>');
function card(it,k){
  const st=state[it.id]||{};
  const el=document.createElement("article");
  el.className="card";el.tabIndex=0;el.dataset.id=it.id;
  if(st.d)el.dataset.d=st.d;
  el.innerHTML='<div class="top mono"><span>#'+(k+1)+' · '+esc(it.id)+'</span><span class="badge">'+esc(st.d||"")+'</span></div>'+
   '<div class="pics" title="Click: keep → reject → maybe"><div class="tee" data-tee="'+it.tee+'"><img alt="" loading="lazy" src="'+it.print+'"></div>'+
   (it.original?'<div class="orig"><img alt="Original" loading="lazy" src="'+it.original+'"></div>':'<div class="orig none">Drawn print (no original)</div>')+'</div>'+
   '<div class="t">'+esc(st.title||it.title)+'</div>'+
   '<div class="sub">'+esc([it.maker,it.date].filter(Boolean).join(", "))+'</div>'+
   '<div class="sub">'+esc(it.source)+' · '+esc(it.license)+(it.recordUrl?' · <a href="'+esc(it.recordUrl)+'" target="_blank" rel="noopener">record</a>':'')+(it.note?' · '+esc(it.note):'')+'</div>'+
   '<div class="nums mono">'+it.numbers.map(([a,b])=>'<span>'+esc(a)+' '+esc(b)+'</span>').join("")+'</div>'+
   (it.flags.length?'<div class="flags">'+it.flags.map(f=>'<span class="flag">'+esc(f)+'</span>').join("")+'</div>':'')+
   '<div class="acts">'+ORDER.map((d,j)=>'<button data-set="'+d+'" aria-pressed="'+(st.d===d)+'">'+(j+1)+' '+d+'</button>').join("")+'</div>'+
   '<div class="edit"><input id="t-'+esc(it.id)+'" aria-label="Title override" placeholder="Title override" value="'+esc(st.title||"")+'">'+
   '<input id="r-'+esc(it.id)+'" aria-label="Reason (for a reject)" placeholder="Reason (for a reject)" value="'+esc(st.reason||"")+'"></div>';
  return el;
}
function set(id,d){const st=state[id]||(state[id]={});st.d=st.d===d?undefined:d;if(!st.d&&!st.title&&!st.reason)delete state[id];save();refresh(id)}
function cycle(id){const cur=state[id]?.d;const next=cur?ORDER[(ORDER.indexOf(cur)+1)%4]:"keep";const st=state[id]||(state[id]={});st.d=next;if(!st.d&&!st.title&&!st.reason)delete state[id];save();refresh(id)}
function refresh(id){const el=grid.querySelector('[data-id="'+CSS.escape(id)+'"]');if(!el)return;const d=state[id]?.d;if(d)el.dataset.d=d;else delete el.dataset.d;el.querySelector(".badge").textContent=d||"";el.querySelectorAll("[data-set]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.set===d)));counts()}
function counts(){const c={keep:0,reject:0,maybe:0};for(const it of ITEMS){const d=state[it.id]?.d;if(d)c[d]++}document.getElementById("counts").innerHTML='<span><b>'+ITEMS.length+'</b> items</span><span><b>'+c.keep+'</b> keep</span><span><b>'+c.reject+'</b> reject</span><span><b>'+c.maybe+'</b> maybe</span><span><b>'+(ITEMS.length-c.keep-c.reject-c.maybe)+'</b> open</span>'}
function render(){grid.textContent="";const fl=fFlag.value,so=fSource.value,de=fDec.value;ITEMS.forEach((it,k)=>{const d=state[it.id]?.d;if(fl&&!it.flags.includes(fl))return;if(so&&it.source!==so)return;if(de&&(de==="none"?d:d!==de))return;grid.appendChild(card(it,k))});counts()}
[fFlag,fSource,fDec].forEach(s=>s.addEventListener("change",render));
grid.addEventListener("click",e=>{const c=e.target.closest(".card");if(!c)return;const b=e.target.closest("[data-set]");if(b)return set(c.dataset.id,b.dataset.set);if(e.target.closest(".pics"))cycle(c.dataset.id)});
grid.addEventListener("input",e=>{const c=e.target.closest(".card");if(!c)return;const st=state[c.dataset.id]||(state[c.dataset.id]={});if(e.target.id.startsWith("t-"))st.title=e.target.value||undefined;else st.reason=e.target.value||undefined;save();if(e.target.id.startsWith("t-"))c.querySelector(".t").textContent=st.title||ITEMS.find(i=>i.id===c.dataset.id).title});
grid.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT")return;const c=e.target.closest(".card");if(!c)return;const k=e.key;
  if(k==="1"||k==="2"||k==="3"){set(c.dataset.id,ORDER[Number(k)-1]);(c.nextElementSibling||c).focus();e.preventDefault()}
  else if(k==="ArrowRight"){(c.nextElementSibling||c).focus();e.preventDefault()}else if(k==="ArrowLeft"){(c.previousElementSibling||c).focus();e.preventDefault()}
  else if(k==="z"||k==="Z"){const it=ITEMS.find(i=>i.id===c.dataset.id);const z=document.getElementById("zoom");z.innerHTML='<div class="tee" data-tee="'+it.tee+'"><img alt="'+esc(it.title)+'" src="'+it.print+'"></div>';z.showModal()}});
document.getElementById("zoom").addEventListener("click",e=>e.currentTarget.close());
document.getElementById("export").addEventListener("click",()=>{const out={};for(const it of ITEMS){const st=state[it.id];if(!st)continue;const o={};if(st.d)o.d=st.d;if(st.title)o.title_override=st.title;if(st.reason)o.reason=st.reason;if(!Object.keys(o).length)continue;out[it.id]=o.title_override||o.reason?{decision:o.d||"keep",...(o.title_override?{title_override:o.title_override}:{}),...(o.reason?{reason:o.reason}:{})}:o.d}document.getElementById("json").value=JSON.stringify(out,null,1);document.getElementById("copied").textContent="";document.getElementById("out").showModal()});
document.getElementById("copy").addEventListener("click",()=>{const t=document.getElementById("json");const done=()=>document.getElementById("copied").textContent="Copied";navigator.clipboard?.writeText(t.value).then(done,()=>{t.select();document.getElementById("copied").textContent="Selected: press Ctrl+C"})??(t.select())});
document.getElementById("close").addEventListener("click",()=>document.getElementById("out").close());
render();
</script>
`;
}

/** Items → one or more pages under the size limit; returns their paths. */
export function writePages(base: string, meta: { title: string; heading: string; storageKey: string; note: string }, items: ReviewItem[]): string[] {
  mkdirSync(path.dirname(base), { recursive: true });
  const parts: ReviewItem[][] = [[]];
  let bytes = 0;
  for (const it of items) {
    const b = it.print.length + (it.original?.length ?? 0) + 800;
    if (bytes + b > PAGE_BYTES && parts[parts.length - 1].length) parts.push([]), (bytes = 0);
    parts[parts.length - 1].push(it);
    bytes += b;
  }
  return parts.map((list, k) => {
    const suffix = parts.length > 1 ? `-${k + 1}` : "";
    const file = `${base}${suffix}.html`;
    const m = parts.length > 1 ? { ...meta, title: `${meta.title} ${k + 1}`, heading: `${meta.heading} · part ${k + 1} of ${parts.length}`, storageKey: `${meta.storageKey}${suffix}` } : meta;
    // A whole document: opened as a file, or published beside a hub page (scripts/review/hubPage.ts).
    writeFileSync(file, `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}</style>\n</head>\n<body>\n${renderPage(m, list)}</body>\n</html>\n`);
    return file;
  });
}

type Entry = { id: string; n: number; title: string; category: string; medium: "drawn" | "ink" | "photo"; baseColor: "black" | "white"; quality: number; flags: string[]; rank: number; dropDate: string; variant: string; printCm: { width: number; height: number }; photo: { credit: string; url: string } | null; family: string };

const CATEGORY_NAMES: Record<string, string> = { photographs: "PHO", specimens: "SPC", sky: "MAP", architecture: "ARC", etched: "ETC", brush: "BRU", pattern: "PAT", systems: "SYS", type: "TYP", terminal: "TRM" };

/** A live design as a review item (wave 0: the catalogue review). */
export async function catalogueItem(s: Entry, familySize: number): Promise<ReviewItem> {
  const file = path.join(ROOT, "public", "prints", `print_${s.n}.${s.medium === "drawn" ? "svg" : "webp"}`);
  const master = path.join(ROOT, "assets", "masters", `print_${s.n}.webp`);
  const [maker] = s.photo ? s.photo.credit.split(/,\s*/) : [];
  return {
    id: s.id,
    title: s.title,
    maker: s.photo && maker && !/museum|institution|smithsonian|zoo|archives/i.test(maker) ? maker : null,
    date: null,
    source: s.photo ? (/smithsonian|museum|zoo|archives|cooper/i.test(s.photo.credit) ? "Smithsonian" : "archive") : "generated",
    license: s.photo ? "CC0" : "original",
    recordUrl: s.photo?.url ?? null,
    tee: s.baseColor,
    print: await inkThumb(file, s.medium, s.baseColor),
    original: s.medium === "drawn" ? null : await originalThumb(master),
    numbers: [["Q", s.quality], ["rank", s.rank], ["cm", `${s.printCm.width}×${s.printCm.height}`], ["drop", s.dropDate], ...(familySize > 1 ? ([["family", familySize]] as [string, number][]) : [])],
    flags: [...(s.quality < 53 || s.flags.length ? ["weak"] : []), ...s.flags],
    note: s.variant,
  };
}

async function catalogue(only: string[]) {
  const shirts = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8")) as Entry[];
  const fam = new Map<string, number>();
  for (const s of shirts) fam.set(s.family, (fam.get(s.family) ?? 0) + 1);
  const cats = Object.keys(CATEGORY_NAMES).filter((c) => !only.length || only.includes(c) || only.includes(CATEGORY_NAMES[c]));
  for (const cat of cats) {
    const list = shirts.filter((s) => s.category === cat).sort((a, b) => a.quality - b.quality || a.n - b.n);
    const items: ReviewItem[] = [];
    for (const s of list) items.push(await catalogueItem(s, fam.get(s.family) ?? 1));
    const code = CATEGORY_NAMES[cat];
    const files = writePages(path.join(OUT, "wave-0", `catalogue-${code}`), { title: `MONO review ${code}`, heading: `Catalogue review · ${code} · ${list.length} live designs, weakest first`, storageKey: `mono-review-w0-${code}`, note: "Mark what leaves the catalogue as reject (a reason helps; otherwise it reads 'owner review'). Undecided and keep stay." }, items);
    console.log(`${code}: ${list.length} designs → ${files.map((f) => path.relative(ROOT, f)).join(", ")}`);
  }
}

async function source(src: SourceId, wave: number) {
  const list = readPrepped(src, wave).sort((a, b) => Number(a.weak || !!a.solid) - Number(b.weak || !!b.solid) || b.score - a.score);
  const dir = cacheDir(src);
  const items: ReviewItem[] = [];
  for (const p of list) {
    items.push({
      id: p.key,
      title: p.title,
      maker: p.maker,
      date: p.date,
      source: src,
      license: LICENSE_LABEL[p.license],
      recordUrl: p.recordUrl,
      tee: p.tee,
      print: await inkThumb(path.join(dir, "screen", `print_${p.key}.webp`), p.mode === "ink" ? "ink" : "photo", p.tee),
      original: await originalThumb(path.join(dir, "prep", `print_${p.key}.webp`)),
      numbers: [["Q", p.assess.quality], ["ink", p.assess.ink], ["extent", p.assess.extent], ["score", p.score]],
      flags: [...p.flags, ...(p.solid ? [`solid-${p.solid}`] : [])].filter((f, i, a) => a.indexOf(f) === i),
      note: p.classification,
    });
  }
  const files = writePages(path.join(OUT, `wave-${wave}`, src), { title: `MONO wave ${wave} ${src}`, heading: `Wave ${wave} · ${src} · ${items.length} candidates (failed checks last)`, storageKey: `mono-review-w${wave}-${src}`, note: "Keep what goes on a tee. Items that failed a check (weak, solid) are at the end, marked." }, items);
  console.log(`${src} wave ${wave}: ${items.length} → ${files.map((f) => path.relative(ROOT, f)).join(", ")}`);
}

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const run = cmd === "catalogue" ? catalogue(args) : cmd === "source" ? source(args[0] as SourceId, Number(args[1])) : Promise.reject(new Error("usage: reviewPage.ts catalogue [category…] | source <source> <wave>"));
  run.catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
