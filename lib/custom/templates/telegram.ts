/**
 * Your Telegram: a telegram form in the terminal's monospace. A double frame,
 * TELEGRAM across the top, the form's rows (to, from, the date, the words
 * charged), and the message in capitals on strips pasted one under another,
 * each as long as its line, the full stops printed as STOP.
 */
import { caption, captionLines, f1, line, longDate, rect, shortMonth, text, textWidth, type Lines } from "../kit";
import { dayNumber, parseDate } from "../specKit";
import { STRIPS, STRIP_PITCH, telegramFit, telegramWords, type Params } from "../specs/telegram";
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
  let s = rect(X0, Y0, X1 - X0, Y1 - Y0, 1.3) + rect(X0 + 4, Y0 + 4, X1 - X0 - 8, Y1 - Y0 - 8, 0.5);
  // The head: the form's number from the day, the word, its class.
  const no = p.d ? String(dayNumber(p.d) % 10000).padStart(4, "0") : "----";
  s += text(X0 + 12, Y0 + 20, `No. ${no}`, LABEL, { anchor: "start" }) + text(X1 - 12, Y0 + 20, "ORDINARY", LABEL, { anchor: "end" });
  s += text(150, Y0 + 50, "TELEGRAM", 26, { bold: true, spacing: 6 });
  s += line(X0 + 12, Y0 + 62, X1 - 12, Y0 + 62, 1) + line(X0 + 12, Y0 + 65, X1 - 12, Y0 + 65, 0.4);
  // The rows: a label, the value on a rule.
  const date = p.d ? parseDate(p.d) : null;
  const rows: [string, string, number][] = [
    ["TO", p.to.toUpperCase(), X1 - 12],
    ["FROM", (p.fr ?? "").toUpperCase(), X1 - 12],
    ["DATE", date ? `${date[2]} ${shortMonth(date[1])} ${date[0]}` : "", 176],
  ];
  rows.forEach(([k, v, end], i) => {
    const y = Y0 + 86 + i * 20;
    s += text(X0 + 12, y, k, LABEL, { anchor: "start", bold: true }) + line(X0 + 50, y + 3, end, y + 3, 0.5);
    // Set at its size, or smaller when (in capitals) it would run past its rule.
    if (v) s += text(X0 + 54, y, v, Math.min(VALUE, Math.floor(((end - X0 - 56) / textWidth(v, 1)) * 10) / 10), { anchor: "start" });
  });
  const n = charged(p.m);
  const wy = Y0 + 126;
  s += text(186, wy, "WORDS", LABEL, { anchor: "start", bold: true }) + line(214, wy + 3, X1 - 12, wy + 3, 0.5) + text(X1 - 14, wy, String(n), VALUE, { anchor: "end" });
  s += line(X0 + 12, Y0 + 140, X1 - 12, Y0 + 140, 0.8);

  // The message: one strip a line, each as long as its words, pasted from the top.
  const fit = telegramFit(p.m)!;
  const pitch = fit.size * STRIP_PITCH;
  const top = Y0 + 150;
  const x = 150 - STRIPS.w / 2;
  fit.lines.forEach((l, i) => {
    const y = top + i * pitch;
    const w = textWidth(l, fit.size) + fit.size * 1.1;
    s += rect(x - fit.size * 0.55, y, w, fit.size * 1.55, 0.6) + text(x, y + fit.size * 1.1, l, fit.size, { anchor: "start" });
  });
  // The foot.
  s += line(X0 + 12, Y1 - 26, X1 - 12, Y1 - 26, 0.4);
  s += text(X0 + 12, Y1 - 14, "PLEASE WRITE PLAINLY", LABEL, { anchor: "start" }) + text(X1 - 12, Y1 - 14, `${f1(n)} AT ONE RATE`, LABEL, { anchor: "end" });
  return s + caption(344, ...captionLines(telegramCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => telegramCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(telegramBody((spec as { p: Params }).p), color);
