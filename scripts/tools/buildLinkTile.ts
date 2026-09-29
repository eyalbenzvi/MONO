/**
 * The "A link" tile on From yours: the before is the address typed in the
 * page's field (as the words tile's), the after is Your Link's own print of
 * it (lib/custom/templates/qr, the product's example), framed on the code,
 * 360 × 480 like the other pairs.
 *
 *   npx tsx scripts/tools/buildLinkTile.ts
 */
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { render } from "../../lib/custom/templates/qr";
import { EXTRA } from "../../lib/custom/specs";

const OUT = path.join(__dirname, "..", "..", "public", "make", "yours");
const [TW, TH] = [360, 480];
const FONTS = ["DejaVuSans.ttf", "DejaVuSansMono.ttf", "DejaVuSansMono-Bold.ttf"].map((f) => path.join("/usr/share/fonts/truetype/dejavu", f));
const font = { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" };

async function main() {
  const address = EXTRA.qr.PRODUCT.example.a;
  // The before: the field, the address typed in it, a caret.
  const size = 25;
  const probe = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><text x="36" y="96" font-family="DejaVu Sans" font-size="${size}">${address}</text></svg>`, { font }).getBBox();
  const caret = probe ? probe.x + probe.width + 6 : 36;
  const before = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><rect width="${TW}" height="${TH}" fill="#111111"/><rect x="12" y="12" width="${TW - 24}" height="${TH - 24}" rx="22" fill="#0b0b0b" stroke="#4a4a4a" stroke-width="3"/><text x="36" y="96" font-family="DejaVu Sans" font-size="${size}" fill="#f5f5f5">${address}</text><rect x="${caret.toFixed(1)}" y="${96 - size * 0.8}" width="3" height="${size * 0.96}" fill="#ffffff"/></svg>`;
  await sharp(Buffer.from(new Resvg(before, { font }).render().asPng())).webp({ quality: 86 }).toFile(path.join(OUT, "link-before.webp"));
  // The after: the print on a black tee, framed on the code and its marks (the print's top 300 × 400 → a 3:4 window).
  const svg = render({ t: "qr", v: 1, p: EXTRA.qr.PRODUCT.example }, "black");
  const png = new Resvg(svg, { font, fitTo: { mode: "width", value: 900 } }).render().asPng();
  // The code and the address under it sit in the print's upper part (y ≈ 15–300 of 400): a 3:4 window of 225 × 300 print units from (37.5, 25): below the small labels, the caption left out.
  const k = 900 / 300;
  await sharp(png).extract({ left: Math.round(37.5 * k), top: Math.round(25 * k), width: Math.round(225 * k), height: Math.round(300 * k) }).resize(TW, TH).webp({ quality: 86 }).toFile(path.join(OUT, "link-after.webp"));
  console.log("link tile → public/make/yours/link-{before,after}.webp");
}
main();
