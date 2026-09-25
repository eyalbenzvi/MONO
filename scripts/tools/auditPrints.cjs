// Audits generated prints in Chromium: text outside the canvas, text
// overlapping text, frame/rule lines crossing text, over-squeezed text.
//   npm run audit:prints [-- from to]
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../../public/prints');
const from = +(process.argv[2] || 1), to = +(process.argv[3] || 99999);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<div id="c"></div>');
  const issues = [];
  for (let n = from; n <= to; n++) {
    const f = `${dir}/print_${n}.svg`;
    if (!fs.existsSync(f)) continue;
    const svg = fs.readFileSync(f, 'utf8');
    const res = await p.evaluate((svg) => {
      const c = document.getElementById('c');
      c.innerHTML = svg;
      const root = c.querySelector('svg');
      const out = [];
      const W = 300, H = 400;
      const texts = [...root.querySelectorAll('text')].filter(t => t.textContent.trim() && !t.closest('clipPath,defs,pattern'));
      const box = (el) => { const bb = el.getBBox(); const m = el.getCTM(); const rm = root.getCTM().inverse(); const M = rm.multiply(m);
        const pts = [[bb.x,bb.y],[bb.x+bb.width,bb.y],[bb.x,bb.y+bb.height],[bb.x+bb.width,bb.y+bb.height]].map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(M);return [q.x,q.y]});
        const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]); return {x:Math.min(...xs),y:Math.min(...ys),X:Math.max(...xs),Y:Math.max(...ys)}; };
      // Tight vertical box: glyph bbox includes ascent/descent padding; shrink a bit.
      const tb = texts.map(t => { const b = box(t); const h = b.Y - b.y; return { t, b: { x: b.x + 0.5, X: b.X - 0.5, y: b.y + h * 0.22, Y: b.Y - h * 0.2 } }; });
      const label = (t) => t.textContent.slice(0, 28);
      for (const { t, b } of tb) {
        if (b.x < 4 || b.y < 4 || b.X > W - 4 || b.Y > H - 4) out.push(`outside canvas: "${label(t)}"`);
        const tl = t.getAttribute('textLength');
        if (tl) { const natural = t.getComputedTextLength ? (()=>{ const c2=t.cloneNode(true); c2.removeAttribute('textLength'); c2.removeAttribute('lengthAdjust'); t.parentNode.appendChild(c2); const l=c2.getComputedTextLength(); c2.remove(); return l; })() : 0;
          if (natural && +tl / natural < 0.62) out.push(`squeezed ${(+tl/natural*100).toFixed(0)}%: "${label(t)}"`); }
      }
      for (let i = 0; i < tb.length; i++) for (let j = i + 1; j < tb.length; j++) {
        const a = tb[i].b, c2 = tb[j].b;
        if (tb[i].t.closest('g') !== tb[j].t.closest('g') && false) continue;
        const ox = Math.min(a.X, c2.X) - Math.max(a.x, c2.x), oy = Math.min(a.Y, c2.Y) - Math.max(a.y, c2.y);
        if (ox > 2 && oy > 2) out.push(`text overlap: "${label(tb[i].t)}" / "${label(tb[j].t)}"`);
      }
      // Stroked lines/rect edges crossing text.
      const segs = [];
      for (const r of root.querySelectorAll('rect')) {
        if (r.closest('clipPath,defs,pattern')) continue;
        const fill = r.getAttribute('fill'); const st = r.getAttribute('stroke');
        if (!(st && st !== 'none') || (fill && fill !== 'none')) continue;
        const b = box(r); segs.push([b.x,b.y,b.X,b.y],[b.x,b.Y,b.X,b.Y],[b.x,b.y,b.x,b.Y],[b.X,b.y,b.X,b.Y]);
      }
      for (const l of root.querySelectorAll('line')) {
        if (l.closest('clipPath,defs,pattern')) continue;
        segs.push(['x1','y1','x2','y2'].map(k => +l.getAttribute(k)));
      }
      for (const { t, b } of tb) for (const [x1,y1,x2,y2] of segs) {
        if (y1 === y2 && y1 > b.y + 1 && y1 < b.Y - 1 && Math.max(x1,x2) > b.x + 2 && Math.min(x1,x2) < b.X - 2) { out.push(`line crosses text: "${label(t)}"`); break; }
        if (x1 === x2 && x1 > b.x + 1 && x1 < b.X - 1 && Math.max(y1,y2) > b.y + 2 && Math.min(y1,y2) < b.Y - 2) { out.push(`line crosses text: "${label(t)}"`); break; }
      }
      return out;
    }, svg);
    if (res.length) issues.push({ n, res: [...new Set(res)] });
  }
  await b.close();
  for (const i of issues) console.log(`print_${i.n}: ${i.res.join(' · ')}`);
  console.log(`${issues.length} prints with issues`);
  process.exitCode = issues.length ? 1 : 0;
})();
