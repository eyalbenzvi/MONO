/**
 * Share images drawn in the browser (canvas → PNG): the tee in the chosen
 * colourway — the same picture the site shows (lib/images: the model photo
 * with the print on it, made at build time) — the design name, and the site.
 * Two formats: "story" 1080×1920 (Instagram / TikTok / WhatsApp status) and
 * "square" 1080×1080 (feeds and chats).
 */
import { MODEL_ASPECT, mockupPath, pictureUrl } from "@/lib/images";
import { siteRoot } from "@/lib/share";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";

export type ShareFormat = "story" | "square";
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const FONT = `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
const MONO_FONT = `ui-monospace, "SF Mono", Menlo, "Courier New", monospace`;

/** The tee as the site shows it, in `color`, at the largest size made. */
export async function loadMockup(shirt: ShirtProduct, color: BaseColor): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = pictureUrl(shirt, mockupPath(shirt, color, 1080));
  await img.decode();
  return img;
}

/** Draws the picture `w` px wide with rounded corners, top-left at (x, y). Returns its height. */
function drawTee(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, img: CanvasImageSource) {
  const h = w / MODEL_ASPECT;
  ctx.save();
  roundRect(ctx, x, y, w, h, w * 0.05);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return h;
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

/** `tee` is the picture when it isn't the baked one (a made-for-you print, drawn in the browser). No price: prices are shown only where money changes hands. */
export async function renderShareImage(shirt: ShirtProduct, color: BaseColor, format: ShareFormat, { tee: drawn }: { tee?: Promise<CanvasImageSource> } = {}): Promise<Blob> {
  const { w, h } = SHARE_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const tee = await (drawn ?? loadMockup(shirt, color));
  const story = format === "story";

  // stage background: soft spotlight on near-black
  const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * 0.75);
  bg.addColorStop(0, "#2a2a2a");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  logo(ctx, w / 2, story ? 120 : 52, story ? 1.3 : 0.95);

  const teeW = story ? 700 : 440;
  const teeTop = story ? 290 : 140;
  const teeH = drawTee(ctx, (w - teeW) / 2, teeTop, teeW, tee);

  // design name + details
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = teeTop + teeH + (story ? 95 : 40);
  if (!story) y = Math.min(y, h - 150);
  fitFont(ctx, shirt.title, w - 120, story ? 84 : 58, 800);
  ctx.fillText(shirt.title, w / 2, y);
  y += story ? 70 : 48;
  const meta = `${CATEGORY_LABELS[shirt.category]}  ·  ${COLOR_LABELS[color]} tee`;
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

/**
 * "My taste" card, 1080×1920 black and white: the archetype name, the three
 * strongest traits and three top matches (each on its own tee colour).
 */
export async function renderTasteImage(name: string, traits: string[], picks: ShirtProduct[]): Promise<Blob> {
  const { w, h } = SHARE_SIZES.story;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const tees = await Promise.all(picks.slice(0, 3).map((s) => loadMockup(s, s.baseColor)));

  const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, h * 0.75);
  bg.addColorStop(0, "#2a2a2a");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  logo(ctx, w / 2, 120, 1.3);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  fitFont(ctx, "MY TASTE IN TEES", w - 200, 38, 600, MONO_FONT);
  ctx.fillText("MY TASTE IN TEES", w / 2, 330);
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, name, w - 140, 112, 800);
  ctx.fillText(name, w / 2, 460);

  // traits as outlined pills
  ctx.font = `600 40px ${FONT}`;
  const pad = 36;
  const gap = 20;
  const widths = traits.map((t) => ctx.measureText(t).width + pad * 2);
  let x = (w - (widths.reduce((a, b) => a + b, 0) + gap * (traits.length - 1))) / 2;
  traits.forEach((t, i) => {
    roundRect(ctx, x, 540, widths[i], 84, 42);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillText(t, x + widths[i] / 2, 596);
    x += widths[i] + gap;
  });

  // three matches, side by side
  const teeW = 320;
  const colGap = 20;
  const x0 = (w - (teeW * 3 + colGap * 2)) / 2;
  tees.forEach((t, i) => drawTee(ctx, x0 + i * (teeW + colGap), 740, teeW, t));
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 34px ${FONT}`;
  picks.slice(0, 3).forEach((s, i) => {
    fitFont(ctx, s.title, teeW - 10, 34, 500);
    ctx.fillText(s.title, x0 + i * (teeW + colGap) + teeW / 2, 1250);
  });

  const cta = "What’s yours? Swipe 10 tees →";
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, cta, w - 280, 44, 700);
  const cw = ctx.measureText(cta).width + 110;
  roundRect(ctx, (w - cw) / 2, h - 292, cw, 96, 48);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.fillText(cta, w / 2, h - 230);
  const host = siteRoot().replace(/^https?:\/\//, "");
  fitFont(ctx, host, w - 120, 36, 500, MONO_FONT);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(host, w / 2, h - 120);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png"));
}
