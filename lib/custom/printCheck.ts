/**
 * Whether a customer's print may be sold, and if not, why, in one line. The
 * same gate as the catalogue (lib/custom/quality: not weak), read so the
 * reason says what to change: too much ink, too little, too narrow. Each product adds its own hint ("Try fewer repeats.").
 */
import { WEAK_QUALITY, assessPrint, type InkRaster } from "./quality";

export interface PrintHints {
  /** What to change when there's too much ink ("Try fewer repeats."). */
  dense?: string;
  /** What to change when there's too little ("Try a longer line."). */
  faint?: string;
}

export interface PrintCheck {
  ok: boolean;
  quality: number;
  /** One line for the customer, or null when it prints. */
  reason: string | null;
}

/** Above this share of ink a print reads as too dense (the quality score's own turning point). */
const DENSE = 0.32;
/** Below this, too faint (the quality score's full-marks floor). */
const FAINT = 0.04;

export function checkPrint(ink: InkRaster, hints: PrintHints = {}): PrintCheck {
  const a = assessPrint(ink);
  const ok = a.quality >= WEAK_QUALITY && a.flags.length === 0;
  if (ok) return { ok, quality: a.quality, reason: null };
  const say = (lead: string, hint?: string) => [lead, hint].filter(Boolean).join(" ");
  let reason: string;
  if (a.ink > DENSE) reason = say("Too much ink to print.", hints.dense);
  else if (a.ink < FAINT || a.flags.includes("flat")) reason = say("Too faint to print.", hints.faint);
  else if (a.flags.includes("sliver")) reason = say("Too narrow to print.", hints.faint);
  else reason = say("This one won’t print well.", hints.faint ?? hints.dense);
  return { ok, quality: a.quality, reason };
}
