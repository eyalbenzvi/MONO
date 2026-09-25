/**
 * Share images drawn in the browser (canvas → PNG): the tee in the chosen
 * colourway with its print, the design name, and the site. Two formats:
 * "story" 1080×1920 (Instagram / TikTok / WhatsApp status) and "square"
 * 1080×1080 (feeds and chats).
 *
 * The print SVG is fetched and recoloured by swapping its two inks (every
 * print is strictly #FFFFFF / #000000), which works in every browser — the
 * canvas `filter` property doesn't exist in Safari.
 */
import { assetUrl } from "@/lib/catalog";
import { siteRoot } from "@/lib/share";
import { TEE_BODY, TEE_COLLAR, TEE_COLORS, TEE_HEMS, TEE_PRINT, TEE_SEAMS, TEE_VIEW } from "@/lib/teeShape";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";
import { formatPrice } from "@/lib/format";

export type ShareFormat = "story" | "square";
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const FONT = `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
const MONO_FONT = `ui-monospace, "SF Mono", Menlo, "Courier New", monospace`;

/** Print SVG in `color`, as an image rasterised at 3× for a crisp canvas. */
export async function loadPrintImage(shirt: ShirtProduct, color: BaseColor): Promise<HTMLImageElement> {
  let svg = await (await fetch(assetUrl(shirt.backPrintUrl))).text();
  if (color !== shirt.baseColor) svg = svg.replace(/#FFFFFF|#000000/g, (m) => (m === "#FFFFFF" ? "#000000" : "#FFFFFF"));
  svg = svg.replace('width="300" height="400"', 'width="900" height="1200"');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // decode() has rasterised it; the URL is no longer needed
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Draws the tee (top-left of its view box at x,y; `w` px wide). Returns its height. */
function drawTee(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: BaseColor, print: HTMLImageElement) {
  const s = w / TEE_VIEW.w;
  const { fabric, seam, collar } = TEE_COLORS[color];
  const body = new Path2D(TEE_BODY);
  ctx.save();
  ctx.translate(x - TEE_VIEW.x * s, y - TEE_VIEW.y * s);
  ctx.scale(s, s);
  // garment with a soft drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = fabric;
  ctx.fill(body);
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1.4;
  ctx.stroke(new Path2D(TEE_SEAMS));
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.2;
  ctx.stroke(new Path2D(TEE_HEMS));
  ctx.setLineDash([]);
  // print blended into the fabric: white ink screens onto black, black ink multiplies onto white
  ctx.save();
  ctx.globalCompositeOperation = color === "black" ? "screen" : "multiply";
  ctx.drawImage(print, TEE_PRINT.x, TEE_PRINT.y, TEE_PRINT.w, TEE_PRINT.h);
  ctx.restore();
  ctx.strokeStyle = collar;
  ctx.lineWidth = 7;
  ctx.stroke(new Path2D(TEE_COLLAR));
  // fabric shading at the sides and hem
  ctx.save();
  ctx.clip(body);
  ctx.globalCompositeOperation = "multiply";
  const side = ctx.createLinearGradient(92, 0, 308, 0);
  const a = color === "black" ? 0.45 : 0.16;
  side.addColorStop(0, `rgba(0,0,0,${a})`);
  side.addColorStop(0.22, "rgba(0,0,0,0)");
  side.addColorStop(0.78, "rgba(0,0,0,0)");
  side.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 400, 460);
  const hem = ctx.createLinearGradient(0, 340, 0, 440);
  hem.addColorStop(0, "rgba(0,0,0,0)");
  hem.addColorStop(1, `rgba(0,0,0,${a * 0.7})`);
  ctx.fillStyle = hem;
  ctx.fillRect(0, 0, 400, 460);
  ctx.restore();
  ctx.restore();
  return TEE_VIEW.h * s;
}

/** Sets the largest font (≤ max) at which `text` fits `maxW`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number, weight: number, family = FONT) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  } while (size > 12);
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The MONO wordmark in its box, centred at (cx, y top). */
function logo(ctx: CanvasRenderingContext2D, cx: number, y: number, scale: number) {
  ctx.save();
  ctx.font = `800 ${34 * scale}px ${FONT}`;
  const letters = "MONO";
  const spacing = 8 * scale;
  const tw = [...letters].reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (letters.length - 1);
  const bw = tw + 44 * scale;
  const bh = 62 * scale;
  roundRect(ctx, cx - bw / 2, y, bw, bh, 12 * scale);
  ctx.lineWidth = 3 * scale;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  let x = cx - tw / 2;
  for (const ch of letters) {
    ctx.fillText(ch, x, y + bh / 2 + 1);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.restore();
}

export async function renderShareImage(shirt: ShirtProduct, color: BaseColor, format: ShareFormat): Promise<Blob> {
  const { w, h } = SHARE_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const print = await loadPrintImage(shirt, color);
  const story = format === "story";

  // stage background: soft spotlight on near-black
  const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.75);
  bg.addColorStop(0, "#2a2a2a");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  logo(ctx, w / 2, story ? 120 : 52, story ? 1.3 : 0.95);

  const teeW = story ? 840 : 560;
  const teeTop = story ? 290 : 150;
  const teeH = drawTee(ctx, (w - teeW) / 2, teeTop, teeW, color, print);

  // design name + details
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = teeTop + teeH + (story ? 95 : 40);
  if (!story) y = Math.min(y, h - 150);
  fitFont(ctx, shirt.title, w - 120, story ? 84 : 58, 800);
  ctx.fillText(shirt.title, w / 2, y);
  y += story ? 70 : 48;
  const meta = `${CATEGORY_LABELS[shirt.category]}  ·  ${COLOR_LABELS[color]} tee  ·  ${formatPrice(shirt.price)}`;
  fitFont(ctx, meta, w - 120, story ? 40 : 30, 500);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(meta, w / 2, y);

  // call to action + site
  const host = siteRoot().replace(/^https?:\/\//, "");
  if (story) {
    y = h - 230;
    const cta = "Swipe to find your taste →";
    fitFont(ctx, cta, w - 280, 44, 700);
    const cw = ctx.measureText(cta).width + 110;
    roundRect(ctx, (w - cw) / 2, y - 62, cw, 96, 48);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.fillText(cta, w / 2, y);
    y += 110;
  } else {
    y = h - 44;
  }
  fitFont(ctx, host, w - 120, story ? 36 : 26, 500, MONO_FONT);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(host, w / 2, y);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png"));
}
