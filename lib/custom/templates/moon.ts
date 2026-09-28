/**
 * The moon's phase for every day of a year, month by month, at 00:00 UTC.
 * Drawn as seen from the north (waxing lit on the right); from the south the
 * lit side is the other one, so every moon is mirrored.
 */
import { moonPhase } from "../astro";
import { INK, caption, circle, dot, f1, julian, shortMonth, text } from "../kit";

/** The lit part of a small moon (as seen from the north: waxing lit on the right; `south` mirrors it). */
export function moonShape(cx: number, cy: number, r: number, k: number, waxing: boolean, south = false): string {
  const s = circle(cx, cy, r, 0.45);
  if (k < 0.03) return s;
  if (k > 0.97) return s + dot(cx, cy, r);
  const rx = Math.abs(1 - 2 * k) * r;
  const top = `${f1(cx)} ${f1(cy - r)}`, bottom = `${f1(cx)} ${f1(cy + r)}`;
  // Seen from the south the lit side swaps: the same shape as a waning (waxing) moon from the north.
  const right = waxing !== south;
  const d = right
    ? `M${top}A${f1(r)} ${f1(r)} 0 0 1 ${bottom}A${f1(rx)} ${f1(r)} 0 0 ${k > 0.5 ? 1 : 0} ${top}Z`
    : `M${top}A${f1(r)} ${f1(r)} 0 0 0 ${bottom}A${f1(rx)} ${f1(r)} 0 0 ${k > 0.5 ? 0 : 1} ${top}Z`;
  return s + `<path d="${d}" fill="${INK}"/>`;
}

export interface MoonInput {
  year: number;
  south?: boolean;
}

/** The year's calendar of moons and its caption: the print's body (white ink, unwrapped). */
export function moonBody({ year, south = false }: MoonInput): string {
  let body = "";
  const X = 42, DX = 7.6, Y = 62, DY = 19.5, R = 3.4;
  for (const d of [1, 5, 10, 15, 20, 25, 30]) body += text(X + (d - 1) * DX, Y - 10, String(d), 5.5);
  for (let mo = 1; mo <= 12; mo++) {
    const y = Y + (mo - 1) * DY;
    body += text(X - 12, y + 2, shortMonth(mo), 6, { anchor: "end" });
    const days = new Date(Date.UTC(year, mo, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const { k, waxing } = moonPhase(julian(year, mo, d, 0, 0));
      body += moonShape(X + (d - 1) * DX, y, R, k, waxing, south);
    }
  }
  body += caption(318, `Moon ${year}`, "Every day at 00:00 UTC", south ? "Waxing lit on the left, as seen from the south" : "Waxing lit on the right, as seen from the north");
  return body;
}
