/**
 * Your Telegram: a telegram form in the terminal's monospace. A double frame,
 * TELEGRAM across the top, the form's rows (to, from, the date, the words
 * charged), and the message in capitals on strips pasted one under another,
 * each as long as its line, the full stops printed as STOP.
 */
import { CAP, STROKE, caption, captionLines, clip, f1, fitSize, line, longDate, rect, shortMonth, text, textWidth, type Lines, house } from "../kit";
import { dayNumber, parseDate } from "../specKit";
import { STRIP_PITCH, telegramFit, telegramWords, type Params } from "../specs/telegram";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const X0 = 26, X1 = 274, Y0 = 26, Y1 = 318;
const LABEL = 6.5, VALUE = 10;

/** The words charged: every word of the message as set, STOP included. */
const charged = (m: string) => telegramWords(m).split(" ").length;

/** The caption's lines (ours): who it's for, the words charged and the day, the house rule. */
export function telegramCaption(p: Params): Lines {
  const date = p.d ? parseDate(p.d) : null;
  const n = charged(p.m);
  return [`For ${p.to}`, `${n} ${n === 1 ? "word" : "words"}${date ? ` · ${longDate(...date)}` : ""}`, "Every full stop charged as a word"];
}

export function telegramBody(p: Params): string {
  let s = rect(X0, Y0, X1 - X0, Y1 - Y0, STROKE.bold) + rect(X0 + 4, Y0 + 4, X1 - X0 - 8, Y1 - Y0 - 8, STROKE.hairline);
  // The head: the form's number from the day, the word in the wire office's condensed capitals, its class.
  const no = p.d ? String(dayNumber(p.d) % 10000).padStart(4, "0") : "----";
  const tr = LABEL * 0.12;
  s += text(X0 + 12, Y0 + 16, `NO. ${no}`, LABEL, { anchor: "start", spacing: tr }) + text(X1 - 12, Y0 + 16, "ORDINARY", LABEL, { anchor: "end", spacing: tr });
  const head = 28;
  s += text(150 + head * 0.03, Y0 + 38 + (CAP.condensed * head) / 2, "TELEGRAM", head, { family: "condensed", bold: true, spacing: head * 0.06 });
  s += line(X0 + 12, Y0 + 62, X1 - 12, Y0 + 62, STROKE.regular) + line(X0 + 12, Y0 + 65, X1 - 12, Y0 + 65, STROKE.hairline);
  // The rows: a label, the value on a rule.
  const date = p.d ? parseDate(p.d) : null;
  const rows: [string, string, number][] = [
    ["TO", p.to.toUpperCase(), X1 - 12],
    ["FROM", (p.fr ?? "").toUpperCase(), X1 - 12],
    ["DATE", date ? `${date[2]} ${shortMonth(date[1])} ${date[0]}` : "", 176],
  ];
  rows.forEach(([k, v, end], i) => {
    const y = Y0 + 86 + i * 20;
    s += text(X0 + 12, y, k, LABEL, { anchor: "start", bold: true, spacing: tr }) + line(X0 + 50, y + 3, end, y + 3, STROKE.hairline);
    // Set at its size, or smaller when (in capitals) it would run past its rule; cut at the floor.
    if (v) {
      const w = end - X0 - 56;
      const size = fitSize(v, w, VALUE, { floor: 6 });
      s += text(X0 + 54, y, clip(v, w, size), size, { anchor: "start" });
    }
  });
  const n = charged(p.m);
  const wy = Y0 + 126;
  s += text(186, wy, "WORDS", LABEL, { anchor: "start", bold: true, spacing: tr }) + line(214, wy + 3, X1 - 12, wy + 3, STROKE.hairline) + text(X1 - 14, wy, String(n), VALUE, { anchor: "end" });
  s += line(X0 + 12, Y0 + 140, X1 - 12, Y0 + 140, STROKE.fine);

  // The message: one strip a line, each as long as its words, pasted from the top.
  const fit = telegramFit(p.m)!;
  const pitch = fit.size * STRIP_PITCH;
  // Pasted from the top of the box, the block centred in it when it is short (never above the box's top).
  const used = fit.lines.length * pitch - (pitch - fit.size * 1.55);
  const top = Y0 + 147 + Math.max(0, (Y1 - 26 - (Y0 + 147) - used) / 2);
  // The block centred on the widest strip, its strips flush left as pasted.
  const widest = Math.max(...fit.lines.map((l) => textWidth(l, fit.size)));
  const x = 150 - widest / 2;
  fit.lines.forEach((l, i) => {
    const y = top + i * pitch;
    const w = textWidth(l, fit.size) + fit.size * 1.1;
    s += rect(x - fit.size * 0.55, y, w, fit.size * 1.55, STROKE.hairline) + text(x, y + fit.size * 1.1, l, fit.size, { anchor: "start" });
  });
  // The foot.
  s += line(X0 + 12, Y1 - 22, X1 - 12, Y1 - 22, STROKE.hairline);
  s += text(X0 + 12, Y1 - 11, "PLEASE WRITE PLAINLY", LABEL, { anchor: "start", spacing: tr }) + text(X1 - 12, Y1 - 11, `${f1(n)} AT ONE RATE`, LABEL, { anchor: "end", spacing: tr });
  return s + caption(344, ...captionLines(telegramCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => telegramCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(telegramBody((spec as { p: Params }).p), color));
