// Measures glyph advances (per 1px font size) for the fonts prints use.
// For each style it takes the WIDEST of the candidate fonts, so layouts fit
// on every platform (Georgia vs Android's wider serif fallback, etc.).
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const chars = [];
for (let c = 32; c < 127; c++) chars.push(String.fromCharCode(c));
chars.push(..."“”‘’—–…°·×№éèáíóúñü•★→←");
const styles = {
  sans: { fams: ['Liberation Sans'], w: 400, i: false },
  sansBold: { fams: ['Liberation Sans'], w: 700, i: false },
  serif: { fams: ['Liberation Serif', 'DejaVu Serif', 'FreeSerif'], w: 400, i: false },
  serifItalic: { fams: ['Liberation Serif', 'DejaVu Serif', 'FreeSerif'], w: 400, i: true },
  serifBold: { fams: ['Liberation Serif', 'DejaVu Serif', 'FreeSerif'], w: 700, i: false },
  mono: { fams: ['Liberation Mono', 'DejaVu Sans Mono'], w: 400, i: false },
  monoBold: { fams: ['Liberation Mono', 'DejaVu Sans Mono'], w: 700, i: false },
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const out = await p.evaluate(({ chars, styles }) => {
    const cv = document.createElement('canvas').getContext('2d');
    const res = {};
    for (const [k, s] of Object.entries(styles)) {
      res[k] = {};
      for (const ch of chars) {
        let m = 0;
        for (const f of s.fams) { cv.font = `${s.i ? 'italic ' : ''}${s.w} 100px "${f}"`; m = Math.max(m, cv.measureText(ch).width / 100); }
        res[k][ch] = Math.round(m * 1000) / 1000;
      }
    }
    return res;
  }, { chars, styles });
  await b.close();
  const lines = Object.entries(out).map(([k, t]) => `  ${k}: ${JSON.stringify(Object.values(t))},`);
  require('fs').writeFileSync(require('path').resolve(__dirname, '../gen/metrics.ts'),
`/**
 * Glyph advance widths (per 1px of font size), measured in Chromium for each
 * print font style, taking the widest of the fonts a device may substitute
 * (Helvetica/Arial/Roboto → Arial metrics, Georgia → DejaVu/Liberation
 * Serif, Courier New → Liberation/DejaVu Mono). Text sized with these fits
 * on every platform. Regenerate with scripts/tools/measureFonts.cjs if the
 * font list changes.
 */
export type FontStyle = ${Object.keys(out).map(k => `"${k}"`).join(' | ')};

export const GLYPHS = ${JSON.stringify(chars.join(''))};

export const ADVANCES: Record<FontStyle, number[]> = {
${lines.join('\n')}
};
`);
  console.log(out.sansBold.W, out.serifItalic.a, out.mono.A);
})();
